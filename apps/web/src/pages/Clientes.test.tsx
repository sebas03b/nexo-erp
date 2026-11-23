import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Clientes } from './Clientes';

const CLIENTE = {
  id: '33333333-3333-4333-8333-333333333333',
  nombre: 'Ana González',
  documento: '12345678',
  email: 'ana@example.com',
  telefono: '3001112233',
  canalPreferido: 'whatsapp',
};

const CLIENTE_SEGUNDO = {
  id: '44444444-4444-4444-8444-444444444444',
  nombre: 'Carlos Ramírez',
  documento: '87654321',
  email: 'carlos@example.com',
  telefono: '3002223344',
  canalPreferido: 'email',
};

function respuestaJson(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function urlDe(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  return input.url;
}

interface RespuestaDiferida {
  promise: Promise<Response>;
  resolver: (respuesta: Response) => void;
}

function respuestaDiferida(): RespuestaDiferida {
  let resolver: ((respuesta: Response) => void) | undefined;
  const promise = new Promise<Response>((resolve) => {
    resolver = resolve;
  });

  return {
    promise,
    resolver: (respuesta) => resolver?.(respuesta),
  };
}

describe('Selector de canal de Clientes', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('muestra el canal preferido de la respuesta de la API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(respuestaJson([CLIENTE]))),
    );

    render(<Clientes />);

    const selector = await screen.findByLabelText(
      'Canal preferido de Ana González',
    );
    expect(selector).toHaveValue('whatsapp');
  });

  it('envía PATCH y refleja el canal confirmado por la API', async () => {
    const fetchMock = vi.fn(
      (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = urlDe(input);

        if (url === '/api/clientes') {
          return Promise.resolve(respuestaJson([CLIENTE]));
        }

        if (url === `/api/clientes/${CLIENTE.id}` && init?.method === 'PATCH') {
          return Promise.resolve(
            respuestaJson({
              ...CLIENTE,
              canalPreferido: 'email',
            }),
          );
        }

        return Promise.resolve(
          respuestaJson({ error: { message: 'No encontrado' } }, 404),
        );
      },
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<Clientes />);

    const selector = await screen.findByLabelText(
      'Canal preferido de Ana González',
    );
    fireEvent.change(selector, { target: { value: 'sms' } });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(`/api/clientes/${CLIENTE.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canalPreferido: 'sms' }),
      });
    });
    await waitFor(() => expect(selector).toHaveValue('email'));
    expect(
      fetchMock.mock.calls.filter(([url]) => url === '/api/clientes'),
    ).toHaveLength(1);
  });

  it('mantiene cada selector deshabilitado durante su propio PATCH', async () => {
    const primeraRespuesta = respuestaDiferida();
    const segundaRespuesta = respuestaDiferida();
    const fetchMock = vi.fn(
      (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = urlDe(input);

        if (url === '/api/clientes') {
          return Promise.resolve(respuestaJson([CLIENTE, CLIENTE_SEGUNDO]));
        }

        if (url === `/api/clientes/${CLIENTE.id}` && init?.method === 'PATCH') {
          return primeraRespuesta.promise;
        }

        if (
          url === `/api/clientes/${CLIENTE_SEGUNDO.id}` &&
          init?.method === 'PATCH'
        ) {
          return segundaRespuesta.promise;
        }

        return Promise.resolve(respuestaJson([], 404));
      },
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<Clientes />);

    const primerSelector = await screen.findByLabelText(
      'Canal preferido de Ana González',
    );
    const segundoSelector = await screen.findByLabelText(
      'Canal preferido de Carlos Ramírez',
    );

    fireEvent.change(primerSelector, { target: { value: 'sms' } });
    await waitFor(() => expect(primerSelector).toBeDisabled());

    fireEvent.change(segundoSelector, { target: { value: 'whatsapp' } });
    await waitFor(() => expect(segundoSelector).toBeDisabled());

    expect(primerSelector).toBeDisabled();
    expect(segundoSelector).toBeDisabled();

    primeraRespuesta.resolver(
      respuestaJson({ ...CLIENTE, canalPreferido: 'sms' }),
    );
    await waitFor(() => expect(primerSelector).toBeEnabled());
    expect(segundoSelector).toBeDisabled();

    segundaRespuesta.resolver(
      respuestaJson({ ...CLIENTE_SEGUNDO, canalPreferido: 'whatsapp' }),
    );
    await waitFor(() => expect(segundoSelector).toBeEnabled());
  });

  it('muestra el error y conserva el canal anterior si falla el PATCH', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = urlDe(input);

        if (url === '/api/clientes') {
          return Promise.resolve(respuestaJson([CLIENTE]));
        }

        if (init?.method === 'PATCH') {
          return Promise.resolve(
            respuestaJson(
              { error: { message: 'No se pudo guardar el canal' } },
              409,
            ),
          );
        }

        return Promise.resolve(respuestaJson([]));
      }),
    );

    render(<Clientes />);

    const selector = await screen.findByLabelText(
      'Canal preferido de Ana González',
    );
    fireEvent.change(selector, { target: { value: 'email' } });

    expect(
      await screen.findByText('No se pudo guardar el canal'),
    ).toBeInTheDocument();
    expect(selector).toHaveValue('whatsapp');
  });

  it('deshabilita el selector mientras guarda el canal', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = urlDe(input);

        if (url === '/api/clientes') {
          return Promise.resolve(respuestaJson([CLIENTE]));
        }

        if (init?.method === 'PATCH') {
          return new Promise<Response>(() => {});
        }

        return Promise.resolve(respuestaJson([]));
      }),
    );

    render(<Clientes />);

    const selector = await screen.findByLabelText(
      'Canal preferido de Ana González',
    );
    fireEvent.change(selector, { target: { value: 'sms' } });

    await waitFor(() => expect(selector).toBeDisabled());
  });
});

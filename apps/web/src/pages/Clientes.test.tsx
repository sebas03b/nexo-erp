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

function cuerpoJson(init?: RequestInit): Record<string, unknown> | null {
  if (typeof init?.body !== 'string') {
    return null;
  }

  const cuerpo: unknown = JSON.parse(init.body);
  return typeof cuerpo === 'object' && cuerpo !== null && !Array.isArray(cuerpo)
    ? (cuerpo as Record<string, unknown>)
    : null;
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

  it('envía PATCH y actualiza el canal local sin recargar clientes', async () => {
    const fetchMock = vi.fn(
      (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = urlDe(input);

        if (url === '/api/clientes') {
          return Promise.resolve(respuestaJson([CLIENTE]));
        }

        if (url === `/api/clientes/${CLIENTE.id}` && init?.method === 'PATCH') {
          const cuerpo = cuerpoJson(init);
          return Promise.resolve(
            respuestaJson({
              ...CLIENTE,
              canalPreferido: cuerpo?.canalPreferido,
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
    await waitFor(() => expect(selector).toHaveValue('sms'));
    expect(
      fetchMock.mock.calls.filter(([url]) => url === '/api/clientes'),
    ).toHaveLength(1);
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

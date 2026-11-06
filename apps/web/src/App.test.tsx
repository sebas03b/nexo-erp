import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';

const producto = {
  id: 'producto-1',
  sku: 'SKU-001',
  nombre: 'Café de prueba',
  precio: 100,
  tipo: 'producto',
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

function instalarFetch(): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(
    (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = urlDe(input);

      if (url === '/api/productos') {
        return Promise.resolve(respuestaJson([producto]));
      }

      if (url === '/api/stock') {
        return Promise.resolve(respuestaJson([{ productoId: producto.id, cantidad: 4 }]));
      }

      if (url === '/api/pedidos' && init?.method === 'POST') {
        return Promise.resolve(
          respuestaJson({ id: 'pedido-1', estado: 'Borrador', total: 200 }, 201),
        );
      }

      return Promise.resolve(respuestaJson({ error: { message: 'No encontrado' } }, 404));
    },
  );

  vi.stubGlobal('fetch', fetchMock);

  return fetchMock;
}

describe('App', () => {
  beforeEach(() => {
    instalarFetch();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('muestra la identidad de Nexo-ERP', () => {
    render(<App />);

    expect(screen.getByRole('heading', { level: 1, name: 'Nexo-ERP' })).toBeInTheDocument();
  });

  it('lista los productos con su stock disponible', async () => {
    render(<App />);

    expect(await screen.findByText('Café de prueba')).toBeInTheDocument();
    expect(screen.getByText('SKU-001')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('envía la creación de un pedido con las cantidades seleccionadas', async () => {
    const fetchMock = instalarFetch();

    render(<App />);

    await screen.findByText('Café de prueba');

    fireEvent.change(screen.getByLabelText('Cliente'), {
      target: { value: '11111111-1111-4111-8111-111111111111' },
    });
    fireEvent.change(screen.getByLabelText('Cantidad para Café de prueba'), {
      target: { value: '2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Crear pedido' }));

    const estado = await screen.findByRole('status');

    expect(estado).toHaveTextContent(
      'Pedido pedido-1 creado en estado Borrador',
    );
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/pedidos',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

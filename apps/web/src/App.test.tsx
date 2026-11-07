import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';

const PRODUCTO_ID = '11111111-1111-4111-8111-111111111111';

const producto = {
  id: PRODUCTO_ID,
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

      if (url === '/api/pedidos/pedido-1/emitir' && init?.method === 'POST') {
        return Promise.resolve(
          respuestaJson({ id: 'pedido-1', estado: 'Emitido', total: 200 }),
        );
      }

      if (url === '/api/pedidos/pedido-1/pagar' && init?.method === 'POST') {
        return Promise.resolve(
          respuestaJson({ id: 'pedido-1', estado: 'Pagado', total: 200 }),
        );
      }

      return Promise.resolve(respuestaJson({ error: { message: 'No encontrado' } }, 404));
    },
  );

  vi.stubGlobal('fetch', fetchMock);

  return fetchMock;
}

async function crearPedido(): Promise<void> {
  render(<App />);

  await screen.findByText('Café de prueba');

  fireEvent.change(screen.getByLabelText('Documento del Cliente'), {
    target: { value: 'CC-123456' },
  });
  fireEvent.change(screen.getByLabelText('Cantidad para Café de prueba'), {
    target: { value: '2' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Crear pedido' }));

  await screen.findByRole('status');
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

    fireEvent.change(screen.getByLabelText('Documento del Cliente'), {
      target: { value: '  CC-123456  ' },
    });
    fireEvent.change(screen.getByLabelText('Cantidad para Café de prueba'), {
      target: { value: '2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Crear pedido' }));

    const estado = await screen.findByRole('status');

    expect(estado).toHaveTextContent(
      'Pedido pedido-1 creado en estado Borrador',
    );
    expect(fetchMock).toHaveBeenCalledWith('/api/pedidos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentoCliente: 'CC-123456',
        items: [{ productoId: producto.id, cantidad: 2 }],
      }),
    });
  });

  it('paga en efectivo emitiendo primero el pedido y enviando el monto recibido', async () => {
    const fetchMock = instalarFetch();

    await crearPedido();

    fireEvent.click(screen.getByRole('button', { name: 'Pagar' }));

    expect(await screen.findByRole('dialog', { name: 'Pagar pedido' })).toBeInTheDocument();
    expect(screen.getByLabelText('Monto recibido')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Monto recibido'), {
      target: { value: '250' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar pago' }));

    expect(
      await screen.findByText(/pagado con Efectivo por/),
    ).toBeInTheDocument();
    expect(screen.getByText('Pagado')).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledWith('/api/pedidos/pedido-1/emitir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/pedidos/pedido-1/pagar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metodoPago: 'efectivo', montoRecibido: 250 }),
    });
  });

  it('paga por pasarela sin solicitar monto recibido', async () => {
    const fetchMock = instalarFetch();

    await crearPedido();

    fireEvent.click(screen.getByRole('button', { name: 'Pagar' }));
    await screen.findByRole('dialog', { name: 'Pagar pedido' });

    fireEvent.click(screen.getByLabelText('Pasarela'));

    expect(screen.queryByLabelText('Monto recibido')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar pago' }));

    expect(
      await screen.findByText(/pagado con Pasarela por/),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/pedidos/pedido-1/pagar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metodoPago: 'pasarela' }),
    });
  });

  it('no envía el pago si el efectivo recibido no cubre el total', async () => {
    const fetchMock = instalarFetch();

    await crearPedido();

    fireEvent.click(screen.getByRole('button', { name: 'Pagar' }));
    await screen.findByRole('dialog', { name: 'Pagar pedido' });

    fireEvent.change(screen.getByLabelText('Monto recibido'), {
      target: { value: '50' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar pago' }));

    expect(
      await screen.findByText('El monto recibido no cubre el total del pedido.'),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/pedidos/pedido-1/pagar',
      expect.anything(),
    );
  });
});

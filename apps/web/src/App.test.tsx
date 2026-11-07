import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';

const PRODUCTO_ID = '11111111-1111-4111-8111-111111111111';
const PEDIDO_ID = '22222222-2222-4222-8222-222222222222';
const CLIENTE_ID = '33333333-3333-4333-8333-333333333333';

const producto = {
  id: PRODUCTO_ID,
  sku: 'SKU-001',
  nombre: 'Café de prueba',
  precio: 100,
  tipo: 'producto',
};

const pedidoPagado = {
  id: PEDIDO_ID,
  clienteId: CLIENTE_ID,
  estado: 'Pagado',
  subtotal: 200,
  descuento: 0,
  impuesto: 0,
  total: 200,
  items: [{ productoId: PRODUCTO_ID, cantidad: 2, precioUnitario: 100 }],
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
          respuestaJson({ ...pedidoPagado, estado: 'Borrador', total: 100 }, 201),
        );
      }

      if (url === '/api/pedidos') {
        return Promise.resolve(respuestaJson([pedidoPagado]));
      }

      if (url === `/api/pedidos/${PEDIDO_ID}/emitir` && init?.method === 'POST') {
        return Promise.resolve(
          respuestaJson({ ...pedidoPagado, estado: 'Emitido', total: 100 }),
        );
      }

      if (url === `/api/pedidos/${PEDIDO_ID}/pagar` && init?.method === 'POST') {
        return Promise.resolve(
          respuestaJson({ ...pedidoPagado, estado: 'Pagado', total: 100 }),
        );
      }

      return Promise.resolve(respuestaJson({ error: { message: 'No encontrado' } }, 404));
    },
  );

  vi.stubGlobal('fetch', fetchMock);

  return fetchMock;
}

async function abrirNuevaVenta(): Promise<void> {
  render(<App />);

  fireEvent.click(await screen.findByRole('button', { name: 'Nueva Venta' }));

  expect(
    await screen.findByRole('heading', { level: 2, name: 'Nueva venta' }),
  ).toBeInTheDocument();
  await screen.findByText('Café de prueba');
}

describe('App', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
    instalarFetch();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('muestra la identidad de Nexo-ERP', () => {
    render(<App />);

    expect(screen.getByRole('heading', { level: 1, name: 'Nexo-ERP' })).toBeInTheDocument();
  });

  it('muestra el historial de ventas con el estado y total de cada pedido', async () => {
    render(<App />);

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Historial de ventas' }),
    ).toBeInTheDocument();
    expect(await screen.findByText(PEDIDO_ID)).toBeInTheDocument();
    expect(screen.getByText(CLIENTE_ID)).toBeInTheDocument();
    expect(screen.getByText('Pagado')).toBeInTheDocument();
    const tabla = screen.getByRole('table');
    expect(within(tabla).getByText(/200/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nueva Venta' })).toBeInTheDocument();
  });

  it('abre el POS de dos columnas con el catálogo y su stock', async () => {
    await abrirNuevaVenta();

    const catalogo = screen.getByRole('region', { name: 'Catálogo' });
    const carrito = screen.getByRole('region', { name: 'Carrito' });

    expect(within(catalogo).getByText('SKU-001')).toBeInTheDocument();
    expect(within(catalogo).getByText('Café de prueba')).toBeInTheDocument();
    expect(within(catalogo).getByText('4')).toBeInTheDocument();
    expect(within(carrito).getByText('Agrega productos desde el catálogo.')).toBeInTheDocument();
  });

  it('agrega productos al carrito, recalcula subtotales y permite eliminarlos', async () => {
    await abrirNuevaVenta();

    const catalogo = screen.getByRole('region', { name: 'Catálogo' });
    const carrito = screen.getByRole('region', { name: 'Carrito' });

    fireEvent.click(within(catalogo).getByRole('button', { name: 'Agregar' }));

    const cantidad = within(carrito).getByLabelText('Cantidad de Café de prueba');
    expect(cantidad).toHaveValue(1);

    const subtotalLinea = carrito.querySelector('.pos-linea-subtotal');
    const totalVenta = carrito.querySelector('.pos-total dd');
    expect(subtotalLinea).toHaveTextContent('100');
    expect(totalVenta).toHaveTextContent('100');

    fireEvent.change(cantidad, { target: { value: '2' } });

    expect(cantidad).toHaveValue(2);
    expect(subtotalLinea).toHaveTextContent('200');
    expect(totalVenta).toHaveTextContent('200');

    fireEvent.click(
      within(carrito).getByRole('button', { name: 'Eliminar Café de prueba' }),
    );

    expect(within(carrito).queryByText('Café de prueba')).not.toBeInTheDocument();
    expect(within(carrito).getByText('Agrega productos desde el catálogo.')).toBeInTheDocument();
  });

  it('procesa la venta con el flujo crear, emitir y pagar usando los UUID correctos', async () => {
    const fetchMock = instalarFetch();

    await abrirNuevaVenta();

    const catalogo = screen.getByRole('region', { name: 'Catálogo' });
    const carrito = screen.getByRole('region', { name: 'Carrito' });

    fireEvent.click(within(catalogo).getByRole('button', { name: 'Agregar' }));
    fireEvent.change(within(carrito).getByLabelText('Cantidad de Café de prueba'), {
      target: { value: '2' },
    });
    fireEvent.change(screen.getByLabelText('Documento del cliente'), {
      target: { value: '  CC-123456  ' },
    });
    fireEvent.change(screen.getByLabelText('Método de pago'), {
      target: { value: 'pasarela' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Procesar pago' }));

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Historial de ventas' }),
    ).toBeInTheDocument();
    expect(await screen.findByRole('status')).toHaveTextContent(
      new RegExp(`Venta ${PEDIDO_ID} pagada con Pasarela por`),
    );

    expect(fetchMock).toHaveBeenCalledWith('/api/pedidos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentoCliente: 'CC-123456',
        items: [{ productoId: PRODUCTO_ID, cantidad: 2 }],
      }),
    });
    expect(fetchMock).toHaveBeenCalledWith(`/api/pedidos/${PEDIDO_ID}/emitir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(fetchMock).toHaveBeenCalledWith(`/api/pedidos/${PEDIDO_ID}/pagar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metodoPago: 'pasarela' }),
    });
  });

  it('no procesa la venta sin documento del cliente', async () => {
    const fetchMock = instalarFetch();

    await abrirNuevaVenta();

    const catalogo = screen.getByRole('region', { name: 'Catálogo' });

    fireEvent.click(within(catalogo).getByRole('button', { name: 'Agregar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Procesar pago' }));

    expect(
      await screen.findByText('Ingresa el documento del cliente.'),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/pedidos',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('navega entre Ventas, Productos y Clientes resaltando la pestaña activa', async () => {
    render(<App />);

    const enlaceVentas = await screen.findByRole('link', { name: 'Ventas' });
    expect(enlaceVentas).toHaveAttribute('aria-current', 'page');

    fireEvent.click(screen.getByRole('link', { name: 'Productos y Stock' }));

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Productos y Stock' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Productos y Stock' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    fireEvent.click(screen.getByRole('link', { name: 'Clientes' }));

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Clientes' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Clientes' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});

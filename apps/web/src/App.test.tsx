import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';

const PRODUCTO_ID = '11111111-1111-4111-8111-111111111111';
const PEDIDO_ID = '22222222-2222-4222-8222-222222222222';
const CLIENTE_ID = '33333333-3333-4333-8333-333333333333';
const CLIENTE_NOMBRE = 'Cliente de prueba';
const CLIENTE_DOCUMENTO = '123456789';
const PRODUCTO_NOMBRE = 'Café de prueba';

const producto = {
  id: PRODUCTO_ID,
  sku: 'SKU-001',
  nombre: PRODUCTO_NOMBRE,
  precio: 100,
  tipo: 'producto',
};

const pedidoPagado = {
  id: PEDIDO_ID,
  clienteId: CLIENTE_ID,
  clienteNombre: CLIENTE_NOMBRE,
  clienteDocumento: CLIENTE_DOCUMENTO,
  estado: 'Pagado',
  subtotal: 200,
  descuento: 0,
  impuesto: 0,
  total: 200,
  createdAt: '2026-11-08T01:05:00.000Z',
  items: [
    {
      productoId: PRODUCTO_ID,
      productoNombre: PRODUCTO_NOMBRE,
      cantidad: 2,
      precioUnitario: 100,
    },
  ],
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

function esObjetoRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function cuerpoJson(init?: RequestInit): Record<string, unknown> | null {
  if (typeof init?.body !== 'string') {
    return null;
  }

  const cuerpo: unknown = JSON.parse(init.body);
  return esObjetoRegistro(cuerpo) ? cuerpo : null;
}

const CLIENTES_POR_DEFECTO: Array<{
  id: string;
  nombre: string;
  documento: string;
  email: string | null;
  telefono: string | null;
  canalPreferido: string | null;
}> = [
  {
    id: 'cliente-1',
    nombre: 'Cliente Prueba',
    documento: '12345678',
    email: 'cliente@prueba.com',
    telefono: '3000000000',
    canalPreferido: 'whatsapp',
  },
  {
    id: 'cliente-2',
    nombre: 'Otro Cliente',
    documento: '87654321',
    email: null,
    telefono: null,
    canalPreferido: 'email',
  },
];

function instalarFetch(
  opciones: {
    pedidosConItems?: boolean;
    stockCantidad?: number;
    errorEliminarProducto?: boolean;
    errorEliminarPedido?: boolean;
    clientes?: Array<{
      id: string;
      nombre: string;
      documento: string;
      email: string | null;
      telefono: string | null;
      canalPreferido: string | null;
    }>;
  } = {},
): ReturnType<typeof vi.fn> {
  let pedidoEliminado = false;

  type ItemCarritoMock = { productoId: string; cantidad: number; precioUnitario: number };
  type CarritoMock = {
    id: string;
    estado: 'Abierto' | 'Cerrado' | 'Descartado';
    items: ItemCarritoMock[];
    subtotal: number;
    descuento: number;
    impuesto: number;
    total: number;
  };

  let carritoActual: CarritoMock | null = null;
  const historial: Array<{ tipo: string; payload: Record<string, unknown>; anterior: ItemCarritoMock | null; removido: ItemCarritoMock | null }> = [];

  function recalcular(carrito: CarritoMock): CarritoMock {
    const subtotal = carrito.items.reduce((acc, i) => acc + i.cantidad * i.precioUnitario, 0);
    const cantidadTotal = carrito.items.reduce((acc, i) => acc + i.cantidad, 0);
    const descuento = cantidadTotal >= 11 ? Math.round(subtotal * 0.1 * 100) / 100 : 0;
    const impuesto = 0;
    const total = Math.round((subtotal - descuento + impuesto) * 100) / 100;
    return { ...carrito, subtotal, descuento, impuesto, total };
  }

  const fetchMock = vi.fn(
    (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = urlDe(input);

      if (url === '/api/clientes') {
        return Promise.resolve(respuestaJson(opciones.clientes ?? CLIENTES_POR_DEFECTO));
      }

      if (url === '/api/productos') {
        return Promise.resolve(respuestaJson([producto]));
      }

      if (url === `/api/productos/${PRODUCTO_ID}` && init?.method === 'PUT') {
        return Promise.resolve(respuestaJson({ ...producto, nombre: 'Café actualizado', precio: 250 }));
      }

      if (url === `/api/productos/${PRODUCTO_ID}` && init?.method === 'DELETE') {
        if (opciones.errorEliminarProducto) {
          return Promise.resolve(
            respuestaJson({ error: { message: 'El producto está referenciado por otros registros' } }, 409),
          );
        }
        return Promise.resolve(respuestaJson({}, 204));
      }

      if (url === '/api/stock') {
        return Promise.resolve(
          respuestaJson([{ productoId: producto.id, cantidad: opciones.stockCantidad ?? 4 }]),
        );
      }

      if (url === `/api/stock/${PRODUCTO_ID}` && init?.method === 'PUT') {
        return Promise.resolve(respuestaJson({ productoId: PRODUCTO_ID, cantidad: 7 }));
      }

      if (url === '/api/carritos' && init?.method === 'POST') {
        carritoActual = recalcular({
          id: '44444444-4444-4444-8444-444444444444',
          estado: 'Abierto',
          items: [],
          subtotal: 0, descuento: 0, impuesto: 0, total: 0,
        });
        historial.length = 0;
        return Promise.resolve(respuestaJson(carritoActual, 201));
      }

      if (carritoActual && url === `/api/carritos/${carritoActual.id}` && (!init?.method || init?.method === 'GET')) {
        return Promise.resolve(respuestaJson(carritoActual));
      }

      if (carritoActual && url === `/api/carritos/${carritoActual.id}/comandos` && init?.method === 'POST') {
        const body = cuerpoJson(init);
        if (!body) return Promise.resolve(respuestaJson({ error: { message: 'Datos inválidos' } }, 400));
        const accion = typeof body.accion === 'string' ? body.accion : '';
        const payload = esObjetoRegistro(body.payload) ? body.payload : {};
        const productoId = String(payload.productoId);
        const cantidad = Number(payload.cantidad ?? 0);
        const existente = carritoActual.items.find((i) => i.productoId === productoId) ?? null;
        const anterior = existente ? { ...existente } : null;

        if (accion === 'AGREGAR_ITEM') {
          if (existente) existente.cantidad += cantidad;
          else carritoActual.items.push({ productoId, cantidad, precioUnitario: producto.precio });
          historial.push({ tipo: accion, payload, anterior, removido: null });
        } else if (accion === 'DECREMENTAR_ITEM') {
          if (existente) {
            existente.cantidad -= cantidad;
            if (existente.cantidad <= 0) carritoActual.items = carritoActual.items.filter((i) => i.productoId !== productoId);
          }
          historial.push({ tipo: accion, payload, anterior, removido: null });
        } else if (accion === 'QUITAR_ITEM') {
          carritoActual.items = carritoActual.items.filter((i) => i.productoId !== productoId);
          historial.push({ tipo: accion, payload, anterior: null, removido: anterior });
        } else if (accion === 'ESTABLECER_CANTIDAD') {
          if (existente) {
            if (cantidad <= 0) carritoActual.items = carritoActual.items.filter((i) => i.productoId !== productoId);
            else existente.cantidad = cantidad;
          }
          historial.push({ tipo: accion, payload, anterior, removido: null });
        }

        carritoActual = recalcular(carritoActual);
        return Promise.resolve(respuestaJson(carritoActual));
      }

      if (carritoActual && url === `/api/carritos/${carritoActual.id}/deshacer` && init?.method === 'POST') {
        const ultimo = historial.pop();
        if (ultimo) {
          if (ultimo.tipo === 'AGREGAR_ITEM') {
            if (ultimo.anterior) {
              const item = carritoActual.items.find((i) => i.productoId === ultimo.anterior!.productoId);
              if (item) item.cantidad = ultimo.anterior.cantidad;
            } else {
              carritoActual.items = carritoActual.items.filter((i) => i.productoId !== String(ultimo.payload.productoId));
            }
          } else if (ultimo.tipo === 'DECREMENTAR_ITEM' || ultimo.tipo === 'ESTABLECER_CANTIDAD') {
            if (ultimo.anterior) {
              const idx = carritoActual.items.findIndex((i) => i.productoId === ultimo.anterior!.productoId);
              if (idx >= 0) carritoActual.items[idx] = { ...ultimo.anterior };
              else carritoActual.items.push({ ...ultimo.anterior });
            }
          } else if (ultimo.tipo === 'QUITAR_ITEM') {
            if (ultimo.removido) carritoActual.items.push({ ...ultimo.removido });
          }
        }
        carritoActual = recalcular(carritoActual);
        return Promise.resolve(respuestaJson(carritoActual));
      }

      if (url === '/api/pedidos' && init?.method === 'POST') {
        const body = cuerpoJson(init);
        return Promise.resolve(
          respuestaJson({ ...pedidoPagado, estado: 'Borrador', total: carritoActual?.total ?? 100, carritoId: body?.carritoId }, 201),
        );
      }

      if (url === `/api/pedidos/${PEDIDO_ID}` && init?.method === 'DELETE') {
        if (opciones.errorEliminarPedido) {
          return Promise.resolve(
            respuestaJson({ error: { message: 'El pedido tiene una factura asociada y no se puede eliminar' } }, 409),
          );
        }
        pedidoEliminado = true;
        return Promise.resolve(respuestaJson({}, 204));
      }

      if (url === `/api/pedidos/${PEDIDO_ID}`) {
        return Promise.resolve(respuestaJson(pedidoPagado));
      }

      if (url === '/api/pedidos') {
        if (pedidoEliminado) return Promise.resolve(respuestaJson([]));
        return Promise.resolve(respuestaJson([opciones.pedidosConItems ? pedidoPagado : { ...pedidoPagado, items: undefined }]));
      }

      if (url === `/api/pedidos/${PEDIDO_ID}/emitir` && init?.method === 'POST') {
        return Promise.resolve(respuestaJson({ ...pedidoPagado, estado: 'Emitido', total: 100 }));
      }

      if (url === `/api/pedidos/${PEDIDO_ID}/pagar` && init?.method === 'POST') {
        return Promise.resolve(respuestaJson({ ...pedidoPagado, estado: 'Pagado', total: 100 }));
      }

      if (url === '/api/ventas/checkout' && init?.method === 'POST') {
        const body = cuerpoJson(init);
        return Promise.resolve(
          respuestaJson({
            pedido: { ...pedidoPagado, id: PEDIDO_ID, estado: 'Pagado', total: carritoActual?.total ?? 100 },
            factura: { id: 'factura-1', numero: 'FAC-000001', estado: 'Emitida' },
            pago: { metodo: body?.metodoPago ?? 'efectivo', monto: carritoActual?.total ?? 100, referencia: 'PAGO-1' },
          }),
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
    vi.restoreAllMocks();
  });

  it('muestra la identidad de Nexo-ERP', () => {
    render(<App />);

    expect(screen.getByRole('img', { name: 'Nexo-ERP' })).toBeInTheDocument();
  });

  it('muestra el historial de ventas con el estado y total de cada pedido', async () => {
    render(<App />);

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Historial de ventas' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('Fecha')).toBeInTheDocument();
    expect(await screen.findByText('07/11/2026 20:05')).toBeInTheDocument();
    const tabla = screen.getByRole('table');
    expect(within(tabla).queryByRole('columnheader', { name: 'Ítems' })).not.toBeInTheDocument();
    expect(within(tabla).queryByText(PEDIDO_ID)).not.toBeInTheDocument();
    expect(within(tabla).getByText(CLIENTE_NOMBRE)).toBeInTheDocument();
    expect(within(tabla).queryByText(CLIENTE_DOCUMENTO)).not.toBeInTheDocument();
    expect(screen.getByText('Pagado')).toBeInTheDocument();
    expect(within(tabla).getByText(/200/)).toBeInTheDocument();
    const historial = screen.getByRole('region', { name: 'Pedidos' });
    expect(
      within(historial).getByRole('button', { name: 'Nueva Venta' }),
    ).toBeInTheDocument();
  });

  it('abre el detalle de una venta y consulta el pedido cuando faltan los ítems', async () => {
    const fetchMock = instalarFetch();

    render(<App />);

    fireEvent.click(
      await screen.findByRole('button', {
        name: `Ver detalles del pedido ${PEDIDO_ID}`,
      }),
    );

    const dialogo = await screen.findByRole('dialog', {
      name: 'Detalle de la venta',
    });

    expect(fetchMock).toHaveBeenCalledWith(`/api/pedidos/${PEDIDO_ID}`);

    expect(within(dialogo).getByText(PEDIDO_ID)).toBeInTheDocument();
    expect(within(dialogo).getByText(CLIENTE_NOMBRE)).toBeInTheDocument();
    expect(
      within(dialogo).getByText(`Documento: ${CLIENTE_DOCUMENTO}`),
    ).toBeInTheDocument();
    expect(within(dialogo).getAllByText('Pagado').length).toBeGreaterThan(0);
    expect(within(dialogo).getByText('Subtotal')).toBeInTheDocument();
    expect(within(dialogo).getByText('Descuento')).toBeInTheDocument();
    expect(within(dialogo).getByText('Impuesto')).toBeInTheDocument();
    expect(within(dialogo).getByText('Total')).toBeInTheDocument();

    const items = within(dialogo).getByRole('table');
    expect(within(items).getByText('Valor unitario')).toBeInTheDocument();
    expect(within(items).getByText(PRODUCTO_NOMBRE)).toBeInTheDocument();
    expect(within(items).queryByText(PRODUCTO_ID)).not.toBeInTheDocument();
    expect(within(items).getByText('2')).toBeInTheDocument();
    expect(within(items).getByText(/100,00/)).toBeInTheDocument();

    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cerrar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('no consulta el detalle si el listado ya incluye los ítems', async () => {
    const fetchMock = instalarFetch({ pedidosConItems: true });

    render(<App />);

    fireEvent.click(
      await screen.findByRole('button', {
        name: `Ver detalles del pedido ${PEDIDO_ID}`,
      }),
    );

    const dialogo = await screen.findByRole('dialog', {
      name: 'Detalle de la venta',
    });

    expect(within(dialogo).getByText(PRODUCTO_NOMBRE)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(`/api/pedidos/${PEDIDO_ID}`);
  });

  it('abre el POS de dos columnas con el catálogo y su stock', async () => {
    await abrirNuevaVenta();

    expect(screen.getByRole('link', { name: 'Volver a Ventas' })).toHaveAttribute(
      'href',
      '/ventas',
    );

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

    const cantidad = await within(carrito).findByLabelText('Cantidad de Café de prueba');
    await waitFor(() => expect(cantidad).toHaveValue(1));

    const totalVenta = () => carrito.querySelector('.pos-total dd');
    expect(totalVenta()).toHaveTextContent('100');

    fireEvent.change(within(carrito).getByLabelText('Cantidad de Café de prueba'), {
      target: { value: '2' },
    });

    await waitFor(() => expect(totalVenta()).toHaveTextContent('200'));

    fireEvent.click(
      within(carrito).getByRole('button', { name: 'Eliminar Café de prueba' }),
    );

    await waitFor(() =>
      expect(within(carrito).queryByText('Café de prueba')).not.toBeInTheDocument(),
    );
    expect(within(carrito).getByText('Agrega productos desde el catálogo.')).toBeInTheDocument();
  });

  it('aplica un descuento del 10% solo cuando el carrito supera 10 unidades', async () => {
    instalarFetch({ stockCantidad: 20 });

    await abrirNuevaVenta();

    const catalogo = screen.getByRole('region', { name: 'Catálogo' });
    const carrito = screen.getByRole('region', { name: 'Carrito' });

    fireEvent.click(within(catalogo).getByRole('button', { name: 'Agregar' }));

    await within(carrito).findByLabelText('Cantidad de Café de prueba');
    const descuento = within(carrito).getByText('Descuento');
    const totalVenta = () => carrito.querySelector('.pos-total dd');

    fireEvent.change(within(carrito).getByLabelText('Cantidad de Café de prueba'), {
      target: { value: '10' },
    });

    await waitFor(() => expect(descuento.nextElementSibling).toHaveTextContent('0'));
    expect(totalVenta()).toHaveTextContent('1.000');

    fireEvent.change(within(carrito).getByLabelText('Cantidad de Café de prueba'), {
      target: { value: '11' },
    });

    await waitFor(() => expect(descuento.nextElementSibling).toHaveTextContent('110'));
    expect(totalVenta()).toHaveTextContent('990');
  });

  it('procesa la venta con el flujo checkout usando el carritoId del backend', async () => {
    const fetchMock = instalarFetch();

    await abrirNuevaVenta();

    const catalogo = screen.getByRole('region', { name: 'Catálogo' });
    const carrito = screen.getByRole('region', { name: 'Carrito' });

    fireEvent.click(within(catalogo).getByRole('button', { name: 'Agregar' }));
    await within(carrito).findByLabelText('Cantidad de Café de prueba');

    fireEvent.change(within(carrito).getByLabelText('Cantidad de Café de prueba'), {
      target: { value: '2' },
    });
    await waitFor(() =>
      expect(carrito.querySelector('.pos-total dd')).toHaveTextContent('200'),
    );

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

    expect(fetchMock).toHaveBeenCalledWith('/api/ventas/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentoCliente: 'CC-123456',
        carritoId: '44444444-4444-4444-8444-444444444444',
        metodoPago: 'pasarela',
      }),
    });
  });

  it('despacha comandos +, −, input, papelera y deshacer al backend', async () => {
    const fetchMock = instalarFetch();

    await abrirNuevaVenta();

    const catalogo = screen.getByRole('region', { name: 'Catálogo' });
    const carrito = screen.getByRole('region', { name: 'Carrito' });

    fireEvent.click(within(catalogo).getByRole('button', { name: 'Agregar' }));
    await within(carrito).findByLabelText('Cantidad de Café de prueba');

    fireEvent.click(within(carrito).getByRole('button', { name: 'Aumentar cantidad de Café de prueba' }));
    await waitFor(() =>
      expect(within(carrito).getByLabelText('Cantidad de Café de prueba')).toHaveValue(2),
    );

    fireEvent.click(within(carrito).getByRole('button', { name: 'Disminuir cantidad de Café de prueba' }));
    await waitFor(() =>
      expect(within(carrito).getByLabelText('Cantidad de Café de prueba')).toHaveValue(1),
    );

    fireEvent.change(within(carrito).getByLabelText('Cantidad de Café de prueba'), {
      target: { value: '3' },
    });
    await waitFor(() =>
      expect(within(carrito).getByLabelText('Cantidad de Café de prueba')).toHaveValue(3),
    );

    fireEvent.click(within(carrito).getByRole('button', { name: 'Deshacer' }));
    await waitFor(() =>
      expect(within(carrito).getByLabelText('Cantidad de Café de prueba')).toHaveValue(1),
    );

    fireEvent.click(within(carrito).getByRole('button', { name: 'Eliminar Café de prueba' }));
    await waitFor(() =>
      expect(within(carrito).queryByText('Café de prueba')).not.toBeInTheDocument(),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/carritos/44444444-4444-4444-8444-444444444444/comandos',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/carritos/44444444-4444-4444-8444-444444444444/deshacer',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('no procesa la venta sin documento del cliente', async () => {
    const fetchMock = instalarFetch();

    await abrirNuevaVenta();

    const catalogo = screen.getByRole('region', { name: 'Catálogo' });
    const carrito = screen.getByRole('region', { name: 'Carrito' });

    fireEvent.click(within(catalogo).getByRole('button', { name: 'Agregar' }));
    await within(carrito).findByLabelText('Cantidad de Café de prueba');

    fireEvent.click(screen.getByRole('button', { name: 'Procesar pago' }));

    expect(
      await screen.findAllByText('Ingresa el documento del cliente.'),
    ).toHaveLength(2);
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/pedidos',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('autocompleta el documento del cliente al seleccionar una opción del desplegable', async () => {
    instalarFetch();

    await abrirNuevaVenta();

    const input = screen.getByLabelText('Documento del cliente');

    fireEvent.change(input, { target: { value: '123' } });

    const opcion = await screen.findByText('12345678 - Cliente Prueba');
    expect(opcion).toBeInTheDocument();

    fireEvent.click(opcion);

    expect(input).toHaveValue('12345678');

    // El menú debe cerrarse tras la selección
    expect(screen.queryByText('12345678 - Cliente Prueba')).not.toBeInTheDocument();
  });

  it('filtra clientes por documento al escribir en el input', async () => {
    instalarFetch();

    await abrirNuevaVenta();

    const input = screen.getByLabelText('Documento del cliente');

    fireEvent.change(input, { target: { value: '8765' } });

    expect(
      await screen.findByText('87654321 - Otro Cliente'),
    ).toBeInTheDocument();
    expect(screen.queryByText('12345678 - Cliente Prueba')).not.toBeInTheDocument();
  });

  it('elimina una venta después de confirmar y refresca el historial', async () => {
    const fetchMock = instalarFetch();
    const confirmacion = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<App />);

    fireEvent.click(
      await screen.findByRole('button', {
        name: `Eliminar pedido ${PEDIDO_ID}`,
      }),
    );

    expect(confirmacion).toHaveBeenCalled();
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(`/api/pedidos/${PEDIDO_ID}`, {
        method: 'DELETE',
      });
    });
    await waitFor(() => {
      expect(
        screen.queryByRole('button', {
          name: `Eliminar pedido ${PEDIDO_ID}`,
        }),
      ).not.toBeInTheDocument();
    });
  });

  it('muestra una alerta amigable si la venta no se puede eliminar', async () => {
    instalarFetch({ errorEliminarPedido: true });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<App />);

    fireEvent.click(
      await screen.findByRole('button', {
        name: `Eliminar pedido ${PEDIDO_ID}`,
      }),
    );

    expect(
      await screen.findByText(
        'El pedido tiene una factura asociada y no se puede eliminar',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: `Eliminar pedido ${PEDIDO_ID}`,
      }),
    ).toBeInTheDocument();
  });

  it('edita nombre, precio y stock de un producto desde el modal', async () => {
    const fetchMock = instalarFetch();

    render(<App />);

    fireEvent.click(await screen.findByRole('link', { name: 'Productos y Stock' }));
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Productos y Stock' }),
    ).toBeInTheDocument();
    expect(await screen.findByText(PRODUCTO_NOMBRE)).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: `Editar ${PRODUCTO_NOMBRE}` }),
    );

    const dialogo = await screen.findByRole('dialog', {
      name: 'Editar producto',
    });

    fireEvent.change(within(dialogo).getByLabelText('Nombre'), {
      target: { value: 'Café actualizado' },
    });
    fireEvent.change(within(dialogo).getByLabelText('Precio'), {
      target: { value: '250' },
    });
    fireEvent.change(within(dialogo).getByLabelText('Stock actual'), {
      target: { value: '7' },
    });
    fireEvent.click(
      within(dialogo).getByRole('button', { name: 'Guardar cambios' }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/productos/${PRODUCTO_ID}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nombre: 'Café actualizado',
            precio: 250,
            stock: 7,
          }),
        },
      );
    });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('elimina un producto después de confirmar', async () => {
    const fetchMock = instalarFetch();
    const confirmacion = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<App />);

    fireEvent.click(await screen.findByRole('link', { name: 'Productos y Stock' }));
    const botonEliminar = await screen.findByRole('button', {
      name: `Eliminar ${PRODUCTO_NOMBRE}`,
    });

    fireEvent.click(botonEliminar);

    expect(confirmacion).toHaveBeenCalled();
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/productos/${PRODUCTO_ID}`,
        { method: 'DELETE' },
      );
    });
  });

  it('muestra una alerta amigable si el producto está en uso', async () => {
    instalarFetch({ errorEliminarProducto: true });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<App />);

    fireEvent.click(await screen.findByRole('link', { name: 'Productos y Stock' }));
    fireEvent.click(
      await screen.findByRole('button', {
        name: `Eliminar ${PRODUCTO_NOMBRE}`,
      }),
    );

    expect(
      await screen.findByText(
        'El producto está referenciado por otros registros',
      ),
    ).toBeInTheDocument();
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
    expect(await screen.findByText('WhatsApp')).toBeInTheDocument();
  });
});

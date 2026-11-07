import { useEffect, useState, type FormEvent, type JSX } from 'react';

interface Producto {
  id: string;
  sku: string;
  nombre: string;
  precio: number;
  tipo: string;
}

interface StockItem {
  productoId: string;
  cantidad: number;
}

interface PedidoCreado {
  id: string;
  estado: string;
  total: number;
}

type MetodoPago = 'efectivo' | 'pasarela';

interface PagoPayload {
  metodoPago: MetodoPago;
  montoRecibido?: number;
}

interface PedidoItemPayload {
  productoId: string;
  cantidad: number;
}

interface ApiErrorResponse {
  error?: {
    message?: string;
  };
}

const formatoMoneda = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 2,
});

function formatearMoneda(valor: number): string {
  return formatoMoneda.format(valor);
}

function etiquetaMetodoPago(metodo: MetodoPago): string {
  return metodo === 'efectivo' ? 'Efectivo' : 'Pasarela';
}

function construirItemsPedido(
  productos: Producto[],
  cantidades: Record<string, number>,
): PedidoItemPayload[] {
  const items: PedidoItemPayload[] = [];

  for (const producto of productos) {
    const cantidad = Number(cantidades[producto.id] ?? 0);

    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      continue;
    }

    items.push({
      // El backend valida un UUID: debe ser el id real del producto, nunca el SKU.
      productoId: producto.id,
      cantidad,
    });
  }

  return items;
}

async function obtenerJson<T>(url: string): Promise<T> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`No se pudo obtener ${url} (${response.status})`);
  }

  return (await response.json()) as T;
}

async function enviarJson<T>(url: string, method: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let mensaje = `Error ${response.status}`;

    try {
      const data = (await response.json()) as ApiErrorResponse;

      if (data.error?.message) {
        mensaje = data.error.message;
      }
    } catch {
      // La respuesta no traía un cuerpo JSON; se conserva el mensaje por defecto.
    }

    throw new Error(mensaje);
  }

  return (await response.json()) as T;
}

export function App(): JSX.Element {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [stock, setStock] = useState<Record<string, number>>({});
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [documentoCliente, setDocumentoCliente] = useState('');
  const [ultimoPedido, setUltimoPedido] = useState<PedidoCreado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);
  const [pagoAbierto, setPagoAbierto] = useState(false);
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('efectivo');
  const [montoRecibido, setMontoRecibido] = useState('');
  const [pagando, setPagando] = useState(false);
  const [errorPago, setErrorPago] = useState<string | null>(null);
  const [mensajePago, setMensajePago] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;

    async function cargar(): Promise<void> {
      try {
        const [productosApi, stockApi] = await Promise.all([
          obtenerJson<Producto[]>('/api/productos'),
          obtenerJson<StockItem[]>('/api/stock'),
        ]);

        if (!activo) {
          return;
        }

        setProductos(productosApi);
        setStock(
          Object.fromEntries(stockApi.map((item) => [item.productoId, item.cantidad])),
        );
      } catch (caught) {
        if (activo) {
          setError(
            caught instanceof Error ? caught.message : 'No se pudieron cargar los productos',
          );
        }
      }
    }

    void cargar();

    return () => {
      activo = false;
    };
  }, []);

  function actualizarCantidad(productoId: string, valor: string): void {
    const cantidad = Number.parseInt(valor, 10);

    setCantidades((actual) => ({
      ...actual,
      [productoId]: Number.isNaN(cantidad) ? 0 : cantidad,
    }));
  }

  async function manejarEnvio(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setUltimoPedido(null);
    setMensajePago(null);
    setPagoAbierto(false);
    setErrorPago(null);

    const documentoClienteNormalizado = documentoCliente.trim();
    const items = construirItemsPedido(productos, cantidades);

    if (documentoClienteNormalizado === '') {
      setError('Ingresa el documento del cliente.');
      return;
    }

    if (items.length === 0) {
      setError('Agrega al menos un producto con cantidad mayor a cero.');
      return;
    }

    setCreando(true);

    try {
      const pedido = await enviarJson<PedidoCreado>('/api/pedidos', 'POST', {
        documentoCliente: documentoClienteNormalizado,
        items,
      });

      setUltimoPedido(pedido);
      setCantidades({});
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo crear el pedido');
    } finally {
      setCreando(false);
    }
  }

  function abrirModalPago(): void {
    setMetodoPago('efectivo');
    setMontoRecibido('');
    setErrorPago(null);
    setPagoAbierto(true);
  }

  function cerrarModalPago(): void {
    if (pagando) {
      return;
    }

    setPagoAbierto(false);
    setErrorPago(null);
  }

  async function manejarPago(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!ultimoPedido) {
      return;
    }

    let payload: PagoPayload;

    if (metodoPago === 'efectivo') {
      const monto = Number(montoRecibido);

      if (montoRecibido.trim() === '' || !Number.isFinite(monto) || monto <= 0) {
        setErrorPago('Ingresa un monto recibido válido.');
        return;
      }

      if (monto < ultimoPedido.total) {
        setErrorPago('El monto recibido no cubre el total del pedido.');
        return;
      }

      payload = { metodoPago, montoRecibido: monto };
    } else {
      payload = { metodoPago };
    }

    setPagando(true);
    setErrorPago(null);

    try {
      let pedido = ultimoPedido;

      if (pedido.estado === 'Borrador') {
        pedido = await enviarJson<PedidoCreado>(
          `/api/pedidos/${pedido.id}/emitir`,
          'POST',
          {},
        );
        setUltimoPedido(pedido);
      }

      const pagado = await enviarJson<PedidoCreado>(
        `/api/pedidos/${pedido.id}/pagar`,
        'POST',
        payload,
      );

      setUltimoPedido(pagado);
      setMensajePago(
        `Pedido ${pagado.id} pagado con ${etiquetaMetodoPago(metodoPago)} por ${formatearMoneda(pagado.total)}.`,
      );
      setError(null);
      setMontoRecibido('');
      setPagoAbierto(false);
    } catch (caught) {
      setErrorPago(
        caught instanceof Error ? caught.message : 'No se pudo pagar el pedido',
      );
    } finally {
      setPagando(false);
    }
  }

  const puedePagar =
    ultimoPedido !== null &&
    (ultimoPedido.estado === 'Borrador' || ultimoPedido.estado === 'Emitido');

  return (
    <main className="app-shell">
      <header className="app-header">
        <p className="app-eyebrow">Ventas y pagos · Fase 3</p>
        <h1>Nexo-ERP</h1>
        <p className="app-description">
          Consulta el catálogo, registra un pedido y cobra con estrategias de pago.
        </p>
      </header>

      {error ? (
        <p role="alert" className="alert alert-error">
          {error}
        </p>
      ) : null}

      {mensajePago ? (
        <p role="status" className="alert alert-success">
          {mensajePago}
        </p>
      ) : ultimoPedido ? (
        <p role="status" className="alert alert-success">
          Pedido {ultimoPedido.id} creado en estado {ultimoPedido.estado} por{' '}
          {formatearMoneda(ultimoPedido.total)}.
        </p>
      ) : null}

      {ultimoPedido ? (
        <section className="app-card pedido-resumen" aria-labelledby="resumen-titulo">
          <div>
            <h2 id="resumen-titulo">Pedido actual</h2>
            <dl className="pedido-datos">
              <div>
                <dt>Identificador</dt>
                <dd>{ultimoPedido.id}</dd>
              </div>
              <div>
                <dt>Estado</dt>
                <dd>
                  <span className={`estado estado-${ultimoPedido.estado.toLowerCase()}`}>
                    {ultimoPedido.estado}
                  </span>
                </dd>
              </div>
              <div>
                <dt>Total</dt>
                <dd>{formatearMoneda(ultimoPedido.total)}</dd>
              </div>
            </dl>
          </div>

          {puedePagar ? (
            <button type="button" className="boton-pagar" onClick={abrirModalPago}>
              Pagar
            </button>
          ) : null}
        </section>
      ) : null}

      <section className="app-card" aria-labelledby="productos-titulo">
        <h2 id="productos-titulo">Productos</h2>

        {productos.length === 0 ? (
          <p className="app-empty">No hay productos registrados.</p>
        ) : (
          <div className="tabla-contenedor">
            <table className="productos-tabla">
              <thead>
                <tr>
                  <th scope="col">SKU</th>
                  <th scope="col">Nombre</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Precio</th>
                  <th scope="col">Stock</th>
                  <th scope="col">Cantidad</th>
                </tr>
              </thead>
              <tbody>
                {productos.map((producto) => (
                  <tr key={producto.id}>
                    <td>{producto.sku}</td>
                    <td>{producto.nombre}</td>
                    <td>{producto.tipo}</td>
                    <td>{formatearMoneda(producto.precio)}</td>
                    <td>{stock[producto.id] ?? 0}</td>
                    <td>
                      <input
                        aria-label={`Cantidad para ${producto.nombre}`}
                        className="cantidad-input"
                        type="number"
                        min="0"
                        value={cantidades[producto.id] ?? 0}
                        onChange={(event) =>
                          actualizarCantidad(producto.id, event.target.value)
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="app-card" aria-labelledby="pedido-titulo">
        <h2 id="pedido-titulo">Crear pedido</h2>

        <form
          className="pedido-form"
          onSubmit={(event) => {
            void manejarEnvio(event);
          }}
        >
          <label htmlFor="documento-cliente">Documento del Cliente</label>
          <input
            id="documento-cliente"
            name="documentoCliente"
            type="text"
            value={documentoCliente}
            placeholder="Número de documento"
            onChange={(event) => setDocumentoCliente(event.target.value)}
          />

          <button type="submit" disabled={creando}>
            {creando ? 'Creando…' : 'Crear pedido'}
          </button>
        </form>
      </section>

      {pagoAbierto && ultimoPedido ? (
        <div className="modal-backdrop" onClick={cerrarModalPago}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pago-titulo"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="pago-titulo">Pagar pedido</h2>
            <p className="modal-descripcion">
              Total a cobrar: <strong>{formatearMoneda(ultimoPedido.total)}</strong>
            </p>

            <form
              className="pago-form"
              onSubmit={(event) => {
                void manejarPago(event);
              }}
            >
              <fieldset className="opciones-pago">
                <legend>Método de pago</legend>

                <label className="opcion-pago">
                  <input
                    type="radio"
                    name="metodoPago"
                    value="efectivo"
                    checked={metodoPago === 'efectivo'}
                    onChange={() => setMetodoPago('efectivo')}
                  />
                  Efectivo
                </label>

                <label className="opcion-pago">
                  <input
                    type="radio"
                    name="metodoPago"
                    value="pasarela"
                    checked={metodoPago === 'pasarela'}
                    onChange={() => setMetodoPago('pasarela')}
                  />
                  Pasarela
                </label>
              </fieldset>

              {metodoPago === 'efectivo' ? (
                <div className="campo-pago">
                  <label htmlFor="monto-recibido">Monto recibido</label>
                  <input
                    id="monto-recibido"
                    type="number"
                    min="0"
                    step="0.01"
                    value={montoRecibido}
                    placeholder="0.00"
                    onChange={(event) => setMontoRecibido(event.target.value)}
                  />
                </div>
              ) : (
                <p className="modal-nota">
                  Se generará una referencia de pago simulada en la pasarela.
                </p>
              )}

              {errorPago ? (
                <p role="alert" className="alert alert-error">
                  {errorPago}
                </p>
              ) : null}

              <div className="modal-actions">
                <button
                  type="button"
                  className="boton-secundario"
                  onClick={cerrarModalPago}
                  disabled={pagando}
                >
                  Cancelar
                </button>
                <button type="submit" disabled={pagando}>
                  {pagando ? 'Procesando…' : 'Confirmar pago'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}

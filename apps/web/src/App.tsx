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
  const [clienteId, setClienteId] = useState('');
  const [ultimoPedido, setUltimoPedido] = useState<PedidoCreado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);

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

    const items = productos
      .map((producto) => ({
        productoId: producto.id,
        cantidad: cantidades[producto.id] ?? 0,
      }))
      .filter((item) => item.cantidad > 0);

    if (clienteId.trim() === '') {
      setError('Ingresa el identificador del cliente.');
      return;
    }

    if (items.length === 0) {
      setError('Agrega al menos un producto con cantidad mayor a cero.');
      return;
    }

    setCreando(true);

    try {
      const pedido = await enviarJson<PedidoCreado>('/api/pedidos', 'POST', {
        clienteId: clienteId.trim(),
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

  return (
    <main className="app-shell">
      <header className="app-header">
        <p className="app-eyebrow">Inventario y pedidos · Fase 2</p>
        <h1>Nexo-ERP</h1>
        <p className="app-description">
          Consulta el catálogo y registra un pedido en estado Borrador.
        </p>
      </header>

      {error ? (
        <p role="alert" className="alert alert-error">
          {error}
        </p>
      ) : null}

      {ultimoPedido ? (
        <p role="status" className="alert alert-success">
          Pedido {ultimoPedido.id} creado en estado {ultimoPedido.estado} por{' '}
          {formatearMoneda(ultimoPedido.total)}.
        </p>
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
          <label htmlFor="cliente-id">Cliente</label>
          <input
            id="cliente-id"
            name="clienteId"
            type="text"
            value={clienteId}
            placeholder="UUID del cliente"
            onChange={(event) => setClienteId(event.target.value)}
          />

          <button type="submit" disabled={creando}>
            {creando ? 'Creando…' : 'Crear pedido'}
          </button>
        </form>
      </section>
    </main>
  );
}

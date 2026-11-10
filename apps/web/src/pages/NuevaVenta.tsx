import { useEffect, useRef, useState, type FormEvent, type JSX } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useCatalogo } from '../hooks/useCatalogo';
import { obtenerJson, enviarJson } from '../lib/api';
import { formatearMoneda, redondearMoneda } from '../lib/formato';
import { claseStock } from '../lib/stock';
import { FiDelete } from 'react-icons/fi';
import type { Cliente, Pedido, Producto } from '../types';

type MetodoPago = 'efectivo' | 'pasarela';

interface LineaCarrito {
  producto: Producto;
  cantidad: number;
}

function etiquetaMetodoPago(metodo: MetodoPago): string {
  return metodo === 'efectivo' ? 'Efectivo' : 'Pasarela';
}

export function NuevaVenta(): JSX.Element {
  const navigate = useNavigate();
  const { productos, stock, cargando, error: errorCatalogo, recargar } = useCatalogo();
  const [lineas, setLineas] = useState<LineaCarrito[]>([]);
  const [documentoCliente, setDocumentoCliente] = useState('');
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('efectivo');
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cargandoClientes, setCargandoClientes] = useState(true);
  const [errorClientes, setErrorClientes] = useState<string | null>(null);
  const [mostrarDropdown, setMostrarDropdown] = useState(false);
  const clienteInputRef = useRef<HTMLDivElement>(null);

  function cantidadEnCarrito(productoId: string): number {
    return lineas.find((linea) => linea.producto.id === productoId)?.cantidad ?? 0;
  }

  function agregarProducto(producto: Producto): void {
    const disponible = stock[producto.id] ?? 0;

    setLineas((actuales) => {
      const existente = actuales.find((linea) => linea.producto.id === producto.id);

      if (existente) {
        if (existente.cantidad >= disponible) {
          return actuales;
        }

        return actuales.map((linea) =>
          linea.producto.id === producto.id
            ? { ...linea, cantidad: linea.cantidad + 1 }
            : linea,
        );
      }

      if (disponible <= 0) {
        return actuales;
      }

      return [...actuales, { producto, cantidad: 1 }];
    });
  }

  function incrementarCantidad(productoId: string): void {
    const disponible = stock[productoId] ?? 0;

    setLineas((actuales) =>
      actuales.map((linea) => {
        if (linea.producto.id !== productoId) {
          return linea;
        }

        if (linea.cantidad >= disponible) {
          return linea;
        }

        return { ...linea, cantidad: linea.cantidad + 1 };
      }),
    );
  }

  function decrementarCantidad(productoId: string): void {
    setLineas((actuales) =>
      actuales.map((linea) => {
        if (linea.producto.id !== productoId) {
          return linea;
        }

        return { ...linea, cantidad: Math.max(linea.cantidad - 1, 0) };
      }),
    );
  }

  function eliminarProducto(productoId: string): void {
    setLineas((actuales) =>
      actuales.filter((linea) => linea.producto.id !== productoId),
    );
  }

  useEffect(() => {
    let activo = true;

    async function cargarClientes(): Promise<void> {
      setCargandoClientes(true);
      setErrorClientes(null);

      try {
        const clientesApi = await obtenerJson<Cliente[]>('/api/clientes');

        if (activo) {
          setClientes(clientesApi);
        }
      } catch (caught) {
        if (activo) {
          setErrorClientes(
            caught instanceof Error
              ? caught.message
              : 'No se pudieron cargar los clientes',
          );
        }
      } finally {
        if (activo) {
          setCargandoClientes(false);
        }
      }
    }

    void cargarClientes();

    return () => {
      activo = false;
    };
  }, []);

  useEffect(() => {
    function manejarClickFuera(event: MouseEvent): void {
      if (
        mostrarDropdown &&
        clienteInputRef.current &&
        !clienteInputRef.current.contains(event.target as Node)
      ) {
        setMostrarDropdown(false);
      }
    }

    document.addEventListener('mousedown', manejarClickFuera);

    return () => {
      document.removeEventListener('mousedown', manejarClickFuera);
    };
  }, [mostrarDropdown]);

  const clientesFiltrados = cargandoClientes
    ? []
    : clientes.filter((cliente) =>
        cliente.documento.includes(documentoCliente.trim()),
      );

  const cantidadTotal = lineas.reduce(
    (acumulado, linea) => acumulado + linea.cantidad,
    0,
  );
  const subtotal = redondearMoneda(
    lineas.reduce(
      (acumulado, linea) => acumulado + linea.producto.precio * linea.cantidad,
      0,
    ),
  );
  const descuento = redondearMoneda(
    cantidadTotal > 10 ? subtotal * 0.1 : 0,
  );
  const impuesto = 0;
  const total = redondearMoneda(subtotal - descuento + impuesto);

  async function dejarEnPendiente(): Promise<void> {
    setError(null);

    const documentoNormalizado = documentoCliente.trim();

    if (documentoNormalizado === '') {
      setError('Ingresa el documento del cliente.');
      return;
    }

    if (lineas.length === 0) {
      setError('Agrega al menos un producto al carrito.');
      return;
    }

    setProcesando(true);

    try {
      await enviarJson<Pedido>('/api/pedidos', 'POST', {
        documentoCliente: documentoNormalizado,
        items: lineas.map((linea) => ({
          productoId: linea.producto.id,
          cantidad: linea.cantidad,
        })),
      });

      void navigate('/ventas', {
        replace: true,
        state: {
          mensaje: 'Pedido dejado en pendiente (Borrador) exitosamente.',
        },
      });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'No se pudo dejar el pedido en pendiente',
      );
    } finally {
      setProcesando(false);
    }
  }

  async function procesarVenta(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    const documentoNormalizado = documentoCliente.trim();

    if (documentoNormalizado === '') {
      setError('Ingresa el documento del cliente.');
      return;
    }

    if (lineas.length === 0) {
      setError('Agrega al menos un producto al carrito.');
      return;
    }

    setProcesando(true);

    try {
      const resultado = await enviarJson<{
        pedido: Pedido;
        factura: { id: string; numero: string; estado: string };
        pago: { metodo: string; monto: number; referencia: string };
      }>('/api/ventas/checkout', 'POST', {
        documentoCliente: documentoNormalizado,
        items: lineas.map((linea) => ({
          productoId: linea.producto.id,
          cantidad: linea.cantidad,
        })),
        metodoPago,
      });

      void navigate('/ventas', {
        replace: true,
        state: {
          mensaje: `Venta ${resultado.pedido.id} pagada con ${etiquetaMetodoPago(
            resultado.pago.metodo as MetodoPago,
          )} por ${formatearMoneda(resultado.pedido.total)}. Factura ${resultado.factura.numero}.`,
        },
      });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'No se pudo procesar la venta',
      );
    } finally {
      setProcesando(false);
    }
  }

  function seleccionarCliente(cliente: Cliente): void {
    setDocumentoCliente(cliente.documento);
    setMostrarDropdown(false);
  }

  return (
    <div className="pagina pos-pagina">
      <header className="pagina-header">
        <div>
          <Link
            to="/ventas"
            className="pagina-volver"
            aria-label="Volver a Ventas"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path
                d="M19 12H5M11 6l-6 6 6 6"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
              />
            </svg>
            Ventas
          </Link>
          <h2>Nueva venta</h2>
          <p className="app-description">
            Selecciona productos del catálogo y confirma el cobro del pedido.
          </p>
        </div>
      </header>

      {error ? (
        <p role="alert" className="alert alert-error">
          {error}
        </p>
      ) : null}

      {errorClientes ? (
        <p role="alert" className="alert alert-error">
          {errorClientes}
        </p>
      ) : null}

      <div className="pos-grid">
        <section className="app-card pos-panel" aria-labelledby="carrito-titulo">
          <div className="seccion-cabecera">
            <h3 id="carrito-titulo" className="seccion-titulo">
              Carrito
            </h3>
            <span className="pos-contador">
              {lineas.length} {lineas.length === 1 ? 'ítem' : 'ítems'}
            </span>
          </div>

          <div className="pos-cliente" ref={clienteInputRef}>
            <label htmlFor="pos-cliente">Documento del cliente</label>
            <input
              id="pos-cliente"
              name="documentoCliente"
              type="text"
              value={documentoCliente}
              placeholder="Número de documento"
              onChange={(event) => {
                setDocumentoCliente(event.target.value);
                setMostrarDropdown(true);
              }}
              onFocus={() => setMostrarDropdown(true)}
            />

            {mostrarDropdown &&
              documentoCliente.trim() !== '' &&
              clientesFiltrados.length > 0 && (
                <ul className="pos-autocomplete-lista">
                  {clientesFiltrados.map((cliente) => (
                    <li
                      key={cliente.id}
                      className="pos-autocomplete-opcion"
                      onClick={() => seleccionarCliente(cliente)}
                    >
                      {cliente.documento} - {cliente.nombre}
                    </li>
                  ))}
                </ul>
              )}
          </div>

          {lineas.length === 0 ? (
            <p className="app-empty">Agrega productos desde el catálogo.</p>
          ) : (
            <ul className="pos-carrito-lista">
              {lineas.map((linea) => {
                const disponible = stock[linea.producto.id] ?? 0;

                return (
                  <li key={linea.producto.id} className="pos-linea">
                    <div className="pos-linea-info">
                      <span className="pos-linea-nombre">
                        {linea.producto.nombre}
                      </span>
                      <span className="pos-linea-precio">
                        {formatearMoneda(linea.producto.precio)} c/u
                      </span>
                    </div>

                    <div className="pos-controles-cantidad">
                      <button
                        type="button"
                        className="boton-icono boton-decrementar"
                        aria-label={`Disminuir cantidad de ${linea.producto.nombre}`}
                        title="Disminuir"
                        disabled={linea.cantidad <= 1}
                        onClick={() => decrementarCantidad(linea.producto.id)}
                      >
                        −
                      </button>

                      <input
                        aria-label={`Cantidad de ${linea.producto.nombre}`}
                        className="pos-cantidad"
                        type="number"
                        min="0"
                        value={linea.cantidad === 0 ? '' : linea.cantidad}
                        onChange={(event) => {
                          const valor = event.target.value;
                          if (valor === '') {
                            setLineas((actuales) =>
                              actuales.map((l) =>
                                l.producto.id === linea.producto.id
                                  ? { ...l, cantidad: 0 }
                                  : l,
                              ),
                            );
                            return;
                          }

                          const numero = Number.parseInt(valor, 10);
                          if (Number.isNaN(numero) || numero < 0) {
                            return;
                          }

                          setLineas((actuales) =>
                            actuales.map((l) =>
                              l.producto.id === linea.producto.id
                                ? { ...l, cantidad: Math.min(numero, Math.max(disponible, 0)) }
                                : l,
                            ),
                          );
                        }}
                      />

                      <button
                        type="button"
                        className="boton-icono boton-incrementar"
                        aria-label={`Aumentar cantidad de ${linea.producto.nombre}`}
                        title="Aumentar"
                        disabled={linea.cantidad >= disponible}
                        onClick={() => incrementarCantidad(linea.producto.id)}
                      >
                        +
                      </button>
                    </div>

                    <button
                      type="button"
                      className="boton-eliminar-icono"
                      aria-label={`Eliminar ${linea.producto.nombre}`}
                      title="Eliminar ítem"
                      onClick={() => eliminarProducto(linea.producto.id)}
                    >
                      <FiDelete size={16} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <dl className="pos-totales">
            <div>
              <dt>Subtotal</dt>
              <dd>{formatearMoneda(subtotal)}</dd>
            </div>
            <div>
              <dt>Descuento</dt>
              <dd>{formatearMoneda(descuento)}</dd>
            </div>
            <div>
              <dt>Impuesto</dt>
              <dd>{formatearMoneda(impuesto)}</dd>
            </div>
            <div className="pos-total">
              <dt>Total</dt>
              <dd>{formatearMoneda(total)}</dd>
            </div>
          </dl>

          <form
            className="pos-pago"
            onSubmit={(event) => {
              void procesarVenta(event);
            }}
          >
            <label htmlFor="pos-metodo-pago">Método de pago</label>
            <select
              id="pos-metodo-pago"
              value={metodoPago}
              onChange={(event) =>
                setMetodoPago(event.target.value as MetodoPago)
              }
            >
              <option value="efectivo">Efectivo</option>
              <option value="pasarela">Pasarela</option>
            </select>

            {error ? (
              <p role="alert" className="alert alert-error">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              className="boton-procesar"
              disabled={procesando || lineas.length === 0}
            >
              {procesando ? 'Procesando…' : 'Procesar pago'}
            </button>

            <button
              type="button"
              className="boton-secundario boton-compacto"
              onClick={() => void dejarEnPendiente()}
              disabled={procesando || lineas.length === 0}
            >
              {procesando ? 'Procesando…' : 'Dejar en pendiente'}
            </button>
          </form>
        </section>

        <section className="app-card pos-panel" aria-labelledby="catalogo-titulo">
          <div className="seccion-cabecera">
            <h3 id="catalogo-titulo" className="seccion-titulo">
              Catálogo
            </h3>
            <button
              type="button"
              className="boton-secundario boton-compacto"
              onClick={recargar}
              disabled={cargando}
            >
              {cargando ? 'Actualizando…' : 'Actualizar'}
            </button>
          </div>

          {errorCatalogo ? (
            <p role="alert" className="alert alert-error">
              {errorCatalogo}
            </p>
          ) : null}

          {cargando ? (
            <p className="app-empty">Cargando productos…</p>
          ) : productos.length === 0 ? (
            <p className="app-empty">No hay productos registrados.</p>
          ) : (
            <div className="tabla-contenedor">
              <table className="productos-tabla pos-tabla-catalogo">
                <thead>
                  <tr>
                    <th scope="col">Código</th>
                    <th scope="col">Descripción</th>
                    <th scope="col">Stock</th>
                    <th scope="col">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {productos.map((producto) => {
                    const disponible = stock[producto.id] ?? 0;
                    const enCarrito = cantidadEnCarrito(producto.id);
                    const sinDisponibilidad = disponible <= enCarrito;

                    return (
                      <tr key={producto.id}>
                        <td className="celda-id">{producto.sku}</td>
                        <td>{producto.nombre}</td>
                        <td>
                          <span
                            className={`stock-badge ${claseStock(disponible)}`}
                          title={`Stock: ${disponible}`}
                          >
                            {disponible}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="boton-agregar"
                            onClick={() => agregarProducto(producto)}
                            disabled={sinDisponibilidad}
                          >
                            Agregar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

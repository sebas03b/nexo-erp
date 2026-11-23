import { useEffect, useMemo, useRef, useState, type FormEvent, type JSX } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiDelete } from 'react-icons/fi';

import { useCarrito } from '../hooks/useCarrito';
import { useCatalogo } from '../hooks/useCatalogo';
import { enviarJson, obtenerJson } from '../lib/api';
import { formatearFechaHora, formatearMoneda } from '../lib/formato';
import { claseStock } from '../lib/stock';
import type { AgendamientoServicio, Cliente, Pedido, Producto } from '../types';

type MetodoPago = 'efectivo' | 'pasarela';

function etiquetaMetodoPago(metodo: MetodoPago): string {
  return metodo === 'efectivo' ? 'Efectivo' : 'Pasarela';
}

function toIso(localDateTime: string): string {
  return new Date(localDateTime).toISOString();
}

function sumarMinutos(localDateTime: string, minutos: number): string {
  const fecha = new Date(localDateTime);
  fecha.setMinutes(fecha.getMinutes() + minutos);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}T${pad(fecha.getHours())}:${pad(fecha.getMinutes())}`;
}

export function NuevaVenta(): JSX.Element {
  const navigate = useNavigate();
  const { productos, stock, cargando: cargandoCatalogo, error: errorCatalogo, recargar } = useCatalogo();
  const {
    carritoId,
    carrito,
    cargando: cargandoCarrito,
    error: errorCarrito,
    despacharComando,
    deshacer,
  } = useCarrito();

  const [documentoCliente, setDocumentoCliente] = useState('');
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('efectivo');
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cargandoClientes, setCargandoClientes] = useState(true);
  const [errorClientes, setErrorClientes] = useState<string | null>(null);
  const [mostrarDropdown, setMostrarDropdown] = useState(false);
  const clienteInputRef = useRef<HTMLDivElement>(null);
  const [servicioAgendar, setServicioAgendar] = useState<Producto | null>(null);
  const [inicioAgendamiento, setInicioAgendamiento] = useState('');
  const [finAgendamiento, setFinAgendamiento] = useState('');
  const [notasAgendamiento, setNotasAgendamiento] = useState('');
  const [agendamientos, setAgendamientos] = useState<Record<string, AgendamientoServicio>>({});

  const productosPorId = useMemo(() => {
    return new Map(productos.map((producto) => [producto.id, producto]));
  }, [productos]);

  const items = carrito?.items ?? [];
  const subtotal = carrito?.subtotal ?? 0;
  const descuento = carrito?.descuento ?? 0;
  const impuesto = carrito?.impuesto ?? 0;
  const total = carrito?.total ?? 0;

  function cantidadEnCarrito(productoId: string): number {
    return items.find((item) => item.productoId === productoId)?.cantidad ?? 0;
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

  const errorVisible = error ?? errorCarrito;

  async function dejarEnPendiente(): Promise<void> {
    setError(null);

    const documentoNormalizado = documentoCliente.trim();

    if (documentoNormalizado === '') {
      setError('Ingresa el documento del cliente.');
      return;
    }

    if (!carritoId || items.length === 0) {
      setError('Agrega al menos un producto al carrito.');
      return;
    }

    setProcesando(true);

    try {
      await crearCitasDeServicios(documentoNormalizado);
      await enviarJson<Pedido>('/api/pedidos', 'POST', {
        documentoCliente: documentoNormalizado,
        carritoId,
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

    if (!carritoId || items.length === 0) {
      setError('Agrega al menos un producto al carrito.');
      return;
    }

    setProcesando(true);

    try {
      await crearCitasDeServicios(documentoNormalizado);
      const resultado = await enviarJson<{
        pedido: Pedido;
        factura: { id: string; numero: string; estado: string };
        pago: { metodo: string; monto: number; referencia: string };
      }>('/api/ventas/checkout', 'POST', {
        documentoCliente: documentoNormalizado,
        carritoId,
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

  function agendamientoDelItem(itemId: string): AgendamientoServicio | undefined {
    return agendamientos[itemId];
  }

  function abrirModalAgendar(producto: Producto): void {
    const ahora = new Date();
    ahora.setMinutes(0, 0, 0);
    ahora.setHours(ahora.getHours() + 1);
    const pad = (n: number) => String(n).padStart(2, '0');
    const inicio = `${ahora.getFullYear()}-${pad(ahora.getMonth() + 1)}-${pad(ahora.getDate())}T${pad(ahora.getHours())}:${pad(ahora.getMinutes())}`;
    setServicioAgendar(producto);
    setInicioAgendamiento(inicio);
    setFinAgendamiento(sumarMinutos(inicio, 60));
    setNotasAgendamiento(producto.nombre);
  }

  function cerrarModalAgendar(): void {
    setServicioAgendar(null);
    setInicioAgendamiento('');
    setFinAgendamiento('');
    setNotasAgendamiento('');
  }

  async function confirmarAgendamientoServicio(): Promise<void> {
    if (!servicioAgendar) return;
    if (!inicioAgendamiento || !finAgendamiento) {
      setError('Selecciona fecha y hora de inicio y fin.');
      return;
    }
    const inicioIso = toIso(inicioAgendamiento);
    const finIso = toIso(finAgendamiento);
    if (new Date(finIso) <= new Date(inicioIso)) {
      setError('La hora de fin debe ser posterior a la hora de inicio.');
      return;
    }

    const carritoActualizado = await despacharComando('AGREGAR_ITEM', {
      productoId: servicioAgendar.id,
      cantidad: 1,
    });
    if (!carritoActualizado) return;

    const itemNuevo = [...carritoActualizado.items]
      .reverse()
      .find((i) => i.productoId === servicioAgendar.id && !agendamientos[i.itemId]);
    if (itemNuevo) {
      setAgendamientos((prev) => ({
        ...prev,
        [itemNuevo.itemId]: {
          inicio: inicioIso,
          fin: finIso,
          ...(notasAgendamiento.trim() ? { notas: notasAgendamiento.trim() } : {}),
        },
      }));
    }
    setError(null);
    cerrarModalAgendar();
  }

  async function crearCitasDeServicios(documentoNormalizado: string): Promise<void> {
    const cliente = clientes.find((c) => c.documento === documentoNormalizado);
    if (!cliente) return;

    const citasPendientes = items
      .map((item) => {
        const ag = agendamientos[item.itemId];
        if (!ag) return null;
        const producto = productosPorId.get(item.productoId);
        if (!producto || producto.tipo !== 'servicio') return null;
        return { ag, producto };
      })
      .filter((x): x is { ag: AgendamientoServicio; producto: Producto } => x !== null);

    for (const { ag, producto } of citasPendientes) {
      await enviarJson('/api/citas', 'POST', {
        clienteId: cliente.id,
        inicio: ag.inicio,
        fin: ag.fin,
        notas: ag.notas ?? producto.nombre,
      });
    }
  }

  const controlesDeshabilitados = cargandoCarrito || procesando;

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

      {errorVisible ? (
        <p role="alert" className="alert alert-error">
          {errorVisible}
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
            <div className="pos-carrito-acciones">
              <span className="pos-contador">
                {items.length} {items.length === 1 ? 'ítem' : 'ítems'}
              </span>
              <button
                type="button"
                className="boton-secundario boton-compacto"
                onClick={() => void deshacer()}
                disabled={controlesDeshabilitados}
              >
                Deshacer
              </button>
            </div>
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

          {items.length === 0 ? (
            <p className="app-empty">Agrega productos desde el catálogo.</p>
          ) : (
            <ul className="pos-carrito-lista">
              {items.map((item) => {
                const producto = productosPorId.get(item.productoId);
                const nombre = producto?.nombre ?? item.productoId;
                const disponible = stock[item.productoId] ?? 0;
                const ag = agendamientoDelItem(item.itemId);
                const esServicio = producto?.tipo === 'servicio';

                return (
                  <li key={item.itemId} className="pos-linea">
                    <div className="pos-linea-info">
                      <span className="pos-linea-nombre">{nombre}</span>
                      <span className="pos-linea-precio">
                        {formatearMoneda(item.precioUnitario)} c/u
                      </span>
                      {ag ? (
                        <span className="pos-linea-agenda">
                          Agendado: {formatearFechaHora(ag.inicio)}
                        </span>
                      ) : null}
                    </div>

                    {esServicio ? (
                      <div className="pos-linea-servicio-cantidad" aria-label={`Cantidad fija de ${nombre}`}>
                        1
                      </div>
                    ) : (
                      <div className="pos-controles-cantidad">
                        <button
                          type="button"
                          className="boton-icono boton-decrementar"
                          aria-label={`Disminuir cantidad de ${nombre}`}
                          title="Disminuir"
                          disabled={controlesDeshabilitados || item.cantidad <= 0}
                          onClick={() =>
                            void despacharComando('DECREMENTAR_ITEM', {
                              productoId: item.productoId,
                              cantidad: 1,
                            })
                          }
                        >
                          −
                        </button>

                        <input
                          aria-label={`Cantidad de ${nombre}`}
                          className="pos-cantidad"
                          type="number"
                          min="0"
                          value={item.cantidad}
                          disabled={controlesDeshabilitados}
                          onChange={(event) => {
                            const valor = event.target.value;
                            if (valor === '') return;
                            const numero = Number.parseInt(valor, 10);
                            if (Number.isNaN(numero) || numero < 0) return;
                            void despacharComando('ESTABLECER_CANTIDAD', {
                              productoId: item.productoId,
                              cantidad: numero,
                            });
                          }}
                        />

                        <button
                          type="button"
                          className="boton-icono boton-incrementar"
                          aria-label={`Aumentar cantidad de ${nombre}`}
                          title="Aumentar"
                          disabled={
                            controlesDeshabilitados || (disponible > 0 && item.cantidad >= disponible)
                          }
                          onClick={() =>
                            void despacharComando('AGREGAR_ITEM', {
                              productoId: item.productoId,
                              cantidad: 1,
                            })
                          }
                        >
                          +
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      className="boton-eliminar-icono"
                      aria-label={`Eliminar ${nombre}`}
                      title="Eliminar ítem"
                      disabled={controlesDeshabilitados}
                      onClick={() => {
                        void despacharComando('QUITAR_ITEM', {
                          productoId: item.productoId,
                          itemId: item.itemId,
                        });
                        setAgendamientos((prev) => {
                          const next = { ...prev };
                          delete next[item.itemId];
                          return next;
                        });
                      }}
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
              onChange={(event) => setMetodoPago(event.target.value as MetodoPago)}
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
              disabled={procesando || cargandoCarrito || items.length === 0}
            >
              {procesando ? 'Procesando…' : 'Procesar pago'}
            </button>

            <button
              type="button"
              className="boton-secundario boton-compacto"
              onClick={() => void dejarEnPendiente()}
              disabled={procesando || cargandoCarrito || items.length === 0}
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
              disabled={cargandoCatalogo}
            >
              {cargandoCatalogo ? 'Actualizando…' : 'Actualizar'}
            </button>
          </div>

          {errorCatalogo ? (
            <p role="alert" className="alert alert-error">
              {errorCatalogo}
            </p>
          ) : null}

          {cargandoCatalogo ? (
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
                    const esServicio = producto.tipo === 'servicio';
                    const disponible = stock[producto.id] ?? 0;
                    const enCarrito = cantidadEnCarrito(producto.id);
                    const sinDisponibilidad = !esServicio && disponible <= enCarrito;

                    return (
                      <tr key={producto.id}>
                        <td className="celda-id">{producto.sku}</td>
                        <td>{producto.nombre}</td>
                        <td>
                          {esServicio ? (
                            <span className="stock-servicio">—</span>
                          ) : (
                            <span
                              className={`stock-badge ${claseStock(disponible)}`}
                              title={`Stock: ${disponible}`}
                            >
                              {disponible}
                            </span>
                          )}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="boton-agregar"
                            disabled={controlesDeshabilitados || sinDisponibilidad}
                            onClick={() => {
                              if (esServicio) {
                                abrirModalAgendar(producto);
                                return;
                              }
                              void despacharComando('AGREGAR_ITEM', {
                                productoId: producto.id,
                                cantidad: 1,
                              });
                            }}
                          >
                            {esServicio ? 'Agendar' : 'Agregar'}
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

      {servicioAgendar ? (
        <div className="modal-backdrop" role="presentation">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="agendar-servicio-titulo"
          >
            <h3 id="agendar-servicio-titulo" className="seccion-titulo">
              Agendar servicio
            </h3>
            <p className="modal-descripcion">{servicioAgendar.nombre}</p>
            <form
              className="producto-form"
              onSubmit={(event) => {
                event.preventDefault();
                void confirmarAgendamientoServicio();
              }}
            >
              <div className="producto-form-campo">
                <label htmlFor="agendar-inicio">Inicio</label>
                <input
                  id="agendar-inicio"
                  type="datetime-local"
                  value={inicioAgendamiento}
                  onChange={(event) => {
                    setInicioAgendamiento(event.target.value);
                    if (event.target.value) {
                      setFinAgendamiento(sumarMinutos(event.target.value, 60));
                    }
                  }}
                  required
                />
              </div>

              <div className="producto-form-campo">
                <label htmlFor="agendar-fin">Fin</label>
                <input
                  id="agendar-fin"
                  type="datetime-local"
                  value={finAgendamiento}
                  onChange={(event) => setFinAgendamiento(event.target.value)}
                  required
                />
              </div>

              <div className="producto-form-campo">
                <label htmlFor="agendar-notas">Notas (opcional)</label>
                <input
                  id="agendar-notas"
                  type="text"
                  value={notasAgendamiento}
                  onChange={(event) => setNotasAgendamiento(event.target.value)}
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="boton-secundario"
                  onClick={cerrarModalAgendar}
                >
                  Cancelar
                </button>
                <button type="submit" disabled={controlesDeshabilitados}>
                  Confirmar agendamiento
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
import { useEffect, useRef, useState, type JSX } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { eliminarRecurso, enviarJson, obtenerJson } from '../lib/api';
import { formatearFechaHora, formatearMoneda } from '../lib/formato';
import type { Pedido } from '../types';

interface EstadoNavegacion {
  mensaje?: string;
}

function nombreCliente(pedido: Pedido): string {
  return pedido.clienteNombre ?? pedido.clienteId;
}

export function ListadoVentas(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);
  const [detalle, setDetalle] = useState<Pedido | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [errorDetalle, setErrorDetalle] = useState<string | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const solicitudDetalle = useRef(0);
  const mensaje = (location.state as EstadoNavegacion | null)?.mensaje ?? null;

  useEffect(() => {
    let activo = true;

    async function cargar(): Promise<void> {
      setCargando(true);
      setError(null);

      try {
        const pedidosApi = await obtenerJson<Pedido[]>('/api/pedidos');

        if (activo) {
          setPedidos(pedidosApi);
        }
      } catch (caught) {
        if (activo) {
          setError(
            caught instanceof Error
              ? caught.message
              : 'No se pudo cargar el historial de ventas',
          );
        }
      } finally {
        if (activo) {
          setCargando(false);
        }
      }
    }

    void cargar();

    return () => {
      activo = false;
    };
  }, [recarga]);

  async function abrirDetalle(pedido: Pedido): Promise<void> {
    const solicitud = solicitudDetalle.current + 1;
    solicitudDetalle.current = solicitud;

    setDetalle(pedido);
    setErrorDetalle(null);

    if (pedido.items && pedido.items.length > 0) {
      setCargandoDetalle(false);
      return;
    }

    setCargandoDetalle(true);

    try {
      const completo = await obtenerJson<Pedido>(`/api/pedidos/${pedido.id}`);

      if (solicitudDetalle.current === solicitud) {
        setDetalle(completo);
      }
    } catch (caught) {
      if (solicitudDetalle.current === solicitud) {
        setErrorDetalle(
          caught instanceof Error
            ? caught.message
            : 'No se pudo cargar el detalle del pedido',
        );
      }
    } finally {
      if (solicitudDetalle.current === solicitud) {
        setCargandoDetalle(false);
      }
    }
  }

  function cerrarDetalle(): void {
    solicitudDetalle.current += 1;
    setDetalle(null);
    setErrorDetalle(null);
    setCargandoDetalle(false);
  }

  async function confirmarPago(pedido: Pedido): Promise<void> {
    const confirmado = window.confirm(
      `¿Confirmar el pago del pedido ${pedido.id}?`,
    );

    if (!confirmado) {
      return;
    }

    setErrorAccion(null);
    setEliminandoId(pedido.id);

    try {
      // Borrador → Emitido → Pagado. Si está en Borrador, primero emitir.
      if (pedido.estado === 'Borrador') {
        await enviarJson<Pedido>(`/api/pedidos/${pedido.id}/emitir`, 'POST', {
          metodoPago: 'efectivo',
        });
      }

      await enviarJson<Pedido>(`/api/pedidos/${pedido.id}/pagar`, 'POST', {
        metodoPago: 'efectivo',
      });

      setPedidos((actuales) =>
        actuales.map((actual) =>
          actual.id === pedido.id
            ? { ...actual, estado: 'Pagado' }
            : actual,
        ),
      );
      setRecarga((valor) => valor + 1);

      if (detalle?.id === pedido.id) {
        cerrarDetalle();
      }
    } catch (caught) {
      setErrorAccion(
        caught instanceof Error
          ? caught.message
          : 'No se pudo confirmar el pago',
      );
    } finally {
      setEliminandoId(null);
    }
  }

  async function eliminarPedido(pedido: Pedido): Promise<void> {
    const confirmado = window.confirm(
      `¿Eliminar el pedido ${pedido.id}? Esta acción no se puede deshacer.`,
    );

    if (!confirmado) {
      return;
    }

    setErrorAccion(null);
    setEliminandoId(pedido.id);

    try {
      await eliminarRecurso(`/api/pedidos/${pedido.id}`);
      setPedidos((actuales) =>
        actuales.filter((actual) => actual.id !== pedido.id),
      );
      setRecarga((valor) => valor + 1);

      if (detalle?.id === pedido.id) {
        cerrarDetalle();
      }
    } catch (caught) {
      setErrorAccion(
        caught instanceof Error
          ? caught.message
          : 'No se pudo eliminar el pedido',
      );
    } finally {
      setEliminandoId(null);
    }
  }

  return (
    <div className="pagina">
      <header className="pagina-header">
        <div>
          <h2>Historial de ventas</h2>
          <p className="app-description">
            Consulta los pedidos registrados y abre una nueva venta en el POS.
          </p>
        </div>
      </header>

      {mensaje ? (
        <p role="status" className="alert alert-success">
          {mensaje}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="alert alert-error">
          {error}
        </p>
      ) : null}

      {errorAccion ? (
        <p role="alert" className="alert alert-error">
          {errorAccion}
        </p>
      ) : null}

      <section className="app-card" aria-labelledby="historial-titulo">
        <div className="seccion-cabecera">
          <h3 id="historial-titulo" className="seccion-titulo">
            Pedidos
          </h3>
          <div className="seccion-acciones">
            <button
              type="button"
              className="boton-primario boton-compacto"
              onClick={() => {
                void navigate('/ventas/nueva');
              }}
            >
              Nueva Venta
            </button>
            <button
              type="button"
              className="boton-secundario boton-compacto"
              onClick={() => setRecarga((valor) => valor + 1)}
              disabled={cargando}
            >
              {cargando ? 'Actualizando…' : 'Actualizar'}
            </button>
          </div>
        </div>

        {cargando ? (
          <p className="app-empty">Cargando historial…</p>
        ) : pedidos.length === 0 ? (
          <p className="app-empty">No hay ventas registradas.</p>
        ) : (
          <div className="tabla-contenedor">
            <table className="productos-tabla ventas-tabla">
              <thead>
                <tr>
                  <th scope="col">Fecha</th>
                  <th scope="col">Cliente</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Total</th>
                  <th scope="col"></th>
                </tr>
              </thead>
              <tbody>
                {pedidos.map((pedido) => (
                  <tr key={pedido.id}>
                    <td>
                      {pedido.createdAt
                        ? formatearFechaHora(pedido.createdAt)
                        : '—'}
                    </td>
                    <td>{nombreCliente(pedido)}</td>
                    <td>
                      <span
                        className={`estado estado-${pedido.estado.toLowerCase()}`}
                      >
                        {pedido.estado}
                      </span>
                    </td>
                    <td>{formatearMoneda(pedido.total)}</td>
                    <td>
                      <div className="acciones-tabla">
                        <button
                          type="button"
                          className="boton-secundario boton-compacto"
                          aria-label={`Ver detalles del pedido ${pedido.id}`}
                          onClick={() => {
                            void abrirDetalle(pedido);
                          }}
                        >
                          Detalles
                        </button>

                        {(
                          pedido.estado === 'Borrador' ||
                          pedido.estado === 'Emitido' ||
                          pedido.estado === 'Pendiente'
                        ) && (
                          <button
                            type="button"
                            className="boton-secundario boton-compacto boton-confirmar-pago"
                            aria-label={`Confirmar pago del pedido ${pedido.id}`}
                            title="Confirmar pago"
                            disabled={eliminandoId === pedido.id}
                            onClick={() => {
                              void confirmarPago(pedido);
                            }}
                          >
                            Confirmar pago
                          </button>
                        )}

                        <button
                          type="button"
                          className="boton-eliminar-icono boton-eliminar-pedido"
                          aria-label={`Eliminar pedido ${pedido.id}`}
                          title="Eliminar pedido"
                          disabled={eliminandoId === pedido.id}
                          onClick={() => {
                            void eliminarPedido(pedido);
                          }}
                        >
                          {eliminandoId === pedido.id ? '…' : '✕'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {detalle ? (
        <div className="modal-backdrop">
          <section
            className="modal modal-detalle"
            role="dialog"
            aria-modal="true"
            aria-labelledby="detalle-titulo"
          >
            <div className="modal-detalle-cabecera">
              <div>
                <p className="app-eyebrow">Pedido</p>
                <h3 id="detalle-titulo" className="seccion-titulo">
                  Detalle de la venta
                </h3>
              </div>
              <span
                className={`estado estado-${detalle.estado.toLowerCase()}`}
              >
                {detalle.estado}
              </span>
            </div>

            <dl className="detalle-datos">
              <div>
                <dt>ID</dt>
                <dd className="celda-id">{detalle.id}</dd>
              </div>
              <div>
                <dt>Estado</dt>
                <dd>{detalle.estado}</dd>
              </div>
              <div>
                <dt>Cliente</dt>
                <dd>
                  <span className="detalle-cliente-nombre">
                    {nombreCliente(detalle)}
                  </span>
                  {detalle.clienteDocumento ? (
                    <span className="detalle-cliente-documento">
                      Documento: {detalle.clienteDocumento}
                    </span>
                  ) : null}
                </dd>
              </div>
            </dl>

            <h4 className="detalle-subtitulo">Ítems</h4>

            {cargandoDetalle ? (
              <p className="app-empty">Cargando ítems…</p>
            ) : errorDetalle ? (
              <p role="alert" className="alert alert-error">
                {errorDetalle}
              </p>
            ) : (detalle.items?.length ?? 0) === 0 ? (
              <p className="app-empty">Este pedido no tiene ítems registrados.</p>
            ) : (
              <div className="tabla-contenedor">
                <table className="productos-tabla detalle-items-tabla">
                  <thead>
                    <tr>
                      <th scope="col">Producto</th>
                      <th scope="col">Cantidad</th>
                      <th scope="col">Valor unitario</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalle.items?.map((item) => (
                      <tr key={item.productoId}>
                        <td>{item.productoNombre ?? item.productoId}</td>
                        <td>{item.cantidad}</td>
                        <td>{formatearMoneda(item.precioUnitario)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <h4 className="detalle-subtitulo">Desglose financiero</h4>
            <dl className="detalle-financiero">
              <div>
                <dt>Subtotal</dt>
                <dd>{formatearMoneda(detalle.subtotal)}</dd>
              </div>
              <div>
                <dt>Descuento</dt>
                <dd>{formatearMoneda(detalle.descuento)}</dd>
              </div>
              <div>
                <dt>Impuesto</dt>
                <dd>{formatearMoneda(detalle.impuesto)}</dd>
              </div>
              <div className="detalle-total">
                <dt>Total</dt>
                <dd>{formatearMoneda(detalle.total)}</dd>
              </div>
            </dl>

            <div className="modal-actions">
              <button
                type="button"
                className="boton-secundario"
                onClick={cerrarDetalle}
              >
                Cerrar
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

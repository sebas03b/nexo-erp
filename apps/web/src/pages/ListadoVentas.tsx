import { useEffect, useState, type JSX } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { obtenerJson } from '../lib/api';
import { formatearMoneda } from '../lib/formato';
import type { Pedido } from '../types';

interface EstadoNavegacion {
  mensaje?: string;
}

export function ListadoVentas(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);
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

  return (
    <div className="pagina">
      <header className="pagina-header pagina-header-con-accion">
        <div>
          <p className="app-eyebrow">Ventas</p>
          <h2>Historial de ventas</h2>
          <p className="app-description">
            Consulta los pedidos registrados y abre una nueva venta en el POS.
          </p>
        </div>

        <button
          type="button"
          className="boton-primario"
          onClick={() => {
            void navigate('/ventas/nueva');
          }}
        >
          Nueva Venta
        </button>
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

      <section className="app-card" aria-labelledby="historial-titulo">
        <div className="seccion-cabecera">
          <h3 id="historial-titulo" className="seccion-titulo">
            Pedidos
          </h3>
          <button
            type="button"
            className="boton-secundario boton-compacto"
            onClick={() => setRecarga((valor) => valor + 1)}
            disabled={cargando}
          >
            {cargando ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>

        {cargando ? (
          <p className="app-empty">Cargando historial…</p>
        ) : pedidos.length === 0 ? (
          <p className="app-empty">No hay ventas registradas.</p>
        ) : (
          <div className="tabla-contenedor">
            <table className="productos-tabla">
              <thead>
                <tr>
                  <th scope="col">Pedido</th>
                  <th scope="col">Cliente</th>
                  <th scope="col">Ítems</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Total</th>
                </tr>
              </thead>
              <tbody>
                {pedidos.map((pedido) => (
                  <tr key={pedido.id}>
                    <td className="celda-id">{pedido.id}</td>
                    <td className="celda-id">{pedido.clienteId}</td>
                    <td>{pedido.items.length}</td>
                    <td>
                      <span
                        className={`estado estado-${pedido.estado.toLowerCase()}`}
                      >
                        {pedido.estado}
                      </span>
                    </td>
                    <td>{formatearMoneda(pedido.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

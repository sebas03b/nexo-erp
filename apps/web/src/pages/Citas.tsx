import { useMemo, type JSX } from 'react';

import { formatearFechaHora } from '../lib/formato';
import { useCitas } from '../hooks/useCitas';

function claseEstado(estado: string): string {
  return `estado estado-${estado.toLowerCase().replace(/\s+/g, '-')}`;
}

export function Citas(): JSX.Element {
  const { citas, clientes, error, cargando, listar, cambiarEstado } = useCitas();

  const clientesPorId = useMemo(
    () => new Map(clientes.map((c) => [c.id, c.nombre])),
    [clientes],
  );

  return (
    <div className="pagina">
      <header className="pagina-header">
        <div>
          <h2>Citas</h2>
          <p className="app-description">
            Consulta la agenda y gestiona las transiciones de estado de cada cita.
          </p>
        </div>
      </header>

      {error ? (
        <p role="alert" className="alert alert-error">
          {error}
        </p>
      ) : null}

      <section className="app-card" aria-labelledby="agenda-titulo">
        <div className="seccion-cabecera">
          <h3 id="agenda-titulo" className="seccion-titulo">
            Agenda
          </h3>
          <div className="seccion-acciones">
            <button
              type="button"
              className="boton-secundario boton-compacto"
              onClick={() => void listar()}
              disabled={cargando}
            >
              {cargando ? 'Actualizando…' : 'Actualizar'}
            </button>
          </div>
        </div>

        {cargando ? (
          <p className="app-empty">Cargando agenda…</p>
        ) : citas.length === 0 ? (
          <p className="app-empty">No hay citas registradas.</p>
        ) : (
          <div className="tabla-contenedor">
            <table className="productos-tabla citas-tabla">
              <thead>
                <tr>
                  <th scope="col">Cliente</th>
                  <th scope="col">Notas</th>
                  <th scope="col">Inicio</th>
                  <th scope="col">Fin</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {citas.map((cita) => (
                  <tr key={cita.id}>
                    <td>{clientesPorId.get(cita.clienteId) ?? cita.clienteId}</td>
                    <td>{cita.notas ?? '—'}</td>
                    <td>{formatearFechaHora(cita.inicio)}</td>
                    <td>{formatearFechaHora(cita.fin)}</td>
                    <td>
                      <span className={claseEstado(cita.estado)}>{cita.estado}</span>
                    </td>
                    <td>
                      <div className="acciones-tabla">
                        <button
                          type="button"
                          className="boton-secundario boton-compacto"
                          onClick={() => void cambiarEstado(cita.id, 'confirmar')}
                        >
                          Confirmar
                        </button>
                        <button
                          type="button"
                          className="boton-secundario boton-compacto"
                          onClick={() => void cambiarEstado(cita.id, 'completar')}
                        >
                          Completar
                        </button>
                        <button
                          type="button"
                          className="boton-secundario boton-compacto boton-eliminar-pedido"
                          onClick={() => void cambiarEstado(cita.id, 'cancelar')}
                        >
                          Cancelar
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
    </div>
  );
}

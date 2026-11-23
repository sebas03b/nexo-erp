import { useMemo, type JSX } from 'react';
import { AiOutlineClose } from 'react-icons/ai';
import { BsCheck2All, BsEnvelopeArrowUp } from 'react-icons/bs';

import { useCitas } from '../hooks/useCitas';

function claseEstado(estado: string): string {
  return `estado estado-${estado.toLowerCase().replace(/\s+/g, '-')}`;
}

function formatearHorario(inicioIso: string, finIso: string): string {
  const inicio = new Date(inicioIso);
  const fin = new Date(finIso);
  const pad = (n: number) => String(n).padStart(2, '0');
  const fecha = `${pad(inicio.getDate())}/${pad(inicio.getMonth() + 1)}/${inicio.getFullYear()}`;
  const horaInicio = `${pad(inicio.getHours())}:${pad(inicio.getMinutes())}`;
  const horaFin = `${pad(fin.getHours())}:${pad(fin.getMinutes())}`;
  return `${fecha} · ${horaInicio} - ${horaFin}`;
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
                  <th scope="col">Horario</th>
                  <th scope="col">Estado</th>
                  <th scope="col" className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {citas.map((cita) => (
                  <tr key={cita.id}>
                    <td>{clientesPorId.get(cita.clienteId) ?? cita.clienteId}</td>
                    <td>{cita.notas ?? '—'}</td>
                    <td>{formatearHorario(cita.inicio, cita.fin)}</td>
                    <td>
                      <span className={claseEstado(cita.estado)}>{cita.estado}</span>
                    </td>
                    <td>
                      <div className="acciones-tabla flex justify-end items-center gap-2">
                        <button
                          type="button"
                          className="boton-secundario boton-compacto"
                          title="Enviar recordatorio"
                          aria-label="Enviar recordatorio"
                          onClick={() => {}}
                        >
                          <BsEnvelopeArrowUp />
                        </button>
                        <button
                          type="button"
                          className="boton-secundario boton-compacto"
                          title="Completar cita"
                          aria-label="Completar cita"
                          onClick={() => void cambiarEstado(cita.id, 'completar')}
                        >
                          <BsCheck2All />
                        </button>
                        <button
                          type="button"
                          className="boton-secundario boton-compacto boton-eliminar-pedido"
                          title="Cancelar cita"
                          aria-label="Cancelar cita"
                          onClick={() => void cambiarEstado(cita.id, 'cancelar')}
                        >
                          <AiOutlineClose />
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

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type JSX,
} from 'react';

import { ApiError, enviarJson, obtenerJson } from '../lib/api';
import {
  convertirDateTimeLocalAISO,
  formatearFechaHora,
  obtenerRangoDiaBogota,
} from '../lib/formato';
import type {
  Cita,
  CrearCitaPayload,
  Cliente,
  Empleado,
  EstadoCita,
} from '../types';

type TransicionCita = 'confirmar' | 'iniciar' | 'completar' | 'cancelar';

interface AccionCita {
  etiqueta: string;
  transicion: TransicionCita;
}

const ACCIONES_POR_ESTADO: Record<EstadoCita, AccionCita[]> = {
  Pendiente: [
    { etiqueta: 'Confirmar', transicion: 'confirmar' },
    { etiqueta: 'Cancelar', transicion: 'cancelar' },
  ],
  Confirmada: [
    { etiqueta: 'Iniciar', transicion: 'iniciar' },
    { etiqueta: 'Cancelar', transicion: 'cancelar' },
  ],
  'En Proceso': [{ etiqueta: 'Completar', transicion: 'completar' }],
  Completada: [],
  Cancelada: [],
};

const SELECTOR_FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const CLASES_ESTADO: Record<EstadoCita, string> = {
  Pendiente: 'estado-pendiente',
  Confirmada: 'estado-confirmada',
  'En Proceso': 'estado-en-proceso',
  Completada: 'estado-completada',
  Cancelada: 'estado-cancelada',
};

function mensajeDeError(caught: unknown, fallback: string): string {
  return caught instanceof Error ? caught.message : fallback;
}

function ordenarCitas(citas: Cita[]): Cita[] {
  return [...citas].sort(
    (primera, segunda) =>
      new Date(primera.inicio).getTime() - new Date(segunda.inicio).getTime(),
  );
}

function coincideConFiltro(cita: Cita, fechaFiltro: string): boolean {
  if (!fechaFiltro) {
    return true;
  }

  const rango = obtenerRangoDiaBogota(fechaFiltro);
  const inicio = new Date(cita.inicio).getTime();
  const fin = new Date(cita.fin).getTime();

  return (
    inicio < new Date(rango.hasta).getTime() &&
    fin > new Date(rango.desde).getTime()
  );
}

export function Citas(): JSX.Element {
  const [citas, setCitas] = useState<Cita[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [clientesCargando, setClientesCargando] = useState(true);
  const [empleadosCargando, setEmpleadosCargando] = useState(true);
  const [clientesError, setClientesError] = useState<string | null>(null);
  const [empleadosError, setEmpleadosError] = useState<string | null>(null);
  const [recargaClientes, setRecargaClientes] = useState(0);
  const [recargaEmpleados, setRecargaEmpleados] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [fechaFiltro, setFechaFiltro] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [operacion, setOperacion] = useState<string | null>(null);

  const modalRef = useRef<HTMLElement>(null);
  const nuevaCitaRef = useRef<HTMLButtonElement>(null);
  const modalPrevioRef = useRef(false);
  const operacionRef = useRef<string | null>(null);

  const [clienteId, setClienteId] = useState('');
  const [empleadoId, setEmpleadoId] = useState('');
  const [inicioLocal, setInicioLocal] = useState('');
  const [finLocal, setFinLocal] = useState('');
  const [motivo, setMotivo] = useState('');

  useEffect(() => {
    let activo = true;

    async function cargarAgenda(): Promise<void> {
      setCargando(true);
      setError(null);
      setCitas([]);

      try {
        let ruta = '/api/citas';

        if (fechaFiltro) {
          const rango = obtenerRangoDiaBogota(fechaFiltro);
          const parametros = new URLSearchParams({
            desde: rango.desde,
            hasta: rango.hasta,
          });
          ruta = `${ruta}?${parametros.toString()}`;
        }

        const citasApi = await obtenerJson<Cita[]>(ruta);

        if (activo) {
          setCitas(citasApi);
        }
      } catch (caught) {
        if (activo) {
          setError(mensajeDeError(caught, 'No se pudo cargar la agenda'));
        }
      } finally {
        if (activo) {
          setCargando(false);
        }
      }
    }

    void cargarAgenda();

    return () => {
      activo = false;
    };
  }, [fechaFiltro]);

  useEffect(() => {
    let activo = true;

    setClientesCargando(true);
    setClientesError(null);

    void obtenerJson<Cliente[]>('/api/clientes')
      .then((catalogo) => {
        if (activo) {
          setClientes(catalogo);
        }
      })
      .catch((caught: unknown) => {
        if (activo) {
          setClientes([]);
          setClientesError(
            mensajeDeError(caught, 'No se pudieron cargar los clientes'),
          );
        }
      })
      .finally(() => {
        if (activo) {
          setClientesCargando(false);
        }
      });

    return () => {
      activo = false;
    };
  }, [recargaClientes]);

  useEffect(() => {
    let activo = true;

    setEmpleadosCargando(true);
    setEmpleadosError(null);

    void obtenerJson<Empleado[]>('/api/empleados')
      .then((catalogo) => {
        if (activo) {
          setEmpleados(catalogo);
        }
      })
      .catch((caught: unknown) => {
        if (activo) {
          setEmpleados([]);
          setEmpleadosError(
            mensajeDeError(caught, 'No se pudieron cargar los empleados'),
          );
        }
      })
      .finally(() => {
        if (activo) {
          setEmpleadosCargando(false);
        }
      });

    return () => {
      activo = false;
    };
  }, [recargaEmpleados]);

  useEffect(() => {
    operacionRef.current = operacion;
  }, [operacion]);

  useEffect(() => {
    const estabaAbierto = modalPrevioRef.current;
    modalPrevioRef.current = modalAbierto;

    if (estabaAbierto && !modalAbierto) {
      nuevaCitaRef.current?.focus();
    }
  }, [modalAbierto]);

  useEffect(() => {
    if (!modalAbierto) {
      return;
    }

    const modal = modalRef.current;
    if (!modal) {
      return;
    }

    const modalElement: HTMLElement = modal;

    function obtenerFocusables(): HTMLElement[] {
      return Array.from(
        modalElement.querySelectorAll<HTMLElement>(SELECTOR_FOCUSABLE),
      );
    }

    const focusables = obtenerFocusables();
    const primerFoco = focusables.at(0);
    const focoInicial =
      modalElement.querySelector<HTMLElement>('#cita-cliente') ?? primerFoco;
    focoInicial?.focus();

    function manejarTeclado(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.preventDefault();

        if (operacionRef.current !== 'crear') {
          setModalAbierto(false);
        }

        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const focusablesActuales = obtenerFocusables();
      const primerFocoActual = focusablesActuales.at(0);
      const ultimoFocoActual = focusablesActuales.at(-1);

      if (!primerFocoActual || !ultimoFocoActual) {
        event.preventDefault();
        modalElement.focus();
        return;
      }

      const focoActual = document.activeElement;
      const focoFuera =
        !(focoActual instanceof Node) || !modalElement.contains(focoActual);

      if (
        event.shiftKey &&
        (focoActual === primerFocoActual || focoFuera)
      ) {
        event.preventDefault();
        ultimoFocoActual.focus();
      } else if (
        !event.shiftKey &&
        (focoActual === ultimoFocoActual || focoFuera)
      ) {
        event.preventDefault();
        primerFocoActual.focus();
      }
    }

    document.addEventListener('keydown', manejarTeclado);

    return () => {
      document.removeEventListener('keydown', manejarTeclado);
    };
  }, [modalAbierto]);

  function abrirModal(): void {
    setErrorAccion(null);
    setClienteId('');
    setEmpleadoId('');
    setInicioLocal('');
    setFinLocal('');
    setMotivo('');
    setModalAbierto(true);
  }

  function cerrarModal(): void {
    if (operacion === 'crear') {
      return;
    }

    setModalAbierto(false);
  }

  async function crearCita(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!clienteId || !empleadoId || !inicioLocal || !finLocal) {
      setErrorAccion('Completa todos los campos obligatorios.');
      return;
    }

    let inicio: string;
    let fin: string;

    try {
      inicio = convertirDateTimeLocalAISO(inicioLocal);
      fin = convertirDateTimeLocalAISO(finLocal);
    } catch (caught) {
      setErrorAccion(
        mensajeDeError(caught, 'Ingresa fechas y horas válidas.'),
      );
      return;
    }

    if (new Date(fin).getTime() <= new Date(inicio).getTime()) {
      setErrorAccion('La hora final debe ser posterior a la hora inicial.');
      return;
    }

    const payload: CrearCitaPayload = {
      clienteId,
      empleadoId,
      inicio,
      fin,
      ...(motivo.trim() ? { motivo: motivo.trim() } : {}),
    };

    setOperacion('crear');
    setErrorAccion(null);

    try {
      const cita = await enviarJson<Cita>('/api/citas', 'POST', payload);
      setCitas((actuales) =>
        coincideConFiltro(cita, fechaFiltro)
          ? ordenarCitas([...actuales, cita])
          : actuales,
      );
      setModalAbierto(false);
    } catch (caught) {
      setErrorAccion(mensajeDeError(caught, 'No se pudo crear la cita'));
    } finally {
      setOperacion(null);
    }
  }

  async function transicionarCita(
    cita: Cita,
    transicion: TransicionCita,
  ): Promise<void> {
    setOperacion(`${cita.id}:${transicion}`);
    setErrorAccion(null);

    try {
      const actualizada = await enviarJson<Cita>(
        `/api/citas/${cita.id}/${transicion}`,
        'POST',
        {},
      );
      setCitas((actuales) =>
        actuales.map((actual) =>
          actual.id === cita.id ? actualizada : actual,
        ),
      );
    } catch (caught) {
      let mensaje = mensajeDeError(caught, 'No se pudo actualizar la cita');

      if (
        caught instanceof ApiError &&
        caught.code === 'CONFLICTO_ESTADO_CITA'
      ) {
        try {
          const reconciliada = await obtenerJson<Cita>(
            `/api/citas/${cita.id}`,
          );
          setCitas((actuales) =>
            actuales.map((actual) =>
              actual.id === cita.id ? reconciliada : actual,
            ),
          );
        } catch (reconciliacionFallida: unknown) {
          mensaje = `No se pudo verificar el estado actual de la cita: ${mensajeDeError(
            reconciliacionFallida,
            'error de red',
          )}`;
        }
      }

      setErrorAccion(mensaje);
    } finally {
      setOperacion(null);
    }
  }

  const empleadosActivos = empleados.filter((empleado) => empleado.activo);
  const catalogosCargando = clientesCargando || empleadosCargando;
  const catalogosError = clientesError !== null || empleadosError !== null;

  return (
    <div className="pagina">
      <header className="pagina-header pagina-header-con-accion">
        <div>
          <h2>Agenda de citas</h2>
          <p className="app-description">
            Reserva y administra citas por empleado. Horarios en America/Bogota
            (UTC−5).
          </p>
        </div>
        <button
          ref={nuevaCitaRef}
          type="button"
          className="boton-primario"
          onClick={abrirModal}
          disabled={
            cargando ||
            catalogosCargando ||
            catalogosError ||
            operacion !== null
          }
        >
          Nueva cita
        </button>
      </header>

      {error ? (
        <p role="alert" className="alert alert-error">
          {error}
        </p>
      ) : null}

      {clientesCargando ? (
        <p role="status" aria-live="polite" className="app-description">
          Cargando clientes…
        </p>
      ) : null}

      {empleadosCargando ? (
        <p role="status" aria-live="polite" className="app-description">
          Cargando empleados…
        </p>
      ) : null}

      {clientesError ? (
        <div role="alert" className="alert alert-error catalogo-error">
          <span>{clientesError}</span>
          <button
            type="button"
            className="boton-secundario boton-compacto"
            disabled={operacion !== null || clientesCargando}
            onClick={() => setRecargaClientes((valor) => valor + 1)}
          >
            Reintentar clientes
          </button>
        </div>
      ) : null}

      {empleadosError ? (
        <div role="alert" className="alert alert-error catalogo-error">
          <span>{empleadosError}</span>
          <button
            type="button"
            className="boton-secundario boton-compacto"
            disabled={operacion !== null || empleadosCargando}
            onClick={() => setRecargaEmpleados((valor) => valor + 1)}
          >
            Reintentar empleados
          </button>
        </div>
      ) : null}

      {errorAccion && !modalAbierto ? (
        <p role="alert" className="alert alert-error">
          {errorAccion}
        </p>
      ) : null}

      <section
        className="app-card"
        aria-labelledby="agenda-citas-titulo"
        aria-busy={cargando || operacion !== null}
      >
        <div className="seccion-cabecera agenda-filtros">
          <div>
            <h3 id="agenda-citas-titulo" className="seccion-titulo">
              Citas programadas
            </h3>
            <p className="app-description">Filtra la agenda por día.</p>
          </div>
          <div className="filtro-fecha">
            <label htmlFor="cita-fecha">Fecha</label>
            <input
              id="cita-fecha"
              type="date"
              value={fechaFiltro}
              disabled={operacion !== null}
              onChange={(event) => setFechaFiltro(event.target.value)}
            />
            {fechaFiltro ? (
              <button
                type="button"
                className="boton-secundario boton-compacto"
                disabled={operacion !== null}
                onClick={() => setFechaFiltro('')}
              >
                Limpiar
              </button>
            ) : null}
          </div>
        </div>

        {cargando ? (
          <p role="status" aria-live="polite" className="app-empty">
            Cargando agenda…
          </p>
        ) : error !== null ? null : citas.length === 0 ? (
          <p className="app-empty">No hay citas para mostrar.</p>
        ) : (
          <div
            className="tabla-contenedor citas-tabla-contenedor"
            role="region"
            aria-label="Tabla de citas, desplazamiento horizontal"
            tabIndex={0}
          >
            <table
              className="productos-tabla citas-tabla"
              aria-label="Citas programadas"
            >
              <thead>
                <tr>
                  <th scope="col">Fecha y hora</th>
                  <th scope="col">Cliente</th>
                  <th scope="col">Empleado</th>
                  <th scope="col">Motivo</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {citas.map((cita) => (
                  <tr key={cita.id}>
                    <td>
                      <span className="cita-fecha">
                        {formatearFechaHora(cita.inicio)}
                      </span>
                      <span className="cita-hora-fin">
                        hasta {formatearFechaHora(cita.fin)}
                      </span>
                    </td>
                    <td>{cita.clienteNombre}</td>
                    <td>{cita.empleadoNombre}</td>
                    <td>{cita.motivo ?? '—'}</td>
                    <td>
                      <span
                        className={`estado-badge ${CLASES_ESTADO[cita.estado]}`}
                      >
                        {cita.estado}
                      </span>
                    </td>
                    <td>
                      <div className="acciones-tabla">
                        {ACCIONES_POR_ESTADO[cita.estado].map((accion) => {
                          const clave = `${cita.id}:${accion.transicion}`;
                          const enCurso = operacion === clave;

                          return (
                            <button
                              key={accion.transicion}
                              type="button"
                              className="boton-secundario boton-compacto"
                              disabled={operacion !== null}
                              aria-label={`${accion.etiqueta} cita de ${cita.clienteNombre}${
                                enCurso ? ', en curso' : ''
                              }`}
                              onClick={() => {
                                void transicionarCita(cita, accion.transicion);
                              }}
                            >
                              {enCurso ? '…' : accion.etiqueta}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {modalAbierto ? (
        <div className="modal-backdrop">
          <section
            ref={modalRef}
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="nueva-cita-titulo"
            tabIndex={-1}
          >
            <div className="modal-header">
              <h3 id="nueva-cita-titulo" className="seccion-titulo">
                Nueva cita
              </h3>
              <button
                type="button"
                className="modal-cerrar"
                aria-label="Cerrar modal de nueva cita"
                disabled={operacion === 'crear'}
                onClick={cerrarModal}
              >
                ×
              </button>
            </div>

            <form className="cita-form" onSubmit={(event) => void crearCita(event)}>
              <div className="cita-form-campo">
                <label htmlFor="cita-cliente">Cliente</label>
                <select
                  id="cita-cliente"
                  value={clienteId}
                  required
                  autoFocus
                  disabled={operacion !== null}
                  onChange={(event) => setClienteId(event.target.value)}
                >
                  <option value="">Selecciona un cliente</option>
                  {clientes.map((cliente) => (
                    <option key={cliente.id} value={cliente.id}>
                      {cliente.nombre} — {cliente.documento}
                    </option>
                  ))}
                </select>
              </div>

              <div className="cita-form-campo">
                <label htmlFor="cita-empleado">Empleado</label>
                <select
                  id="cita-empleado"
                  value={empleadoId}
                  required
                  disabled={operacion !== null}
                  onChange={(event) => setEmpleadoId(event.target.value)}
                >
                  <option value="">Selecciona un empleado</option>
                  {empleadosActivos.map((empleado) => (
                    <option key={empleado.id} value={empleado.id}>
                      {empleado.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="cita-form-campo">
                <label htmlFor="cita-inicio">Inicio</label>
                <input
                  id="cita-inicio"
                  type="datetime-local"
                  value={inicioLocal}
                  required
                  disabled={operacion !== null}
                  onChange={(event) => setInicioLocal(event.target.value)}
                />
              </div>

              <div className="cita-form-campo">
                <label htmlFor="cita-fin">Fin</label>
                <input
                  id="cita-fin"
                  type="datetime-local"
                  value={finLocal}
                  required
                  disabled={operacion !== null}
                  onChange={(event) => setFinLocal(event.target.value)}
                />
              </div>

              <div className="cita-form-campo cita-form-campo-ancho">
                <label htmlFor="cita-motivo">Motivo</label>
                <input
                  id="cita-motivo"
                  type="text"
                  value={motivo}
                  disabled={operacion !== null}
                  onChange={(event) => setMotivo(event.target.value)}
                />
              </div>

              {errorAccion ? (
                <p role="alert" className="alert alert-error">
                  {errorAccion}
                </p>
              ) : null}

              <div className="modal-actions">
                <button
                  type="button"
                  className="boton-secundario"
                  disabled={operacion === 'crear'}
                  onClick={cerrarModal}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={operacion === 'crear' || cargando}
                >
                  {operacion === 'crear' ? 'Guardando…' : 'Crear cita'}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Citas } from './Citas';
import type { Cita, EstadoCita } from '../types';

const CLIENTE = {
  id: 'cliente-1',
  nombre: 'Ana González',
  documento: '12345678',
  email: 'ana@example.com',
  telefono: '3001112233',
  canalPreferido: 'email',
};

const EMPLEADO = {
  id: 'empleado-1',
  nombre: 'Laura Pérez',
  email: 'laura@example.com',
  telefono: '3002223344',
  activo: true,
};

const EMPLEADO_INACTIVO = {
  id: 'empleado-2',
  nombre: 'Empleado inactivo',
  email: null,
  telefono: null,
  activo: false,
};

const CITA_PENDIENTE: Cita = {
  id: 'cita-1',
  clienteId: CLIENTE.id,
  clienteNombre: CLIENTE.nombre,
  empleadoId: EMPLEADO.id,
  empleadoNombre: EMPLEADO.nombre,
  inicio: '2026-11-25T15:00:00.000Z',
  fin: '2026-11-25T16:00:00.000Z',
  estado: 'Pendiente',
  motivo: 'Corte y color',
};

const CITA_PENDIENTE_CANCELABLE: Cita = {
  ...CITA_PENDIENTE,
  id: 'cita-2',
  clienteNombre: 'Carlos Ramírez',
  motivo: 'Manicure',
};

const CITA_CONFIRMADA: Cita = {
  ...CITA_PENDIENTE,
  id: 'cita-3',
  clienteNombre: 'Cliente Confirmada',
  estado: 'Confirmada',
};

const CITA_EN_PROCESO: Cita = {
  ...CITA_PENDIENTE,
  id: 'cita-4',
  clienteNombre: 'Cliente En Proceso',
  estado: 'En Proceso',
};

const CITA_COMPLETADA: Cita = {
  ...CITA_PENDIENTE,
  id: 'cita-5',
  clienteNombre: 'Cliente Completada',
  estado: 'Completada',
};

const CITA_CANCELADA: Cita = {
  ...CITA_PENDIENTE,
  id: 'cita-6',
  clienteNombre: 'Cliente Cancelada',
  estado: 'Cancelada',
};

type TransicionMock = 'confirmar' | 'iniciar' | 'completar' | 'cancelar';

const TRANSICIONES_PERMITIDAS: Record<EstadoCita, TransicionMock[]> = {
  Pendiente: ['confirmar', 'cancelar'],
  Confirmada: ['iniciar', 'cancelar'],
  'En Proceso': ['completar'],
  Completada: [],
  Cancelada: [],
};

const ESTADO_RESULTANTE: Record<TransicionMock, EstadoCita> = {
  confirmar: 'Confirmada',
  iniciar: 'En Proceso',
  completar: 'Completada',
  cancelar: 'Cancelada',
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

function urlCompletaDe(input: RequestInfo | URL): URL {
  return new URL(urlDe(input), 'http://nexo.local');
}

function cuerpoJson(init?: RequestInit): Record<string, unknown> | null {
  if (typeof init?.body !== 'string') {
    return null;
  }

  const cuerpo: unknown = JSON.parse(init.body);
  return typeof cuerpo === 'object' && cuerpo !== null && !Array.isArray(cuerpo)
    ? (cuerpo as Record<string, unknown>)
    : null;
}

interface OpcionesMock {
  citas?: Cita[];
  errorAgenda?: string;
  errorAgendaConFiltro?: string;
  errorClientes?: string;
  errorEmpleados?: string;
  errorCrear?: string;
  errorTransicion?: string;
  codigoErrorTransicion?: string;
  estadoConcurrente?: EstadoCita;
  retrasarAgenda?: boolean;
  retrasarCreacion?: boolean;
  retrasarTransicion?: boolean;
}

function instalarFetch(opciones: OpcionesMock = {}): ReturnType<typeof vi.fn> {
  let citas = [...(opciones.citas ?? [CITA_PENDIENTE])];

  const fetchMock = vi.fn(
    (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = urlCompletaDe(input);
      const ruta = url.pathname;

      if (ruta === '/api/citas' && (!init?.method || init.method === 'GET')) {
        if (opciones.errorAgendaConFiltro && url.searchParams.has('desde')) {
          return Promise.resolve(
            respuestaJson(
              { error: { message: opciones.errorAgendaConFiltro } },
              500,
            ),
          );
        }

        if (opciones.errorAgenda) {
          return Promise.resolve(
            respuestaJson(
              { error: { message: opciones.errorAgenda } },
              500,
            ),
          );
        }

        if (opciones.retrasarAgenda) {
          return new Promise<Response>(() => {});
        }

        const desde = url.searchParams.get('desde');
        const hasta = url.searchParams.get('hasta');
        const citasFiltradas =
          desde && hasta
            ? citas.filter((cita) => {
                const inicio = new Date(cita.inicio).getTime();
                const fin = new Date(cita.fin).getTime();
                return (
                  inicio < new Date(hasta).getTime() &&
                  fin > new Date(desde).getTime()
                );
              })
            : citas;

        return Promise.resolve(respuestaJson(citasFiltradas));
      }

      if (ruta === '/api/clientes') {
        if (opciones.errorClientes) {
          return Promise.resolve(
            respuestaJson(
              { error: { message: opciones.errorClientes } },
              500,
            ),
          );
        }

        return Promise.resolve(respuestaJson([CLIENTE]));
      }

      if (ruta === '/api/empleados') {
        if (opciones.errorEmpleados) {
          return Promise.resolve(
            respuestaJson(
              { error: { message: opciones.errorEmpleados } },
              500,
            ),
          );
        }

        return Promise.resolve(respuestaJson([EMPLEADO, EMPLEADO_INACTIVO]));
      }

      if (ruta === '/api/citas' && init?.method === 'POST') {
        if (opciones.errorCrear) {
          return Promise.resolve(
            respuestaJson(
              { error: { message: opciones.errorCrear } },
              409,
            ),
          );
        }

        const payload = cuerpoJson(init);
        const creada: Cita = {
          id: 'cita-creada',
          clienteId: String(payload?.clienteId),
          clienteNombre: CLIENTE.nombre,
          empleadoId: String(payload?.empleadoId),
          empleadoNombre: EMPLEADO.nombre,
          inicio: String(payload?.inicio),
          fin: String(payload?.fin),
          estado: 'Pendiente',
          motivo:
            typeof payload?.motivo === 'string' ? payload.motivo : null,
        };
        citas = [...citas, creada];

        if (opciones.retrasarCreacion) {
          return new Promise<Response>(() => {});
        }

        return Promise.resolve(respuestaJson(creada, 201));
      }

      const detalle = /^\/api\/citas\/([^/]+)$/.exec(ruta);
      if (detalle && (!init?.method || init.method === 'GET')) {
        const id = detalle[1];
        const cita = citas.find((item) => item.id === id);
        return Promise.resolve(
          cita
            ? respuestaJson(cita)
            : respuestaJson({ error: { message: 'Cita no encontrada' } }, 404),
        );
      }

      const transicion =
        /^\/api\/citas\/([^/]+)\/(confirmar|iniciar|completar|cancelar)$/.exec(
          ruta,
        );

      if (transicion) {
        const id = transicion[1];
        const accion = transicion[2];
        if (
          !id ||
          (accion !== 'confirmar' &&
            accion !== 'iniciar' &&
            accion !== 'completar' &&
            accion !== 'cancelar')
        ) {
          return Promise.resolve(respuestaJson({}, 404));
        }

        const actual = citas.find((cita) => cita.id === id);
        if (!actual) {
          return Promise.resolve(
            respuestaJson({ error: { message: 'Cita no encontrada' } }, 404),
          );
        }

        if (!TRANSICIONES_PERMITIDAS[actual.estado].includes(accion)) {
          return Promise.resolve(
            respuestaJson(
              {
                error: {
                  code: 'TRANSICION_CITA_INVALIDA',
                  message: 'Transición de cita inválida',
                },
              },
              409,
            ),
          );
        }

        if (opciones.errorTransicion) {
          if (opciones.estadoConcurrente) {
            citas = citas.map((cita) =>
              cita.id === id
                ? { ...cita, estado: opciones.estadoConcurrente ?? cita.estado }
                : cita,
            );
          }

          return Promise.resolve(
            respuestaJson(
              {
                error: {
                  code: opciones.codigoErrorTransicion ?? 'CITA_SOLAPADA',
                  message: opciones.errorTransicion,
                },
              },
              409,
            ),
          );
        }

        if (opciones.retrasarTransicion) {
          return new Promise<Response>(() => {});
        }

        const estadoNuevo = ESTADO_RESULTANTE[accion];
        const citasActualizadas = citas.map((cita) =>
          cita.id === id ? { ...cita, estado: estadoNuevo } : cita,
        );
        citas = citasActualizadas;
        const actualizada = citasActualizadas.find((cita) => cita.id === id);

        return Promise.resolve(
          respuestaJson(
            actualizada ?? { ...CITA_PENDIENTE, estado: estadoNuevo },
          ),
        );
      }

      return Promise.resolve(
        respuestaJson({ error: { message: 'No encontrado' } }, 404),
      );
    },
  );

  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function filaDe(clienteNombre: string): HTMLElement {
  const fila = screen.getByText(clienteNombre).closest('tr');

  if (!(fila instanceof HTMLElement)) {
    throw new Error(`No se encontró la fila de ${clienteNombre}`);
  }

  return fila;
}

function completarFormulario(): void {
  fireEvent.change(screen.getByLabelText('Cliente'), {
    target: { value: CLIENTE.id },
  });
  fireEvent.change(screen.getByLabelText('Empleado'), {
    target: { value: EMPLEADO.id },
  });
  fireEvent.change(screen.getByLabelText('Inicio'), {
    target: { value: '2026-11-25T10:00' },
  });
  fireEvent.change(screen.getByLabelText('Fin'), {
    target: { value: '2026-11-25T11:00' },
  });
  fireEvent.change(screen.getByLabelText('Motivo'), {
    target: { value: 'Corte y color' },
  });
}

describe('Agenda de citas', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renderiza la agenda con fecha, participantes, motivo y estado', async () => {
    instalarFetch();

    render(<Citas />);

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Agenda de citas' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('Ana González')).toBeInTheDocument();
    expect(screen.getByText('Laura Pérez')).toBeInTheDocument();
    expect(screen.getByText('Corte y color')).toBeInTheDocument();
    expect(screen.getByText('25/11/2026 10:00')).toBeInTheDocument();
    expect(screen.getByText('Pendiente')).toBeInTheDocument();
  });

  it('crea una cita interpretando el formulario en America/Bogota', async () => {
    const fetchMock = instalarFetch();

    render(<Citas />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Nueva cita' }),
    );
    completarFormulario();
    fireEvent.click(screen.getByRole('button', { name: 'Crear cita' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/citas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteId: CLIENTE.id,
          empleadoId: EMPLEADO.id,
          inicio: '2026-11-25T15:00:00.000Z',
          fin: '2026-11-25T16:00:00.000Z',
          motivo: 'Corte y color',
        }),
      });
    });
    await waitFor(() =>
      expect(screen.getAllByText('25/11/2026 10:00')).toHaveLength(2),
    );
  });

  it('expone únicamente empleados activos en el selector', async () => {
    instalarFetch();

    render(<Citas />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Nueva cita' }),
    );

    const selector = screen.getByLabelText('Empleado');
    expect(
      within(selector).getByRole('option', { name: EMPLEADO.nombre }),
    ).toBeInTheDocument();
    expect(
      within(selector).queryByRole('option', {
        name: EMPLEADO_INACTIVO.nombre,
      }),
    ).not.toBeInTheDocument();
  });

  it('expone exactamente las acciones permitidas por cada estado', async () => {
    instalarFetch({
      citas: [
        CITA_PENDIENTE,
        CITA_CONFIRMADA,
        CITA_EN_PROCESO,
        CITA_COMPLETADA,
        CITA_CANCELADA,
      ],
    });

    render(<Citas />);

    await screen.findByText(CITA_PENDIENTE.clienteNombre);

    const pendiente = filaDe(CITA_PENDIENTE.clienteNombre);
    expect(
      within(pendiente).getByRole('button', {
        name: `Confirmar cita de ${CITA_PENDIENTE.clienteNombre}`,
      }),
    ).toBeInTheDocument();
    expect(
      within(pendiente).getByRole('button', {
        name: `Cancelar cita de ${CITA_PENDIENTE.clienteNombre}`,
      }),
    ).toBeInTheDocument();

    const confirmada = filaDe(CITA_CONFIRMADA.clienteNombre);
    expect(
      within(confirmada).getByRole('button', {
        name: `Iniciar cita de ${CITA_CONFIRMADA.clienteNombre}`,
      }),
    ).toBeInTheDocument();
    expect(
      within(confirmada).getByRole('button', {
        name: `Cancelar cita de ${CITA_CONFIRMADA.clienteNombre}`,
      }),
    ).toBeInTheDocument();

    const enProceso = filaDe(CITA_EN_PROCESO.clienteNombre);
    expect(
      within(enProceso).getByRole('button', {
        name: `Completar cita de ${CITA_EN_PROCESO.clienteNombre}`,
      }),
    ).toBeInTheDocument();
    expect(
      within(enProceso).queryByRole('button', {
        name: `Cancelar cita de ${CITA_EN_PROCESO.clienteNombre}`,
      }),
    ).not.toBeInTheDocument();

    expect(
      within(filaDe(CITA_COMPLETADA.clienteNombre)).queryByRole('button'),
    ).not.toBeInTheDocument();
    expect(
      within(filaDe(CITA_CANCELADA.clienteNombre)).queryByRole('button'),
    ).not.toBeInTheDocument();
  });

  it('confirma, inicia, completa y cancela según el estado', async () => {
    const fetchMock = instalarFetch({
      citas: [CITA_PENDIENTE, CITA_PENDIENTE_CANCELABLE],
    });

    render(<Citas />);

    await screen.findByText(CLIENTE.nombre);
    await screen.findByText('Carlos Ramírez');
    const filaFlujo = filaDe(CLIENTE.nombre);
    const filaCancelable = filaDe('Carlos Ramírez');

    fireEvent.click(
      within(filaFlujo).getByRole('button', {
        name: `Confirmar cita de ${CLIENTE.nombre}`,
      }),
    );
    await waitFor(() =>
      expect(within(filaFlujo).getByText('Confirmada')).toBeInTheDocument(),
    );

    fireEvent.click(
      within(filaFlujo).getByRole('button', {
        name: `Iniciar cita de ${CLIENTE.nombre}`,
      }),
    );
    await waitFor(() =>
      expect(within(filaFlujo).getByText('En Proceso')).toBeInTheDocument(),
    );

    fireEvent.click(
      within(filaFlujo).getByRole('button', {
        name: `Completar cita de ${CLIENTE.nombre}`,
      }),
    );
    await waitFor(() =>
      expect(within(filaFlujo).getByText('Completada')).toBeInTheDocument(),
    );

    fireEvent.click(
      within(filaCancelable).getByRole('button', {
        name: 'Cancelar cita de Carlos Ramírez',
      }),
    );
    await waitFor(() =>
      expect(within(filaCancelable).getByText('Cancelada')).toBeInTheDocument(),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/citas/${CITA_PENDIENTE.id}/confirmar`,
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/citas/${CITA_PENDIENTE.id}/iniciar`,
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/citas/${CITA_PENDIENTE.id}/completar`,
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/citas/${CITA_PENDIENTE_CANCELABLE.id}/cancelar`,
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('muestra el error del backend al intentar una transición', async () => {
    instalarFetch({ errorTransicion: 'La cita ya tiene otra transición' });

    render(<Citas />);

    await screen.findByText(CLIENTE.nombre);
    const fila = filaDe(CLIENTE.nombre);
    fireEvent.click(
      within(fila).getByRole('button', {
        name: `Confirmar cita de ${CLIENTE.nombre}`,
      }),
    );

    expect(
      await screen.findByText('La cita ya tiene otra transición'),
    ).toBeInTheDocument();
  });

  it('reconcilia el estado visible después de un conflicto concurrente', async () => {
    const fetchMock = instalarFetch({
      errorTransicion: 'La cita cambió de estado',
      codigoErrorTransicion: 'CONFLICTO_ESTADO_CITA',
      estadoConcurrente: 'Confirmada',
    });

    render(<Citas />);

    await screen.findByText(CLIENTE.nombre);
    const fila = filaDe(CLIENTE.nombre);
    fireEvent.click(
      within(fila).getByRole('button', {
        name: `Confirmar cita de ${CLIENTE.nombre}`,
      }),
    );

    expect(await screen.findByText('La cita cambió de estado')).toBeInTheDocument();
    await waitFor(() =>
      expect(within(fila).getByText('Confirmada')).toBeInTheDocument(),
    );
    expect(
      within(fila).queryByRole('button', {
        name: `Confirmar cita de ${CLIENTE.nombre}`,
      }),
    ).not.toBeInTheDocument();
    expect(
      within(fila).getByRole('button', {
        name: `Iniciar cita de ${CLIENTE.nombre}`,
      }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(`/api/citas/${CITA_PENDIENTE.id}`);
  });

  it('filtra la agenda por el rango diario de Bogotá', async () => {
    const fetchMock = instalarFetch();

    render(<Citas />);

    fireEvent.change(await screen.findByLabelText('Fecha'), {
      target: { value: '2026-11-25' },
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/citas?desde=2026-11-25T05%3A00%3A00.000Z&hasta=2026-11-26T05%3A00%3A00.000Z',
      );
    });
  });

  it('no agrega una cita creada fuera del filtro activo', async () => {
    instalarFetch();

    render(<Citas />);

    fireEvent.change(await screen.findByLabelText('Fecha'), {
      target: { value: '2026-11-26' },
    });
    await screen.findByText('No hay citas para mostrar.');

    fireEvent.click(screen.getByRole('button', { name: 'Nueva cita' }));
    completarFormulario();
    fireEvent.click(screen.getByRole('button', { name: 'Crear cita' }));

    await waitFor(() =>
      expect(screen.getByText('No hay citas para mostrar.')).toBeInTheDocument(),
    );
    expect(screen.queryByText(CLIENTE.nombre)).not.toBeInTheDocument();
  });

  it('no conserva la lista anterior cuando falla el filtro', async () => {
    instalarFetch({ errorAgendaConFiltro: 'No se pudo filtrar la agenda' });

    render(<Citas />);

    await screen.findByText(CLIENTE.nombre);
    fireEvent.change(screen.getByLabelText('Fecha'), {
      target: { value: '2026-11-26' },
    });

    expect(
      await screen.findByText('No se pudo filtrar la agenda'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText(CLIENTE.nombre)).not.toBeInTheDocument();
  });

  it('muestra el error al crear una cita y conserva el modal abierto', async () => {
    instalarFetch({ errorCrear: 'El empleado ya tiene una cita' });

    render(<Citas />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Nueva cita' }),
    );
    completarFormulario();
    fireEvent.click(screen.getByRole('button', { name: 'Crear cita' }));

    expect(
      await screen.findByText('El empleado ya tiene una cita'),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('anuncia la carga de la agenda', () => {
    instalarFetch({ retrasarAgenda: true });

    render(<Citas />);

    expect(screen.getByText('Cargando agenda…')).toBeInTheDocument();
    expect(screen.getByText('Cargando clientes y empleados…')).toBeInTheDocument();
  });

  it('muestra el error de carga de la agenda', async () => {
    instalarFetch({ errorAgenda: 'No se pudo cargar la agenda' });

    render(<Citas />);

    expect(
      await screen.findByText('No se pudo cargar la agenda'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('deshabilita la creación si falla un catálogo y ofrece reintento', async () => {
    instalarFetch({ errorClientes: 'No se pudieron cargar los clientes' });

    render(<Citas />);

    expect(
      await screen.findByText('No se pudieron cargar los clientes'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nueva cita' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Reintentar catálogos' }),
    ).toBeInTheDocument();
  });

  it('gestiona foco, Escape y contención de Tab en el modal', async () => {
    instalarFetch();

    render(<Citas />);

    const nuevaCita = await screen.findByRole('button', { name: 'Nueva cita' });
    fireEvent.click(nuevaCita);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Cliente')).toHaveFocus();

    const cerrar = screen.getByRole('button', {
      name: 'Cerrar modal de nueva cita',
    });
    const crear = screen.getByRole('button', { name: 'Crear cita' });
    cerrar.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(crear).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(cerrar).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(nuevaCita).toHaveFocus();
  });

  it('deshabilita los controles mientras se crea una cita', async () => {
    instalarFetch({ retrasarCreacion: true });

    render(<Citas />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Nueva cita' }),
    );
    completarFormulario();
    fireEvent.click(screen.getByRole('button', { name: 'Crear cita' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled(),
    );
    expect(screen.getByLabelText('Cliente')).toBeDisabled();
    expect(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }),
    ).toBeDisabled();
  });

  it('deshabilita los controles mientras se transiciona una cita', async () => {
    instalarFetch({ retrasarTransicion: true });

    render(<Citas />);

    await screen.findByText(CLIENTE.nombre);
    const fila = filaDe(CLIENTE.nombre);
    fireEvent.click(
      within(fila).getByRole('button', {
        name: `Confirmar cita de ${CLIENTE.nombre}`,
      }),
    );

    await waitFor(() =>
      expect(
        within(fila).getByRole('button', {
          name: `Confirmar cita de ${CLIENTE.nombre}, en curso`,
        }),
      ).toBeDisabled(),
    );
    expect(screen.getByRole('button', { name: 'Nueva cita' })).toBeDisabled();
    expect(screen.getByLabelText('Fecha')).toBeDisabled();
  });
});

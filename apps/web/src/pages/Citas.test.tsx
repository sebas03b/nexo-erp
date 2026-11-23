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

function rutaDe(input: RequestInfo | URL): string {
  return new URL(urlDe(input), 'http://nexo.local').pathname;
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
  errorCrear?: string;
  errorTransicion?: string;
  retrasarCreacion?: boolean;
}

function instalarFetch(opciones: OpcionesMock = {}): ReturnType<typeof vi.fn> {
  let citas = [...(opciones.citas ?? [CITA_PENDIENTE])];

  const fetchMock = vi.fn(
    (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const ruta = rutaDe(input);

      if (ruta === '/api/citas' && (!init?.method || init.method === 'GET')) {
        return Promise.resolve(respuestaJson(citas));
      }

      if (ruta === '/api/clientes') {
        return Promise.resolve(respuestaJson([CLIENTE]));
      }

      if (ruta === '/api/empleados') {
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

      const transicion = /^\/api\/citas\/([^/]+)\/(confirmar|iniciar|completar|cancelar)$/.exec(
        ruta,
      );

      if (transicion) {
        if (opciones.errorTransicion) {
          return Promise.resolve(
            respuestaJson(
              { error: { message: opciones.errorTransicion } },
              409,
            ),
          );
        }

        const id = transicion[1];
        const accion = transicion[2];
        if (!id || !accion) {
          return Promise.resolve(respuestaJson({}, 404));
        }

        if (
          accion !== 'confirmar' &&
          accion !== 'iniciar' &&
          accion !== 'completar' &&
          accion !== 'cancelar'
        ) {
          return Promise.resolve(respuestaJson({}, 404));
        }

        const estados: Record<
          'confirmar' | 'iniciar' | 'completar' | 'cancelar',
          EstadoCita
        > = {
          confirmar: 'Confirmada',
          iniciar: 'En Proceso',
          completar: 'Completada',
          cancelar: 'Cancelada',
        };
        const estadoNuevo = estados[accion];
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

      return Promise.resolve(respuestaJson({ error: { message: 'No encontrado' } }, 404));
    },
  );

  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
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
      target: { value: '  Corte y color  ' },
    });
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
    expect(within(selector).getByRole('option', { name: EMPLEADO.nombre })).toBeInTheDocument();
    expect(
      within(selector).queryByRole('option', { name: EMPLEADO_INACTIVO.nombre }),
    ).not.toBeInTheDocument();
  });

  it('confirma, inicia, completa y cancela según el estado', async () => {
    const fetchMock = instalarFetch({
      citas: [CITA_PENDIENTE, CITA_PENDIENTE_CANCELABLE],
    });

    render(<Citas />);

    const filaFlujo = (await screen.findByText(CLIENTE.nombre)).closest('tr');
    const filaCancelable = (
      await screen.findByText('Carlos Ramírez')
    ).closest('tr');
    expect(filaFlujo).not.toBeNull();
    expect(filaCancelable).not.toBeNull();

    fireEvent.click(
      within(filaFlujo as HTMLElement).getByRole('button', { name: 'Confirmar' }),
    );
    await waitFor(() =>
      expect(within(filaFlujo as HTMLElement).getByText('Confirmada')).toBeInTheDocument(),
    );

    fireEvent.click(
      within(filaFlujo as HTMLElement).getByRole('button', { name: 'Iniciar' }),
    );
    await waitFor(() =>
      expect(within(filaFlujo as HTMLElement).getByText('En Proceso')).toBeInTheDocument(),
    );

    fireEvent.click(
      within(filaFlujo as HTMLElement).getByRole('button', { name: 'Completar' }),
    );
    await waitFor(() =>
      expect(within(filaFlujo as HTMLElement).getByText('Completada')).toBeInTheDocument(),
    );

    fireEvent.click(
      within(filaCancelable as HTMLElement).getByRole('button', { name: 'Cancelar' }),
    );
    await waitFor(() =>
      expect(within(filaCancelable as HTMLElement).getByText('Cancelada')).toBeInTheDocument(),
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
    instalarFetch({ errorTransicion: 'La cita cambió de estado' });

    render(<Citas />);

    const fila = (await screen.findByText(CLIENTE.nombre)).closest('tr');
    expect(fila).not.toBeNull();
    fireEvent.click(
      within(fila as HTMLElement).getByRole('button', { name: 'Confirmar' }),
    );

    expect(await screen.findByText('La cita cambió de estado')).toBeInTheDocument();
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

  it('deshabilita los controles mientras se crea una cita', async () => {
    instalarFetch({ retrasarCreacion: true });

    render(<Citas />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Nueva cita' }),
    );
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
    fireEvent.click(screen.getByRole('button', { name: 'Crear cita' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled(),
    );
    expect(screen.getByLabelText('Cliente')).toBeDisabled();
    expect(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }),
    ).toBeDisabled();
  });
});

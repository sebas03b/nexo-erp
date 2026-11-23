import { describe, expect, it } from 'vitest';

import { Cita, crearEstadoCita } from './cita.js';
import type { EstadoCita } from './cita-estado.js';

type AccionCita = 'confirmar' | 'iniciar' | 'completar' | 'cancelar';

const ESTADOS: readonly EstadoCita[] = [
  'Pendiente',
  'Confirmada',
  'En Proceso',
  'Completada',
  'Cancelada',
];

const ACCIONES: readonly AccionCita[] = [
  'confirmar',
  'iniciar',
  'completar',
  'cancelar',
];

const MATRIZ_TRANSICIONES: Record<
  EstadoCita,
  Record<AccionCita, EstadoCita | null>
> = {
  Pendiente: {
    confirmar: 'Confirmada',
    iniciar: null,
    completar: null,
    cancelar: 'Cancelada',
  },
  Confirmada: {
    confirmar: null,
    iniciar: 'En Proceso',
    completar: null,
    cancelar: 'Cancelada',
  },
  'En Proceso': {
    confirmar: null,
    iniciar: null,
    completar: 'Completada',
    cancelar: null,
  },
  Completada: {
    confirmar: null,
    iniciar: null,
    completar: null,
    cancelar: null,
  },
  Cancelada: {
    confirmar: null,
    iniciar: null,
    completar: null,
    cancelar: null,
  },
};

function crearCita(estado: EstadoCita = 'Pendiente'): Cita {
  return new Cita({
    id: 'cita-1',
    clienteId: 'cliente-1',
    empleadoId: 'empleado-1',
    inicio: new Date('2026-11-25T15:00:00.000Z'),
    fin: new Date('2026-11-25T16:00:00.000Z'),
    estado,
  });
}

describe('Patrón State - Cita', () => {
  it('permite todas las transiciones legales', () => {
    for (const estadoActual of ESTADOS) {
      for (const accion of ACCIONES) {
        const estadoDestino = MATRIZ_TRANSICIONES[estadoActual][accion];
        if (!estadoDestino) {
          continue;
        }

        const cita = crearCita(estadoActual);
        cita[accion]();

        expect(cita.estado).toBe(estadoDestino);
      }
    }
  });

  it('rechaza todas las transiciones ilegales y conserva el estado', () => {
    for (const estadoActual of ESTADOS) {
      for (const accion of ACCIONES) {
        const estadoDestino = MATRIZ_TRANSICIONES[estadoActual][accion];
        if (estadoDestino) {
          continue;
        }

        const cita = crearCita(estadoActual);

        expect(() => cita[accion]()).toThrowError(
          `Transición de cita inválida: ${estadoActual} →`,
        );
        expect(cita.estado).toBe(estadoActual);
      }
    }
  });

  it('expone el código TRANSICION_CITA_INVALIDA para una transición ilegal', () => {
    const cita = crearCita('Cancelada');

    try {
      cita.completar();
      expect.fail('La transición debería haber sido rechazada');
    } catch (caught) {
      expect(caught).toBeInstanceOf(Error);
      expect(caught).toMatchObject({
        code: 'TRANSICION_CITA_INVALIDA',
        statusCode: 409,
        message: 'Transición de cita inválida: Cancelada → Completada',
      });
    }

    expect(cita.estado).toBe('Cancelada');
  });

  it('completa el flujo Pendiente → Confirmada → En Proceso → Completada', () => {
    const cita = crearCita();

    cita.confirmar();
    expect(cita.estado).toBe('Confirmada');

    cita.iniciar();
    expect(cita.estado).toBe('En Proceso');

    cita.completar();
    expect(cita.estado).toBe('Completada');
  });

  it('rechaza fechas inválidas o un fin anterior al inicio', () => {
    expect(
      () =>
        new Cita({
          id: 'cita-1',
          clienteId: 'cliente-1',
          empleadoId: 'empleado-1',
          inicio: new Date('2026-11-25T15:00:00.000Z'),
          fin: new Date('2026-11-25T15:00:00.000Z'),
          estado: 'Pendiente',
        }),
    ).toThrowError('Las fechas de la cita son inválidas');

    expect(
      () =>
        new Cita({
          id: 'cita-1',
          clienteId: 'cliente-1',
          empleadoId: 'empleado-1',
          inicio: new Date('fecha-invalida'),
          fin: new Date('2026-11-25T15:00:00.000Z'),
          estado: 'Pendiente',
        }),
    ).toThrowError('Las fechas de la cita son inválidas');
  });

  it('rechaza un estado desconocido', () => {
    expect(() => crearEstadoCita('Inventado')).toThrowError(
      'Estado de cita desconocido',
    );
  });

  it('rechaza identificadores vacíos', () => {
    expect(
      () =>
        new Cita({
          id: '',
          clienteId: 'cliente-1',
          empleadoId: 'empleado-1',
          inicio: new Date('2026-11-25T15:00:00.000Z'),
          fin: new Date('2026-11-25T16:00:00.000Z'),
          estado: 'Pendiente',
        }),
    ).toThrowError('El campo id de la cita es obligatorio');
  });

  it('serializa las fechas como ISO', () => {
    expect(crearCita().toJSON()).toEqual({
      id: 'cita-1',
      clienteId: 'cliente-1',
      empleadoId: 'empleado-1',
      inicio: '2026-11-25T15:00:00.000Z',
      fin: '2026-11-25T16:00:00.000Z',
      estado: 'Pendiente',
      motivo: null,
    });
  });
});

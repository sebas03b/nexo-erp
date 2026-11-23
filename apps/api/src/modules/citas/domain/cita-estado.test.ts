import { describe, expect, it } from 'vitest';

import { Cita } from './cita.js';

function crearCita() {
  return Cita.crear({
    id: 'cita-1',
    clienteId: 'cliente-1',
    empleadoId: null,
    inicio: new Date('2026-01-01T10:00:00Z'),
    fin: new Date('2026-01-01T11:00:00Z'),
    notas: null,
  });
}

describe('Patrón State - Cita', () => {
  it('sigue la cadena completa Pendiente → Confirmada → En Proceso → Completada', () => {
    const cita = crearCita();
    cita.confirmar();
    expect(cita.estado).toBe('Confirmada');
    cita.iniciar();
    expect(cita.estado).toBe('En Proceso');
    cita.completar();
    expect(cita.estado).toBe('Completada');
  });

  it('permite cancelar desde Pendiente, Confirmada y En Proceso', () => {
    const desdePendiente = crearCita();
    desdePendiente.cancelar();
    expect(desdePendiente.estado).toBe('Cancelada');

    const desdeConfirmada = crearCita();
    desdeConfirmada.confirmar();
    desdeConfirmada.cancelar();
    expect(desdeConfirmada.estado).toBe('Cancelada');

    const desdeEnProceso = crearCita();
    desdeEnProceso.confirmar();
    desdeEnProceso.iniciar();
    desdeEnProceso.cancelar();
    expect(desdeEnProceso.estado).toBe('Cancelada');
  });

  it('rechaza transiciones inválidas con 409 y mensaje exacto', () => {
    const cancelada = crearCita();
    cancelada.cancelar();
    expect(() => cancelada.completar()).toThrowError(
      expect.objectContaining({
        message: 'Transición de cita inválida: Cancelada → Completada',
        statusCode: 409,
        code: 'TRANSICION_INVALIDA',
      }),
    );

    const completada = crearCita();
    completada.confirmar();
    completada.iniciar();
    completada.completar();
    expect(() => completada.confirmar()).toThrowError(
      expect.objectContaining({
        message: 'Transición de cita inválida: Completada → Confirmada',
        statusCode: 409,
      }),
    );

    const pendiente = crearCita();
    expect(() => pendiente.completar()).toThrowError(
      expect.objectContaining({
        message: 'Transición de cita inválida: Pendiente → Completada',
        statusCode: 409,
      }),
    );

    const enProceso = crearCita();
    enProceso.confirmar();
    enProceso.iniciar();
    expect(() => enProceso.confirmar()).toThrowError(
      expect.objectContaining({
        message: 'Transición de cita inválida: En Proceso → Confirmada',
        statusCode: 409,
      }),
    );

    const cancelada2 = crearCita();
    cancelada2.cancelar();
    expect(() => cancelada2.cancelar()).toThrowError(
      expect.objectContaining({
        message: 'Transición de cita inválida: Cancelada → Cancelada',
        statusCode: 409,
      }),
    );
  });
});

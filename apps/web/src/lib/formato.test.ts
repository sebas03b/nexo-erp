import { describe, expect, it } from 'vitest';

import {
  convertirDateTimeLocalAISO,
  obtenerRangoDiaBogota,
} from './formato';

describe('formatos de agenda en America/Bogota', () => {
  it('convierte datetime-local a ISO interpretando la hora de Bogotá', () => {
    expect(convertirDateTimeLocalAISO('2026-11-25T10:00')).toBe(
      '2026-11-25T15:00:00.000Z',
    );
  });

  it('construye un rango diario semiabierto en Bogotá', () => {
    expect(obtenerRangoDiaBogota('2026-11-25')).toEqual({
      desde: '2026-11-25T05:00:00.000Z',
      hasta: '2026-11-26T05:00:00.000Z',
    });
  });

  it('rechaza fechas locales imposibles', () => {
    expect(() => convertirDateTimeLocalAISO('2026-02-30T10:00')).toThrow(
      'La fecha y hora local no son válidas',
    );
    expect(() => obtenerRangoDiaBogota('2026-02-30')).toThrow(
      'La fecha del filtro no es válida',
    );
  });
});

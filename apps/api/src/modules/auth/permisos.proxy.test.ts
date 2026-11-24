import { describe, expect, it } from 'vitest';
import { crearPermisosProxy } from './permisos.proxy.js';

class CajaServiceMock {
  async abrirCaja(): Promise<string> {
    return 'caja abierta';
  }

  async cerrarCaja(): Promise<string> {
    return 'caja cerrada';
  }

  async listarCajas(): Promise<string[]> {
    return ['caja-1'];
  }
}

class ContabilidadServiceMock {
  async listarAsientos(): Promise<string[]> {
    return ['asiento-1'];
  }

  async resumenVentas(): Promise<string> {
    return 'resumen';
  }
}

describe('Patrón Proxy - Permisos', () => {
  it('admin puede acceder a todo', async () => {
    const caja = crearPermisosProxy(new CajaServiceMock(), 'admin');
    const contabilidad = crearPermisosProxy(new ContabilidadServiceMock(), 'admin');

    await expect(caja.abrirCaja()).resolves.toBe('caja abierta');
    await expect(caja.cerrarCaja()).resolves.toBe('caja cerrada');
    await expect(contabilidad.listarAsientos()).resolves.toEqual(['asiento-1']);
    await expect(contabilidad.resumenVentas()).resolves.toBe('resumen');
  });

  it('cajero puede abrir y cerrar caja', async () => {
    const caja = crearPermisosProxy(new CajaServiceMock(), 'cajero');

    await expect(caja.abrirCaja()).resolves.toBe('caja abierta');
    await expect(caja.cerrarCaja()).resolves.toBe('caja cerrada');
    await expect(caja.listarCajas()).resolves.toEqual(['caja-1']);
  });

  it('cajero NO puede acceder a contabilidad', async () => {
    const contabilidad = crearPermisosProxy(new ContabilidadServiceMock(), 'cajero');

    await expect(contabilidad.listarAsientos()).rejects.toMatchObject({
      code: 'SIN_PERMISOS',
      statusCode: 403,
    });
    await expect(contabilidad.resumenVentas()).rejects.toMatchObject({
      code: 'SIN_PERMISOS',
      statusCode: 403,
    });
  });

  it('contador puede acceder a contabilidad', async () => {
    const contabilidad = crearPermisosProxy(new ContabilidadServiceMock(), 'contador');

    await expect(contabilidad.listarAsientos()).resolves.toEqual(['asiento-1']);
    await expect(contabilidad.resumenVentas()).resolves.toBe('resumen');
  });

  it('contador NO puede acceder a caja', async () => {
    const caja = crearPermisosProxy(new CajaServiceMock(), 'contador');

    await expect(caja.abrirCaja()).rejects.toMatchObject({
      code: 'SIN_PERMISOS',
      statusCode: 403,
    });
    await expect(caja.cerrarCaja()).rejects.toMatchObject({
      code: 'SIN_PERMISOS',
      statusCode: 403,
    });
  });
});

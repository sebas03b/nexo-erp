import { describe, expect, it } from 'vitest';

import {
  CadenaValidacion,
  type EslabonValidacion,
  ValidarClienteValido,
  ValidarStockSuficiente,
  type ValidacionContexto,
} from './cadena-validacion.js';

function crearContexto(sobreescritos: Partial<ValidacionContexto> = {}): ValidacionContexto {
  const verificarCliente = sobreescritos.verificarCliente ?? (async () => ({ id: 'cliente-1' }));
  const verificarStock = sobreescritos.verificarStock ?? (async () => true);

  return {
    documentoCliente: '123',
    items: [{ productoId: 'producto-1', cantidad: 2 }],
    verificarCliente,
    verificarStock,
    ...sobreescritos,
  };
}

describe('Patrón Chain of Responsibility - validación de checkout', () => {
  it('debe pasar cuando el cliente es válido y hay stock', async () => {
    const cadena = new CadenaValidacion();
    cadena.agregar(new ValidarClienteValido());
    cadena.agregar(new ValidarStockSuficiente());

    await expect(cadena.ejecutar(crearContexto())).resolves.toBeUndefined();
  });

  it('debe fallar cuando el cliente no existe', async () => {
    const cadena = new CadenaValidacion();
    cadena.agregar(new ValidarClienteValido());
    cadena.agregar(new ValidarStockSuficiente());

    await expect(
      cadena.ejecutar(crearContexto({ verificarCliente: async () => null })),
    ).rejects.toMatchObject({ code: 'CLIENTE_NO_ENCONTRADO' });
  });

  it('debe fallar cuando el stock es insuficiente', async () => {
    const cadena = new CadenaValidacion();
    cadena.agregar(new ValidarClienteValido());
    cadena.agregar(new ValidarStockSuficiente());

    await expect(
      cadena.ejecutar(crearContexto({ verificarStock: async () => false })),
    ).rejects.toMatchObject({ code: 'STOCK_INSUFICIENTE' });
  });

  it('debe ejecutar los eslabones en orden y detenerse en el primer fallo', async () => {
    const orden: string[] = [];
    const cadena = new CadenaValidacion();

    const eslabon1: EslabonValidacion = {
      validar: async () => {
        orden.push('primero');
        throw new Error('error en primero');
      },
      establecerSiguiente: () => eslabon1,
    };
    const eslabon2: EslabonValidacion = {
      validar: async () => {
        orden.push('segundo');
      },
      establecerSiguiente: () => eslabon2,
    };

    cadena.agregar(eslabon1);
    cadena.agregar(eslabon2);

    await expect(cadena.ejecutar(crearContexto())).rejects.toThrow(
      'error en primero',
    );
    expect(orden).toEqual(['primero']);
  });
});

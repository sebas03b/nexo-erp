import { describe, expect, it } from 'vitest';

import { PagoEfectivo } from './pago-efectivo.strategy.js';
import { PagoPasarela } from './pago-pasarela.strategy.js';

describe('Patrón Strategy en el cobro del pedido', () => {
  it('cobra en efectivo y calcula el cambio', async () => {
    const resultado = await new PagoEfectivo().cobrar({
      monto: 80,
      montoRecibido: 100,
    });

    expect(resultado).toMatchObject({
      metodo: 'efectivo',
      monto: 80,
      cambio: 20,
    });
    expect(resultado.referencia).toMatch(/^EFECTIVO-/);
  });

  it('rechaza un pago en efectivo insuficiente', async () => {
    await expect(
      new PagoEfectivo().cobrar({ monto: 100, montoRecibido: 50 }),
    ).rejects.toMatchObject({
      code: 'PAGO_INSUFICIENTE',
      statusCode: 400,
    });
  });

  it('cobra por pasarela y conserva la referencia externa', async () => {
    const resultado = await new PagoPasarela().cobrar({
      monto: 80,
      referencia: 'TX-123',
    });

    expect(resultado).toEqual({
      metodo: 'pasarela',
      monto: 80,
      cambio: 0,
      referencia: 'TX-123',
    });
  });
});

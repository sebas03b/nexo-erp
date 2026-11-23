import { describe, expect, it } from 'vitest';

import { Carrito } from './carrito.js';
import { EstablecerCantidadCommand } from './establecer-cantidad.command.js';

describe('Patrón Command - establecer cantidad del carrito', () => {
  it('debe fijar la cantidad absoluta al ejecutar', async () => {
    const carrito = new Carrito();
    carrito.agregarItem('producto-1', 2, 100);

    const comando = new EstablecerCantidadCommand(carrito, 'producto-1', 5);
    await comando.ejecutar();

    expect(carrito.obtenerItem('producto-1')?.cantidad).toBe(5);
  });

  it('debe quitar la línea si la cantidad se establece en 0', async () => {
    const carrito = new Carrito();
    carrito.agregarItem('producto-1', 2, 100);

    const comando = new EstablecerCantidadCommand(carrito, 'producto-1', 0);
    await comando.ejecutar();

    expect(carrito.items).toHaveLength(0);
  });

  it('debe restaurar la cantidad previa al deshacer', async () => {
    const carrito = new Carrito();
    carrito.agregarItem('producto-1', 2, 100);

    const comando = new EstablecerCantidadCommand(carrito, 'producto-1', 7);
    await comando.ejecutar();
    await comando.deshacer();

    expect(carrito.obtenerItem('producto-1')?.cantidad).toBe(2);
  });
});
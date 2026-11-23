import { describe, expect, it } from 'vitest';

import { Carrito } from './carrito.js';
import { DecrementarItemCommand } from './decrementar-item.command.js';

describe('Patrón Command - decrementar ítem del carrito', () => {
  it('debe restar unidades al ejecutar', async () => {
    const carrito = new Carrito();
    carrito.agregarItem('producto-1', 3, 100);

    const comando = new DecrementarItemCommand(carrito, 'producto-1', 1);
    await comando.ejecutar();

    expect(carrito.obtenerItem('producto-1')?.cantidad).toBe(2);
  });

  it('debe quitar la línea si la cantidad llega a 0', async () => {
    const carrito = new Carrito();
    carrito.agregarItem('producto-1', 1, 100);

    const comando = new DecrementarItemCommand(carrito, 'producto-1', 1);
    await comando.ejecutar();

    expect(carrito.items).toHaveLength(0);
  });

  it('debe restaurar la cantidad previa al deshacer', async () => {
    const carrito = new Carrito();
    carrito.agregarItem('producto-1', 2, 100);

    const comando = new DecrementarItemCommand(carrito, 'producto-1', 1);
    await comando.ejecutar();
    await comando.deshacer();

    expect(carrito.obtenerItem('producto-1')?.cantidad).toBe(2);
  });

  it('debe restaurar un ítem eliminado al deshacer', async () => {
    const carrito = new Carrito();
    carrito.agregarItem('producto-1', 1, 100);

    const comando = new DecrementarItemCommand(carrito, 'producto-1', 1);
    await comando.ejecutar();
    expect(carrito.items).toHaveLength(0);

    await comando.deshacer();
    expect(carrito.items).toHaveLength(1);
    expect(carrito.items[0]).toMatchObject({ productoId: 'producto-1', cantidad: 1, precioUnitario: 100 });
  });
});
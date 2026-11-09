import { describe, expect, it } from 'vitest';

import { QuitarItemCommand } from './quitar-item.command.js';
import { Carrito } from './carrito.js';

describe('Patrón Command - quitar ítem del carrito', () => {
  it('debe remover un ítem del carrito al ejecutar', async () => {
    const carrito = new Carrito();
    carrito.agregarItem('producto-1', 2, 100);

    const comando = new QuitarItemCommand(carrito, 'producto-1');
    await comando.ejecutar();

    expect(carrito.items).toHaveLength(0);
  });

  it('debe restaurar el ítem removido al deshacer', async () => {
    const carrito = new Carrito();
    carrito.agregarItem('producto-1', 2, 100);

    const comando = new QuitarItemCommand(carrito, 'producto-1');
    await comando.ejecutar();
    expect(carrito.items).toHaveLength(0);

    await comando.deshacer();
    expect(carrito.items).toHaveLength(1);
    expect(carrito.items[0]!).toMatchObject({
      productoId: 'producto-1',
      cantidad: 2,
      precioUnitario: 100,
    });
  });

  it('no debe hacer nada al deshacer si no se ejecutó antes', async () => {
    const carrito = new Carrito();
    carrito.agregarItem('producto-1', 2, 100);

    const comando = new QuitarItemCommand(carrito, 'producto-1');
    await comando.deshacer();
    expect(carrito.items).toHaveLength(1);
  });

  it('no debe hacer nada al ejecutar dos veces el mismo comando', async () => {
    const carrito = new Carrito();
    carrito.agregarItem('producto-1', 2, 100);

    const comando = new QuitarItemCommand(carrito, 'producto-1');
    await comando.ejecutar();
    await comando.ejecutar();

    expect(carrito.items).toHaveLength(0);
  });
});

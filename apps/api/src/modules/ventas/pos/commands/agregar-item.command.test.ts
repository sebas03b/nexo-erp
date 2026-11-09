import { describe, expect, it } from 'vitest';

import { AgregarItemCommand } from './agregar-item.command.js';
import { Carrito } from './carrito.js';

describe('Patrón Command - agregar ítem al carrito', () => {
  it('debe agregar un ítem nuevo al carrito al ejecutar', async () => {
    const carrito = new Carrito();
    const comando = new AgregarItemCommand(carrito, 'producto-1', 2, 100);

    await comando.ejecutar();

    expect(carrito.items).toHaveLength(1);
    expect(carrito.items[0]!).toMatchObject({
      productoId: 'producto-1',
      cantidad: 2,
      precioUnitario: 100,
    });
  });

  it('debe sumar la cantidad si el producto ya existe en el carrito', async () => {
    const carrito = new Carrito();
    const comando1 = new AgregarItemCommand(carrito, 'producto-1', 2, 100);
    const comando2 = new AgregarItemCommand(carrito, 'producto-1', 3, 100);

    await comando1.ejecutar();
    await comando2.ejecutar();

    expect(carrito.items).toHaveLength(1);
    expect(carrito.items[0]!.cantidad).toBe(5);
  });

  it('debe restaurar el carrito al deshacer un agregado', async () => {
    const carrito = new Carrito();
    const comando = new AgregarItemCommand(carrito, 'producto-1', 2, 100);

    await comando.ejecutar();
    expect(carrito.items).toHaveLength(1);

    await comando.deshacer();
    expect(carrito.items).toHaveLength(0);
  });

  it('debe restaurar la cantidad anterior al deshacer un agregado sobre ítem existente', async () => {
    const carrito = new Carrito();
    const comando1 = new AgregarItemCommand(carrito, 'producto-1', 2, 100);
    const comando2 = new AgregarItemCommand(carrito, 'producto-1', 3, 100);

    await comando1.ejecutar();
    await comando2.ejecutar();
    expect(carrito.items[0]!.cantidad).toBe(5);

    await comando2.deshacer();
    expect(carrito.items[0]!.cantidad).toBe(2);
  });

  it('no debe hacer nada al deshacer si no se ejecutó antes', async () => {
    const carrito = new Carrito();
    const comando = new AgregarItemCommand(carrito, 'producto-1', 2, 100);

    await comando.deshacer();
    expect(carrito.items).toHaveLength(0);
  });
});

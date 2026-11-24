import { describe, expect, it } from 'vitest';
import { crearCacheProxy } from './cache.proxy.js';

class ProductoRepositoryMock {
  private contadorLlamadas = 0;

  async obtenerProducto(id: string): Promise<{ id: string; nombre: string } | null> {
    this.contadorLlamadas++;
    if (id === 'prod-1') {
      return { id: 'prod-1', nombre: 'Producto 1' };
    }
    return null;
  }

  async listarProductos(): Promise<{ id: string; nombre: string }[]> {
    this.contadorLlamadas++;
    return [
      { id: 'prod-1', nombre: 'Producto 1' },
      { id: 'prod-2', nombre: 'Producto 2' },
    ];
  }

  getContadorLlamadas(): number {
    return this.contadorLlamadas;
  }
}

describe('Patrón Proxy - Cache', () => {
  it('almacena en caché y devuelve el valor sin llamar al servicio', async () => {
    const repo = new ProductoRepositoryMock();
    const proxy = crearCacheProxy(repo, 60000);

    // Primera llamada
    const r1 = await proxy.obtenerProducto('prod-1');
    expect(r1).toEqual({ id: 'prod-1', nombre: 'Producto 1' });

    // Segunda llamada debería venir de caché
    const r2 = await proxy.obtenerProducto('prod-1');
    expect(r2).toEqual({ id: 'prod-1', nombre: 'Producto 1' });

    // El servicio solo se llamó una vez
    expect(repo.getContadorLlamadas()).toBe(1);
  });

  it('diferentes argumentos producen diferentes entradas de caché', async () => {
    const repo = new ProductoRepositoryMock();
    const proxy = crearCacheProxy(repo, 60000);

    await proxy.obtenerProducto('prod-1');
    await proxy.obtenerProducto('prod-2');

    expect(repo.getContadorLlamadas()).toBe(2);
  });

  it('lista de productos se cachea correctamente', async () => {
    const repo = new ProductoRepositoryMock();
    const proxy = crearCacheProxy(repo, 60000);

    const r1 = await proxy.listarProductos();
    expect(r1).toHaveLength(2);

    const r2 = await proxy.listarProductos();
    expect(r2).toHaveLength(2);

    expect(repo.getContadorLlamadas()).toBe(1);
  });

  it('la caché expira después del TTL', async () => {
    const repo = new ProductoRepositoryMock();
    const proxy = crearCacheProxy(repo, 50); // 50ms TTL

    await proxy.obtenerProducto('prod-1');
    expect(repo.getContadorLlamadas()).toBe(1);

    // Esperar a que expire
    await new Promise((resolve) => setTimeout(resolve, 60));

    await proxy.obtenerProducto('prod-1');
    expect(repo.getContadorLlamadas()).toBe(2);
  });
});

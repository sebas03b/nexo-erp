import { DomainError, RecursoNoEncontrado } from '../../shared/errors/domain-error.js';
import type { Producto, Stock } from './domain/producto.js';
import type {
  ActualizarProductoData,
  CrearProductoData,
  InventarioRepository,
} from './inventario.repository.js';

export class InventarioService {
  readonly #repository: InventarioRepository;

  constructor(repository: InventarioRepository) {
    this.#repository = repository;
  }

  listarProductos(): Promise<Producto[]> {
    return this.#repository.listarProductos();
  }

  async obtenerProducto(id: string): Promise<Producto> {
    const producto = await this.#repository.obtenerProducto(id);

    if (!producto) {
      throw new RecursoNoEncontrado('PRODUCTO_NO_ENCONTRADO', 'Producto no encontrado');
    }

    return producto;
  }

  async crearProducto(data: CrearProductoData): Promise<Producto> {
    const existente = await this.#repository.obtenerProductoPorSku(data.sku);

    if (existente) {
      throw new DomainError('Ya existe un producto con ese SKU', {
        code: 'SKU_DUPLICADO',
        statusCode: 409,
      });
    }

    return this.#repository.crearProducto(data);
  }

  async actualizarProducto(id: string, data: ActualizarProductoData): Promise<Producto> {
    await this.obtenerProducto(id);

    if (data.sku !== undefined) {
      const existente = await this.#repository.obtenerProductoPorSku(data.sku);

      if (existente && existente.id !== id) {
        throw new DomainError('Ya existe un producto con ese SKU', {
          code: 'SKU_DUPLICADO',
          statusCode: 409,
        });
      }
    }

    const actualizado = await this.#repository.actualizarProducto(id, data);

    if (!actualizado) {
      throw new RecursoNoEncontrado('PRODUCTO_NO_ENCONTRADO', 'Producto no encontrado');
    }

    return actualizado;
  }

  async eliminarProducto(id: string): Promise<void> {
    await this.obtenerProducto(id);
    await this.#repository.eliminarProducto(id);
  }

  listarStock(): Promise<Stock[]> {
    return this.#repository.listarStock();
  }

  async obtenerStock(productoId: string): Promise<Stock> {
    await this.obtenerProducto(productoId);
    const stock = await this.#repository.obtenerStock(productoId);

    return stock ?? { productoId, cantidad: 0 };
  }

  async fijarStock(productoId: string, cantidad: number): Promise<Stock> {
    await this.obtenerProducto(productoId);

    return this.#repository.fijarStock(productoId, cantidad);
  }

  async eliminarStock(productoId: string): Promise<void> {
    await this.obtenerProducto(productoId);
    await this.#repository.eliminarStock(productoId);
  }
}

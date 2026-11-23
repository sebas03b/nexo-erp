// Patrón: Command — rol Invoker

import type { Kysely } from 'kysely';

import type { Database } from '../../../shared/db/schema.js';
import { DomainError, RecursoNoEncontrado } from '../../../shared/errors/domain-error.js';
import { Pedido } from '../domain/pedido.js';
import type { EstrategiasVentas } from '../ventas.service.js';
import { AgregarItemCommand } from './commands/agregar-item.command.js';
import { Carrito, type ItemCarrito } from './commands/carrito.js';
import type { Comando } from './commands/comando.js';
import { DecrementarItemCommand } from './commands/decrementar-item.command.js';
import { EstablecerCantidadCommand } from './commands/establecer-cantidad.command.js';
import { QuitarItemCommand } from './commands/quitar-item.command.js';
import {
  CarritoRepository,
  type ComandoCarritoPersistido,
  type TipoComandoCarrito,
} from './carrito.repository.js';

export type AccionCarrito =
  | 'AGREGAR_ITEM'
  | 'DECREMENTAR_ITEM'
  | 'QUITAR_ITEM'
  | 'ESTABLECER_CANTIDAD';

export interface PayloadAgregarItem {
  productoId: string;
  cantidad: number;
}

export interface PayloadProducto {
  productoId: string;
  itemId?: string;
}

export interface PayloadDecrementarItem {
  productoId: string;
  cantidad: number;
}

export interface PayloadEstablecerCantidad {
  productoId: string;
  cantidad: number;
}

export type PayloadComandoCarrito =
  | PayloadAgregarItem
  | PayloadProducto
  | PayloadDecrementarItem
  | PayloadEstablecerCantidad;

export interface EstadoCarrito {
  id: string;
  estado: 'Abierto' | 'Cerrado' | 'Descartado';
  items: ItemCarrito[];
  subtotal: number;
  descuento: number;
  impuesto: number;
  total: number;
}

function asegurarCarritoAbierto(estado: 'Abierto' | 'Cerrado' | 'Descartado'): void {
  if (estado !== 'Abierto') {
    throw new DomainError('El carrito no está abierto', {
      code: 'CARRITO_NO_ABIERTO',
      statusCode: 409,
    });
  }
}

function validarCantidadPositiva(cantidad: number, code = 'CANTIDAD_INVALIDA'): void {
  if (!Number.isInteger(cantidad) || cantidad <= 0) {
    throw new DomainError('La cantidad debe ser un entero positivo', {
      code,
      statusCode: 400,
    });
  }
}

export class CarritoService {
  readonly #db: Kysely<Database>;
  readonly #repository: CarritoRepository;
  readonly #estrategias: Pick<EstrategiasVentas, 'descuento' | 'impuesto'>;

  constructor(
    db: Kysely<Database>,
    repository: CarritoRepository,
    estrategias: Pick<EstrategiasVentas, 'descuento' | 'impuesto'>,
  ) {
    this.#db = db;
    this.#repository = repository;
    this.#estrategias = estrategias;
  }

  async crearCarrito(): Promise<EstadoCarrito> {
    const id = await this.#db.transaction().execute(async (trx) => {
      return this.#repository.crearCarrito(trx);
    });

    return {
      id,
      estado: 'Abierto',
      items: [],
      subtotal: 0,
      descuento: 0,
      impuesto: 0,
      total: 0,
    };
  }

  async obtenerCarrito(id: string): Promise<EstadoCarrito> {
    const carrito = await this.#repository.obtenerCarrito(this.#db, id);
    if (!carrito) {
      throw new RecursoNoEncontrado('CARRITO_NO_ENCONTRADO', 'Carrito no encontrado');
    }
    return this.#construirEstado(carrito.id, carrito.estado, carrito.items);
  }

  async descartarCarrito(id: string): Promise<void> {
    const carrito = await this.#repository.obtenerCarrito(this.#db, id);
    if (!carrito) {
      throw new RecursoNoEncontrado('CARRITO_NO_ENCONTRADO', 'Carrito no encontrado');
    }
    await this.#repository.actualizarEstado(this.#db, id, 'Descartado');
  }

  async cerrarCarrito(id: string): Promise<void> {
    const carrito = await this.#repository.obtenerCarrito(this.#db, id);
    if (!carrito) {
      throw new RecursoNoEncontrado('CARRITO_NO_ENCONTRADO', 'Carrito no encontrado');
    }
    await this.#repository.actualizarEstado(this.#db, id, 'Cerrado');
  }

  async ejecutarComando(
    id: string,
    accion: AccionCarrito,
    payload: Record<string, unknown>,
  ): Promise<EstadoCarrito> {
    return this.#db.transaction().execute(async (trx) => {
      const carritoPersistido = await this.#repository.obtenerCarrito(trx, id);
      if (!carritoPersistido) {
        throw new RecursoNoEncontrado('CARRITO_NO_ENCONTRADO', 'Carrito no encontrado');
      }
      asegurarCarritoAbierto(carritoPersistido.estado);

      const carrito = new Carrito();
      carrito.cargarItems(carritoPersistido.items);

      const { comando, tipo, payloadNormalizado, estadoAnterior, itemRemovido } =
        await this.#construirComando(trx, carrito, accion, payload);

      await comando.ejecutar();

      let payloadFinal = payloadNormalizado;
      if (comando instanceof AgregarItemCommand) {
        const itemId = comando.obtenerItemCreadoId();
        if (itemId) {
          payloadFinal = {
            ...payloadNormalizado,
            itemId,
            precioUnitario: (comando as unknown as { obtenerEstadoAnterior?: () => unknown })
              ? undefined
              : undefined,
          };
          // preserve precio for rehidratación of independent lines
          const item = carrito.items.find((i) => i.itemId === itemId);
          if (item) {
            payloadFinal = { ...payloadFinal, precioUnitario: item.precioUnitario };
          }
        }
      }

      const items = carrito.items;
      await this.#repository.guardarItems(trx, id, items);
      await this.#repository.registrarComando(trx, {
        carritoId: id,
        tipo,
        payload: payloadFinal,
        estadoAnterior,
        itemRemovido,
      });

      return this.#construirEstado(id, carritoPersistido.estado, [...items]);
    });
  }

  async deshacer(id: string): Promise<EstadoCarrito> {
    return this.#db.transaction().execute(async (trx) => {
      const carritoPersistido = await this.#repository.obtenerCarrito(trx, id);
      if (!carritoPersistido) {
        throw new RecursoNoEncontrado('CARRITO_NO_ENCONTRADO', 'Carrito no encontrado');
      }
      asegurarCarritoAbierto(carritoPersistido.estado);

      const ultimo = await this.#repository.obtenerUltimoComandoNoDeshecho(trx, id);
      if (!ultimo) {
        throw new DomainError('No hay comandos para deshacer', {
          code: 'NADA_PARA_DESHACER',
          statusCode: 409,
        });
      }

      const carrito = new Carrito();
      carrito.cargarItems(carritoPersistido.items);

      const comando = this.#rehidratarComando(carrito, ultimo);
      await comando.deshacer();

      const items = carrito.items;
      await this.#repository.guardarItems(trx, id, items);
      await this.#repository.marcarComandoDeshecho(trx, ultimo.id);

      return this.#construirEstado(id, carritoPersistido.estado, [...items]);
    });
  }

  async #construirComando(
    executor: Kysely<Database>,
    carrito: Carrito,
    accion: AccionCarrito,
    payload: Record<string, unknown>,
  ): Promise<{
    comando: Comando;
    tipo: TipoComandoCarrito;
    payloadNormalizado: Record<string, unknown>;
    estadoAnterior: ItemCarrito | null;
    itemRemovido: ItemCarrito | null;
  }> {
    switch (accion) {
      case 'AGREGAR_ITEM': {
        const productoId = this.#leerProductoId(payload);
        const cantidad = this.#leerCantidad(payload, 'cantidad');
        validarCantidadPositiva(cantidad);

        const producto = await this.#obtenerProducto(executor, productoId);
        if (producto === null) {
          throw new RecursoNoEncontrado(
            'PRODUCTO_NO_ENCONTRADO',
            `Producto ${productoId} no encontrado`,
          );
        }

        const lineaIndependiente = producto.tipo === 'servicio';
        const existente = lineaIndependiente ? null : carrito.obtenerItem(productoId);
        const cantidadResultante = (existente?.cantidad ?? 0) + cantidad;
        await this.#asegurarStock(executor, productoId, cantidadResultante, producto.tipo);

        const comando = new AgregarItemCommand(
          carrito,
          productoId,
          cantidad,
          producto.precio,
          undefined,
          undefined,
          { lineaIndependiente },
        );
        return {
          comando,
          tipo: 'AGREGAR_ITEM',
          payloadNormalizado: lineaIndependiente
            ? { productoId, cantidad, lineaIndependiente: true }
            : { productoId, cantidad },
          estadoAnterior: existente ?? null,
          itemRemovido: null,
        };
      }
      case 'DECREMENTAR_ITEM': {
        const productoId = this.#leerProductoId(payload);
        const cantidad = this.#leerCantidad(payload, 'cantidad');
        validarCantidadPositiva(cantidad);

        const existente = carrito.obtenerItem(productoId);
        if (!existente) {
          throw new RecursoNoEncontrado(
            'ITEM_NO_ENCONTRADO',
            'El producto no está en el carrito',
          );
        }

        const comando = new DecrementarItemCommand(carrito, productoId, cantidad);
        return {
          comando,
          tipo: 'DECREMENTAR_ITEM',
          payloadNormalizado: { productoId, cantidad },
          estadoAnterior: existente,
          itemRemovido: null,
        };
      }
      case 'QUITAR_ITEM': {
        const productoId = this.#leerProductoId(payload);
        const itemId = this.#leerItemIdOpcional(payload);
        const existente = itemId
          ? carrito.obtenerItemPorId(itemId)
          : carrito.obtenerItem(productoId);
        if (!existente) {
          throw new RecursoNoEncontrado(
            'ITEM_NO_ENCONTRADO',
            'El producto no está en el carrito',
          );
        }

        const comando = new QuitarItemCommand(carrito, productoId, undefined, undefined, itemId);
        return {
          comando,
          tipo: 'QUITAR_ITEM',
          payloadNormalizado: itemId ? { productoId, itemId } : { productoId },
          estadoAnterior: null,
          itemRemovido: existente,
        };
      }
      case 'ESTABLECER_CANTIDAD': {
        const productoId = this.#leerProductoId(payload);
        const cantidad = this.#leerCantidad(payload, 'cantidad');
        if (!Number.isInteger(cantidad) || cantidad < 0) {
          throw new DomainError('La cantidad debe ser un entero mayor o igual a cero', {
            code: 'CANTIDAD_INVALIDA',
            statusCode: 400,
          });
        }

        const existente = carrito.obtenerItem(productoId);
        if (!existente) {
          throw new RecursoNoEncontrado(
            'ITEM_NO_ENCONTRADO',
            'El producto no está en el carrito',
          );
        }

        if (cantidad > 0) {
          const producto = await this.#obtenerProducto(executor, productoId);
          await this.#asegurarStock(executor, productoId, cantidad, producto?.tipo);
        }

        const comando = new EstablecerCantidadCommand(carrito, productoId, cantidad);
        return {
          comando,
          tipo: 'ESTABLECER_CANTIDAD',
          payloadNormalizado: { productoId, cantidad },
          estadoAnterior: existente,
          itemRemovido: null,
        };
      }
    }
  }

  #rehidratarComando(carrito: Carrito, persistido: ComandoCarritoPersistido): Comando {
    const payload = persistido.payload;
    const productoId = typeof payload.productoId === 'string' ? payload.productoId : '';
    const cantidad = typeof payload.cantidad === 'number' ? payload.cantidad : 0;
    const itemId = typeof payload.itemId === 'string' ? payload.itemId : undefined;
    const lineaIndependiente =
      persistido.tipo === 'AGREGAR_ITEM' &&
      (payload.lineaIndependiente === true || typeof payload.itemId === 'string');

    switch (persistido.tipo) {
      case 'AGREGAR_ITEM': {
        const precio =
          persistido.estadoAnterior?.precioUnitario ??
          persistido.itemRemovido?.precioUnitario ??
          (typeof payload.precioUnitario === 'number' ? payload.precioUnitario : 0);
        return new AgregarItemCommand(
          carrito,
          productoId,
          cantidad,
          precio,
          persistido.estadoAnterior,
          undefined,
          { itemId, lineaIndependiente },
        );
      }
      case 'DECREMENTAR_ITEM':
        return new DecrementarItemCommand(
          carrito,
          productoId,
          cantidad,
          persistido.estadoAnterior,
        );
      case 'QUITAR_ITEM':
        return new QuitarItemCommand(
          carrito,
          productoId,
          persistido.itemRemovido ?? undefined,
          undefined,
          itemId,
        );
      case 'ESTABLECER_CANTIDAD':
        return new EstablecerCantidadCommand(
          carrito,
          productoId,
          cantidad,
          persistido.estadoAnterior,
        );
    }
  }

  async #obtenerProducto(
    executor: Kysely<Database>,
    productoId: string,
  ): Promise<{ precio: number; tipo: string } | null> {
    const row = await executor
      .selectFrom('productos')
      .select(['precio', 'tipo'])
      .where('id', '=', productoId)
      .executeTakeFirst();
    return row ? { precio: Number(row.precio), tipo: row.tipo } : null;
  }

  async #obtenerStockCantidad(executor: Kysely<Database>, productoId: string): Promise<number | null> {
    const row = await executor
      .selectFrom('stock')
      .select('cantidad')
      .where('producto_id', '=', productoId)
      .executeTakeFirst();
    return row ? row.cantidad : null;
  }

  async #asegurarStock(
    executor: Kysely<Database>,
    productoId: string,
    cantidad: number,
    tipoProducto?: string,
  ): Promise<void> {
    if (tipoProducto === 'servicio') {
      return;
    }

    const stock = await this.#obtenerStockCantidad(executor, productoId);
    if (stock === null) {
      throw new RecursoNoEncontrado(
        'PRODUCTO_NO_ENCONTRADO',
        `Producto ${productoId} no encontrado`,
      );
    }
    if (stock < cantidad) {
      throw new DomainError(`Stock insuficiente para el producto ${productoId}`, {
        code: 'STOCK_INSUFICIENTE',
        statusCode: 409,
        details: { productoId, stockDisponible: stock, cantidadSolicitada: cantidad },
      });
    }
  }

  #leerProductoId(payload: Record<string, unknown>): string {
    const productoId = payload.productoId;
    if (typeof productoId !== 'string' || productoId.trim() === '') {
      throw new DomainError('productoId es requerido', {
        code: 'DATOS_INVALIDOS',
        statusCode: 400,
      });
    }
    return productoId;
  }

  #leerCantidad(payload: Record<string, unknown>, campo: string): number {
    const valor = payload[campo];
    if (typeof valor !== 'number' || !Number.isFinite(valor)) {
      throw new DomainError(`${campo} debe ser un número`, {
        code: 'DATOS_INVALIDOS',
        statusCode: 400,
      });
    }
    return valor;
  }

  #leerItemIdOpcional(payload: Record<string, unknown>): string | undefined {
    const itemId = payload.itemId;
    if (itemId === undefined) return undefined;
    if (typeof itemId !== 'string' || itemId.trim() === '') {
      throw new DomainError('itemId debe ser una cadena válida', {
        code: 'DATOS_INVALIDOS',
        statusCode: 400,
      });
    }
    return itemId;
  }

  #construirEstado(
    id: string,
    estado: 'Abierto' | 'Cerrado' | 'Descartado',
    items: ItemCarrito[],
  ): EstadoCarrito {
    if (items.length === 0) {
      return { id, estado, items: [], subtotal: 0, descuento: 0, impuesto: 0, total: 0 };
    }

    const totales = Pedido.calcularTotales(
      items.map((item) => ({
        productoId: item.productoId,
        cantidad: item.cantidad,
        precioUnitario: item.precioUnitario,
      })),
      {
        descuento: this.#estrategias.descuento,
        impuesto: this.#estrategias.impuesto,
      },
      { esClienteFrecuente: false },
    );

    return {
      id,
      estado,
      items: items.map((item) => ({ ...item })),
      ...totales,
    };
  }
}
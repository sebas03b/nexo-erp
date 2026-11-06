import { randomUUID } from 'node:crypto';

import type {
  UnitOfWork,
  UnitOfWorkContext,
} from '../../shared/db/unit-of-work.js';
import { DomainError, RecursoNoEncontrado } from '../../shared/errors/domain-error.js';
import type { VentasEventMap } from './domain/eventos.js';
import { Factura } from './domain/factura.js';
import { Pedido, type PedidoItem } from './domain/pedido.js';
import type { EstadoPedido } from './domain/pedido-estado.js';
import type { CatalogoProductos, VerificadorClientes } from './domain/ports.js';
import type { VentasRepository } from './ventas.repository.js';

export interface CrearPedidoItemInput {
  productoId: string;
  cantidad: number;
}

export interface CrearPedidoInput {
  clienteId: string;
  items: CrearPedidoItemInput[];
  descuento?: number;
  impuesto?: number;
}

type VentasTransaction = UnitOfWorkContext<VentasEventMap>['db'];

function redondear(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

export class VentasService {
  readonly #repository: VentasRepository;
  readonly #unitOfWork: UnitOfWork<VentasEventMap>;
  readonly #catalogo: CatalogoProductos;
  readonly #clientes: VerificadorClientes;

  constructor(
    repository: VentasRepository,
    unitOfWork: UnitOfWork<VentasEventMap>,
    catalogo: CatalogoProductos,
    clientes: VerificadorClientes,
  ) {
    this.#repository = repository;
    this.#unitOfWork = unitOfWork;
    this.#catalogo = catalogo;
    this.#clientes = clientes;
  }

  async crearPedido(data: CrearPedidoInput): Promise<Pedido> {
    const clienteExiste = await this.#clientes.existe(data.clienteId);

    if (!clienteExiste) {
      throw new RecursoNoEncontrado('CLIENTE_NO_ENCONTRADO', 'Cliente no encontrado');
    }

    const productosVistos = new Set<string>();
    const items: PedidoItem[] = [];

    for (const item of data.items) {
      if (productosVistos.has(item.productoId)) {
        throw new DomainError('No se puede repetir un producto en el pedido', {
          code: 'ITEM_DUPLICADO',
          statusCode: 400,
        });
      }

      productosVistos.add(item.productoId);

      const precioUnitario = await this.#catalogo.obtenerPrecio(item.productoId);

      if (precioUnitario === null) {
        throw new RecursoNoEncontrado(
          'PRODUCTO_NO_ENCONTRADO',
          `Producto ${item.productoId} no encontrado`,
        );
      }

      items.push({
        productoId: item.productoId,
        cantidad: item.cantidad,
        precioUnitario,
      });
    }

    const subtotal = redondear(
      items.reduce((acumulado, item) => acumulado + item.precioUnitario * item.cantidad, 0),
    );
    const descuento = redondear(data.descuento ?? 0);
    const impuesto = redondear(data.impuesto ?? 0);

    if (descuento > subtotal) {
      throw new DomainError('El descuento no puede superar el subtotal', {
        code: 'DESCUENTO_INVALIDO',
        statusCode: 400,
      });
    }

    const total = redondear(subtotal - descuento + impuesto);

    const pedido = new Pedido({
      id: randomUUID(),
      clienteId: data.clienteId,
      estado: 'Borrador',
      subtotal,
      descuento,
      impuesto,
      total,
      items,
    });

    await this.#unitOfWork.execute(async ({ db }) => {
      await this.#repository.crearPedido(db, pedido);
    });

    return pedido;
  }

  listarPedidos(): Promise<Pedido[]> {
    return this.#repository.listarPedidos();
  }

  async obtenerPedido(id: string): Promise<Pedido> {
    const pedido = await this.#repository.obtenerPedido(id);

    if (!pedido) {
      throw new RecursoNoEncontrado('PEDIDO_NO_ENCONTRADO', 'Pedido no encontrado');
    }

    return pedido;
  }

  async emitirPedido(id: string): Promise<Pedido> {
    const pedido = await this.obtenerPedido(id);
    const estadoEsperado = pedido.estado;
    pedido.emitir();

    await this.#unitOfWork.execute(async (context) => {
      await this.#persistirTransicion(context.db, pedido, estadoEsperado);
      await context.publish('PedidoEmitido', {
        pedidoId: pedido.id,
        clienteId: pedido.clienteId,
        total: pedido.total,
        emitidoEn: new Date().toISOString(),
      });
    });

    return pedido;
  }

  async pagarPedido(id: string): Promise<Pedido> {
    const pedido = await this.obtenerPedido(id);
    const estadoEsperado = pedido.estado;
    pedido.pagar();

    await this.#unitOfWork.execute(async (context) => {
      await this.#persistirTransicion(context.db, pedido, estadoEsperado);
      await context.publish('PedidoPagado', {
        pedidoId: pedido.id,
        clienteId: pedido.clienteId,
        total: pedido.total,
        pagadoEn: new Date().toISOString(),
      });
    });

    return pedido;
  }

  async anularPedido(id: string): Promise<Pedido> {
    const pedido = await this.obtenerPedido(id);
    const estadoEsperado = pedido.estado;
    pedido.anular();

    await this.#unitOfWork.execute(async ({ db }) => {
      await this.#persistirTransicion(db, pedido, estadoEsperado);
    });

    return pedido;
  }

  async crearFactura(pedidoId: string): Promise<Factura> {
    const pedido = await this.obtenerPedido(pedidoId);
    const existente = await this.#repository.obtenerFacturaPorPedido(pedidoId);

    if (existente) {
      throw new DomainError('El pedido ya tiene una factura emitida', {
        code: 'FACTURA_EXISTENTE',
        statusCode: 409,
      });
    }

    return this.#unitOfWork.execute(async ({ db }) => {
      const numero = await this.#repository.siguienteNumeroFactura(db);
      const factura = Factura.emitirPara(pedido, { id: randomUUID(), numero });

      await this.#repository.crearFactura(db, factura);

      return factura;
    });
  }

  listarFacturas(): Promise<Factura[]> {
    return this.#repository.listarFacturas();
  }

  async obtenerFactura(id: string): Promise<Factura> {
    const factura = await this.#repository.obtenerFactura(id);

    if (!factura) {
      throw new RecursoNoEncontrado('FACTURA_NO_ENCONTRADA', 'Factura no encontrada');
    }

    return factura;
  }

  async #persistirTransicion(
    db: VentasTransaction,
    pedido: Pedido,
    estadoEsperado: EstadoPedido,
  ): Promise<void> {
    const actualizado = await this.#repository.actualizarEstado(
      db,
      pedido.id,
      estadoEsperado,
      pedido.estado,
    );

    if (!actualizado) {
      throw new DomainError(
        'El pedido cambió de estado antes de completar la operación',
        {
          code: 'CONFLICTO_ESTADO_PEDIDO',
          statusCode: 409,
          details: { estadoEsperado, estadoNuevo: pedido.estado },
        },
      );
    }
  }
}

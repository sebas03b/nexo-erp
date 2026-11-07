import { randomUUID } from 'node:crypto';

import type {
  UnitOfWork,
  UnitOfWorkContext,
} from '../../shared/db/unit-of-work.js';
import { DomainError, RecursoNoEncontrado } from '../../shared/errors/domain-error.js';
import type { VentasEventMap } from './domain/eventos.js';
import { Factura } from './domain/factura.js';
import { Pedido, type PedidoItem } from './domain/pedido.js';
import type { PedidoDetalle } from './domain/pedido-detalle.js';
import type { EstadoPedido } from './domain/pedido-estado.js';
import { DescuentoPromocion } from './domain/pricing/descuento-promocion.strategy.js';
import type { DescuentoStrategy } from './domain/pricing/descuento.strategy.js';
import { ImpuestoFijo } from './domain/pricing/impuesto-fijo.strategy.js';
import type { ImpuestoStrategy } from './domain/pricing/impuesto.strategy.js';
import type { PagoContexto, PagoStrategy } from './domain/payments/pago.strategy.js';
import type { CatalogoProductos, VerificadorClientes } from './domain/ports.js';
import type { VentasRepository } from './ventas.repository.js';

export interface CrearPedidoItemInput {
  productoId: string;
  cantidad: number;
}

export interface CrearPedidoInput {
  documentoCliente: string;
  items: CrearPedidoItemInput[];
  descuento?: number;
  impuesto?: number;
}

export interface EstrategiasVentas {
  readonly descuento: DescuentoStrategy;
  readonly impuesto: ImpuestoStrategy;
  readonly pagos: Readonly<Record<MetodoPago, PagoStrategy>>;
}

export type MetodoPago = 'efectivo' | 'pasarela';

export interface OpcionesPago extends Omit<PagoContexto, 'monto'> {
  readonly metodoPago?: MetodoPago;
}

type VentasTransaction = UnitOfWorkContext<VentasEventMap>['db'];

export class VentasService {
  readonly #repository: VentasRepository;
  readonly #unitOfWork: UnitOfWork<VentasEventMap>;
  readonly #catalogo: CatalogoProductos;
  readonly #clientes: VerificadorClientes;
  readonly #estrategias: EstrategiasVentas;

  constructor(
    repository: VentasRepository,
    unitOfWork: UnitOfWork<VentasEventMap>,
    catalogo: CatalogoProductos,
    clientes: VerificadorClientes,
    estrategias: EstrategiasVentas,
  ) {
    this.#repository = repository;
    this.#unitOfWork = unitOfWork;
    this.#catalogo = catalogo;
    this.#clientes = clientes;
    this.#estrategias = estrategias;
  }

  async crearPedido(data: CrearPedidoInput): Promise<Pedido> {
    const cliente = await this.#clientes.obtenerPorDocumento(data.documentoCliente.trim());

    if (!cliente) {
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

    const descuentoStrategy =
      data.descuento === undefined
        ? this.#estrategias.descuento
        : new DescuentoPromocion({ montoFijo: data.descuento });
    const impuestoStrategy =
      data.impuesto === undefined
        ? this.#estrategias.impuesto
        : new ImpuestoFijo(data.impuesto);

    const pedido = Pedido.crear(
      {
        id: randomUUID(),
        clienteId: cliente.id,
        estado: 'Borrador',
        items,
      },
      { descuento: descuentoStrategy, impuesto: impuestoStrategy },
      { esClienteFrecuente: cliente.esClienteFrecuente ?? false },
    );

    await this.#unitOfWork.execute(async ({ db }) => {
      await this.#repository.crearPedido(db, pedido);
    });

    return pedido;
  }

  listarPedidos(): Promise<PedidoDetalle[]> {
    return this.#repository.listarPedidos();
  }

  async obtenerPedidoDetalle(id: string): Promise<PedidoDetalle> {
    const pedido = await this.#repository.obtenerPedidoDetalle(id);

    if (!pedido) {
      throw new RecursoNoEncontrado('PEDIDO_NO_ENCONTRADO', 'Pedido no encontrado');
    }

    return pedido;
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

  async pagarPedido(
    id: string,
    opcionesPago: OpcionesPago = {},
  ): Promise<Pedido> {
    const { metodoPago = 'efectivo', ...contextoPago } = opcionesPago;
    const estrategiaPago = this.#estrategias.pagos[metodoPago];
    const pedido = await this.obtenerPedido(id);
    const estadoEsperado = pedido.estado;
    pedido.pagar();

    const pago = await estrategiaPago.cobrar({
      monto: pedido.total,
      ...contextoPago,
    });

    await this.#unitOfWork.execute(async (context) => {
      await this.#persistirTransicion(context.db, pedido, estadoEsperado);
      await context.publish('PedidoPagado', {
        pedidoId: pedido.id,
        clienteId: pedido.clienteId,
        total: pedido.total,
        pagadoEn: new Date().toISOString(),
        metodoPago: pago.metodo,
        referenciaPago: pago.referencia,
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

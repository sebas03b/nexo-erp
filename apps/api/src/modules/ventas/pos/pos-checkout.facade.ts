// Patrón: Facade

import { randomUUID } from 'node:crypto';

import type { UnitOfWork } from '../../../shared/db/unit-of-work.js';
import { DomainError, RecursoNoEncontrado } from '../../../shared/errors/domain-error.js';
import type { VentasEventMap } from '../domain/eventos.js';
import { FacturaBuilder } from '../domain/factura.builder.js';
import type { Factura } from '../domain/factura.js';
import { Pedido, type PedidoItem } from '../domain/pedido.js';
import type { VerificadorClientes } from '../domain/ports.js';
import type { ResultadoPago } from '../domain/payments/pago.strategy.js';
import type { CadenaValidacion } from '../domain/validation/cadena-validacion.js';
import type { VentasRepository } from '../ventas.repository.js';
import type { EstrategiasVentas, MetodoPago } from '../ventas.service.js';
import type { CarritoRepository } from './carrito.repository.js';

export interface CheckoutInput {
  readonly documentoCliente: string;
  readonly carritoId: string;
  readonly metodoPago?: MetodoPago;
  readonly montoRecibido?: number;
}

export interface CheckoutResultado {
  readonly pedido: Pedido;
  readonly factura: Factura;
  readonly pago: ResultadoPago;
}

export class PosCheckoutFacade {
  constructor(
    private readonly cadenaValidacion: CadenaValidacion,
    private readonly estrategias: EstrategiasVentas,
    private readonly clientes: VerificadorClientes,
    private readonly repository: VentasRepository,
    private readonly carritoRepository: CarritoRepository,
    private readonly unitOfWork: UnitOfWork<VentasEventMap>,
    private readonly verificarStock: (
      productoId: string,
      cantidad: number,
    ) => Promise<boolean>,
  ) {}

  async checkout(input: CheckoutInput): Promise<CheckoutResultado> {
    const carrito = await this.carritoRepository.obtenerCarrito(
      this.unitOfWork.db,
      input.carritoId,
    );

    if (!carrito) {
      throw new RecursoNoEncontrado('CARRITO_NO_ENCONTRADO', 'Carrito no encontrado');
    }

    if (carrito.estado !== 'Abierto') {
      throw new DomainError('El carrito no está abierto', {
        code: 'CARRITO_NO_ABIERTO',
        statusCode: 409,
      });
    }

    if (carrito.items.length === 0) {
      throw new DomainError('El carrito está vacío', {
        code: 'CARRITO_VACIO',
        statusCode: 400,
      });
    }

    await this.cadenaValidacion.ejecutar({
      documentoCliente: input.documentoCliente,
      items: carrito.items.map((item) => ({
        productoId: item.productoId,
        cantidad: item.cantidad,
      })),
      verificarCliente: (documento) => this.clientes.obtenerPorDocumento(documento),
      verificarStock: this.verificarStock,
    });

    return this.unitOfWork.execute(async (context) => {
      const carritoTx = await this.carritoRepository.obtenerCarrito(
        context.db,
        input.carritoId,
      );

      if (!carritoTx) {
        throw new RecursoNoEncontrado('CARRITO_NO_ENCONTRADO', 'Carrito no encontrado');
      }

      if (carritoTx.estado !== 'Abierto') {
        throw new DomainError('El carrito no está abierto', {
          code: 'CARRITO_NO_ABIERTO',
          statusCode: 409,
        });
      }

      if (carritoTx.items.length === 0) {
        throw new DomainError('El carrito está vacío', {
          code: 'CARRITO_VACIO',
          statusCode: 400,
        });
      }

      const items: PedidoItem[] = [];

      for (const itemInput of carritoTx.items) {
        const productoRow = await context.db
          .selectFrom('productos')
          .select('precio')
          .where('id', '=', itemInput.productoId)
          .executeTakeFirst();

        if (!productoRow) {
          throw new DomainError(`Producto ${itemInput.productoId} no encontrado`, {
            code: 'PRODUCTO_NO_ENCONTRADO',
            statusCode: 404,
          });
        }

        items.push({
          productoId: itemInput.productoId,
          cantidad: itemInput.cantidad,
          precioUnitario: Number(productoRow.precio),
        });
      }

      const cliente = await context.db
        .selectFrom('clientes')
        .select('id')
        .where('documento', '=', input.documentoCliente.trim())
        .executeTakeFirst();

      if (!cliente) {
        throw new DomainError('Cliente no encontrado', {
          code: 'CLIENTE_NO_ENCONTRADO',
          statusCode: 404,
        });
      }

      const pedido = Pedido.crear(
        {
          id: randomUUID(),
          clienteId: cliente.id,
          estado: 'Borrador',
          items,
        },
        {
          descuento: this.estrategias.descuento,
          impuesto: this.estrategias.impuesto,
        },
        {
          esClienteFrecuente: false,
        },
      );

      await this.repository.crearPedido(context.db, pedido);

      pedido.emitir();

      const emitido = await this.repository.actualizarEstado(
        context.db,
        pedido.id,
        'Borrador',
        'Emitido',
      );

      if (!emitido) {
        throw new DomainError('El pedido cambió de estado antes de emitirlo', {
          code: 'CONFLICTO_ESTADO_PEDIDO',
          statusCode: 409,
        });
      }

      const metodoPago = input.metodoPago ?? 'efectivo';
      const estrategiaPago = this.estrategias.pagos[metodoPago];

      const pago = await estrategiaPago.cobrar({
        monto: pedido.total,
        montoRecibido: input.montoRecibido,
      });

      pedido.pagar();

      const pagado = await this.repository.actualizarEstado(
        context.db,
        pedido.id,
        'Emitido',
        'Pagado',
      );

      if (!pagado) {
        throw new DomainError(
          'El pedido cambió de estado antes de completar el cobro',
          {
            code: 'CONFLICTO_ESTADO_PEDIDO',
            statusCode: 409,
          },
        );
      }

      await context.publish('PedidoPagado', {
        pedidoId: pedido.id,
        clienteId: pedido.clienteId,
        total: pedido.total,
        pagadoEn: new Date().toISOString(),
        metodoPago: pago.metodo,
        referenciaPago: pago.referencia,
      });

      const numero = await this.repository.siguienteNumeroFactura(context.db);
      const factura = new FacturaBuilder()
        .conId(randomUUID())
        .conPedidoId(pedido.id)
        .conNumero(numero)
        .conEstado('Emitida')
        .construir();

      await this.repository.crearFactura(context.db, factura);

      for (const item of items) {
        const stockRow = await context.db
          .selectFrom('stock')
          .select('cantidad')
          .where('producto_id', '=', item.productoId)
          .executeTakeFirst();

        if (!stockRow || stockRow.cantidad < item.cantidad) {
          throw new DomainError('Stock insuficiente', {
            code: 'STOCK_INSUFICIENTE',
            statusCode: 409,
          });
        }

        await context.db
          .updateTable('stock')
          .set({ cantidad: stockRow.cantidad - item.cantidad })
          .where('producto_id', '=', item.productoId)
          .execute();
      }

      await this.carritoRepository.actualizarEstado(context.db, input.carritoId, 'Cerrado');

      return { pedido, factura, pago };
    });
  }
}
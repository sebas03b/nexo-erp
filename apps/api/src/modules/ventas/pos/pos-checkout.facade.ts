// Patrón: Facade

import { randomUUID } from 'node:crypto';

import type { UnitOfWork } from '../../../shared/db/unit-of-work.js';
import { DomainError } from '../../../shared/errors/domain-error.js';
import type { VentasEventMap } from '../domain/eventos.js';
import { FacturaBuilder } from '../domain/factura.builder.js';
import { Factura } from '../domain/factura.js';
import { Pedido, type PedidoItem } from '../domain/pedido.js';
import type {
  CatalogoProductos,
  VerificadorClientes,
} from '../domain/ports.js';
import type { ResultadoPago } from '../domain/payments/pago.strategy.js';
import type { CadenaValidacion } from '../domain/validation/cadena-validacion.js';
import type { VentasRepository } from '../ventas.repository.js';
import type { EstrategiasVentas, MetodoPago } from '../ventas.service.js';

export interface CheckoutItemInput {
  readonly productoId: string;
  readonly cantidad: number;
}

export interface CheckoutInput {
  readonly documentoCliente: string;
  readonly items: readonly CheckoutItemInput[];
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
    private readonly catalogo: CatalogoProductos,
    private readonly clientes: VerificadorClientes,
    private readonly repository: VentasRepository,
    private readonly unitOfWork: UnitOfWork<VentasEventMap>,
    private readonly verificarStock: (
      productoId: string,
      cantidad: number,
    ) => Promise<boolean>,
    private readonly descontarStock: (
      productoId: string,
      cantidad: number,
    ) => Promise<void>,
  ) {}

  async checkout(input: CheckoutInput): Promise<CheckoutResultado> {
    // 1. Validación por cadena de responsabilidad (fuera de la transacción
    //    para fallar rápido sin tocar la base de datos).
    await this.cadenaValidacion.ejecutar({
      documentoCliente: input.documentoCliente,
      items: input.items,
      verificarCliente: (documento) =>
        this.clientes.obtenerPorDocumento(documento),
      verificarStock: this.verificarStock,
    });

    // 2. Todo el proceso de checkout corre en una única transacción.
    return this.unitOfWork.execute(async (context) => {
      // 2a. Obtener precios y construir ítems del pedido.
      const items: PedidoItem[] = [];

      for (const itemInput of input.items) {
        const precioUnitario = await this.catalogo.obtenerPrecio(
          itemInput.productoId,
        );

        if (precioUnitario === null) {
          throw new DomainError(
            `Producto ${itemInput.productoId} no encontrado`,
            {
              code: 'PRODUCTO_NO_ENCONTRADO',
              statusCode: 404,
            },
          );
        }

        items.push({
          productoId: itemInput.productoId,
          cantidad: itemInput.cantidad,
          precioUnitario,
        });
      }

      // 2b. Verificar cliente y obtener si es frecuente.
      const cliente = await this.clientes.obtenerPorDocumento(
        input.documentoCliente.trim(),
      );

      if (!cliente) {
        throw new DomainError('Cliente no encontrado', {
          code: 'CLIENTE_NO_ENCONTRADO',
          statusCode: 404,
        });
      }

      // 2c. Calcular totales usando las estrategias de descuento e impuesto.
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
          esClienteFrecuente: cliente.esClienteFrecuente ?? false,
        },
      );

      // 2d. Persistir pedido en Borrador.
      await this.repository.crearPedido(context.db, pedido);

      // 2e. Emitir el pedido (Borrador → Emitido).
      pedido.emitir();

      const emitido = await this.repository.actualizarEstado(
        context.db,
        pedido.id,
        'Borrador',
        'Emitido',
      );

      if (!emitido) {
        throw new DomainError(
          'El pedido cambió de estado antes de emitirlo',
          {
            code: 'CONFLICTO_ESTADO_PEDIDO',
            statusCode: 409,
          },
        );
      }

      // 2f. Cobrar usando la estrategia de pago seleccionada.
      const metodoPago = input.metodoPago ?? 'efectivo';
      const estrategiaPago = this.estrategias.pagos[metodoPago];

      const pago = await estrategiaPago.cobrar({
        monto: pedido.total,
        montoRecibido: input.montoRecibido,
      });

      // 2g. Pagar el pedido (Emitido → Pagado).
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

      // 2g. Publicar evento de pago en el outbox (dentro de la transacción).
      await context.publish('PedidoPagado', {
        pedidoId: pedido.id,
        clienteId: pedido.clienteId,
        total: pedido.total,
        pagadoEn: new Date().toISOString(),
        metodoPago: pago.metodo,
        referenciaPago: pago.referencia,
      });

      // 2h. Construir la factura con el Builder.
      const numero = await this.repository.siguienteNumeroFactura(context.db);
      const factura = new FacturaBuilder()
        .conId(randomUUID())
        .conPedidoId(pedido.id)
        .conNumero(numero)
        .conEstado('Emitida')
        .construir();

      await this.repository.crearFactura(context.db, factura);

      // 2i. Descontar el stock de cada ítem vendido.
      for (const item of items) {
        await this.descontarStock(item.productoId, item.cantidad);
      }

      return { pedido, factura, pago };
    });
  }
}

import type { FastifyPluginCallback } from 'fastify';
import { z } from 'zod';

import type { FacturacionElectronicaPort } from '../../integrations/facturacion-electronica/facturacion.port.js';
import type { UnitOfWork } from '../../shared/db/unit-of-work.js';
import type { AppEventMap } from '../../shared/events/app-event-map.js';
import type { VentasRepository } from './ventas.repository.js';
import type { CatalogoProductos, VerificadorClientes } from './domain/ports.js';
import type { CarritoRepository } from './pos/carrito.repository.js';
import { VentasService, type EstrategiasVentas } from './ventas.service.js';
import type { CheckoutInput, PosCheckoutFacade } from './pos/pos-checkout.facade.js';

const crearPedidoSchema = z.object({
  documentoCliente: z.string().trim().min(1),
  carritoId: z.string().uuid(),
});

const pagoSchema = z.object({
  metodoPago: z.enum(['efectivo', 'pasarela']).optional(),
  montoRecibido: z.coerce.number().nonnegative().optional(),
});

const pedidoParamsSchema = z.object({
  id: z.string().uuid(),
});

const facturaParamsSchema = z.object({
  id: z.string().uuid(),
});

const checkoutSchema = z.object({
  documentoCliente: z.string().trim().min(1),
  carritoId: z.string().uuid(),
  metodoPago: z.enum(['efectivo', 'pasarela']).optional(),
  montoRecibido: z.coerce.number().nonnegative().optional(),
});

export interface VentasRoutesOptions {
  repository: VentasRepository;
  unitOfWork: UnitOfWork<AppEventMap>;
  catalogo: CatalogoProductos;
  clientes: VerificadorClientes;
  estrategias: EstrategiasVentas;
  facade: PosCheckoutFacade;
  carritoRepository: CarritoRepository;
  facturacion: FacturacionElectronicaPort;
}

export const ventasRoutes: FastifyPluginCallback<VentasRoutesOptions> = (
  app,
  { repository, unitOfWork, clientes, estrategias, facade, carritoRepository, facturacion },
  done,
) => {
  const service = new VentasService(
    repository,
    unitOfWork,
    clientes,
    estrategias,
    carritoRepository,
    facturacion,
  );

  const checkoutFacade = facade;

  app.get('/api/pedidos', async () => service.listarPedidos());

  app.get<{ Params: { id: string } }>('/api/pedidos/:id', async (request) => {
    const { id } = pedidoParamsSchema.parse(request.params);

    return service.obtenerPedidoDetalle(id);
  });

  app.post<{ Params: { id: string } }>('/api/pedidos', async (request, reply) => {
    const data = crearPedidoSchema.parse(request.body);
    const pedido = await service.crearPedido(data);

    return reply.code(201).send(pedido);
  });

  app.delete<{ Params: { id: string } }>('/api/pedidos/:id', async (request, reply) => {
    const { id } = pedidoParamsSchema.parse(request.params);
    await service.eliminarPedido(id);

    return reply.code(204).send();
  });

  app.post<{ Params: { id: string } }>('/api/pedidos/:id/emitir', async (request) => {
    const { id } = pedidoParamsSchema.parse(request.params);

    return service.emitirPedido(id);
  });

  app.post<{ Params: { id: string } }>('/api/pedidos/:id/pagar', async (request) => {
    const { id } = pedidoParamsSchema.parse(request.params);
    const opcionesPago = pagoSchema.parse(request.body ?? {});

    return service.pagarPedido(id, opcionesPago);
  });

  app.post<{ Params: { id: string } }>('/api/pedidos/:id/anular', async (request) => {
    const { id } = pedidoParamsSchema.parse(request.params);

    return service.anularPedido(id);
  });

  app.post<{ Params: { id: string } }>('/api/pedidos/:id/factura', async (request, reply) => {
    const { id } = pedidoParamsSchema.parse(request.params);
    const factura = await service.crearFactura(id);

    return reply.code(201).send(factura);
  });

  app.post<{ Body: CheckoutInput }>('/api/ventas/checkout', async (request, reply) => {
    const data = checkoutSchema.parse(request.body);
    const resultado = await checkoutFacade.checkout(data);

    return reply.code(201).send({
      pedido: resultado.pedido,
      factura: resultado.factura,
      pago: resultado.pago,
    });
  });

  app.get('/api/facturas', async () => service.listarFacturas());

  app.get<{ Params: { id: string } }>('/api/facturas/:id', async (request) => {
    const { id } = facturaParamsSchema.parse(request.params);

    return service.obtenerFactura(id);
  });

  done();
};

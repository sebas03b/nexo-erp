import type { FastifyPluginCallback } from 'fastify';
import { z } from 'zod';

import type { UnitOfWork } from '../../shared/db/unit-of-work.js';
import type { VentasEventMap } from './domain/eventos.js';
import type { VentasRepository } from './ventas.repository.js';
import type { CatalogoProductos, VerificadorClientes } from './domain/ports.js';
import { VentasService, type EstrategiasVentas } from './ventas.service.js';
import { PosCheckoutFacade } from './pos/pos-checkout.facade.js';
import type { CheckoutInput } from './pos/pos-checkout.facade.js';

const pedidoItemSchema = z.object({
  productoId: z.string().uuid(),
  cantidad: z.coerce.number().int().positive(),
});

const crearPedidoSchema = z.object({
  documentoCliente: z.string().trim().min(1),
  items: z.array(pedidoItemSchema).min(1),
  descuento: z.coerce.number().nonnegative().optional(),
  impuesto: z.coerce.number().nonnegative().optional(),
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
  items: z.array(pedidoItemSchema).min(1),
  metodoPago: z.enum(['efectivo', 'pasarela']).optional(),
  montoRecibido: z.coerce.number().nonnegative().optional(),
});

export interface VentasRoutesOptions {
  repository: VentasRepository;
  unitOfWork: UnitOfWork<VentasEventMap>;
  catalogo: CatalogoProductos;
  clientes: VerificadorClientes;
  estrategias: EstrategiasVentas;
  facade: PosCheckoutFacade;
}

export const ventasRoutes: FastifyPluginCallback<VentasRoutesOptions> = (
  app,
  { repository, unitOfWork, catalogo, clientes, estrategias, facade },
  done,
) => {
  const service = new VentasService(
    repository,
    unitOfWork,
    catalogo,
    clientes,
    estrategias,
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

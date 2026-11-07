export type VentasEventMap = {
  PedidoEmitido: {
    pedidoId: string;
    clienteId: string;
    total: number;
    emitidoEn: string;
  };
  PedidoPagado: {
    pedidoId: string;
    clienteId: string;
    total: number;
    pagadoEn: string;
    metodoPago: string;
    referenciaPago: string;
  };
};

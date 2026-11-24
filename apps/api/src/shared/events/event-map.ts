export type AppEventMap = {
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
    items?: Array<{
      productoId: string;
      nombre: string;
      tipo: 'producto' | 'servicio';
      cantidad: number;
      precioUnitario: number;
      subtotal: number;
    }>;
  };
  CitaConfirmada: {
    citaId: string;
    clienteId: string;
    empleadoId: string;
    empleadoNombre: string;
    motivo: string | null;
    inicio: string;
    fin: string;
    confirmadaEn: string;
  };
};

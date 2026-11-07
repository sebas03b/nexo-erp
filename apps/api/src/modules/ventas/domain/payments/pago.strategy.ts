// Patrón: Strategy

export interface PagoContexto {
  readonly monto: number;
  readonly montoRecibido?: number;
  readonly referencia?: string;
}

export interface ResultadoPago {
  readonly metodo: string;
  readonly monto: number;
  readonly cambio: number;
  readonly referencia: string;
}

export interface PagoStrategy {
  readonly metodo: string;
  cobrar(contexto: PagoContexto): Promise<ResultadoPago>;
}

export type EstadoCaja = 'Abierta' | 'Cerrada';

export interface Caja {
  id: string;
  usuarioId: string;
  apertura: Date;
  cierre: Date | null;
  montoInicial: number;
  montoFinal: number | null;
}

export interface CrearCajaInput {
  usuarioId: string;
  montoInicial: number;
}

export interface CerrarCajaInput {
  montoFinal: number;
}

export interface CajaRow {
  id: string;
  usuario_id: string;
  apertura: Date;
  cierre: Date | null;
  monto_inicial: string;
  monto_final: string | null;
}

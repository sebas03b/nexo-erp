// Patrón: Strategy

export interface ImpuestoContexto {
  readonly baseImponible: number;
}

export interface ImpuestoStrategy {
  readonly nombre: string;
  calcular(contexto: ImpuestoContexto): number;
}

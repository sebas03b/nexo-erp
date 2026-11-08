// Patrón: Strategy

export interface DescuentoContexto {
  readonly subtotal: number;
  readonly cantidadTotal: number;
  readonly esClienteFrecuente: boolean;
}

export interface DescuentoStrategy {
  readonly nombre: string;
  calcular(contexto: DescuentoContexto): number;
}

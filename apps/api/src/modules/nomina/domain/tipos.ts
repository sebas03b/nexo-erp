export type ConceptoTipo = 'devengo' | 'deduccion';

export interface ConceptoNomina {
  id: string;
  codigo: string;
  nombre: string;
  tipo: ConceptoTipo;
  activo: boolean;
}

export interface EntradaConcepto {
  empleadoId: string;
  salarioBase: number;
  horasExtras?: number;
  auxilioTransporte?: number;
  periodo: string;
}

export interface ResultadoConcepto {
  codigo: string;
  nombre: string;
  tipo: ConceptoTipo;
  valor: number;
}

export interface LiquidacionResultado {
  id: string;
  empleadoId: string;
  periodo: string;
  salarioBase: number;
  totalDevengos: number;
  totalDeducciones: number;
  netoAPagar: number;
  conceptos: ResultadoConcepto[];
}

export interface LiquidacionPersistida {
  id: string;
  empleadoId: string;
  periodo: string;
  salarioBase: number;
  totalDevengos: number;
  totalDeducciones: number;
  netoAPagar: number;
  creadoEn: Date;
  actualizadoEn: Date;
}

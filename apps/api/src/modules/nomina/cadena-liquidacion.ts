// Patrón: Chain of Responsibility

import type { EntradaConcepto, ResultadoConcepto } from './domain/tipos.js';

export interface EslabonLiquidacion {
  ejecutar(
    entrada: EntradaConcepto,
    acumulado: ResultadoConcepto[],
  ): Promise<ResultadoConcepto[]>;
  establecerSiguiente(eslabon: EslabonLiquidacion): EslabonLiquidacion;
}

export abstract class EslabonLiquidacionBase {
  #siguiente?: EslabonLiquidacion;

  establecerSiguiente(eslabon: EslabonLiquidacion): EslabonLiquidacion {
    this.#siguiente = eslabon;
    return eslabon;
  }

  protected siguiente(
    entrada: EntradaConcepto,
    acumulado: ResultadoConcepto[],
  ): Promise<ResultadoConcepto[]> {
    if (this.#siguiente) {
      return this.#siguiente.ejecutar(entrada, acumulado);
    }
    return Promise.resolve(acumulado);
  }
}

export class CadenaLiquidacion {
  #cabeza: EslabonLiquidacion | null = null;
  #cola: EslabonLiquidacion | null = null;

  agregar(eslabon: EslabonLiquidacion): void {
    if (!this.#cabeza) {
      this.#cabeza = eslabon;
      this.#cola = eslabon;
    } else {
      this.#cola!.establecerSiguiente(eslabon);
      this.#cola = eslabon;
    }
  }

  async ejecutar(entrada: EntradaConcepto): Promise<ResultadoConcepto[]> {
    if (!this.#cabeza) {
      return [];
    }
    return this.#cabeza.ejecutar(entrada, []);
  }
}

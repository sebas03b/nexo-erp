// Patrón: Chain of Responsibility

import { DomainError } from '../../../../shared/errors/domain-error.js';

export interface ValidacionContexto {
  readonly documentoCliente: string;
  readonly items: readonly {
    readonly productoId: string;
    readonly cantidad: number;
  }[];
  readonly verificarCliente: (
    documento: string,
  ) => Promise<{ readonly id: string; readonly esClienteFrecuente?: boolean } | null>;
  readonly verificarStock: (
    productoId: string,
    cantidad: number,
  ) => Promise<boolean>;
}

export interface EslabonValidacion {
  validar(contexto: ValidacionContexto): Promise<void>;
  establecerSiguiente(eslabon: EslabonValidacion): EslabonValidacion;
}

export abstract class EslabonValidacionBase {
  #siguiente?: EslabonValidacion;

  establecerSiguiente(eslabon: EslabonValidacion): EslabonValidacion {
    this.#siguiente = eslabon;
    return eslabon;
  }

  protected async siguiente(contexto: ValidacionContexto): Promise<void> {
    if (this.#siguiente) {
      await this.#siguiente.validar(contexto);
    }
  }
}

export class ValidarClienteValido extends EslabonValidacionBase implements EslabonValidacion {
  async validar(contexto: ValidacionContexto): Promise<void> {
    const cliente = await contexto.verificarCliente(contexto.documentoCliente);

    if (!cliente) {
      throw new DomainError('Cliente no encontrado', {
        code: 'CLIENTE_NO_ENCONTRADO',
        statusCode: 404,
      });
    }

    await this.siguiente(contexto);
  }
}

export class ValidarStockSuficiente extends EslabonValidacionBase implements EslabonValidacion {
  async validar(contexto: ValidacionContexto): Promise<void> {
    for (const item of contexto.items) {
      const suficiente = await contexto.verificarStock(item.productoId, item.cantidad);

      if (!suficiente) {
        throw new DomainError(`Stock insuficiente para el producto ${item.productoId}`, {
          code: 'STOCK_INSUFICIENTE',
          statusCode: 409,
        });
      }
    }

    await this.siguiente(contexto);
  }
}

export class CadenaValidacion {
  #cabeza: EslabonValidacion | null = null;
  #cola: EslabonValidacion | null = null;

  agregar(eslabon: EslabonValidacion): void {
    if (!this.#cabeza) {
      this.#cabeza = eslabon;
      this.#cola = eslabon;
    } else {
      this.#cola!.establecerSiguiente(eslabon);
      this.#cola = eslabon;
    }
  }

  async ejecutar(contexto: ValidacionContexto): Promise<void> {
    if (!this.#cabeza) {
      return;
    }

    await this.#cabeza.validar(contexto);
  }
}

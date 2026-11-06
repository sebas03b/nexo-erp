import { DomainError } from '../errors/domain-error.js';

type CodigoErrorPostgres = '23502' | '23503' | '23505' | '23514';

interface ErrorPostgres {
  code: string;
}

export interface TraduccionErrorBd {
  code: string;
  message: string;
  statusCode?: number;
}

export type TraduccionesErrorBd = Partial<Record<CodigoErrorPostgres, TraduccionErrorBd>>;

function esErrorPostgres(error: unknown): error is ErrorPostgres {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return false;
  }

  return typeof (error as { code?: unknown }).code === 'string';
}

/**
 * Convierte los errores del driver PostgreSQL en errores de dominio. De este
 * modo la capa HTTP responde con el código adecuado y nunca expone el SQL del
 * motor ni los detalles de las restricciones.
 */
export function traducirErrorBd(error: unknown, traducciones: TraduccionesErrorBd): never {
  if (esErrorPostgres(error)) {
    const traduccion = traducciones[error.code as CodigoErrorPostgres];

    if (traduccion) {
      throw new DomainError(traduccion.message, {
        code: traduccion.code,
        statusCode: traduccion.statusCode ?? 409,
        cause: error,
      });
    }
  }

  throw error;
}

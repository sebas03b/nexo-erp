export interface DomainErrorOptions {
  code: string;
  statusCode?: number;
  details?: unknown;
  cause?: unknown;
}

export class DomainError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly details?: unknown;

  constructor(message: string, options: DomainErrorOptions) {
    super(message, { cause: options.cause });
    this.name = new.target.name;
    this.code = options.code;
    this.statusCode = options.statusCode ?? 400;
    this.details = options.details;
  }
}

export class RecursoNoEncontrado extends DomainError {
  constructor(code: string, message: string) {
    super(message, { code, statusCode: 404 });
  }
}

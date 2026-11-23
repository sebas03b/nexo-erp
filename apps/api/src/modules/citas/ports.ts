import type { Kysely } from 'kysely';

import type { Database } from '../../shared/db/schema.js';

export interface EmpleadoCita {
  id: string;
  nombre: string;
  activo: boolean;
}

export interface VerificadorClienteParaCita {
  existeBloqueado(
    clienteId: string,
    executor: Kysely<Database>,
  ): Promise<boolean>;
}

export interface ConsultorEmpleadosParaCita {
  obtenerEmpleadoBloqueado(
    empleadoId: string,
    executor: Kysely<Database>,
  ): Promise<EmpleadoCita | null>;
}

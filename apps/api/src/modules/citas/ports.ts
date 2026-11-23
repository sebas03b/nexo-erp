import type { Kysely } from 'kysely';

import type { Database } from '../../shared/db/schema.js';

export interface EmpleadoCita {
  id: string;
  nombre: string;
  activo: boolean;
}

export interface VerificadorClienteParaCita {
  existe(clienteId: string): Promise<boolean>;
}

export interface ConsultorEmpleadosParaCita {
  obtenerEmpleado(
    empleadoId: string,
    executor: Kysely<Database>,
  ): Promise<EmpleadoCita | null>;
}

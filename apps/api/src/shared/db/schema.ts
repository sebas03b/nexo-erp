import type { ColumnType, Generated } from 'kysely';

export interface UsuariosTable {
  id: Generated<string>;
  nombre: string;
  rol: string;
  hash_password: string;
}

export interface ClientesTable {
  id: Generated<string>;
  nombre: string;
  documento: string;
  email: string | null;
  telefono: string | null;
  canal_preferido: string | null;
}

export interface OutboxEventsTable {
  id: Generated<string>;
  correlation_id: string;
  tipo: string;
  payload: ColumnType<object, string, string>;
  creado_en: Generated<Date>;
  procesado_en: Date | null;
}

export interface Database {
  usuarios: UsuariosTable;
  clientes: ClientesTable;
  outbox_events: OutboxEventsTable;
}

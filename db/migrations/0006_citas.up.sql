CREATE TABLE empleados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  email text,
  telefono text,
  activo boolean NOT NULL DEFAULT true
);

CREATE TABLE citas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES clientes (id) ON DELETE RESTRICT,
  empleado_id uuid NOT NULL REFERENCES empleados (id) ON DELETE RESTRICT,
  inicio timestamptz NOT NULL,
  fin timestamptz NOT NULL,
  estado text NOT NULL DEFAULT 'Pendiente'
    CHECK (estado IN ('Pendiente', 'Confirmada', 'En Proceso', 'Completada', 'Cancelada')),
  motivo text,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  CHECK (fin > inicio)
);

CREATE INDEX citas_agenda_idx ON citas (empleado_id, inicio, fin);
CREATE INDEX citas_cliente_idx ON citas (cliente_id, inicio);
CREATE INDEX citas_estado_idx ON citas (estado, inicio);

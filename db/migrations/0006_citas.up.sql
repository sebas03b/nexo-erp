CREATE TABLE citas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES clientes (id) ON DELETE RESTRICT,
  empleado_id text,
  inicio timestamptz NOT NULL,
  fin timestamptz NOT NULL,
  estado text NOT NULL DEFAULT 'Pendiente'
    CHECK (estado IN ('Pendiente','Confirmada','En Proceso','Completada','Cancelada')),
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT citas_rango_valido CHECK (fin > inicio)
);

CREATE INDEX citas_inicio_idx ON citas (inicio);
CREATE INDEX citas_empleado_rango_idx ON citas (empleado_id, inicio, fin);

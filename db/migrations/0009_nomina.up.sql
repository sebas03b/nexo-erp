-- Agrega columna salario_base a empleados (demo: valor por defecto)
ALTER TABLE empleados
  ADD COLUMN IF NOT EXISTS salario_base numeric(12, 2) NOT NULL DEFAULT 1500000;

-- Catálogo de conceptos de nómina (devengo / deducción)
CREATE TABLE conceptos_nomina (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE CHECK (length(codigo) > 0),
  nombre text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('devengo', 'deduccion')),
  activo boolean NOT NULL DEFAULT true,
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX conceptos_nomina_tipo_idx ON conceptos_nomina (tipo);
CREATE INDEX conceptos_nomina_activo_idx ON conceptos_nomina (activo);

-- Liquidaciones de nómina (resultado neto por empleado y período)
CREATE TABLE liquidaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id uuid NOT NULL REFERENCES empleados (id) ON DELETE RESTRICT,
  periodo text NOT NULL CHECK (length(periodo) > 0),
  salario_base numeric(12, 2) NOT NULL CHECK (salario_base >= 0),
  total_devengos numeric(12, 2) NOT NULL DEFAULT 0 CHECK (total_devengos >= 0),
  total_deducciones numeric(12, 2) NOT NULL DEFAULT 0 CHECK (total_deducciones >= 0),
  neto_a_pagar numeric(12, 2) NOT NULL CHECK (neto_a_pagar >= 0),
  detalle jsonb NOT NULL DEFAULT '{}',
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX liquidaciones_empleado_idx ON liquidaciones (empleado_id);
CREATE INDEX liquidaciones_periodo_idx ON liquidaciones (periodo);
CREATE UNIQUE INDEX liquidaciones_empleado_periodo_idx
  ON liquidaciones (empleado_id, periodo);

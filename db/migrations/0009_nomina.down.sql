DROP INDEX IF EXISTS liquidaciones_empleado_periodo_idx;
DROP INDEX IF EXISTS liquidaciones_periodo_idx;
DROP INDEX IF EXISTS liquidaciones_empleado_idx;
DROP INDEX IF EXISTS conceptos_nomina_activo_idx;
DROP INDEX IF EXISTS conceptos_nomina_tipo_idx;
DROP TABLE IF EXISTS liquidaciones;
DROP TABLE IF EXISTS conceptos_nomina;
ALTER TABLE empleados
  DROP COLUMN IF EXISTS salario_base;

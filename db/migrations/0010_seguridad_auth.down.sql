-- Fase 8: Autenticación (down)
DROP INDEX IF EXISTS sesiones_token_hash_idx;
DROP INDEX IF EXISTS sesiones_usuario_id_idx;
DROP TABLE IF EXISTS sesiones;

ALTER TABLE cajas
  DROP CONSTRAINT IF EXISTS cajas_usuario_id_fkey;

ALTER TABLE cajas
  ALTER COLUMN usuario_id TYPE text;

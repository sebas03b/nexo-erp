DROP INDEX IF EXISTS pedidos_created_at_idx;

ALTER TABLE pedidos
  DROP COLUMN IF EXISTS created_at;

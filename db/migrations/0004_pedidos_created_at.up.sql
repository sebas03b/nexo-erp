DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'pedidos'
      AND column_name = 'created_at'
  ) THEN
    ALTER TABLE pedidos
      ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
  ELSE
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'pedidos'
        AND column_name = 'created_at'
        AND data_type = 'timestamp without time zone'
    ) THEN
      ALTER TABLE pedidos
        ALTER COLUMN created_at TYPE timestamptz
        USING created_at AT TIME ZONE 'UTC';
    END IF;

    UPDATE pedidos
    SET created_at = now()
    WHERE created_at IS NULL;

    ALTER TABLE pedidos
      ALTER COLUMN created_at SET DEFAULT now();

    ALTER TABLE pedidos
      ALTER COLUMN created_at SET NOT NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS pedidos_created_at_idx
  ON pedidos (created_at DESC);

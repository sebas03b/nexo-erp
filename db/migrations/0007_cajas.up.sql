CREATE TABLE cajas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id text NOT NULL,
  apertura timestamptz NOT NULL DEFAULT now(),
  cierre timestamptz,
  monto_inicial numeric(12, 2) NOT NULL CHECK (monto_inicial >= 0),
  monto_final numeric(12, 2) CHECK (monto_final IS NULL OR monto_final >= 0),
  CONSTRAINT cajas_cierre_requiere_monto CHECK (
    (cierre IS NULL AND monto_final IS NULL) OR (cierre IS NOT NULL AND monto_final IS NOT NULL)
  )
);

-- Una sola caja abierta por usuario a la vez.
CREATE UNIQUE INDEX cajas_abierta_por_usuario_idx
  ON cajas (usuario_id) WHERE cierre IS NULL;

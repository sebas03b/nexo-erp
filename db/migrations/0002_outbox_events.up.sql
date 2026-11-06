CREATE TABLE outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correlation_id text NOT NULL,
  tipo text NOT NULL,
  payload jsonb NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now(),
  procesado_en timestamptz
);

CREATE INDEX outbox_events_pendientes_idx
  ON outbox_events (creado_en)
  WHERE procesado_en IS NULL;

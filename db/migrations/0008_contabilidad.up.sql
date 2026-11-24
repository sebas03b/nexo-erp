CREATE TABLE asientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha timestamptz NOT NULL DEFAULT now(),
  cuenta text NOT NULL,
  debito numeric(12, 2) NOT NULL DEFAULT 0 CHECK (debito >= 0),
  credito numeric(12, 2) NOT NULL DEFAULT 0 CHECK (credito >= 0),
  origen_id uuid NOT NULL,
  metodo_pago text,
  descripcion text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT asientos_partida_doble CHECK ((debito = 0) <> (credito = 0))
);

-- Idempotencia: un pedido genera exactamente un asiento por cuenta.
CREATE UNIQUE INDEX asientos_origen_cuenta_idx ON asientos (origen_id, cuenta);
CREATE INDEX asientos_fecha_idx ON asientos (fecha);

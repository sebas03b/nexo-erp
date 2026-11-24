-- Fase 8: Autenticación
-- Cambiar cajas.usuario_id de text a uuid con FK a usuarios
ALTER TABLE cajas
  ALTER COLUMN usuario_id TYPE uuid USING usuario_id::uuid;

ALTER TABLE cajas
  ADD CONSTRAINT cajas_usuario_id_fkey
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE RESTRICT;

-- Tabla de sesiones activas (para control de sesiones de usuario)
CREATE TABLE sesiones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expira_en timestamptz NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sesiones_usuario_id_idx ON sesiones (usuario_id);
CREATE INDEX sesiones_token_hash_idx ON sesiones (token_hash);

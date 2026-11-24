ALTER TABLE facturas
  ALTER COLUMN payload_externo TYPE jsonb
  USING NULL::jsonb;

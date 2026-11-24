ALTER TABLE facturas
  ALTER COLUMN payload_externo TYPE text
  USING payload_externo::text;

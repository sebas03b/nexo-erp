CREATE TABLE productos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text NOT NULL UNIQUE,
  nombre text NOT NULL,
  precio numeric(12, 2) NOT NULL CHECK (precio >= 0),
  tipo text NOT NULL
);

CREATE TABLE stock (
  producto_id uuid PRIMARY KEY REFERENCES productos (id) ON DELETE CASCADE,
  cantidad integer NOT NULL DEFAULT 0 CHECK (cantidad >= 0)
);

CREATE TABLE pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES clientes (id),
  estado text NOT NULL DEFAULT 'Borrador'
    CHECK (estado IN ('Borrador', 'Emitido', 'Pagado', 'Anulado')),
  subtotal numeric(12, 2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  descuento numeric(12, 2) NOT NULL DEFAULT 0 CHECK (descuento >= 0),
  impuesto numeric(12, 2) NOT NULL DEFAULT 0 CHECK (impuesto >= 0),
  total numeric(12, 2) NOT NULL DEFAULT 0 CHECK (total >= 0)
);

CREATE TABLE pedido_items (
  pedido_id uuid NOT NULL REFERENCES pedidos (id) ON DELETE CASCADE,
  producto_id uuid NOT NULL REFERENCES productos (id),
  cantidad integer NOT NULL CHECK (cantidad > 0),
  precio_unitario numeric(12, 2) NOT NULL CHECK (precio_unitario >= 0),
  PRIMARY KEY (pedido_id, producto_id)
);

CREATE SEQUENCE facturas_numero_seq AS bigint START WITH 1 INCREMENT BY 1;

CREATE TABLE facturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL UNIQUE REFERENCES pedidos (id),
  numero text NOT NULL UNIQUE,
  estado text NOT NULL,
  payload_externo jsonb
);

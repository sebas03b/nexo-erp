ALTER TABLE carrito_items DROP CONSTRAINT carrito_items_pkey;
ALTER TABLE carrito_items ADD COLUMN id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE carrito_items ADD PRIMARY KEY (id);
CREATE INDEX carrito_items_carrito_producto_idx ON carrito_items (carrito_id, producto_id);

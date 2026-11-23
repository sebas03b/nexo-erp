DROP INDEX IF EXISTS carrito_items_carrito_producto_idx;
ALTER TABLE carrito_items DROP CONSTRAINT carrito_items_pkey;
ALTER TABLE carrito_items DROP COLUMN id;
ALTER TABLE carrito_items ADD PRIMARY KEY (carrito_id, producto_id);

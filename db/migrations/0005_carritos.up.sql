CREATE TABLE carritos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estado text NOT NULL DEFAULT 'Abierto' CHECK (estado IN ('Abierto','Cerrado','Descartado')),
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE carrito_items (
  carrito_id uuid NOT NULL REFERENCES carritos (id) ON DELETE CASCADE,
  producto_id uuid NOT NULL REFERENCES productos (id),
  cantidad integer NOT NULL CHECK (cantidad > 0),
  precio_unitario numeric(12, 2) NOT NULL CHECK (precio_unitario >= 0),
  PRIMARY KEY (carrito_id, producto_id)
);

CREATE TABLE carrito_comandos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carrito_id uuid NOT NULL REFERENCES carritos (id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('AGREGAR_ITEM','DECREMENTAR_ITEM','QUITAR_ITEM','ESTABLECER_CANTIDAD')),
  payload jsonb NOT NULL,
  estado_anterior jsonb,
  item_removido jsonb,
  deshecho boolean NOT NULL DEFAULT false,
  creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX carrito_comandos_historial ON carrito_comandos (carrito_id, deshecho, creado_en);


Objetivo
El frontend deja de ser el dueño del carrito: NuevaVenta se convierte en Invocador (thin client). Cada clic envía una intención a la API; la API ejecuta el Command sobre la entidad Carrito (persistida en PostgreSQL), valida producto/precio/stock y devuelve el estado oficial. pnpm test y pnpm tsc --noEmit en verde.
Decisiones tomadas
#	Decisión
1	Carrito persistido en PostgreSQL (carritos, carrito_items, carrito_comandos)
2	− = nuevo DecrementarItemCommand (resta 1 unidad; al llegar a 0 elimina la línea)
3	DESHACER con historial persistido por carrito + botón en el POS
4	Checkout y "dejar en pendiente" usan carritoId; el backend resuelve los ítems
5	Input de cantidad editable → nuevo EstablecerCantidadCommand
6	Se corrigen solo imports de los State movidos (typecheck hoy roto)
1. Capa de datos (nuevo)
db/migrations/0005_carritos.up.sql / .down.sql
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
  estado_anterior jsonb,        -- línea previa (null = el producto no existía)
  item_removido jsonb,          -- para QUITAR_ITEM
  deshecho boolean NOT NULL DEFAULT false,
  creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX carrito_comandos_historial ON carrito_comandos (carrito_id, deshecho, creado_en);
apps/api/src/shared/db/schema.ts: añadir CarritosTable, CarritoItemsTable, CarritoComandosTable.
2. Dominio Command (pos/commands/)
- Nuevo decrementar-item.command.ts: // Patrón: Command. Resta N unidades; si llega a 0, quita la línea. deshacer() restaura la cantidad previa.
- Nuevo establecer-cantidad.command.ts: fija la cantidad absoluta; deshacer() restaura la cantidad previa.
- Modificar agregar-item.command.ts / quitar-item.command.ts: constructor acepta opcionalmente el estado previo persistido (estadoAnterior: ItemCarrito | null | undefined, itemRemovido?: ItemCarrito) para poder rehidratar el comando y llamar deshacer() tras reiniciar la API. undefined = ejecución fresca (captura el estado), null = "el producto no existía".
- Modificar comando.ts: tipo compartido EstadoPrevioItem = ItemCarrito | null y guarda de estado de deshacer.
- Modificar carrito.ts (Receptor): nuevos primitivos restarCantidad, fijarCantidad, restaurarItem, restaurarItems encapsulados (sin any).
3. Servicio Invoker + repositorio (nuevos)
- pos/carrito.repository.ts: CRUD de carritos, carrito_items, carrito_comandos con Kysely (upsert de ítems, último comando no deshecho, marcar deshecho).
- pos/carrito.service.ts (// Patrón: Command — rol Invoker):
- crearCarrito() / obtenerCarrito(id) / descartarCarrito(id) / cerrarCarrito(id).
- ejecutarComando(id, accion, payload): carga agregado → valida (precio desde catálogo, nunca desde el cliente; stock vía port) → construye el command → ejecutar() → persiste ítems + fila de historial en una sola transacción (Unit of Work) → devuelve estado.
- deshacer(id): toma el último comando no deshecho, lo rehidrata, llama deshacer(), persiste y marca deshecho = true.
- Totales calculados con Pedido.calcularTotales(...) → mismas Strategies del checkout (fin de la divergencia frontend 10 % vs backend).
- pos/carrito.routes.ts: POST /api/carritos, GET /api/carritos/:id, POST /api/carritos/:id/comandos, DELETE /api/carritos/:id, con Zod (accion enum, payload por acción).
Ports (domain/ports.ts): nuevo ConsultorStock { obtenerCantidadStock(productoId): Promise<number | null> }, implementado en app.ts con InventarioRepository → Ventas nunca importa Inventario (respeta el desacoplamiento de AGENTS.md).
4. Checkout usa el carrito
- PosCheckoutFacade.checkout({ documentoCliente, carritoId, metodoPago?, montoRecibido? }): resuelve ítems desde el carrito (rechaza carrito vacío 400 / inexistente 404), ejecuta la cadena de validación (cliente + stock) y dentro de la misma transacción crea pedido, factura, pago, descuenta stock y marca el carrito Cerrado.
- VentasService.crearPedido({ documentoCliente, carritoId }) (dejar en pendiente) → resuelve ítems del carrito y lo cierra.
- ventas.routes.ts: checkoutSchema y crearPedidoSchema pasan a exigir carritoId (uuid) en lugar de items.
- app.ts: registra carritoRoutes, inyecta CarritoRepository y el port de stock.
5. Frontend
- Nuevo apps/web/src/hooks/useCarrito.ts: al montar NuevaVenta hace POST /api/carritos (y rehidrata con GET /api/carritos/:id si hay carritoId en sessionStorage); expone items, totales, cargando, error, despacharComando(accion, payload), deshacer().
- Modificar apps/web/src/pages/NuevaVenta.tsx: se elimina lineas/setLineas y el cálculo local de subtotal/descuento/impuesto/total. Botones "ciegos":
UI	Comando
Catálogo "Agregar" / botón +	AGREGAR_ITEM {productoId, cantidad:1}
Botón −	DECREMENTAR_ITEM {productoId, cantidad:1}
Input numérico	ESTABLECER_CANTIDAD {productoId, cantidad}
Papelera 🗑	QUITAR_ITEM {productoId}
Botón "Deshacer"	DESHACER
- Checkout: POST /api/ventas/checkout {documentoCliente, carritoId, metodoPago}; pendiente: POST /api/pedidos {documentoCliente, carritoId}.
- Se muestran los errores del backend (p. ej. Stock insuficiente…) y se deshabilitan los controles mientras hay un comando en vuelo.
- apps/web/src/types.ts: ItemCarrito, Carrito (con items + totales).
6. Pruebas (Vitest)
- Nuevas: decrementar-item.command.test.ts, establecer-cantidad.command.test.ts, carrito.service.test.ts / carrito.routes.test.ts (PGlite como fase2.routes.test.ts): crear carrito, agregar con precio del catálogo, 409 por stock insuficiente, 404 producto inexistente, decrementar, quitar, establecer cantidad, deshacer (deshacer un alta de línea nueva la elimina; deshacer una eliminación la restaura), checkout con carritoId (crea pedido/factura, descuenta stock, cierra carrito).
- Actualizar: pos-checkout.facade.test.ts y fase2.routes.test.ts al nuevo contrato carritoId; tests de comandos por los constructores opcionales.
- Frontend App.test.tsx: el mock de fetch simulará un carrito server-side (estado real en el mock) para verificar que +, −, input, papelera y "Deshacer" llaman al endpoint correcto y renderizan la respuesta del backend, y que el checkout envía carritoId.
7. Corrección de imports preexistente (solo rutas)
- apps/api/src/modules/ventas/domain/pedido.ts: './states/*.js' → './pricing/states/*.js'.
- apps/api/src/modules/ventas/domain/pricing/states/*.ts: '../pedido-estado.js' → '../../pedido-estario.js' (→ '../../pedido-estado.js'). Sin cambios de lógica.
Archivos tocados (resumen)
API (nuevos): 0005_carritos.{up,down}.sql, pos/commands/decrementar-item.command.ts, pos/commands/establecer-cantidad.command.ts, pos/carrito.repository.ts, pos/carrito.service.ts, pos/carrito.routes.ts + tests.
API (modificados): schema.ts, ports.ts, carrito.ts, comando.ts, agregar-item.command.ts, quitar-item.command.ts, carrito.service↔ventas.service.ts, ventas.routes.ts, pos-checkout.facade.ts, app.ts, pedido.ts, pricing/states/*.
Web: hooks/useCarrito.ts (nuevo), pages/NuevaVenta.tsx, types.ts, App.test.tsx.
Criterios de aceptación
1. +, −, input, papelera y "Agregar" no mutan estado local: solo disparan commands; la UI refleja la respuesta de la API.
2. Stock insuficiente / producto inexistente / cantidad inválida → error HTTP del backend mostrado en pantalla.
3. DESHACER revierte el último comando incluso tras recargar la página (historial en BD).
4. El checkout toma los ítems del carrito del backend, descuenta stock y deja el carrito Cerrado en la misma transacción.
5. pnpm test y pnpm tsc --noEmit en verde; sin any; sin imports directos entre módulos.
Riesgos a vigilar: doble clic concurrente (se mitiga deshabilitando controles y usando el estado devuelto por la API), y la rehidratación del historial de deshacer (se cubre con tests de undo tras "recargar").

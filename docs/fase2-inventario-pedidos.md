# Especificación: Inventario y Pedidos (Fase 2)

## Entregables
- CRUD básico de productos y stock[cite: 6].
- Entidades `Pedido` y `Factura`[cite: 6].
- Patrón State para el pedido con los estados: `Borrador`, `Emitido`, `Pagado`, `Anulado`[cite: 6].
- Endpoints REST para estas operaciones en `apps/api`[cite: 6].
- Vistas iniciales en `apps/web` (React) para listar productos y crear un pedido[cite: 6].
- Migración `db/migrations/0003_inventario_pedidos.up.sql` y `.down.sql` definiendo las siguientes tablas:
  - `productos`: id, sku, nombre, precio, tipo[cite: 8].
  - `stock`: producto_id, cantidad[cite: 8].
  - `pedidos`: id, cliente_id, estado, subtotal, descuento, impuesto, total[cite: 8].
  - `pedido_items`: pedido_id, producto_id, cantidad, precio_unitario[cite: 8].
  - `facturas`: id, pedido_id, numero, estado, payload_externo[cite: 8].

## Reglas Arquitectónicas
- **Patrón State**: Las transiciones del pedido deben estar rígidamente controladas por clases de estado.
- Una transición ilegal (por ejemplo, intentar pasar directamente de `Borrador` a `Pagado`, o anular un pedido ya pagado) debe ser rechazada explícitamente lanzando un error.

## Criterio de Aceptación
- Pruebas Vitest que validen tanto las transiciones legales como las ilegales del estado del pedido (State)[cite: 6].
- Endpoints REST funcionando correctamente[cite: 6].
- El frontend lista los productos y permite crear un pedido[cite: 6].
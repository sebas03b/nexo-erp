# Trazabilidad de patrones — Fase 5 y Fase 6 (snapshot)

> **Documento técnico de trazabilidad para el cierre de Citas, Notificaciones y Caja.**
> Es un borrador vivo de evidencia y **no** constituye la versión final del documento de Fase 9 (guion de demo, diapositivas y matriz final GoF).

---

## 1. Alcance y snapshot

| Aspecto | Valor |
|---|---|
| Fases documentadas | Fase 5: Citas y notificaciones; Fase 6: Caja (Ventas/POS) |
| Estado | Implementado y cubierto por pruebas en suite local |
| Ramas / commits Fase 5 | `feat/fase5-citas-migration` → `feat/fase5-cita-state` → `feat/fase5-citas-api` → `feat/fase5-notificaciones` → `feat/fase5-cliente-canal` → `fix/fase5-citas-robustez` → `fix/fase5-citas-carreras` → `fix/fase5-clientes-web-robustez` → `feat/fase5-agenda-web` → `fix/fase5-agenda-web-robustez` → `fix/fase5-agenda-web-estado` |
| Rama / commits Fase 6 | `feat/fase6-ventas-caja` (migración 0007_cajas, módulo caja en Ventas, rutas apertura/actual/cierre, pruebas) |
| Base de la fase | `0a7a7fa` (baseline Fase 5) |

Distinción clave:

- **GoF:** los patrones del catálogo original.
- **Patrones arquitectónicos de apoyo:** Repository, Unit of Work, Outbox (infraestructura de persistencia de eventos).
- **Trabajo pendiente:** Fase 6 contabilidad (asientos, reportes), Adapter (facturación electrónica), Proxy, Nómina, exposición final.

---

## 2. Leyenda de estado

| Estado | Significado |
|---|---|
| `Implementado` | Código y prueba presentes y en verde. |
| `Implementado parcialmente` | Variante presente, alcance restante explícito. |
| `Pendiente` | Previsto en el plan, sin implementación real. |
| `No GoF` | Patrón de arquitectura de apoyo, no variante del catálogo GoF. |

---

## 3. Matriz de trazabilidad (Fase 5)

| Patrón | Clasificación | Problema | Participantes | Archivo / comentario real | Evidencia | Estado |
|---|---|---|---|---|---|---|
| State — Cita | GoF (Fase 5) | Transiciones válidas de una cita | `Cita` (Context), `CitaEstado`, `states/*`, `CitasService` | `citas/domain/cita.ts`, `citas/domain/cita-estado.ts`, `citas/domain/states/*.ts`, `citas/service.ts` | Matriz legal/ilegal, 409 `TRANSICION_CITA_INVALIDA`, flujo completo, persistencia ante rechazo, API y frontend | Implementado |
| State — Pedido | GoF (Fases 2–4) | Transiciones de pedido | `Pedido`, `PedidoEstado`, `ventas/domain/states/*` | `ventas/domain/pedido.ts`, `ventas/domain/states/*.ts` | Tests de transiciones del pedido | Implementado (preexistente) |
| Observer | GoF / arquitectura | Desacoplar emisores de consumidores | `InMemoryEventBus`, suscriptor Notificaciones, `UnitOfWork` | `shared/events/event-bus.ts`, `notificaciones/notificaciones.suscriptores.ts` | Suscripción a `CitaConfirmada` y `PedidoPagado`, entrega post-commit, aislamiento de fallos | Implementado |
| Factory Method | GoF adoptado por el proyecto | Elegir canal de notificación | `NotificacionFactory`, `Notificador`, `EmailSender`, `SmsSender`, `WhatsAppSender` | `notificaciones/notificacion.factory.ts`, `notificaciones/notificadores/*.ts` | Un canal por defecto, salida inyectada, sin casts | Implementado (adoptida como Factory Method; en GoF estricto es Simple Factory) |
| Unit of Work | Arquitectura | Transacción única + publicación | `UnitOfWork`, `Outbox`, `CitasService`, `PosCheckoutFacade` | `shared/db/unit-of-work.ts` | Commit/rollback, evento sin entregar si falla el commit, fallo de suscriptor no revierte commit | Implementado |
| Outbox | Arquitectura | Eventos sin perder tras fallos | `Outbox`, `CitaConfirmada` | `shared/events/outbox.ts`, `db/migrations/0002_outbox_events.up.sql` | Evento persistido en la misma transacción, sin worker de reintento en Fase 5 | Implementado parcialmente |
| Repository | Arquitectura | Acceso a datos aislado | `CitasRepository`, `EmpleadosRepository`, `ClientesRepository` | `citas/citas.repository.ts`, `empleados/empleados.repository.ts`, `clientes/clientes.repository.ts` | Tests de persistencia y concurrencia | Implementado |
| Facade | GoF (Fase 4) | Orquestación del checkout | `PosCheckoutFacade` | `ventas/pos/pos-checkout.facade.ts` | Tests de checkout | Implementado (preexistente) |
| Command | GoF (Fase 4) | Deshacer operaciones del POS | `pos/commands/*` | `ventas/pos/commands/*` | Tests de deshacer | Implementado (preexistente) |
| Chain of Responsibility | GoF (Fase 4) | Validaciones encadenables | `cadena-validacion.ts` | `ventas/domain/validation/cadena-validacion.ts` | Tests de validación | Implementado (preexistente) |
| Strategy | GoF (Fase 3) | Sustitución de algoritmos | `pricing/*`, `payments/*` | `ventas/domain/pricing/*`, `ventas/domain/payments/*` | Tests de sustitución | Implementado (preexistente) |
| Builder | GoF (Fase 4) | Construcción paso a paso | `factura.builder.ts` | `ventas/domain/factura.builder.ts` | Tests del Builder | Implementado (preexistente) |
| Adapter | GoF | APIs externas | `integrations/*` | — | — | Pendiente |
| Proxy | GoF | Permisos y caché | `permisos.proxy.ts`, `cache.proxy.ts` | — | — | Pendiente |
| Chain de Nómina | GoF | Liquidaciones encadenadas | `cadena-liquidacion.ts` | — | — | Pendiente |
| Caja / Contabilidad | Arquitectura | Asientos y cierres | `CajaService`, `ContabilidadService` | `ventas/caja/caja.service.ts`, `contabilidad/contabilidad.service.ts` | Apertura/cierre de caja, asientos de partida doble, reportes | Implementado (Fase 6) |
| Repository — Caja | Arquitectura | Acceso a datos aislado para caja | `CajaRepository` | `ventas/caja/caja.repository.ts` | Pruebas de apertura, cierre, duplicidad, 400/404/409 | Implementado (Fase 6) |
| Repository — Contabilidad | Arquitectura | Acceso a datos aislado para asientos y reportes | `ContabilidadRepository` | `contabilidad/contabilidad.repository.ts` | Pruebas de asientos, reporte por día/mes/año/medio de pago | Implementado (Fase 6) |
| Observer — Contabilidad | GoF / arquitectura | Reaccionar a PedidoPagado sin importar Ventas | `contabilidad.suscriptores.ts` | `contabilidad/contabilidad.suscriptores.ts` | Suscripción a PedidoPagado, asientos post-commit, idempotencia | Implementado (Fase 6) |
| Adapter — Facturación electrónica | GoF | Traducir modelo interno a formato externo ajeno | `AdapterFacturacionElectronicaMock` | `integrations/facturacion-electronica/adapter-mock.ts` | XML simulado, acuse de recibo, best-effort post-commit | Implementado (Fase 6) |

---

## 4. Flujo transaccional de `CitaConfirmada`

```text
POST /api/citas/:id/confirmar
→ CitasService valida transición mediante State
→ UnitOfWork abre transacción
→ UPDATE citas WHERE id AND estado esperado
→ INSERT outbox_events CitaConfirmada
→ COMMIT
→ InMemoryEventBus entrega CitaConfirmada
→ NotificacionesService consulta contacto actual
→ NotificacionFactory crea el sender
→ Sender escribe la salida simulada
```

## 5. Flujo de `PedidoPagado`

- `PedidoPagado` se persiste en Outbox y llega al suscriptor de Notificaciones.
- `PedidoPagado` se persiste en Outbox y llega al suscriptor de Contabilidad, que genera los asientos de partida doble (CAJA débito / INGRESOS_VENTAS crédito).
- El descuento de stock es **sincrónico dentro** del `PosCheckoutFacade`.
- El Adapter de facturación electrónica se invoca **después del commit** (best-effort); una falla no revierte la venta.

---

## 6. Evidencia de pruebas (Fase 5)

| Área | Archivo | Casos |
|---|---|---:|
| State — Cita | `apps/api/src/modules/citas/domain/cita-estado.test.ts` | 8 |
| API — Citas | `apps/api/src/modules/citas/citas.routes.test.ts` | 19 |
| Servicio — Citas | `apps/api/src/modules/citas/citas.service.test.ts` | 3 |
| Factory / Notificaciones | `apps/api/src/modules/notificaciones/*` | 13 |
| Clientes — PATCH | `apps/api/src/modules/clientes/clientes.routes.test.ts` | 11 |
| Migración Citas | `apps/api/src/shared/db/citas-migration.test.ts` | 1 |
| Web — Citas | `apps/web/src/pages/Citas.test.tsx` | 17 |
| Web — Clientes | `apps/web/src/pages/Clientes.test.tsx` | 5 |
| Formato web | `apps/web/src/lib/formato.test.ts` | 3 |
| Contratos web | `apps/web/src/types.test.ts` | 2 |
| Navegación web | `apps/web/src/App.test.tsx` | 20 |
| Unit of Work | `apps/api/src/shared/db/unit-of-work.test.ts` | 7 |
| Event Bus | `apps/api/src/shared/events/event-bus.test.ts` | 5 |
| API — Caja | `apps/api/src/modules/ventas/caja/caja.routes.test.ts` | 8 |
| Dominio — Contabilidad (partida doble) | `apps/api/src/modules/contabilidad/domain/asiento.test.ts` | 2 |
| API — Contabilidad (asientos, reportes) | `apps/api/src/modules/contabilidad/contabilidad.routes.test.ts` | 5 |
| Adapter — Facturación electrónica | `pos-checkout.facade.test.ts` (integración adapter) | 2 |
| Web — Contabilidad (dashboard) | `apps/web/src/pages/Contabilidad.test.tsx` | 3 |

Suite completa de la fase: 30 archivos / ~179 casos declarados (con los últimos ajustes web en verde).

---

## 7. Flujo transaccional de Caja (Fase 6)

```text
POST /api/caja/apertura
→ CajaService valida que no exista caja abierta para el usuario
→ CajaRepository INSERT en cajas (cierre NULL)
→ 201 Caja creada

POST /api/caja/:id/cierre
→ CajaService valida monto final >= 0
→ CajaRepository UPDATE cajas SET cierre = now(), monto_final = ?
  WHERE id = ? AND cierre IS NULL
→ Si ninguna fila afectada: 409 CAJA_NO_ABIERTA
→ 200 Caja cerrada

GET /api/caja/actual?usuarioId=X
→ CajaService lista cajas y filtra la abierta del usuario
→ 200 Caja / 404 si no hay abierta
```

## 8. Flujo transaccional de Contabilidad (Fase 6)

```text
POST /api/ventas/checkout
→ PosCheckoutFacade ejecuta UoW: pedido, pago, factura, stock
→ context.publish('PedidoPagado', { pedidoId, total, metodoPago, items, ... })
→ COMMIT
→ InMemoryEventBus entrega PedidoPagado
→ ContabilidadService.registrarVenta (dentro de UoW)
→ ContabilidadRepository.registrarAsientos (INSERT asientos CAJA + INGRESOS_VENTAS)
→ COMMIT asientos (idempotente: UNIQUE origen_id + cuenta)
```

Después del checkout, el Adapter de facturación electrónica se invoca fuera del UoW:

```text
POST /api/ventas/checkout (post-commit)
→ PosCheckoutFacade llama FacturacionElectronicaPort.emitir(datosFactura)
→ AdapterFacturacionElectronicaMock traduce a XML simulado
→ Respuesta externa (ACEPTADA / RECHAZADA) traducida al modelo interno
→ actualizarPayloadExterno en facturas.payload_externo
→ Una falla del adapter NO revierte la venta (best-effort)
```

## 9. Limitaciones conocidas

- Outbox sin worker de reintento posterior a reinicio.
- `procesado_en` no se actualiza en el flujo productivo.
- Notificaciones simuladas, no persistidas.
- Sin endpoint HTTP de Notificaciones.
- Simple Factory en sentido GoF estricto.
- Pruebas de base de datos sobre PGlite.
- Seed sin prueba automatizada.

---

## 10. Registro de cambios

- Snapshot creado con fecha y commit de cierre de Fase 5.
- Agregada trazabilidad de Fase 6: Caja en Ventas/POS (patrón Repository, rutas apertura/actual/cierre, migración 0007_cajas, pruebas de integración).
- Agregada trazabilidad de Fase 6: Contabilidad (dominio, partida doble, repositorio, servicio, rutas de reporte con agrupación día/mes/año/medio_pago, suscripción Observer a PedidoPagado, pruebas de integración y dominio).
- Agregada trazabilidad de Fase 6: Adapter de facturación electrónica (mock, integración en PosCheckoutFacade post-commit, pruebas).
- Agregada trazabilidad de Fase 6: Frontend dashboard de contabilidad (caja, reporte de ventas con agrupación, tabla de asientos, pruebas web).
- Documento marcado como **preliminar**; la versión final pertenece a Fase 9.

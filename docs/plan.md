# NEXO-ERP: Plan de desarrollo

Planeación técnica, fases, patrones de diseño y flujo de trabajo con agentes (opencode y freebuff).

---

## 1. Objetivo y alcance

**Objetivo:** construir una aplicación web ERP para gestión de servicios y operaciones comerciales, y demostrar de forma explícita la aplicación de patrones de diseño GoF en una exposición de clase.

**Módulos:** Ventas/POS, Citas, Inventario, Contabilidad (caja y reportes), Notificaciones, Nómina, GUI y acceso a datos.

**Alcance mínimo (MVP para la demo):** Inventario, Pedido/Factura, Checkout POS completo, Citas con estados y Notificaciones. Contabilidad, Nómina y facturación electrónica se hacen simulados o simplificados si falta tiempo.

**Fuera de alcance:**
- Facturación electrónica real ante la autoridad tributaria.
- Pasarelas de pago reales.
- Multiempresa.
- Despliegue en producción.

---

## 2. Stack y decisiones técnicas

| Capa | Tecnología | Motivo |
|---|---|---|
| Lenguaje | TypeScript estricto (sin `any`) | Tipos que ayudan a los agentes y a explicar interfaces |
| Backend | Node + Fastify | Ligero, fácil de entender en clase |
| Validación | Zod | Contratos de entrada claros |
| Acceso a datos | Kysely o Drizzle + SQL de migraciones | Control de transacciones (Unit of Work) |
| Base de datos | PostgreSQL en Docker (`docker-compose`) | Reproducible en cualquier equipo |
| Frontend | React + Vite + TypeScript | Rápido de iterar |
| Pruebas | Vitest | Cada patrón tendrá su prueba como evidencia |
| Monorepo | pnpm workspaces | `apps/api` y `apps/web` |

**Decisión clave:** backend propio en TypeScript (no PostgREST) para que la lógica y los patrones vivan en código visible.

**Principios:**
- Un patrón por archivo, con comentario `// Patrón: X` al inicio.
- No se aplica un patrón sin un problema concreto que lo justifique.
- El checkout corre en una única transacción de base de datos.
- Los módulos se comunican por eventos, no se importan entre sí.

---

## 3. Estructura del repositorio

```
nexo-erp/
├─ AGENTS.md
├─ docker-compose.yml
├─ docs/
│  ├─ plan.md   patrones.md
│  └─ ventas.md  citas.md  inventario.md  contabilidad.md  notificaciones.md  nomina.md
├─ db/migrations/
├─ apps/
│  ├─ web/            React (vistas y configuración)
│  └─ api/src/
│     ├─ main.ts
│     ├─ shared/
│     │  ├─ db/        pool.ts  unit-of-work.ts  outbox.ts
│     │  ├─ events/    event-bus.ts                         (Observer)
│     │  ├─ security/  permisos.proxy.ts  cache.proxy.ts    (Proxy)
│     │  └─ config/
│     ├─ integrations/
│     │  ├─ facturacion-electronica/   adapter              (Adapter)
│     │  └─ banco/                     adapter              (Adapter)
│     └─ modules/
│        ├─ ventas/
│        │  ├─ domain/       pedido.ts  factura.ts  factura.builder.ts   (Builder)
│        │  ├─ pricing/      descuento.strategy.ts  impuesto.strategy.ts (Strategy)
│        │  ├─ payments/     pago.strategy.ts                            (Strategy)
│        │  ├─ validation/   cadena-validacion.ts                        (Chain)
│        │  └─ pos/          commands/*  pos-checkout.facade.ts          (Command, Facade)
│        ├─ citas/domain/states/   pendiente.ts  confirmada.ts ...      (State)
│        ├─ notificaciones/        notificacion.factory.ts              (Factory Method)
│        ├─ inventario/
│        ├─ contabilidad/
│        └─ nomina/                cadena-liquidacion.ts                (Chain)
```

---

## 4. Mapa de patrones: dónde vive cada uno

| # | Patrón | Archivo | Problema que resuelve | Qué mostrar en la demo |
|---|---|---|---|---|
| 1 | Facade | `pos-checkout.facade.ts` | Cobrar toca stock, pago y factura | Un solo `checkout()` que orquesta todo |
| 2 | Command | `pos/commands/*` | Deshacer operaciones del POS | Agregar ítem y luego deshacer |
| 3 | Chain of Responsibility (ventas) | `cadena-validacion.ts` | Validaciones que se añaden o quitan | Stock, cliente y caja abierta como eslabones |
| 4 | Strategy | `pricing/*`, `payments/*` | Descuentos, impuestos y medios de pago | Cambiar estrategia sin tocar el checkout |
| 5 | Builder | `factura.builder.ts` | Factura con muchas partes opcionales | Construcción paso a paso |
| 6 | Observer | `event-bus.ts` | Desacoplar módulos | `OrdenPagada` descuenta stock y registra asiento |
| 7 | State | `citas/domain/states/*` | Transiciones válidas de una cita | Pasar de Cancelada a Completada y ver el rechazo |
| 8 | Factory Method | `notificacion.factory.ts` | Elegir canal de notificación | Mismo evento por email, SMS o WhatsApp |
| 9 | Adapter | `integrations/*` | APIs externas con formatos ajenos | Mock de facturación tras tu interfaz |
| 10 | Proxy | `permisos.proxy.ts`, `cache.proxy.ts` | Permisos y caché sin ensuciar el servicio | Cajero bloqueado al anular una venta |
| 11 | Chain of Responsibility (nómina) | `cadena-liquidacion.ts` | Conceptos de nómina apilables | Salario, extras, salud, pensión, neto |

**Mencionados, no obligatorios:**
- Composite (plan de cuentas)
- Template Method (reportes y cierre de caja)
- Decorator (auditoría)

**No GoF que apoyan la arquitectura:**
- Repository
- Unit of Work (transacción del checkout)
- Outbox (evento guardado en la misma transacción que el cambio)

---

## 5. Flujo de trabajo con agentes

### 5.1 Roles sugeridos

| Herramienta | Rol | Ejemplos de tarea |
|---|---|---|
| opencode | Constructor | Implementar un archivo o módulo contra su spec |
| freebuff | Revisor y pruebas | Revisar el código, escribir pruebas Vitest, detectar violaciones del patrón |
| Tú | Arquitecto y aprobador | Escribir specs, revisar diffs, hacer merge |

Los detalles de configuración de freebuff no se asumen aquí: se le pide que lea `AGENTS.md` al inicio de cada sesión, y con opencode se carga de forma automática.

### 5.2 Reglas

1. **`AGENTS.md` primero.** Incluye stack, estructura, tabla de patrones, convenciones y comando de pruebas.
2. **Una spec por módulo en `docs/`.** El agente implementa contra la spec, no contra el chat.
3. **Una tarea pequeña por prompt.** Evitar "haz el módulo de ventas".
4. **Una rama de git por tarea** (`feat/ventas-facade`). Dos agentes nunca editan la misma rama a la vez.
5. **Commit solo cuando pasan las pruebas** (`pnpm test` en verde y `pnpm tsc --noEmit` sin errores).
6. **Cada patrón lleva su prueba**, que sirve de evidencia para la clase.
7. **Revisión cruzada:** lo que construye uno lo revisa el otro antes del merge.

### 5.3 Plantilla de prompt

```
Lee AGENTS.md y docs/[modulo].md. Implementa [X] en [ruta]. Aplica el patrón [Y].
Agrega pruebas en Vitest. No toques otros módulos. Al final lista los archivos que
cambiaste y cómo ejecutar las pruebas.
```

### 5.4 Plantilla de prompt de revisión

```
Lee AGENTS.md. Revisa la rama [nombre] contra docs/[modulo].md. Verifica que el
patrón [Y] esté bien aplicado, que no haya any, que las pruebas cubran casos de
error y que no se importen módulos vecinos directamente. Devuelve una lista de
problemas ordenada por gravedad, sin modificar código.
```

### 5.5 Ciclo por tarea

1. Crear rama.
2. opencode implementa con el prompt de la plantilla.
3. Correr pruebas y typecheck.
4. freebuff revisa con el prompt de revisión.
5. Corregir hallazgos.
6. Commit y merge a `main`.
7. Marcar la tarea en el checklist de este documento.

---

## 6. Fases de desarrollo

### Fase 0: Fundaciones

**Entregables:** repo con pnpm workspaces, `docker-compose.yml` con PostgreSQL, sistema de migraciones, `AGENTS.md`, specs en `docs/`, Vitest y ESLint configurados.

**Criterio de aceptación:** `docker compose up` levanta la base, `pnpm test` corre (aunque sea con una prueba trivial) y `pnpm dev` arranca la API con un endpoint `/health`.

**Tareas para agentes:**
- opencode: crear el esqueleto del monorepo y el `docker-compose.yml`.
- opencode: escribir el sistema de migraciones y la migración inicial.
- Tú: redactar `AGENTS.md` y las specs.

### Fase 1: Infraestructura compartida

**Patrones:** Observer.

**Entregables:** `pool.ts`, `unit-of-work.ts`, `event-bus.ts`, `outbox.ts`, tabla `outbox_events`.

**Criterio de aceptación:** una prueba demuestra que un evento publicado dentro de una transacción solo se entrega si la transacción hace commit, y que varios suscriptores lo reciben.

**Nota:** la conexión se entrega por inyección de dependencias (parámetro o contenedor), no por Singleton clásico.

### Fase 2: Inventario y Pedido/Factura básicos

**Patrones:** State (pedido).

**Entregables:** CRUD de productos y stock, entidades Pedido y Factura, estados del pedido (Borrador, Emitido, Pagado, Anulado) con transiciones validadas.

**Criterio de aceptación:** pruebas de transiciones legales e ilegales; endpoints REST funcionando; el frontend lista productos y crea un pedido.

### Fase 3: Precios, impuestos y pagos

**Patrones:** Strategy.

**Entregables:**
- Interfaz `DescuentoStrategy` con al menos tres implementaciones (volumen, cliente frecuente, promoción por fecha).
- `ImpuestoStrategy` por región.
- `PagoStrategy` con Efectivo y una pasarela simulada.

**Criterio de aceptación:** el cálculo de un pedido cambia al sustituir la estrategia sin editar el servicio que la usa.

### Fase 4: Checkout POS completo (núcleo de la demo)

**Patrones:** Facade, Command, Chain of Responsibility, Builder.

**Entregables:**
- `cadena-validacion.ts` con eslabones: caja abierta, cliente válido, stock suficiente.
- `factura.builder.ts`.
- Comandos con `ejecutar()` y `deshacer()`: agregar ítem, quitar ítem, aplicar descuento, anular venta.
- `PosCheckoutFacade.checkout()` dentro de una única transacción: validar, calcular, cobrar, facturar, descontar stock, publicar `OrdenPagada` en el outbox.
- Pantalla POS en el frontend.

**Criterio de aceptación:** una venta exitosa de punta a punta; si falla cualquier paso, nada queda a medias en la base de datos (prueba de rollback); deshacer restituye el carrito.

### Fase 5: Citas y notificaciones

**Patrones:** State, Factory Method.

**Entregables:**
- Agenda y citas con estados Pendiente, Confirmada, En Proceso, Completada y Cancelada.
- `NotificacionFactory` que crea `EmailSender`, `SmsSender` o `WhatsAppSender` (simulados con log o archivo).
- Suscripción a `CitaConfirmada` y `OrdenPagada`.

**Criterio de aceptación:** una transición ilegal es rechazada con un error claro; cambiar la preferencia del cliente cambia el canal sin tocar el emisor del evento.

### Fase 6: Contabilidad e integración externa

**Patrones:** Observer (suscriptor), Adapter.

**Entregables:**
- Caja (apertura y cierre).
- Asientos generados al recibir `OrdenPagada`.
- Reporte de ventas.
- `FacturacionElectronicaPort` con un adapter hacia un mock que simula un formato ajeno (por ejemplo XML).

**Criterio de aceptación:** al pagar una orden se crea el asiento sin que Ventas importe Contabilidad; el adapter traduce el modelo interno al formato externo y viceversa.

**Opcional:** Template Method para reportes y cierre de caja; Composite para el plan de cuentas.

### Fase 7: Nómina

**Patrones:** Chain of Responsibility.

**Entregables:** cadena de conceptos (salario base, horas extras, auxilios, salud, pensión, retenciones) que produce una liquidación con neto a pagar.

**Criterio de aceptación:** añadir o quitar un concepto de la cadena no modifica los demás; prueba con un empleado de ejemplo y resultado verificable a mano.

### Fase 8: Seguridad, caché y pulido

**Patrones:** Proxy.

**Entregables:** autenticación básica, roles (admin, cajero, contador), `PermisosProxy` sobre servicios sensibles, `CacheProxy` sobre consultas frecuentes (por ejemplo catálogo), pulido del frontend, datos semilla para la demo.

**Criterio de aceptación:** un cajero que intenta anular una venta recibe 403; la segunda lectura del catálogo no consulta la base.

### Fase 9: Preparación de la exposición

**Entregables:** `docs/patrones.md` final, script de datos semilla, guion de demo ensayado, diapositivas con diagrama y fragmentos de código por patrón.

---

## 7. Modelo de datos inicial (resumen)

| Tabla | Campos clave |
|---|---|
| usuarios | id, nombre, rol, hash_password |
| clientes | id, nombre, documento, email, telefono, canal_preferido |
| productos | id, sku, nombre, precio, tipo (producto o servicio) |
| stock | producto_id, cantidad |
| pedidos | id, cliente_id, estado, subtotal, descuento, impuesto, total |
| pedido_items | pedido_id, producto_id, cantidad, precio_unitario |
| facturas | id, pedido_id, numero, estado, payload_externo |
| pagos | id, pedido_id, medio, monto, estado |
| citas | id, cliente_id, empleado_id, inicio, fin, estado |
| cajas | id, usuario_id, apertura, cierre, monto_inicial, monto_final |
| asientos | id, fecha, cuenta, debito, credito, origen_id |
| empleados | id, nombre, salario_base, datos de contrato |
| liquidaciones | id, empleado_id, periodo, detalle (jsonb), neto |
| outbox_events | id, tipo, payload (jsonb), creado_en, procesado_en |

Los tipos exactos y las relaciones se definen en la spec de cada módulo.

---

## 8. Guion de explicación en clase

Una sola venta recorre casi todos los patrones:

1. **Proxy:** valida que el cajero tenga permiso.
2. **Facade:** se llama `checkout()`.
3. **Chain of Responsibility:** valida caja, cliente y stock.
4. **Strategy:** calcula descuento, impuesto y medio de pago.
5. **Builder:** arma la factura.
6. **Adapter:** la envía a la facturación electrónica simulada.
7. **Observer:** se publica `OrdenPagada`; inventario descuenta stock, contabilidad registra el asiento y notificaciones envía el comprobante.
8. **Factory Method:** crea el canal de notificación elegido.

**Demostraciones aparte:** State (cita con transición ilegal), Command (deshacer en el POS) y Chain de nómina.

**Sugerencia de orden:** primero el diagrama de arquitectura, luego la demo de la venta, luego un archivo de código por patrón (máximo 30 líneas en pantalla), y cierre con las pruebas en verde.

---

## 9. Riesgos y mitigación

| Riesgo | Mitigación |
|---|---|
| Los agentes generan código inconsistente | `AGENTS.md` estricto, specs, revisión cruzada, tareas pequeñas |
| Sobreingeniería por forzar patrones | Cada patrón se introduce en su fase, con su problema concreto |
| Falta de tiempo | Recortar en este orden: Nómina, Contabilidad avanzada, Proxy de caché, Citas. **Nunca recortar Checkout** |
| Conflictos de git entre agentes | Una rama por tarea y un solo agente por rama |
| La demo falla en vivo | Datos semilla, `docker compose up` probado, video de respaldo |
| Pérdida de eventos | Outbox en la misma transacción |

---

## 10. Checklist de seguimiento

- [ ] Fase 0: Fundaciones
- [ ] Fase 1: Infraestructura compartida (Observer)
- [ ] Fase 2: Inventario y Pedido/Factura (State)
- [ ] Fase 3: Precios, impuestos y pagos (Strategy)
- [ ] Fase 4: Checkout POS (Facade, Command, Chain, Builder)
- [ ] Fase 5: Citas y notificaciones (State, Factory Method)
- [ ] Fase 6: Contabilidad e integración externa (Adapter)
- [ ] Fase 7: Nómina (Chain)
- [ ] Fase 8: Seguridad y caché (Proxy)
- [ ] Fase 9: Preparación de la exposición

---

## 11. Siguiente paso

Empezar la Fase 0: redactar `AGENTS.md` y las specs de `docs/`, y luego lanzar el primer prompt a opencode para crear el esqueleto del monorepo con Docker y PostgreSQL.

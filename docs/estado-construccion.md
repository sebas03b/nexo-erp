# Estado de construcción de Nexo-ERP

> **Documento vivo.** Registra el estado verificable del código, la ubicación y el funcionamiento de los patrones, los flujos ejecutados, la evidencia disponible y la deuda pendiente. No sustituye las especificaciones ni reemplaza `docs/patrones.md`; complementa ambos documentos.

## Corte del snapshot

| Aspecto | Valor |
|---|---|
| Fecha de corte | 2026-11-24 |
| Rama | `feat/fase8-seguridad-cache` |
| Commit base | `05cbde1e03609d131093aa8dd7caec6d5654452f` |
| Relación con `main` | `main` permanece en `59439c2`; la rama está 11 commits por delante, por lo que las fases 6, 7 y 8 todavía no están integradas en `main` |
| Objeto observado | Commit `05cbde1`, validado en un worktree aislado. El árbol del commit estaba limpio; los cambios abiertos de `docs/plan.md` y `docs/patrones.md` pertenecen al trabajo concurrente y no forman parte de este corte |
| GitNexus | **No reindexado en este corte.** El índice consultable sigue siendo el de `fa986b5` y no describe autenticación ni los Proxy de Fase 8 |
| Alcance | Backend Fastify, frontend React, persistencia Kysely/PostgreSQL, pruebas Vitest |

> **Corte reproducible.** El código y las pruebas se verificaron sobre `05cbde1` en un worktree aislado. La suite y el lint no están verdes: 21 pruebas fallan y ESLint registra 30 errores. El detalle está en [Verificación y evidencia](#13-verificación-y-evidencia). Este documento no presenta la Fase 8 como cerrada mientras persistan esos fallos y los Proxy sigan sin cablearse.

### Fuentes y jerarquía de verdad

1. **Código y pruebas del commit base `05cbde1`**: describen lo que realmente se ejecuta en este corte.
2. **Especificaciones vigentes** en `docs/`: describen el comportamiento requerido.
3. **`docs/plan.md`**: contiene fases y prioridades, pero su checklist no siempre coincide con el código.
4. **`docs/patrones.md`**: es un snapshot de trazabilidad de las fases 5 y 6; puede contener afirmaciones históricas superadas. No se modifica desde este informe.

Cuando una especificación y el código difieren, este documento los muestra como dos estados separados en lugar de declarar “terminado” por intuición.

### Leyenda

| Estado | Significado |
|---|---|
| `Implementado` | Existe código productivo y evidencia de prueba. |
| `Implementado parcialmente` | Hay implementación, pero falta una integración, criterio o caso de aceptación importante. |
| `Pendiente` | No existe una implementación real. |
| `No GoF` | Patrón arquitectónico de apoyo, no variante del catálogo GoF. |

---

## 1. Resumen ejecutivo

Nexo-ERP es un monorepo pnpm con una API Node.js/Fastify, un frontend React/Vite y PostgreSQL como persistencia. La API usa TypeScript estricto, Zod para contratos de entrada, Kysely para SQL tipado y Vitest para pruebas.

El núcleo de la aplicación ya recorre estos elementos en una venta:

```text
Cadena de validación
→ Strategy de precio/impuesto
→ State del pedido
→ Strategy de pago
→ Unit of Work + Outbox
→ Builder de factura
→ Observer post-commit
→ Adapter de facturación electrónica
```

El resultado consolidado es:

- Inventario, stock, clientes, empleados, citas, POS, facturas, caja, contabilidad, Nómina y sus interfaces web tienen implementación real.
- El checkout POS ejecuta pedido, pago, factura y descuento de stock dentro de una sola transacción.
- `PedidoPagado` desacopla Notificaciones y Contabilidad de Ventas.
- La cadena de Nómina está implementada y probada como unidad, pero **no está conectada en `app.ts`**; la API productiva calcula una liquidación con cero conceptos.
- La página web `/nomina` existe, pero dispara cálculo y listado en paralelo; la respuesta del listado puede sobrescribir el resultado calculado y su prueba falla de forma reproducible.
- La autenticación JWT, el login web, los roles y la protección de Caja/Contabilidad existen desde la Fase 8, pero solo cubren esas dos superficies.
- `PermisosProxy` y `CacheProxy` existen con pruebas unitarias, pero están aislados: no se aplican desde `app.ts` ni desde las rutas.
- La interfaz de Contabilidad existe, pero el cierre de caja web no puede obtener el ID de la caja abierta en el flujo actual.
- El desglose de productos/servicios de Contabilidad devuelve una lista vacía porque el checkout no envía `items` en `PedidoPagado`.
- La protección de rutas web deja en login 20 pruebas previas de `App.test.tsx`; la Fase 8 añadió regresiones de integración y lint.

### Estado por fases

| Fase | Estado técnico real | Observación |
|---|---|---|
| 0. Fundaciones | `Implementado` | Monorepo, Fastify, PostgreSQL/Docker, migraciones SQL, Vitest, ESLint y health check existen, aunque `docs/plan.md` aún no marca las fases 0–4. |
| 1. Infraestructura compartida | `Implementado` | Event Bus, Outbox, Unit of Work y repositorios compartidos. |
| 2. Inventario, pedido y factura | `Implementado` | CRUD de productos/stock, pedidos, items, facturas y State del pedido. |
| 3. Precios, impuestos y pagos | `Implementado` | Strategies de descuento, impuesto y pago; varias variantes comprobables. |
| 4. Checkout POS | `Implementado parcialmente` | Checkout transaccional y deshacer funcionan; faltan validación de caja abierta, protección concurrente del stock, tratamiento de servicios y auditoría/persistencia correcta del Adapter. |
| 5. Citas y Notificaciones | `Implementado` | State de cita, agenda, concurrencia y notificaciones simuladas por canal. |
| 6. Contabilidad e integración | `Implementado parcialmente` | Asientos, idempotencia, reportes y Adapter existen; falta el desglose real de productos, los filtros web de fecha no son compatibles y hay defectos de cierre de caja y persistencia externa. |
| 7. Nómina | `Implementado parcialmente` | Dominio, cadena, repositorio, servicio, rutas, migración, tipos, hook, página web y pruebas existen; falta conectar la cadena en el composition root, persistir detalle, exponer el catálogo y corregir la carrera del frontend. |
| 8. Seguridad y caché | `Implementado parcialmente` | Hay login JWT, sesiones, seed de usuarios, guard de rutas web y protección de Caja/Contabilidad. Los Proxy de permisos y caché existen y tienen pruebas, pero no están cableados; el bypass `x-user-id`, el secreto fijo y las regresiones web impiden cerrar la fase. |
| 9. Exposición | `Implementado parcialmente` | Seed y evidencia viva existen; faltan demoEnsayada, validación contra PostgreSQL Docker y material final de exposición. |

---

## 2. Arquitectura real

### 2.1 Componentes

```text
┌─────────────────────────────────────────────────────────────────┐
│ apps/web — React + Vite                                        │
│ Ventas | Productos | Clientes | Citas | Contabilidad           │
└──────────────────────────────┬──────────────────────────────────┘
                               │ fetch /api/*
┌──────────────────────────────▼──────────────────────────────────┐
│ apps/api — Fastify                                              │
│ routes + services + dominio + repositories por módulo           │
├─────────────────────────────────────────────────────────────────┤
│ shared/db — UnitOfWork, Outbox, Kysely, migraciones             │
│ shared/events — EventBus y contratos AppEventMap               │
├─────────────────────────────────────────────────────────────────┤
│ integrations/facturacion-electronica — port + Adapter mock     │
└──────────────────────────────┬──────────────────────────────────┘
                               │ Kysely / pg
┌──────────────────────────────▼──────────────────────────────────┐
│ PostgreSQL 17 — 18 tablas de dominio e infraestructura          │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Composition root

`apps/api/src/app.ts` es el composition root. Construye y conecta:

- repositorios y servicios;
- `InMemoryEventBus<AppEventMap>`;
- `UnitOfWork<AppEventMap>` con `Outbox`;
- `CadenaValidacion` con cliente y stock;
- una instancia de `CadenaLiquidacion`, todavía sin eslabones;
- Strategies predeterminadas de descuento, impuesto y pago;
- `PosCheckoutFacade` con `AdapterFacturacionElectronicaMock`;
- suscripciones de Notificaciones y Contabilidad;
- `AuthRepository`, `AuthService` y las rutas de autenticación;
- dos hooks inline que protegen Caja y Contabilidad mediante JWT o `x-user-id`;
- rutas de Inventario, Clientes, Empleados, Citas, Carrito, Caja, Contabilidad, Nómina y Ventas.

`PermisosProxy` y `CacheProxy` no se instancian en este composition root. `shared/auth/middleware.ts` tampoco se registra; su lógica está duplicada en los hooks de Caja y Contabilidad.

La verificación de la regla de aislamiento de módulos no encontró imports de producción entre dominios de `apps/api/src/modules/`, ni imports desde `integrations/` hacia `modules/`. La única coincidencia de cruce es la prueba de integración `modules/fase2.routes.test.ts`, que importa clases del dominio de Ventas para construir la aplicación. Los módulos productivos dependen de contratos compartidos, no de repositorios de otros módulos.

### 2.3 Contrato de errores HTTP

El manejador global de `app.ts` normaliza tres casos:

| Origen | HTTP | Cuerpo |
|---|---:|---|
| `DomainError` | `statusCode` de la excepción | `{ error: { code, message, details? } }` |
| `ZodError` | 400 | `{ error: { code: 'DATOS_INVALIDOS', ... } }` |
| Error no clasificado | 500 | `{ error: { code: 'ERROR_INTERNO', message: 'Error interno del servidor' } }` |

Los errores 500 se registran en el log de Fastify; los errores de negocio no se exponen como error interno.

---

## 3. Módulos implementados

| Módulo | Responsabilidad real | API | Frontend | Persistencia |
|---|---|---|---|---|
| Inventario | Productos, stock y precios | Sí | `/productos` | `productos`, `stock` |
| Clientes | Alta, consulta, edición parcial y canal preferido | Sí | `/clientes` | `clientes` |
| Empleados | Catálogo mínimo para agenda y Nómina | `GET /api/empleados` | No | `empleados` |
| Citas | Agenda, validaciones, concurrencia y transiciones | Sí | `/citas` | `citas` |
| Notificaciones | Suscripción a eventos y salida simulada por canal | No | No | No persiste entregas |
| Ventas/POS | Pedidos, factura, carrito, comandos, checkout y stock | Sí | `/ventas`, `/ventas/nueva` | `pedidos`, `pedido_items`, `facturas`, carritos |
| Caja | Apertura, caja actual y cierre | Sí | Integrada en `/contabilidad` | `cajas` |
| Contabilidad | Asientos por evento, idempotencia y reportes | Sí | `/contabilidad` | `asientos` |
| Nómina | Conceptos, liquidación, listado y consulta | Sí, parcial | `/nomina`, parcial | `conceptos_nomina`, `liquidaciones` |
| Integración electrónica | Traducción interna/XML y respuesta simulada | Indirecta | No | `facturas.payload_externo` |
| Seguridad | Login JWT, registro, sesiones y roles | Parcial: login/registro; Caja y Contabilidad protegidas | `/login`, guard de rutas | `usuarios`, `sesiones` |

### 3.1 Inventario

- `apps/api/src/modules/inventario/inventario.routes.ts` expone CRUD de productos y consulta/fijación/eliminación de stock.
- `InventarioService` coordina reglas y `InventarioRepository` encapsula Kysely.
- La web consume el catálogo y permite administrar productos y existencias.

### 3.2 Clientes y Empleados

- Clientes admite email, teléfono y `canalPreferido` (`email`, `sms` o `whatsapp`).
- `ClientesRepository`/`ClientesService` aíslan el acceso a datos y las reglas.
- Empleados es intencionalmente pequeño: expone catálogo y permite que Citas/Nómina lo consulten sin imports entre módulos de negocio.

### 3.3 Citas

- El agregado `Cita` delega las transiciones a `CitaEstado` y a las clases de `citas/domain/states/`.
- `CitasService` valida cliente/empleado bloqueados, solapamientos, disponibilidad y persistencia optimista.
- Las transiciones disponibles son `confirmar`, `iniciar`, `completar` y `cancelar`.

### 3.4 Ventas/POS

- El carrito persiste ítems y un historial de comandos.
- `CarritoService` actúa como Invoker; cada comando sabe ejecutar y deshacer.
- `PosCheckoutFacade` es la puerta de entrada simplificada para la venta completa.
- `VentasService` conserva además operaciones de pedido/factura independientes del checkout.

### 3.5 Caja

- Caja pertenece al módulo Ventas/POS, como decide `docs/contabilidad.md`.
- Una caja abierta se identifica por `usuario_id`; el índice parcial impide dos cajas abiertas para el mismo usuario.
- El cierre exige monto final no negativo y una fila todavía abierta.

### 3.6 Contabilidad

- `PedidoPagado` activa un asiento de partida doble: débito `CAJA` y crédito `INGRESOS_VENTAS`.
- `UNIQUE (origen_id, cuenta)` más `ON CONFLICT DO NOTHING` hace idempotente la reacción al evento.
- El reporte agrupa por día, mes, año o medio de pago.
- `productosServicios` todavía es un placeholder vacío.

### 3.7 Nómina

- Existen cinco eslabones: salario base, horas extras, auxilio de transporte, salud y pensión.
- El catálogo `conceptos_nomina` y la tabla `liquidaciones` están migrados y tipados; la API expone cálculo, listado y consulta por ID.
- `NominaService` calcula totales, verifica empleado y periodo, e inserta la liquidación.
- La cadena usada por el servicio es una instancia vacía en el composition root actual; véase [Cadena de Responsabilidad de Nómina](#715-chain-of-responsibility-de-nómina).
- La web incluye tipos, `useNomina`, página `/nomina`, ruta y enlace de navegación. La página no consume el hook, no carga el catálogo y coordina mal el cálculo con el listado.

---

## 4. API REST actual

Las rutas se registran desde `app.ts`; los contratos de entrada se validan con Zod. El código expone 49 endpoints REST contando `GET /health` y las dos rutas de autenticación. Solo Caja y Contabilidad exigen autenticación en la API; las demás rutas siguen abiertas.

| Módulo | Método y ruta | Uso |
|---|---|---|
| Salud | `GET /health` | Estado del servicio. |
| Seguridad | `POST /api/auth/login` | Autenticar y devolver token JWT. |
| Seguridad | `POST /api/auth/registro` | Crear usuario con rol `admin`, `cajero` o `contador`. |
| Inventario | `GET /api/productos` | Listar productos. |
| Inventario | `GET /api/productos/:id` | Consultar producto. |
| Inventario | `POST /api/productos` | Crear producto. |
| Inventario | `PATCH /api/productos/:id` | Actualizar producto. |
| Inventario | `PUT /api/productos/:id` | Actualizar producto y stock. |
| Inventario | `DELETE /api/productos/:id` | Eliminar producto. |
| Inventario | `GET /api/stock` | Listar stock. |
| Inventario | `GET /api/stock/:productoId` | Consultar stock. |
| Inventario | `PUT /api/stock/:productoId` | Fijar cantidad. |
| Inventario | `DELETE /api/stock/:productoId` | Eliminar registro de stock. |
| Clientes | `GET /api/clientes` | Listar clientes. |
| Clientes | `POST /api/clientes` | Crear cliente. |
| Clientes | `PATCH /api/clientes/:id` | Editar contacto/canal. |
| Clientes | `DELETE /api/clientes/:id` | Eliminar cliente. |
| Empleados | `GET /api/empleados` | Listar empleados. |
| Citas | `GET /api/citas` | Listar con filtros `desde`, `hasta`, `estado`. |
| Citas | `GET /api/citas/:id` | Consultar cita. |
| Citas | `POST /api/citas` | Crear cita. |
| Citas | `POST /api/citas/:id/confirmar` | Transición a Confirmada. |
| Citas | `POST /api/citas/:id/iniciar` | Transición a En Proceso. |
| Citas | `POST /api/citas/:id/completar` | Transición a Completada. |
| Citas | `POST /api/citas/:id/cancelar` | Transición a Cancelada. |
| Carrito | `POST /api/carritos` | Crear carrito. |
| Carrito | `GET /api/carritos/:id` | Consultar carrito y totales. |
| Carrito | `POST /api/carritos/:id/comandos` | Ejecutar `AGREGAR_ITEM`, `DECREMENTAR_ITEM`, `QUITAR_ITEM` o `ESTABLECER_CANTIDAD`. |
| Carrito | `POST /api/carritos/:id/deshacer` | Deshacer el último comando no deshecho. |
| Carrito | `DELETE /api/carritos/:id` | Descartar carrito. |
| Ventas | `GET /api/pedidos` | Listar pedidos. |
| Ventas | `GET /api/pedidos/:id` | Consultar detalle de pedido. |
| Ventas | `POST /api/pedidos` | Crear pedido desde carrito. |
| Ventas | `DELETE /api/pedidos/:id` | Eliminar pedido. |
| Ventas | `POST /api/pedidos/:id/emitir` | Transición a Emitido. |
| Ventas | `POST /api/pedidos/:id/pagar` | Transición a Pagado. |
| Ventas | `POST /api/pedidos/:id/anular` | Transición a Anulado. |
| Ventas | `POST /api/pedidos/:id/factura` | Emitir factura aislada. |
| Ventas | `POST /api/ventas/checkout` | Ejecutar checkout transaccional completo. |
| Ventas | `GET /api/facturas` | Listar facturas. |
| Ventas | `GET /api/facturas/:id` | Consultar factura. |
| Caja | `POST /api/caja/apertura` | Abrir caja. |
| Caja | `GET /api/caja/actual` | Consultar caja abierta por `usuarioId`. |
| Caja | `POST /api/caja/:id/cierre` | Cerrar caja. |
| Contabilidad | `GET /api/contabilidad/asientos` | Listar asientos, con `desde`/`hasta`. |
| Contabilidad | `GET /api/contabilidad/reporte-ventas` | Reporte agrupado por `dia`, `mes`, `anio` o `medio_pago`. |
| Nómina | `POST /api/nomina/calcular` | Calcular y persistir liquidación. |
| Nómina | `GET /api/nomina/liquidaciones` | Listar por `empleadoId`/`periodo`. |
| Nómina | `GET /api/nomina/liquidaciones/:id` | Consultar liquidación. |

La especificación de Nómina contempla `GET /api/nomina/conceptos`, pero esa ruta todavía no existe. `NominaRepository.obtenerConceptosActivos()` tampoco tiene consumidor; el hook web `useNomina` solicita esa ruta, aunque la página `/nomina` no lo utiliza.

---

## 5. Frontend actual

| Ruta web | Vista | Estado |
|---|---|---|
| `/login` | `Login` | Implementada; guarda token y usuario en `localStorage`. |
| `/ventas` | `ListadoVentas` | Implementada; protegida por `RequireAuth`. |
| `/ventas/nueva` | `NuevaVenta` | Implementada; usa carrito, comandos, stock y checkout. |
| `/productos` | `Productos` | Implementada. |
| `/clientes` | `Clientes` | Implementada, incluida edición de canal. |
| `/citas` | `Citas` | Implementada. |
| `/contabilidad` | `Contabilidad` | Implementada parcialmente; el cierre web no recibe el ID de caja. |
| `/nomina` | `Nomina` | Implementada parcialmente; calcula y lista, pero el listado concurrente puede sobrescribir el resultado calculado y su prueba falla. |

La web consume rutas relativas `/api/*`; Vite las redirige a `http://localhost:3000` durante desarrollo. `apps/web/src/lib/api.ts` convierte las respuestas de error de la API en `ApiError` con código y mensaje. Toda la aplicación salvo `/login` está bajo `RequireAuth`, pero el rol solo filtra enlaces del sidebar (`Contabilidad` para contador, `Nómina` para admin); no existe un guard de autorización por ruta. Ninguna página envía el token JWT en sus llamadas `fetch`, por lo que Caja y Contabilidad seguirían dependiendo de `x-user-id` o de un cliente que añada la cabecera.

### Defecto visible en el cierre de caja web

`apps/web/src/pages/Contabilidad.tsx` renderiza el ID de la caja en un `<input type="hidden">`. El estado `cajaIdParaCierre` solo se actualiza mediante `onChange`, evento que un input oculto no produce al cambiar su valor mediante React. Como el estado inicia vacío, `manejarCerrarCaja` retorna antes de llamar la API.

### Defecto visible en el cálculo web de Nómina

`apps/web/src/pages/Nomina.tsx` implementa por separado `calcularLiquidacion` y `listarLiquidaciones`. `manejarCalcular` inicia ambas operaciones sin esperarlas y ambas escriben sobre `liquidaciones`; por tanto, la respuesta de `GET /api/nomina/liquidaciones` puede reemplazar el resultado recién calculado por `POST /api/nomina/calcular`. `Nomina.test.tsx` reproduce esta condición: el mock del POST devuelve `$ 1.542.000,00`, el mock del GET devuelve `[]` y la tabla termina vacía. El fallo aparece tanto en la suite completa como en una ejecución aislada del archivo. La página tampoco consulta `/api/empleados`, por lo que exige escribir manualmente un UUID.

### Incompatibilidad de los filtros de fecha de Contabilidad

Los `<input type="date">` de `Contabilidad.tsx` producen valores `YYYY-MM-DD`. `useContabilidad` los envía sin transformarlos a `GET /api/contabilidad/reporte-ventas`, cuyo esquema Zod exige `z.string().datetime()`. El reporte con fechas seleccionadas devuelve 400; la ruta de asientos no aplica esa validación.

---

## 6. Base de datos

### 6.1 Migraciones

| Migración | Contenido |
|---|---|
| `0001_initial_schema` | `usuarios`, `clientes`. |
| `0002_outbox_events` | Outbox transaccional e índice de pendientes. |
| `0003_inventario_pedidos` | `productos`, `stock`, `pedidos`, `pedido_items`, `facturas`. |
| `0004_pedidos_created_at` | `pedidos.created_at` como `timestamptz` e índice descendente. |
| `0005_carritos` | `carritos`, `carrito_items`, `carrito_comandos` e historial. |
| `0006_citas` | `empleados`, `citas` e índices de agenda. |
| `0007_cajas` | `cajas` y caja abierta única por usuario. |
| `0008_contabilidad` | `asientos`, idempotencia por origen/cuenta e índice por fecha. |
| `0009_nomina` | `empleados.salario_base`, `conceptos_nomina`, `liquidaciones` e índices. |
| `0010_seguridad_auth` | Convierte `cajas.usuario_id` a `uuid` con FK a `usuarios`; crea `sesiones` e índices por usuario y token. |

Las migraciones se ejecutan con Kysely y un provider propio que lee pares `.up.sql`/`.down.sql` desde `db/migrations/`. El provider falla si una migración `up` no tiene su correspondiente `down`.

### 6.2 Tablas

El esquema tipado de `apps/api/src/shared/db/schema.ts` registra 18 tablas:

```text
usuarios
sesiones
clientes
outbox_events
productos
stock
pedidos
pedido_items
facturas
carritos
carrito_items
carrito_comandos
cajas
asientos
empleados
citas
conceptos_nomina
liquidaciones
```

### 6.3 Restricciones importantes

- `cajas`: índice único parcial permite una sola caja abierta por `usuario_id`.
- `asientos`: `UNIQUE (origen_id, cuenta)` evita duplicados por reentrega del evento.
- `liquidaciones`: `UNIQUE (empleado_id, periodo)` evita dos liquidaciones del mismo periodo.
- `carrito_comandos`: conserva payload, estado anterior, ítem removido y marca `deshecho`.
- No existe tabla `pagos`; el resultado de la Strategy solo se mantiene en memoria y se replica parcialmente en el evento.
- Los módulos de negocio no comparten foreign keys de dominio; por ejemplo, `asientos.origen_id` no referencia `pedidos`.

### 6.4 Seed de demostración

`apps/api/src/db/seed.ts` limpia las tablas operativas e inserta 3 usuarios (`admin`, `cajero1`, `contador1`), 3 clientes, 3 empleados, 5 conceptos de Nómina, 8 productos, 4 registros de stock y 2 citas. Solo los cuatro productos físicos reciben existencias; los cuatro servicios quedan sin fila de stock. No existe una prueba automatizada que certifique limpieza, repetibilidad, conteos e integridad referencial del seed.

---

## 7. Mapa de patrones: ubicación, participantes y evidencia

### 7.1 Matriz general

| Patrón | Clasificación | Ubicación principal | Participantes | Evidencia principal | Estado |
|---|---|---|---|---|---|
| Facade | GoF | `modules/ventas/pos/pos-checkout.facade.ts` | `PosCheckoutFacade`, collaborators de checkout | `pos-checkout.facade.test.ts` | `Implementado parcialmente` |
| Command | GoF | `modules/ventas/pos/commands/` | `Comando`, `Carrito`, cuatro comandos concretos, `CarritoService` | Pruebas de cada comando y `carrito.routes.test.ts` | `Implementado` |
| Chain of Responsibility — Ventas | GoF | `modules/ventas/domain/validation/cadena-validacion.ts` | `CadenaValidacion`, `ValidarClienteValido`, `ValidarStockSuficiente` | `cadena-validacion.test.ts` | `Implementado` |
| Strategy | GoF | `modules/ventas/domain/pricing/` y `domain/payments/` | Interfaces de descuento/impuesto/pago y seis implementaciones | `estrategias.test.ts`, `pago.test.ts` | `Implementado` |
| Builder | GoF | `modules/ventas/domain/factura.builder.ts` | `FacturaBuilder`, `Factura` | `factura.builder.test.ts` y checkout | `Implementado` |
| Observer | GoF / arquitectura | `shared/events/event-bus.ts` y suscriptores de módulo | `InMemoryEventBus`, `EventSubscriber`, Notificaciones, Contabilidad | `event-bus.test.ts`, `notificaciones.suscriptores.test.ts` | `Implementado` |
| State | GoF | `modules/citas/domain/states/` y `modules/ventas/domain/states/` | Context `Cita`/`Pedido`, estado abstracto y estados concretos | `cita-estado.test.ts`, `pedido-estado.test.ts`, pruebas API | `Implementado` |
| Factory Method | GoF adoptado por el proyecto | `modules/notificaciones/notificacion.factory.ts` | `NotificacionFactory`, `Notificador`, tres senders | `notificacion.factory.test.ts`, `notificaciones.service.test.ts` | `Implementado` |
| Adapter | GoF | `integrations/facturacion-electronica/` | `FacturacionElectronicaPort`, `AdapterFacturacionElectronicaMock`, Facade | Integración en `pos-checkout.facade.test.ts`; falta prueba directa | `Implementado parcialmente` |
| Proxy | GoF | `modules/auth/permisos.proxy.ts` y `modules/inventario/cache.proxy.ts` | `crearPermisosProxy`, tabla de permisos por rol, `DomainError 403`; `crearCacheProxy`, `Map` con TTL | `permisos.proxy.test.ts`, `cache.proxy.test.ts`; sin prueba de integración con rutas | `Implementado parcialmente` |
| Repository | `No GoF` | `*/repository.ts` | Repositorios de Inventario, Clientes, Empleados, Citas, Ventas, Carrito, Caja, Contabilidad y Nómina | Pruebas de API/integración y repositorios compartidos | `Implementado parcialmente` |
| Unit of Work | `No GoF` | `shared/db/unit-of-work.ts` | `UnitOfWork`, `UnitOfWorkContext`, Outbox, EventPublisher | `unit-of-work.test.ts` | `Implementado` |
| Outbox | `No GoF` | `shared/events/outbox.ts` | `Outbox`, tabla `outbox_events` | Pruebas del Unit of Work; falta worker productivo | `Implementado parcialmente` |
| Chain of Responsibility — Nómina | GoF | `modules/nomina/cadena-liquidacion.ts` y `modules/nomina/cadena/` | `CadenaLiquidacion`, cinco eslabones, `NominaService` | Pruebas de cadena y eslabones; la prueba API no demuestra la composición productiva | `Implementado parcialmente` |

### 7.2 Facade — checkout POS

**Ubicación:** `apps/api/src/modules/ventas/pos/pos-checkout.facade.ts`.

**Problema:** el cliente no debe conocer la coordinación de carrito, validación, strategies, pedido, pago, factura, stock, eventos y Adapter.

**Participantes:** `PosCheckoutFacade`, `CadenaValidacion`, `EstrategiasVentas`, `VerificadorClientes`, `VentasRepository`, `CarritoRepository`, `UnitOfWork`, verificador de stock y `FacturacionElectronicaPort`.

**Funcionamiento:**

```text
POST /api/ventas/checkout
→ carga y valida carrito
→ ejecuta cadena cliente → stock
→ abre UnitOfWork
→ relee carrito y precios dentro de la transacción
→ crea Pedido y aplica State Borrador → Emitido → Pagado
→ cobra con Strategy de pago
→ publica PedidoPagado en Outbox
→ construye factura con FacturaBuilder
→ descuenta stock y cierra carrito
→ COMMIT
→ entrega PedidoPagado a Observer
→ llama Adapter fuera de la transacción
→ intenta guardar el XML externo; el destino `jsonb` no admite XML crudo
```

**Evidencia:** `apps/api/src/modules/ventas/pos/pos-checkout.facade.test.ts` comprueba pedido pagado, factura emitida, pago, stock descontado y evento `PedidoPagado`. La prueba usa repositorios y Unit of Work simulados; no demuestra rollback real en PostgreSQL, persistencia del pago ni persistencia del payload externo.

El resultado de la Strategy de pago se usa para publicar `PedidoPagado`, pero no se persiste en una tabla de pagos: no existe `pagos` en el esquema y el checkout no conserva de forma independiente monto, método y referencia de la operación.

**Límites:** el test usa un repositorio simulado que no implementa `actualizarPayloadExterno`; el error queda absorbido por el `try/catch` best-effort. Por tanto, la prueba actual no demuestra la persistencia real de `payload_externo`.

El flujo legacy `POST /api/pedidos` → `emitir` → `pagar` → `factura` tampoco descuenta stock y ejecuta emisión, pago y factura en operaciones separadas. Solo el checkout de la Facade aplica el descuento de inventario; ambos caminos no son equivalentes.

### 7.3 Command — manipulation y deshacer del carrito

**Ubicaciones:**

- `apps/api/src/modules/ventas/pos/commands/comando.ts`
- `apps/api/src/modules/ventas/pos/commands/carrito.ts`
- `apps/api/src/modules/ventas/pos/commands/agregar-item.command.ts`
- `apps/api/src/modules/ventas/pos/commands/decrementar-item.command.ts`
- `apps/api/src/modules/ventas/pos/commands/quitar-item.command.ts`
- `apps/api/src/modules/ventas/pos/commands/establecer-cantidad.command.ts`
- `apps/api/src/modules/ventas/pos/carrito.service.ts`

**Participantes:** `Comando` es el Receiver abstracto; `Carrito` es el Receiver concreto; los cuatro comandos encapsulan una operación; `CarritoService` es el Invoker; `CarritoRepository` conserva el historial.

**Funcionamiento:** cada comando ejecuta una mutación y conserva el estado anterior necesario para `deshacer()`. `CarritoService` persiste los ítems y el comando en una misma transacción. Para deshacer, rehidrata el último comando no deshecho, lo revierte y lo marca.

**Evidencia:** pruebas específicas de los cuatro comandos y `carrito.routes.test.ts` para API, rollback y deshacer.

### 7.4 Chain of Responsibility — validaciones de Ventas

**Ubicación:** `apps/api/src/modules/ventas/domain/validation/cadena-validacion.ts`.

**Participantes:** `CadenaValidacion`, `EslabonValidacionBase`, `ValidarClienteValido` y `ValidarStockSuficiente`.

**Funcionamiento:** `CadenaValidacion.agregar()` enlaza cabeza y cola. Cada eslabón valida su regla y, si pasa, delega en `siguiente`. El primer error interrumpe la cadena.

**Composición real:** `app.ts` agrega cliente y stock en ese orden.

**Evidencia:** `cadena-validacion.test.ts`.

**Diferencia con la especificación:** no existe el eslabón “caja abierta” previsto por el plan. El checkout puede completarse sin comprobar que el cajero tenga una caja abierta.

La validación de stock tampoco distingue `producto` de `servicio`: exige una fila con cantidad suficiente para cada ítem. El seed crea existencias solo para sus cuatro productos físicos, de modo que los cuatro servicios quedan con `STOCK_INSUFICIENTE` en el checkout.

### 7.5 Strategy — precio, impuesto y pago

**Ubicaciones:** `modules/ventas/domain/pricing/` y `modules/ventas/domain/payments/`.

**Participantes:**

| Familia | Implementaciones disponibles | Configuración inicial de `app.ts` |
|---|---|---|
| Descuento | Volumen, cliente frecuente, promoción | Volumen |
| Impuesto | Exento, IVA, fijo | Exento |
| Pago | Efectivo, pasarela simulada | Ambas disponibles |

**Funcionamiento:** `Pedido.calcularTotales()` recibe las interfaces `DescuentoStrategy` e `ImpuestoStrategy`; el Facade selecciona `PagoStrategy` por `metodoPago`. `BuildAppOptions.estrategiasVentas` permite sustituir las implementaciones sin cambiar el checkout.

**Evidencia:** `estrategias.test.ts` y `pago.test.ts`; `fase2.routes.test.ts` prueba sustitución de estrategias en la API.

### 7.6 Builder — factura

**Ubicación:** `apps/api/src/modules/ventas/domain/factura.builder.ts`.

**Participantes:** `FacturaBuilder` acumula `id`, `pedidoId`, `numero`, `estado` y `payloadExterno`; `construir()` valida obligatorios y crea `Factura`.

**Funcionamiento:** el checkout encadena `conId`, `conPedidoId`, `conNumero`, `conEstado` y `construir()`.

**Evidencia:** `factura.builder.test.ts`.

**Alcance:** la ruta legacy `POST /api/pedidos/:id/factura` usa `Factura.emitirPara()` y no el Builder; el Builder está aplicado al checkout.

### 7.7 Observer — bus y suscriptores

**Ubicación principal:** `apps/api/src/shared/events/event-bus.ts`.

**Participantes:** `InMemoryEventBus`, `EventSubscriber`, `EventPublisher`, `UnitOfWork` y los suscriptores de Notificaciones/Contabilidad.

**Funcionamiento:** el bus mantiene un `Map<string, Set<handler>>`. Al publicar toma un snapshot y entrega con `Promise.allSettled`, por lo que un suscriptor fallido no impide entregar a los demás ni revierte un commit confirmado.

**Suscriptores reales:**

- Notificaciones: `CitaConfirmada` y `PedidoPagado`.
- Contabilidad: `PedidoPagado`.

**Evidencia:** `event-bus.test.ts` y `notificaciones.suscriptores.test.ts`. Las pruebas de rutas de Contabilidad cubren el servicio, pero no existe una prueba que publique `PedidoPagado` a través del suscriptor para demostrar de extremo a extremo la idempotencia reactiva y el aislamiento de fallos.

### 7.8 State — Cita y Pedido

**Ubicaciones:**

- `apps/api/src/modules/citas/domain/cita.ts`
- `apps/api/src/modules/citas/domain/cita-estado.ts`
- `apps/api/src/modules/citas/domain/states/`
- `apps/api/src/modules/ventas/domain/pedido.ts`
- `apps/api/src/modules/ventas/domain/pedido-estado.ts`
- `apps/api/src/modules/ventas/domain/states/`

**Participantes:** `Cita`/`Pedido` son Context; `CitaEstado`/`PedidoEstado` define la interfaz; cada estado concreto decide la transición legal.

**Funcionamiento:** el Context delega `confirmar`, `iniciar`, `completar`, `cancelar`, `emitir`, `pagar` o `anular` al objeto de estado actual. La transición cambia el estado interno del Context.

**Evidencia:** matrices de transición, errores 409 `TRANSICION_CITA_INVALIDA`/`TRANSICION_INVALIDA`, pruebas de dominio y de API.

### 7.9 Factory Method — canal de notificación

**Ubicación:** `apps/api/src/modules/notificaciones/notificacion.factory.ts`.

**Participantes:** `NotificacionFactory`, `CreadorNotificador`, `Notificador`, `EmailSender`, `SmsSender` y `WhatsAppSender`.

**Funcionamiento:** `NotificacionesService` consulta el canal preferido actual del cliente y pide a la factory un `Notificador`; luego envía el mensaje. Cambiar el canal del cliente no cambia el evento ni el servicio emisor.

**Evidencia:** `notificacion.factory.test.ts` y `notificaciones.service.test.ts`.

**Precisión GoF:** la implementación es una **Simple Factory** en sentido estricto: una única factory selecciona y crea clases concretas. El proyecto la presenta como Factory Method, pero la demostración debe reconocer esta diferencia.

### 7.10 Adapter — facturación electrónica simulada

**Ubicaciones:**

- `apps/api/src/integrations/facturacion-electronica/facturacion-electronica.port.ts`
- `apps/api/src/integrations/facturacion-electronica/adapter-mock.ts`

**Participantes:** `FacturacionElectronicaPort`, `DatosFacturaInterna`, `ResultadoEmisionExterna`, `AdapterFacturacionElectronicaMock` y `PosCheckoutFacade`.

**Funcionamiento:** el Adapter convierte el modelo interno a XML, simula una respuesta externa y la traduce al modelo interno. El Facade lo invoca después del commit para que un fallo externo no revierta la venta.

**Evidencia actual:** el checkout usa un port simulado. No existe `adapter-mock.test.ts`; la especificación exige una prueba directa de XML, respuesta y rechazo.

**Límites:** la Facade entrega `payloadXml` directamente a `VentasRepository.actualizarPayloadExterno`; ese método deja las cadenas sin serializar. Como `facturas.payload_externo` es `jsonb` y el XML no es JSON válido, el `UPDATE` es incompatible con el esquema. Además, la Facade descarta `estado` y `cufe`, no bifurca ante `RECHAZADA` y usa un `catch {}` vacío que oculta tanto el rechazo lógico como el error de persistencia. No hay reintento ni auditoría del fallo.

### 7.11 Proxy — permisos y caché

**Ubicación:** `apps/api/src/modules/auth/permisos.proxy.ts` y `apps/api/src/modules/inventario/cache.proxy.ts`.

**Participantes:** `crearPermisosProxy<T>`, la tabla `PERMISOS_POR_ROL`, el mapa `METODO_A_PERMISO` y `DomainError` con `statusCode: 403`; `crearCacheProxy<T>`, una `Map` de entradas con expiración y la clave `metodo:JSON(args)`.

**Funcionamiento:** ambos usan `new Proxy(target, { get })`. El Proxy de permisos envuelve los métodos en una función asíncrona, resuelve el permiso por nombre de método y lanza `SIN_PERMISOS` antes de invocar el servicio real. El Proxy de caché devuelve una entrada vigente o ejecuta el método, guarda el resultado y lo reutiliza hasta que vence el TTL.

**Evidencia:** `permisos.proxy.test.ts` cubre admin, cajero y contador, incluidos los rechazos 403. `cache.proxy.test.ts` cubre reutilización, claves distintas, listas y expiración por TTL. Ambas pruebas pasan dentro de la suite, pero no prueban una ruta HTTP.

**Límites:** ninguno de los dos Proxy está cableado en `app.ts`, en `caja.routes.ts`, en `contabilidad.routes.ts` ni en las rutas de inventario. Por tanto, el criterio de aceptación del plan —un cajero que intenta anular una venta recibe 403— no se cumple; además, `METODO_A_PERMISO` no contiene una operación de anulación de venta. La caché no participa de la lectura real del catálogo, no tiene invalidación al escribir y su clave basada en `JSON.stringify` no cubre argumentos no serializables. Los permisos de Caja/Contabilidad se aplican hoy mediante hooks inline y el rol se deriva del JWT o de `x-user-id`; el `authPlugin` compartido no está conectado.

### 7.12 Repository — no GoF

Cada módulo de datos expone una clase Repository que encapsula Kysely. Hay repositorios para Inventario, Clientes, Empleados, Citas, Ventas, Carrito, Caja, Contabilidad y Nómina.

**Ventajas observadas:** los servicios no contienen SQL; las transacciones pueden recibir un `executor`; eldominio no depende de PostgreSQL.

**Límites:** no todos los repositorios siguen exactamente la misma frontera. Por ejemplo, `NominaService` consulta e inserta directamente mediante `unitOfWork.db`, mientras que también recibe `NominaRepository`; esto deja el patrón de Repository inconsistente en Nómina. `NominaRepository.crearLiquidacion()` no tiene consumidor, y sus métodos de lectura fabrican `netoAPagar` en vez de mapear `neto_a_pagar`. `carrito.repository.ts` además comienza con `// Patrón: Command` aunque su responsabilidad principal es persistencia, por lo que la convención de un patrón por archivo no es uniforme.

### 7.13 Unit of Work — no GoF

**Ubicación:** `apps/api/src/shared/db/unit-of-work.ts`.

**Participantes:** `UnitOfWork`, `UnitOfWorkContext`, `OutboxWriter`, `EventPublisher` y la transacción Kysely.

**Funcionamiento:**

1. Abre una transacción.
2. Entrega `context.db` a la operación.
3. `context.publish()` guarda el evento en Outbox usando la misma transacción y encola la entrega.
4. Si la operación falla, no hay commit ni entrega.
5. Después del commit entrega los eventos y aísla fallos con `Promise.allSettled`.

**Evidencia:** `unit-of-work.test.ts` demuestra commit, rollback, correlación y que un suscriptor fallido no revierte el commit.

### 7.14 Outbox — no GoF

**Ubicación:** `apps/api/src/shared/events/outbox.ts` y tabla `outbox_events`.

**Funcionamiento:** cada evento publicado en un Unit of Work se persiste con `procesado_en = null`. `Outbox` ofrece `marcarProcesado()` y `pendientes()`.

**Estado real:** `Implementado parcialmente`. No existe worker/consumer que lea pendientes al iniciar, intente redelivery o marque los eventos como procesados en el flujo productivo. Tras un reinicio, el registro queda, pero no se vuelve a entregar por sí solo.

### 7.15 Chain of Responsibility de Nómina

**Ubicaciones:**

- `apps/api/src/modules/nomina/cadena-liquidacion.ts`
- `apps/api/src/modules/nomina/cadena/salario-base.ts`
- `apps/api/src/modules/nomina/cadena/horas-extras.ts`
- `apps/api/src/modules/nomina/cadena/auxilio-transporte.ts`
- `apps/api/src/modules/nomina/cadena/salud.ts`
- `apps/api/src/modules/nomina/cadena/pension.ts`

**Participantes:** `CadenaLiquidacion`, `EslabonLiquidacionBase`, los cinco eslabones y `NominaService`.

**Funcionamiento:** cada eslabón agrega un `ResultadoConcepto` al acumulado y delega en el siguiente. `NominaService` suma devengos, resta deducciones y calcula el neto.

**Cálculo de referencia:** con salario 1.500.000, 10 horas extras y auxilio 1, el resultado esperado es:

```text
devengos    = 1.500.000 + 31.250 + 162.000 = 1.693.250
deducciones = 60.000 + 60.000 = 120.000
neto        = 1.573.250
```

**Evidencia:** `cadena-liquidacion.test.ts` y una prueba por eslabón construyen manualmente la cadena y verifican esos valores.

**Defecto de integración:** `apps/api/src/app.ts` instancia `new CadenaLiquidacion()` sin agregar ningún eslabón. `CadenaLiquidacion.ejecutar()` devuelve `[]` en ese caso. En consecuencia, la ruta productiva persiste devengos, deducciones y neto en cero. La prueba API compara los totales contra los conceptos recibidos, por lo que puede pasar con conceptos vacíos y no demuestra el valor esperado. Además, `NominaRepository.obtenerLiquidacionPorId` y `listarLiquidaciones` fabrican `netoAPagar` como `salarioBase * 0.9` en vez de leer `neto_a_pagar`; la aserción `netoAPagar > 0` de la prueba de consulta queda enmascarada y tampoco prueba el valor persistido.

**Otros límites de Nómina:**

- El catálogo `conceptos_nomina` no determina la composición de la cadena.
- `salarioBase` llega en el body; no se toma de `empleados.salario_base`.
- El detalle de conceptos no se persiste ni se devuelve al listar/consultar una liquidación.
- La verificación de duplicado y el insert no están dentro de una transacción.
- La página web `/nomina` existe, pero no consume `useNomina`, mantiene `conceptos` vacío y dispara cálculo/listado concurrentes que pueden sobrescribirse.
- No existe endpoint de catálogo, aunque el hook web solicite `/api/nomina/conceptos`.

---

## 8. Flujos ejecutados

### 8.1 Venta completa

```text
Usuario web
→ POST /api/carritos
→ POST /api/carritos/:id/comandos
→ POST /api/ventas/checkout
→ PosCheckoutFacade
   → CadenaValidacion: cliente → stock
   → UnitOfWork.execute
      → Pedido.crear + State
      → PagoStrategy.cobrar
      → context.publish(PedidoPagado)
      → FacturaBuilder
      → UPDATE stock
      → cerrar carrito
   → COMMIT
→ InMemoryEventBus
   ├→ NotificacionesService → NotificacionFactory → sender
   └→ ContabilidadService → partida doble
→ AdapterFacturacionElectronicaMock
→ intenta UPDATE facturas.payload_externo (XML crudo contra jsonb; error oculto)
```

El stock se vuelve a leer dentro de la transacción, pero el `SELECT` y el `UPDATE` no son una operación atómica condicional. Dos checkouts concurrentes todavía pueden competir por el mismo stock; la protección definitiva requiere `UPDATE ... WHERE cantidad >= ?`, bloqueo pesimista o una política de/versionado de stock.

El cierre del carrito tampoco es compare-and-set: `CarritoRepository.actualizarEstado` solo filtra por ID y no exige que el estado previo sea `Abierto`. Dos requests concurrentes pueden observar el mismo carrito abierto, pagar y crear dos pedidos. El checkout tampoco recibe una clave de idempotencia de negocio.

### 8.2 Confirmación de cita

```text
POST /api/citas/:id/confirmar
→ CitasService valida transición y condiciones de agenda
→ UnitOfWork
   → UPDATE citas con estado esperado
   → INSERT outbox_events CitaConfirmada
→ COMMIT
→ EventBus
→ NotificacionesService
→ Factory crea sender según canal actual del cliente
```

### 8.3 Asiento contable

```text
PedidoPagado
→ Contabilidad subscriber
→ ContabilidadService.registrarVenta
→ construirAsientoVenta(total)
→ UnitOfWork
   → INSERT CAJA (débito)
   → INSERT INGRESOS_VENTAS (crédito)
   → ON CONFLICT DO NOTHING
→ COMMIT
```

La venta ya confirmó su commit antes de entregar `PedidoPagado`. Contabilidad abre una segunda transacción para el asiento; si esa operación falla, el bus aísla el fallo y la venta permanece confirmada sin asiento. Esta frontera preserva el desacoplamiento, pero no garantiza atomicidad entre venta y contabilización.

### 8.4 Liquidación de Nómina: flujo requerido frente al actual

```text
Requerido:
POST /api/nomina/calcular
→ CadenaLiquidacion con cinco eslabones
→ total devengos - total deducciones
→ validar empleado y unicidad
→ persistir liquidación con detalle
→ 201 con conceptos

Actual:
POST /api/nomina/calcular
→ CadenaLiquidacion vacía en app.ts
→ conceptos = []
→ totales = 0
→ validar empleado y unicidad
→ persistir liquidación
→ 201 con conceptos = []
```

### 8.5 Cálculo web de Nómina: carrera entre POST y GET

```text
Usuario web → /nomina → "Calcular liquidación"
→ POST /api/nomina/calcular
→ GET /api/nomina/liquidaciones?empleadoId=...&periodo=...
→ ambas respuestas actualizan el mismo estado liquidaciones
→ si el GET responde después, reemplaza el resultado calculado por la lista
```

La prueba `Nomina.test.tsx` deja expuesta esta carrera: el POST mockeado devuelve una liquidación y el GET mockeado devuelve `[]`; el resultado esperado no aparece.

### 8.6 Login y acceso a Caja/Contabilidad

```text
Navegador → /login
→ POST /api/auth/login
→ AuthService valida scrypt y firma JWT
→ AuthRepository registra sesión
→ web guarda token y usuario en localStorage
→ RequireAuth permite renderizar las rutas internas

API → ruta de Caja o Contabilidad
→ hook inline de app.ts
→ si existe x-user-id: asigna cajero o contador y omite JWT
→ si no, exige Bearer y verifica firma/expiración
→ request.usuario gobierna la ruta
```

El frontend no adjunta `Authorization` a las llamadas de páginas; por tanto, la protección real de Caja/Contabilidad depende de una cabecera que la web no envía o del bypass `x-user-id`. El `AuthProvider` solo demuestra que hay una sesión en el navegador, no que la API vaya a aceptar sus peticiones.

---

## 9. Pruebas y su función como evidencia

### 9.1 Topología

- `vitest.config.ts` ejecuta dos proyectos: `api` y `web`.
- API: entorno Node, `src/**/*.test.ts`, archivos en serie.
- Web: `jsdom`, Testing Library, `src/**/*.test.{ts,tsx}`.
- Las pruebas de persistencia usan PGlite y aplican las migraciones SQL reales; no sustituyen una prueba smoke contra PostgreSQL Docker.

### 9.2 Evidencia por patrón

| Patrón | Archivo(s) de evidencia |
|---|---|
| Facade | `apps/api/src/modules/ventas/pos/pos-checkout.facade.test.ts` |
| Command | `apps/api/src/modules/ventas/pos/commands/*.test.ts`, `carrito.routes.test.ts` |
| Chain de Ventas | `apps/api/src/modules/ventas/domain/validation/cadena-validacion.test.ts` |
| Strategy | `apps/api/src/modules/ventas/domain/pricing/estrategias.test.ts`, `domain/payments/pago.test.ts` |
| Builder | `apps/api/src/modules/ventas/domain/factura.builder.test.ts` |
| Observer | `apps/api/src/shared/events/event-bus.test.ts`, `modules/notificaciones/notificaciones.suscriptores.test.ts` |
| State | `modules/citas/domain/cita-estado.test.ts`, `modules/ventas/domain/pedido-estado.test.ts` |
| Factory | `modules/notificaciones/notificacion.factory.test.ts`, `notificaciones.service.test.ts` |
| Adapter | Integración en `pos-checkout.facade.test.ts`; falta prueba directa |
| Repository | Pruebas de API/integración de cada módulo; cobertura desigual entre repositorios |
| Unit of Work | `apps/api/src/shared/db/unit-of-work.test.ts` |
| Outbox | Cubierto indirectamente por Unit of Work; falta worker/retry |
| Chain de Nómina | `modules/nomina/cadena-liquidacion.test.ts`, `modules/nomina/cadena/*.test.ts`, `nomina.routes.test.ts` |
| Proxy | `apps/api/src/modules/auth/permisos.proxy.test.ts` y `apps/api/src/modules/inventario/cache.proxy.test.ts`; evidencia unitaria, sin integración HTTP |

### 9.3 Cobertura frontend

Existen pruebas de las páginas de Ventas/Citas/Clientes, navegación, tipos, formato y los dashboards de Contabilidad y Nómina. La prueba de Nómina tiene dos casos: el render pasa, pero el cálculo falla de forma reproducible por la carrera POST/GET descrita en [8.5](#85-cálculo-web-de-nómina-carrera-entre-post-y-get). La nueva guarda de autenticación no está preparada en las pruebas: las 20 pruebas de `App.test.tsx` renderizan el login sin sesión y no encuentran los enlaces o botones esperados. No hay pruebas del formulario `Login`, del hook `useAuth` ni de la integración de los Proxy con rutas.

---

## 10. Límites y deuda técnica conocida

| Prioridad | Hallazgo | Impacto |
|---|---|---|
| P0 | La cadena de Nómina no está conectada en `app.ts`. | La API productiva calcula totales en cero aunque las pruebas unitarias de la cadena sean correctas. |
| P0 | La puerta de calidad no está verde: 21 pruebas y 30 reglas de ESLint fallan. | La rama no cumple la regla de cerrar con `test`, `typecheck`, `lint` y `build` en verde. |
| P0 | La guarda de rutas web no tiene un estado autenticado en las pruebas existentes. | 20 pruebas de `App.test.tsx` quedan en `/login` y fallan por elementos ausentes. |
| P0 | `x-user-id` es un bypass de autenticación y asigna roles fijos (`cajero` en Caja, `contador` en Contabilidad). | Cualquier cliente puede entrar sin JWT y obtener un rol distinto del real. |
| P0 | `POST /api/auth/registro` es público y acepta el rol `admin`. | Cualquiera puede crearse una cuenta administrativa sin autenticarse. |
| P1 | `PermisosProxy` y `CacheProxy` no están cableados. | El criterio “cajero anulando venta → 403” y “segunda lectura del catálogo no consulta la base” no están demostrados ni activos. |
| P1 | El JWT usa un secreto fijo y el middleware valida la firma, pero no consulta la sesión persistida. | Un token emitido no se puede revocar desde `sesiones`; el secreto de desarrollo no es apto para producción. |
| P1 | La página de Nómina coordina POST y GET en paralelo sobre el mismo estado. | El listado puede borrar el resultado calculado; el caso web falla de forma reproducible. |
| P1 | `NominaRepository` fabrica `netoAPagar` como `salarioBase * 0.9` al listar y consultar. | La API no devuelve el neto persistido y la aserción positiva de la prueba queda enmascarada. |
| P1 | `PedidoPagado.items` es opcional y el Facade no lo publica. | Contabilidad no puede mostrar productos/servicios; `productosServicios` siempre queda vacío. |
| P1 | No hay prueba directa del suscriptor contable. | La idempotencia reactiva y el aislamiento de fallos del Observer no están demostrados de extremo a extremo. |
| P1 | El Adapter entrega XML crudo a una columna `jsonb` y oculta el error con `catch {}`. | La persistencia externa es incompatible con el esquema y no hay estado/CUFE, rechazo ni reintento auditables. |
| P1 | El cierre de caja web usa un input oculto para inicializar el ID. | El usuario puede abrir una caja, pero el botón de cierre no llega a la API. |
| P1 | Los filtros web de Contabilidad envían `YYYY-MM-DD`, pero el reporte exige fecha-hora ISO. | Consultar el reporte con una fecha de la interfaz devuelve 400. |
| P1 | No hay worker de Outbox ni actualización de `procesado_en` en el flujo productivo. | Un evento persistido puede no entregarse después de reiniciar el proceso. |
| P1 | El checkout no valida caja abierta. | Una venta puede completarse sin una caja operativa. |
| P1 | El descuento de stock usa lectura seguida de escritura. | Existe una ventana de carrera entre checkouts concurrentes. |
| P1 | El checkout cierra el carrito sin compare-and-set y no tiene clave de idempotencia. | Dos requests concurrentes pueden crear dos pedidos para el mismo carrito. |
| P1 | El pago no se persiste en una tabla. | No existe registro durable de monto, método y referencia del cobro. |
| P1 | La validación de stock exige existencias para servicios, pero el seed solo crea stock para productos físicos. | Los cuatro servicios del seed no pueden pasar el checkout. |
| P1 | El flujo legacy de Ventas no descuenta stock. | `/api/pedidos` y `/api/ventas/checkout` producen inventarios distintos. |
| P1 | Nómina no persiste detalle ni toma salario y conceptos desde el catálogo/empleado. | No se puede reconstruir una liquidación histórica completa desde la API. |
| P1 | La prevalidación de duplicado y el insert de Nómina no son una sola transacción. | Una carrera puede terminar en violación de índice y error 500, no en 409 controlado. |
| P1 | `periodo` de Nómina solo exige texto no vacío y la web pide un UUID manual. | Se aceptan períodos inválidos y el usuario debe conocer el identificador del empleado. |
| P2 | La caché no tiene invalidación ni se usa en el catálogo real. | Una escritura puede dejar lecturas obsoletas hasta el TTL si se cablea sin estrategia de invalidación. |
| P2 | Notificaciones solo escriben en una salida inyectada. | No hay bandeja, persistencia de entregas ni endpoint HTTP. |
| P2 | “Gestión de personal” apunta a `#` en la navegación web. | El frontend no ofrece gestión de empleados aunque exista `GET /api/empleados`. |
| P2 | Las pruebas de persistencia usan PGlite. | Debe verificarse además el comportamiento real en PostgreSQL 17. |
| P2 | El seed no tiene una prueba automatizada de repetibilidad. | Una regresión del seed puede detectarse tarde. |
| P2 | La documentación histórica tiene afirmaciones contradictorias. | `docs/plan.md` y `docs/patrones.md` pueden inducir a un estado incorrecto. |
| P2 | Los marcadores `// Patrón:` no son uniformes. | `carrito.repository.ts` se etiqueta como Command aunque su responsabilidad principal es persistencia. |

---

## 11. Diferencias entre especificación e implementación

| Tema | Especificación / plan | Implementación observada |
|---|---|---|
| Checklist de fases | `docs/plan.md` marca solo fases 5 y 6. | Hay código de fases 0–8; Fase 7 y Fase 8 están parcialmente implementadas y Fase 9 sigue incompleta. |
| Trazabilidad | `docs/patrones.md` conserva un snapshot de fases 5–6 y en una sección presenta Adapter/Nómina como pendientes. | Adapter está implementado; Nómina está parcialmente implementado. |
| Cadena de Ventas | Incluir caja abierta, cliente y stock. | Solo cliente y stock. |
| Checkout | Resultado verificable de punta a punta y sin stock parcial. | La unidad de negocio está agrupada en un UoW, pero el stock requiere actualización atómica/condicional y la validación no distingue servicios. |
| Flujo legacy de Ventas | Mismo resultado de inventario que el checkout. | `POST /api/pedidos` cierra el carrito, pero no descuenta stock ni ejecuta Adapter. |
| Facturación | Persistir resultado externo y evidencia de rechazo. | Se intenta persistir XML best-effort en `jsonb`; la actualización es incompatible, no se guardan estado/CUFE y el error queda oculto. |
| Desglose contable | `productosServicios` con productos/servicios vendidos. | El contrato existe, pero la implementación devuelve `[]`. |
| Nómina | `docs/nomina.md` termina como plan y dice que no se ha modificado código. | El commit contiene dominio, API, repositorio, rutas, migración, tipos, hook, página web y pruebas. |
| Nómina | Cadena con cinco conceptos y detalle persistido. | Cinco clases y pruebas unitarias; composición productiva vacía y sin detalle persistido. |
| Nómina | Consultar catálogo de conceptos. | No existe `/api/nomina/conceptos`; el catálogo tampoco compone la cadena. |
| Nómina | Dinero en centavos enteros. | La implementación usa `number` en pesos y redondeo decimal en algunos eslabones. |
| Nómina frontend | Página `/nomina`, hook y pruebas web. | Existen y están montados; el hook no se consume, falta cargar empleados/catálogo y la prueba de cálculo falla por la carrera POST/GET. |
| Proxy | Permisos y caché con pruebas e integración. | Las clases y pruebas unitarias existen, pero no hay integración con rutas ni se cumple el criterio de aceptación del plan. |
| Seguridad | Roles admin/cajero/contador y sesiones. | Login, seed y guard web existen; solo Caja y Contabilidad están protegidas, el bypass `x-user-id` sigue activo y las sesiones no se consultan al autorizar. |

---

## 12. Próximos pasos recomendados

### P0 — estabilizar el corte actual

1. Conectar en `app.ts` los cinco eslabones de Nómina mediante una función de composition explícita.
2. Hacer que `NominaRepository` lea `neto_a_pagar` y cambiar la prueba API para afirmar valores conocidos (`1.693.250`, `120.000`, `1.573.250`), no solo la consistencia entre campos ni un neto fabricado.
3. Serializar el cálculo y el listado de `/nomina`, o hacer que el GET incorpore el resultado sin sobrescribirlo; corregir la prueba web que falla.
4. Preparar la autenticación en `App.test.tsx` (sesión o mock explícito) para recuperar las 20 pruebas, y resolver los 30 errores de lint de Fase 8 sin ocultarlos con reglas desactivadas.
5. Eliminar el bypass `x-user-id` fuera de pruebas, conectar un único middleware de autenticación y consultar la sesión persistida para permitir revocación.
6. Ejecutar de nuevo `pnpm test`, `pnpm typecheck`, `pnpm lint` y `pnpm build`; corregir todo error antes de cerrar la fase.
7. Revisar la migración `0009_nomina` antes de aplicarla en un entorno con datos: los importes están como `text`, no como `numeric`, y no existe la columna de detalle prevista.

### P1 — completar las integraciones existentes

1. Publicar `items` completos en `PedidoPagado` y persistirlos o exponerlos mediante un contrato de lectura que Contabilidad pueda consumir sin importar Ventas.
2. Sustituir el input oculto de cierre por el `caja.id` disponible en el estado de la vista y convertir las fechas web a ISO antes de consultar el reporte.
3. Añadir `adapter-mock.test.ts`, serializar un objeto JSON válido para `payload_externo`, registrar estado/CUFE/error y sustituir el `catch {}` vacío por una auditoría o reintento explícito.
4. Implementar el lector/worker de Outbox, reintento y actualización de `procesado_en`.
5. Añadir validación de caja abierta al checkout, hacer atómico el descuento de stock, cerrar el carrito con compare-and-set, incorporar idempotencia, persistir el pago y permitir servicios sin una fila de existencias.
6. Unificar el flujo legacy con el checkout o retirar/documentar explícitamente su diferencia de inventario.
7. Llevar el cálculo y persistencia de Nómina al Repository/UoW; persistir detalle, tomar salario del empleado, exponer `/api/nomina/conceptos` y validar `periodo` como `YYYY-MM`.
8. Integrar `useNomina` o eliminar la lógica duplicada; cargar empleados para evitar exigir un UUID manual.

### P2 — completar el producto y la exposición

1. Cablear `PermisosProxy` sobre las operaciones sensibles (incluida la anulación de venta), aplicar `CacheProxy` al catálogo con invalidación y añadir pruebas HTTP de ambos criterios de aceptación.
2. Ejecutar migraciones up/down y seed repetible contra PostgreSQL Docker, además de PGlite.
3. Consolidar un guion de demo por patrón con el flujo real y sus limitaciones honestas.
4. Convertir este documento en el resumen vivo y dejar `docs/patrones.md` como historial fechado o convertirlo gradualmente en el documento final de exposición.

---

## 13. Verificación y evidencia

### 13.1 Comandos de verificación

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

| Comando | Propósito |
|---|---|
| `pnpm test` | Suite Vitest completa de API y web. |
| `pnpm typecheck` | TypeScript sin emitir archivos. |
| `pnpm lint` | ESLint sobre el monorepo. |
| `pnpm build` | Compilación de API y bundle de producción web. |

### 13.2 Resultado de la corrida de corte

La corrida de este corte, ejecutada sobre `05cbde1` en un worktree aislado, produjo:

| Comando | Resultado observado |
|---|---|
| `pnpm test` | **Falla:** 44 archivos; 243 pruebas; 222 pasan y **21 fallan**. 20 fallos están en `App.test.tsx` porque la guarda muestra `/login` sin sesión; el otro es el fallo ya conocido de `Nomina.test.tsx` (`calcula liquidación y muestra el resultado`). |
| `pnpm typecheck` | Correcto (`tsc --noEmit`, salida 0). |
| `pnpm build` | Correcto por componentes: `tsc -p apps/api/tsconfig.build.json` y `vite build` de web. El comando raíz `pnpm build` no se pudo ejecutar en el worktree aislado por `ERR_PNPM_UNSAFE_TASK_RUN_STATE_PATH` sobre el `node_modules` enlazado; no fue un error de compilación. |
| `pnpm lint` | **Falla:** 30 errores y 2 warnings. 26 errores son de Fase 8 (`app.ts`, ambos Proxy y sus pruebas, `Layout.tsx`, `useAuth.tsx` y `Login.tsx`); los 4 restantes y los 2 warnings pertenecen a Contabilidad. |

> El corte anterior `fa986b5` tenía 42 archivos, 232 pruebas, 1 fallo y 13 errores de lint. Esos resultados no describen `05cbde1`: la Fase 8 añadió 2 archivos de prueba, 11 pruebas, 20 fallos de integración web y 17 errores de lint adicionales. La rama no cumple la puerta verde de `AGENTS.md`; no debe marcarse la Fase 8 como cerrada.

### 13.3 Otras comprobaciones realizadas

- Búsqueda de `any` en `apps/**/*.{ts,tsx}`: sin coincidencias.
- Búsqueda de imports productivos directos entre dominios de negocio: sin coincidencias; la única importación cruzada está en la prueba de integración `modules/fase2.routes.test.ts`.
- Búsqueda de imports de `modules/` desde `integrations/`: sin coincidencias.
- La Fase 8 añadió autenticación JWT, `/api/auth/*`, login web, guard de rutas, seed de usuarios y la migración `0010_seguridad_auth`; solo Caja y Contabilidad están protegidas en la API.
- `app.ts` duplica la lógica de autenticación en dos hooks inline y mantiene `x-user-id` como bypass con roles hardcodeados. `shared/auth/middleware.ts` existe, pero no se registra.
- La Fase 8 añadió dos archivos de prueba de Proxy y 11 pruebas. Los Proxy pasan sus casos unitarios, pero no hay ninguna prueba HTTP que demuestre los criterios de aceptación del plan.
- GitNexus **no se reindexó** sobre `05cbde1`: el worktree aislado quedó fuera del acceso permitido para el runner. Los datos anteriores (3.314 nodos, 7.123 relaciones, 104 clústeres y 177 flujos) corresponden a `fa986b5` y no incluyen autenticación ni los Proxy.

---

## 14. Protocolo para actualizar este documento

Este archivo debe cambiar junto con el código, no después de una entrega.

1. Actualizar fecha, rama, commit y si el árbol estaba limpio.
2. Ejecutar `pnpm test`, `pnpm typecheck`, `pnpm lint` y `pnpm build`; copiar el resultado real.
3. Revisar la matriz de patrones: ubicación, participantes, evidencia y estado.
4. Actualizar los flujos si cambia el composition root, un contrato de evento o una frontera transaccional.
5. Mover cada hallazgo de “Deuda” a “Resuelto” solo cuando exista código y evidencia.
6. Registrar divergencias con la especificación; no resolverlas reescribiendo la historia.
7. Mantener `docs/patrones.md` como snapshot existente salvo decisión explícita de convertirlo en el documento final.
8. Revisar enlaces, rutas y símbolos citados antes de hacer commit.

### Checklist de mantenimiento

- [ ] Snapshot actualizado.
- [ ] Matriz de patrones revisada.
- [ ] Flujos y contratos de eventos revisados.
- [ ] API y frontend contrastados con el código.
- [ ] Migraciones y tablas verificadas.
- [ ] Pruebas, typecheck, lint y build ejecutados.
- [ ] Limitaciones y próximos pasos actualizados.
- [ ] Diff limitado a los documentos o cambios explícitamente autorizados.

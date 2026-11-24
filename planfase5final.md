# Plan final — Fase 5: Citas y Notificaciones

> **Estado:** propuesta consolidada, pendiente de aprobación explícita.
>
> **Documento fuente comparado:** `planfase5.md`.
>
> **Alcance de este documento:** planning únicamente. No implementa la Fase 5 ni aplica correcciones.
>
> **Regla de ejecución:** no se modifica código, migraciones, tests ni documentación del producto hasta que el usuario autorice expresamente el inicio.

---

## 0. Resumen ejecutivo

La Fase 5 agrega dos capacidades demostrables:

1. **Agenda de Citas persistida**, con transiciones controladas mediante el patrón **State**.
2. **Notificaciones simuladas** por email, SMS y WhatsApp mediante el patrón **Factory Method** definido por el proyecto.
3. Integración de **Observer** para reaccionar a `CitaConfirmada` y `PedidoPagado` sin acoplar Citas, Ventas, Clientes y Notificaciones entre sí.
4. Pantalla de agenda y edición del canal preferido del cliente.
5. Pruebas unitarias, de integración, de rutas y frontend.
6. Documentación modular y trazabilidad para `docs/patrones.md`.

La Fase 5 **no** implementa Caja, Contabilidad, Nómina, autenticación, Adapter, Proxy ni un worker de Outbox.

### Resultado esperado de la demo

1. El usuario crea una cita.
2. La cita inicia en `Pendiente`.
3. Al confirmarla, el backend persiste la transición y publica `CitaConfirmada` dentro del Unit of Work.
4. Después del commit, el suscriptor de Notificaciones consulta la preferencia actual del cliente.
5. La Factory crea el notificador correspondiente y produce una salida simulada.
6. Al cambiar la preferencia del cliente a otro canal, la siguiente confirmación utiliza el nuevo canal sin modificar `CitasService` ni el emisor del evento.

---

## 1. Comparación con la auditoría y las anotaciones previas

### 1.1 Decisiones de `planfase5.md` que se conservan

| Decisión | Evaluación final |
|---|---|
| Mantener `PedidoPagado` como evento canónico | **Se conserva.** El dominio, las tablas y las rutas ya usan Pedido. `OrdenPagada` queda únicamente como nombre histórico del plan inicial. |
| Crear un contrato `AppEventMap` | **Se conserva.** Será la fuente canónica de tipos de eventos de la aplicación. |
| Usar un único `UnitOfWork<AppEventMap>` | **Se conserva.** Evita mantener buses distintos para Ventas y Citas. |
| Agregar una tabla mínima de empleados | **Se conserva.** Es una dependencia indispensable de la agenda. |
| Validar solapamientos | **Se conserva y se Fortalece.** Se definirá con intervalos semiabiertos y serialización por empleado para evitar carreras. |
| Notificaciones simuladas con salida inyectable | **Se conserva.** Permite pruebas deterministas sin espiar `console.log`. |
| Editar el canal preferido del cliente | **Se conserva.** Es parte del criterio de aceptación. |
| Publicar IDs, no datos de contacto, en eventos | **Se conserva.** La notificación consulta la preferencia vigente al momento de enviarse. |
| Notificaciones best-effort | **Se conserva.** Un fallo de canal no revierte una cita ya confirmada. |
| No implementar worker de Outbox en esta fase | **Se conserva.** Se documentará como limitación explícita. |
| No crear una caja artificial | **Se conserva.** `ValidarCajaAbierta` queda para Fase 6. |
| Mantener Command limitado al carrito | **Se conserva.** Descuento pertenece a Strategy y anulación a State; no se fuerzan comandos artificiales. |

### 1.2 Ajustes incorporados a `planfase5.md`

1. **Baseline real:** se incluye también el estado de ESLint: actualmente hay 48 errores.
2. **Contrato de canal único:** `CanalNotificacion` se define en `shared/` y lo reutilizan Clientes y Notificaciones, evitando uniones duplicadas que puedan divergir.
3. **Respuesta de Clientes:** la API actual devuelve `canalPreferido`, mientras el frontend lee `canal_preferido`. La corrección del contrato visual es prerrequisito de la demo de canales.
4. **Concurrencia de agenda:** la consulta de solapamiento y la inserción se harán en una transacción, bloqueando la fila del empleado antes de revalidar.
5. **Semántica temporal:** dos citas consecutivas son válidas; el solapamiento se calcula con intervalos `[inicio, fin)`.
6. **Empleado inactivo:** se agrega una validación y un error específico.
7. **Factory Method:** se conserva la estructura solicitada por el proyecto, pero se separan los productos concretos en archivos propios y se documentarán sus roles con honestidad académica.
8. **Canal inválido:** se valida en el borde de entrada y al leer datos preexistentes, no mediante casts inseguros.
9. **Destinatario ausente:** se registra una advertencia y se omite el envío; no se cambia silenciosamente el canal preferido.
10. **Errores de Fase 4:** se separan de la Fase 5 para no mezclar alcance. Quedan registradas como deuda técnica priorizada.
11. **Prueba de concurrencia:** se exige una prueba que intente reservar dos veces el mismo horario del mismo empleado.
12. **Inyección de salida:** `BuildAppOptions` permitirá inyectar el sumidero de notificaciones en pruebas de integración.

---

## 2. Estado verificado antes de iniciar

### 2.1 Verificaciones actuales

| Comando | Estado observado |
|---|---|
| `pnpm typecheck` | Pasa. |
| `pnpm --filter @nexo/api test` | Pasa: 19 archivos y 97 pruebas. |
| `pnpm --filter @nexo/web test` | Falla 1 de 18 pruebas. |
| `pnpm test` | No está verde: timeouts PGlite en la ejecución conjunta y el fallo web. |
| `pnpm lint` | No está verde: 48 errores. |
| `/health` | Responde `200`. |

### 2.2 Correcciones prerequisito

No forman parte del dominio de Citas, pero deben resolverse antes de escribir la primera línea funcional de la Fase 5.

#### Corrección A.1 — Vitest

- Ajustar `apps/api/vitest.config.ts` para evitar que las suites PGlite se ejecuten de forma que agoten el timeout.
- Subir `hookTimeout` solo como margen defensivo; no usarlo para ocultar una prueba bloqueada.
- Verificar también la suite ejecutada con el comando raíz `pnpm test`.

#### Corrección A.2 — Formato monetario web

- La prueba espera `/100,00/`, pero el formato real produce `$ 100`.
- Se debe elegir una única convención:
  - preferida: dos decimales siempre para valores monetarios;
  - alternativa: adaptar la prueba a la salida real.
- La corrección debe hacerse en `formatearMoneda` o en la prueba, no en un parche específico de esa aserción.

#### Corrección A.3 — Keys del sidebar

- `Layout.tsx` usa `key={enlace.to}` y tres enlaces usan `#`.
- Se agregará un `id` estable y único por enlace.
- `Citas` pasa a usar `/citas`; Contabilidad y Personal permanecen como enlaces futuros, pero con keys únicas.

#### Corrección A.4 — Contrato de canal de Clientes

- API: `canalPreferido`.
- Frontend actual: `canal_preferido`.
- Se corrige el mapeo web para usar el contrato real de la API.
- Se elimina el cast inseguro del repositorio:
  ```ts
  (row.canal_preferido ?? 'email') as CanalPreferido
  ```
- Se utiliza un type guard o normalizador compartido.

#### Corrección A.5 — ESLint

- Corregir los 48 errores actuales.
- Los errores de `require-await` en dobles de prueba deben resolverse ajustando el tipo del mock, no desactivando la regla global.

### 2.3 Gate de entrada

La Fase 5 no comienza hasta que estén verdes:

```bash
pnpm test
pnpm typecheck
pnpm lint
```

---

## 3. Deuda de Fase 4 separada de esta fase

La auditoría detectó problemas reales en Fase 4. No se corregirán mezclados con Citas porque requieren cambios arquitectónicos y pruebas propias.

| Prioridad | Deuda | Dependencia con Fase 5 |
|---|---|---|
| P0 | Checkout concurrente: stock, cierre del carrito y posible doble venta. | No bloquea Citas; sí bloquea una demo concurrente confiable. |
| P0 | Persistencia de la tabla `pagos`. | No bloquea Citas. |
| P0 | Prueba integral de rollback del checkout. | No bloquea Citas. |
| P1 | Ejecutar toda la Chain dentro de la transacción. | No bloquea Citas. |
| P1 | Sustituir acceso directo a tablas de Inventario/Clientes por puertos. | No bloquea Citas. |
| P1 | Cliente frecuente real, promoción por fecha e impuesto por región. | No bloquea Citas. |
| P1 | Relay/worker del Outbox e idempotencia de suscriptores. | Se mantiene fuera de Fase 5; sí debe resolverse antes de usar eventos para procesos críticos externos. |
| P2 | README y checklist desactualizados. | README se corrige en el cierre documental de esta fase si se autoriza. |

Estas tareas se ejecutarán en ramas y commits separados, con aprobación independiente.

---

## 4. Decisiones finales de diseño

| # | Decisión | Motivo |
|---|---|---|
| 1 | `PedidoPagado` es el evento canónico. | Consistencia con el dominio actual. |
| 2 | `AppEventMap` vive en `shared/events/event-map.ts`. | Contrato único de integración, sin imports entre módulos de negocio. |
| 3 | Los módulos exponen alias specialized: `VentasEventMap` y `CitasEventMap`. | Evita romper imports y mantiene tipos autodescriptivos. |
| 4 | `CanalNotificacion` vive en `shared/types/canal-notificacion.ts`. | Clientes y Notificaciones comparten una única definición estricta. |
| 5 | `empleados` es un módulo mínimo independiente. | Citas necesita el recurso; Fase 7 ampliará el modelo laboral. |
| 6 | Las citas se crean siempre en `Pendiente`. | La transición inicial es única y trazable. |
| 7 | Los intervalos de agenda son `[inicio, fin)`. | Permite citas consecutivas sin considerarlas solapadas. |
| 8 | La reserva serializa reservas del mismo empleado mediante bloqueo de fila. | Evita una carrera entre dos solicitudes simultáneas. |
| 9 | `CitaConfirmada` publica solo IDs y datos de agenda. | No congela el canal ni el contacto del cliente. |
| 10 | Notificaciones consulta el contacto y la preferencia actuales. | Cambiar la preferencia afecta la siguiente notificación. |
| 11 | La salida del canal es inyectable. | Pruebas deterministas y desacoplamiento de console. |
| 12 | El envío es best-effort. | Notificar no participa en la transacción de la cita. |
| 13 | Las notificaciones no se persisten. | Evita ampliar el modelo fuera del alcance de la demo. |
| 14 | No se implementa worker de Outbox en Fase 5. | Se documenta la limitación; no se promete reintento automático. |
| 15 | Caja permanece fuera de alcance. | La Chain de Ventas se documentará como parcialmente implementada. |

---

## 5. Alcance de la Fase 5

### 5.1 Incluido

- Tablas mínimas `empleados` y `citas`.
- State de Citas.
- Repositorio, servicio, puertos y rutas de Citas.
- Catálogo de empleados.
- Evento `CitaConfirmada`.
- Contrato `AppEventMap`.
- Factory y senders simulados.
- Servicio y suscriptores de Notificaciones.
- Integración con `PedidoPagado`.
- Actualización parcial de clientes y canal preferido.
- Pantalla de agenda.
- Seed de demostración.
- Pruebas y documentación.

### 5.2 Excluido

- Caja y cierre de caja.
- Asientos contables.
- Nómina y liquidaciones.
- Autenticación y roles.
- Envío real de email, SMS o WhatsApp.
- Persistencia de notificaciones.
- Worker o retry automático del Outbox.
- Calendario gráfico avanzado.
- Reprogramación de citas.
- Cancelación desde `En Proceso`.
- Patrones Adapter y Proxy.
- Correcciones de concurrencia del checkout de Fase 4, salvo que se autoricen por separado.

---

## 6. Reglas arquitectónicas obligatorias

1. Ningún módulo de negocio importa directamente a otro módulo de negocio.
2. `app.ts` es el composition root y conecta repositorios, puertos, strategies, factories y suscriptores.
3. Citas no importa Clientes ni Notificaciones.
4. Notificaciones no importa Citas, Clientes ni Ventas.
5. Ventas no importa Notificaciones.
6. Las dependencias de acceso a datos se comunican por puertos o por contratos compartidos.
7. Cada archivo que implementa un patrón comienza con:
   ```ts
   // Patrón: <Nombre>
   ```
8. No se introduces un patrón sin un problema concreto.
9. No se usa `any`.
10. Las transiciones de estado y la publicación del evento deben ser atómicas.
11. La notificación se entrega después del commit.
12. Cada cambio de contrato se cubre con pruebas de API y frontend.

---

## 7. Modelo de datos

### 7.1 Migración

Crear:

```text
db/migrations/0006_citas.up.sql
db/migrations/0006_citas.down.sql
```

DDL previsto:

```sql
CREATE TABLE empleados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  email text,
  telefono text,
  activo boolean NOT NULL DEFAULT true
);

CREATE TABLE citas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES clientes (id) ON DELETE RESTRICT,
  empleado_id uuid NOT NULL REFERENCES empleados (id) ON DELETE RESTRICT,
  inicio timestamptz NOT NULL,
  fin timestamptz NOT NULL,
  estado text NOT NULL DEFAULT 'Pendiente'
    CHECK (estado IN ('Pendiente', 'Confirmada', 'En Proceso', 'Completada', 'Cancelada')),
  motivo text,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  CHECK (fin > inicio)
);

CREATE INDEX citas_agenda_idx ON citas (empleado_id, inicio, fin);
CREATE INDEX citas_cliente_idx ON citas (cliente_id, inicio);
CREATE INDEX citas_estado_idx ON citas (estado, inicio);
```

Down:

```sql
DROP INDEX IF EXISTS citas_estado_idx;
DROP INDEX IF EXISTS citas_cliente_idx;
DROP INDEX IF EXISTS citas_agenda_idx;
DROP TABLE IF EXISTS citas;
DROP TABLE IF EXISTS empleados;
```

### 7.2 TypeScript

Agregar a `apps/api/src/shared/db/schema.ts`:

- `EmpleadosTable`
- `CitasTable`
- entradas `empleados` y `citas` en `Database`.

`CitasTable.estado` debe ser una unión estricta:

```ts
export type EstadoCitaPersistido =
  | 'Pendiente'
  | 'Confirmada'
  | 'En Proceso'
  | 'Completada'
  | 'Cancelada';
```

### 7.3 Integridad y solapamiento

Una cita bloquea el horario cuando su estado no es `Cancelada`.

La condición de solapamiento será:

```text
existente.inicio < nueva.fin
AND existente.fin > nueva.inicio
AND existente.estado != 'Cancelada'
```

Esto significa:

- `10:00–11:00` y `11:00–12:00` no se solapan.
- `10:00–11:00` y `10:59–12:00` sí se solapan.
- Una cita cancelada libera el horario.

Para concurrencia, la creación se hará así:

1. Abrir transacción.
2. Bloquear la fila del empleado con `SELECT ... FOR UPDATE`.
3. Verificar que el empleado existe y está activo.
4. Consultar solapamientos dentro de la misma transacción.
5. Insertar la cita.
6. Commit.

La serialización por empleado evita que dos transacciones validen el mismo horario antes de insertar.

### 7.4 Seed y orden de limpieza

Actualizar `apps/api/src/db/seed.ts` para insertar:

- 3 empleados activos.
- 2 citas de demo con fechas relativas al día actual.
- Una cita `Pendiente` y una `Confirmada`.

Orden de limpieza por dependencias:

1. `citas`
2. `empleados`
3. `facturas`
4. `pedido_items`
5. `pedidos`
6. `carrito_comandos`
7. `carrito_items`
8. `carritos`
9. `stock`
10. `productos`
11. `clientes`
12. `outbox_events`

El mismo orden debe aplicarse en las suites que limpien PostgreSQL.

---

## 8. Patrón State de Citas

### 8.1 Archivos

```text
apps/api/src/modules/citas/domain/
├── cita-estado.ts
├── cita.ts
└── states/
    ├── pendiente.state.ts
    ├── confirmada.state.ts
    ├── en-proceso.state.ts
    ├── completada.state.ts
    └── cancelada.state.ts
```

Todos comienzan con `// Patrón: State`.

### 8.2 Roles

- `CitaEstado`: clase abstracta, nombre y métodos con comportamiento inválido por defecto.
- Estados concretos: una responsabilidad y transición válida por clase.
- `Cita`: Context del patrón; mantiene `#estado` privado y delega las transiciones.
- `crearEstadoCita`: rehidrata el estado concreto desde una fila válida.

Para evitar ciclos innecesarios, `crearEstadoCita` puede vivir en `cita.ts` o en un archivo exclusivo de factory de estados.

### 8.3 Matriz de transiciones

| Estado actual | `confirmar()` | `iniciar()` | `completar()` | `cancelar()` |
|---|---|---|---|---|
| Pendiente | Confirmada | 409 | 409 | Cancelada |
| Confirmada | 409 | En Proceso | 409 | Cancelada |
| En Proceso | 409 | 409 | Completada | 409 |
| Completada | 409 | 409 | 409 | 409 |
| Cancelada | 409 | 409 | 409 | 409 |

Error:

```text
Transición de cita inválida: Cancelada → Completada
```

- Código: `TRANSICION_CITA_INVALIDA`.
- HTTP: `409`.
- La entidad conserva el estado anterior cuando la transición falla.

### 8.4 Invariantes de `Cita`

- `fin > inicio`.
- `clienteId` y `empleadoId` no vacíos.
- Estado desconocido rechazado.
- Fechas inválidas rechazadas.
- `toJSON()` devuelve fechas ISO.

### 8.5 Persistencia y concurrencia

`CitasRepository.actualizarEstado` debe usar control optimista:

```sql
UPDATE citas
SET estado = $nuevo, actualizado_en = now()
WHERE id = $id AND estado = $esperado
```

Si no se actualiza ninguna fila:

```text
CONFLICTO_ESTADO_CITA
HTTP 409
```

---

## 9. Módulos y APIs

### 9.1 Empleados

Archivos:

```text
apps/api/src/modules/empleados/
├── empleados.repository.ts
├── empleados.routes.ts
├── empleados.service.ts
└── empleados.types.ts
```

Endpoint:

```http
GET /api/empleados
```

Devuelve:

```json
[
  {
    "id": "uuid",
    "nombre": "Laura Pérez",
    "email": "laura@email.com",
    "telefono": "3001112233",
    "activo": true
  }
]
```

Los empleados se crean por seed en esta fase.

### 9.2 Puertos de Citas

Para no importar Clientes ni Empleados, `CitasService` recibe puertos definidos en:

```text
apps/api/src/modules/citas/ports.ts
```

Contratos mínimos:

```ts
export interface VerificadorClienteParaCita {
  existe(clienteId: string): Promise<boolean>;
}

export interface ConsultorEmpleadosParaCita {
  obtenerEmpleado(empleadoId: string): Promise<EmpleadoCita | null>;
}
```

`app.ts` los implementa usando `ClientesRepository` y `EmpleadosRepository`.

El read model de detalle puede usar joins de lectura en `CitasRepository`, como ya hace el proyecto en otros repositorios; la validación de existencia y las reglas de escritura deben usar los puertos.

### 9.3 Endpoints de Citas

```http
GET  /api/citas?desde=&hasta=&estado=
GET  /api/citas/:id
POST /api/citas
POST /api/citas/:id/confirmar
POST /api/citas/:id/iniciar
POST /api/citas/:id/completar
POST /api/citas/:id/cancelar
```

Creación:

```json
{
  "clienteId": "uuid",
  "empleadoId": "uuid",
  "inicio": "2026-11-25T15:00:00.000Z",
  "fin": "2026-11-25T16:00:00.000Z",
  "motivo": "Corte y color"
}
```

Respuesta:

```json
{
  "id": "uuid",
  "clienteId": "uuid",
  "clienteNombre": "Ana González",
  "empleadoId": "uuid",
  "empleadoNombre": "Laura Pérez",
  "inicio": "2026-11-25T15:00:00.000Z",
  "fin": "2026-11-25T16:00:00.000Z",
  "estado": "Pendiente",
  "motivo": "Corte y color"
}
```

Filtros:

- `desde` y `hasta`: ISO opcionales.
- `estado`: opcional, uno de los cinco estados.
- Si no se manda rango, se listan las citas disponibles ordenadas por inicio.
- El rango filtra por solapamiento: `cita.inicio < hasta` y `cita.fin > desde`.

### 9.4 Errores

| Código | HTTP | Cuándo |
|---|---:|---|
| `CITA_NO_ENCONTRADA` | 404 | ID inexistente. |
| `CLIENTE_NO_ENCONTRADO` | 404 | Cliente inexistente. |
| `EMPLEADO_NO_ENCONTRADO` | 404 | Empleado inexistente. |
| `EMPLEADO_INACTIVO` | 409 | No se agenda con un empleado inactivo. |
| `CITA_FECHAS_INVALIDAS` | 400 | Fechas inválidas o `fin <= inicio`. |
| `CITA_SOLAPADA` | 409 | Horario ocupado para el empleado. |
| `TRANSICION_CITA_INVALIDA` | 409 | Transición no permitida. |
| `CONFLICTO_ESTADO_CITA` | 409 | Cambio concurrente de estado. |

### 9.5 Actualización de Clientes

Agregar:

```http
PATCH /api/clientes/:id
```

Body permitido:

```json
{
  "canalPreferido": "whatsapp"
}
```

También se admiten actualizaciones parciales de:

```json
{
  "email": "nuevo@email.com",
  "telefono": "3000000000"
}
```

Reglas:

- Validación Zod.
- `canalPreferido` solo admite `email`, `sms` o `whatsapp`.
- `email` y `telefono` admiten string válido o `null` para eliminar el dato.
- El servicio primero verifica que el cliente exista.
- La respuesta usa el contrato camelCase actual: `canalPreferido`.

---

## 10. Eventos, Observer, Outbox y Unit of Work

### 10.1 Contrato canónico

Crear:

```text
apps/api/src/shared/events/event-map.ts
```

Contrato:

```ts
export type AppEventMap = {
  PedidoEmitido: {
    pedidoId: string;
    clienteId: string;
    total: number;
    emitidoEn: string;
  };
  PedidoPagado: {
    pedidoId: string;
    clienteId: string;
    total: number;
    pagadoEn: string;
    metodoPago: string;
    referenciaPago: string;
  };
  CitaConfirmada: {
    citaId: string;
    clienteId: string;
    empleadoId: string;
    inicio: string;
    fin: string;
    confirmadaEn: string;
  };
};
```

Aliases:

```ts
// modules/ventas/domain/eventos.ts
export type VentasEventMap = Pick<
  AppEventMap,
  'PedidoEmitido' | 'PedidoPagado'
>;

// modules/citas/domain/eventos.ts
export type CitasEventMap = Pick<AppEventMap, 'CitaConfirmada'>;
```

No se duplicarán payloads en varios archivos.

### 10.2 Composition root

En `app.ts`:

```ts
const eventBus = new InMemoryEventBus<AppEventMap>();
const unitOfWork = new UnitOfWork<AppEventMap>(db, eventBus);
```

Se actualizan:

- `VentasService`.
- `VentasRoutesOptions`.
- `PosCheckoutFacade`.
- Tests que actualmente usan `UnitOfWork<VentasEventMap>`.

### 10.3 Publicación de `CitaConfirmada`

`CitasService.confirmarCita(id)`:

1. Cargar la cita.
2. Guardar `estadoEsperado`.
3. Ejecutar `cita.confirmar()` en memoria.
4. Abrir `UnitOfWork<AppEventMap>`.
5. Actualizar la fila con `WHERE estado = estadoEsperado`.
6. Si no se actualizó, lanzar `CONFLICTO_ESTADO_CITA` sin publicar.
7. Publicar `CitaConfirmada` dentro de la transacción.
8. Commit.

El Outbox persiste el evento en la misma transacción. El bus en memoria lo entrega después del commit.

### 10.4 Suscriptor de Notificaciones

Crear:

```text
apps/api/src/modules/notificaciones/notificaciones.suscriptores.ts
```

```ts
export function registrarSuscriptoresNotificaciones(
  bus: EventSubscriber<AppEventMap>,
  service: NotificacionesService,
): () => void {
  const cancelarCita = bus.subscribe('CitaConfirmada', (evento) =>
    service.notificarCitaConfirmada(evento),
  );

  const cancelarPedido = bus.subscribe('PedidoPagado', (evento) =>
    service.notificarPedidoPagado(evento),
  );

  return () => {
    cancelarCita();
    cancelarPedido();
  };
}
```

El suscriptor se registra en `app.ts` antes de aceptar peticiones.

### 10.5 Regla de desacoplamiento

- `CitasService` no importa Notificaciones.
- `NotificacionesService` no importa Citas, Clientes ni Ventas.
- El adaptador de contactos se construye en `app.ts`.
- El contrato de eventos vive en `shared`.

### 10.6 Limitación real del Outbox

Debe documentarse que:

- El evento se persiste atómicamente con el cambio de negocio.
- La entrega actual es en memoria y ocurre después del commit.
- No existe worker que reintente eventos pendientes después de reiniciar.
- `procesado_en` no se actualiza en el flujo productivo actual.
- Las notificaciones son best-effort.

No se debe afirmar que el Outbox garantiza reintentos automáticos en esta fase.

---

## 11. Factory Method y Notificaciones

### 11.1 Estructura de archivos

```text
apps/api/src/modules/notificaciones/
├── notificacion.factory.ts
├── notificacion.types.ts
├── notificaciones.service.ts
├── notificaciones.suscriptores.ts
├── ports.ts
└── notificadores/
    ├── email.sender.ts
    ├── sms.sender.ts
    └── whatsapp.sender.ts
```

`notificacion.factory.ts` conserva el patrón definido en el proyecto:

- **Creator:** `NotificacionFactory`.
- **Product:** `Notificador`.
- **Products concretos:** `EmailSender`, `SmsSender`, `WhatsAppSender`.

### 11.2 Nota académica

La factory con `switch` es funcionalmente una **Simple Factory** en la clasificación GoF estricta. El proyecto la ha definido como Factory Method. Se conservará esta estructura para no contradecir `docs/plan.md` y `AGENTS.md`, pero la documentación dirá:

> “Factory Method según la definición adopted por Nexo-ERP: un creator central construye el producto concreto según el canal solicitado.”

Si la rúbrica académica exige Creator abstracto y Creators concretos, esa variante deberá aprobarse antes de implementar; no se construirán ambas versiones.

### 11.3 Canal compartido

Crear:

```text
apps/api/src/shared/types/canal-notificacion.ts
```

```ts
export const CANALES_NOTIFICACION = [
  'email',
  'sms',
  'whatsapp',
] as const;

export type CanalNotificacion =
  (typeof CANALES_NOTIFICACION)[number];

export function esCanalNotificacion(
  valor: unknown,
): valor is CanalNotificacion {
  return (
    typeof valor === 'string' &&
    CANALES_NOTIFICACION.includes(valor as CanalNotificacion)
  );
}

export function normalizarCanalNotificacion(
  valor: unknown,
): CanalNotificacion {
  return esCanalNotificacion(valor) ? valor : 'email';
}
```

Clientes y Notificaciones reutilizan este tipo.

### 11.4 Tipos de notificación

```ts
export interface MensajeNotificacion {
  destinatario: string;
  mensaje: string;
}

export interface Notificador {
  enviar(mensaje: MensajeNotificacion): Promise<void>;
}
```

### 11.5 Factory tipada

```ts
export class NotificacionFactory {
  constructor(
    private readonly salida: (linea: string) => void = console.log,
  ) {}

  crear(canal: CanalNotificacion): Notificador {
    switch (canal) {
      case 'email':
        return new EmailSender(this.salida);
      case 'sms':
        return new SmsSender(this.salida);
      case 'whatsapp':
        return new WhatsAppSender(this.salida);
    }
  }
}
```

El canal se valida antes de llegar a la factory. No se usarán casts para probar canales inválidos.

### 11.6 Senders

Cada sender:

- vive en su propio archivo;
- recibe la función `salida`;
- construye una línea determinista;
- devuelve `Promise<void>`.

Ejemplos:

```text
[Email][ana@email.com] Cita confirmada para el 25/11/2026 10:00.
[SMS][3001112233] Pago recibido por el pedido 123. Total: $200.
[WhatsApp][3014445566] Cita confirmada para el 25/11/2026 10:00.
```

### 11.7 Puerto de contactos

En `modules/notificaciones/ports.ts`:

```ts
export interface ContactoCliente {
  nombre: string;
  email?: string;
  telefono?: string;
  canalPreferido: CanalNotificacion;
}

export interface ConsultorContactos {
  obtenerContacto(clienteId: string): Promise<ContactoCliente | null>;
}
```

Implementación en `app.ts` con `ClientesRepository`.

### 11.8 Servicio de Notificaciones

`NotificacionesService` recibe:

- `NotificacionFactory`.
- `ConsultorContactos`.
- Un sumidero opcional de advertencias.

Flujo:

1. Resolver contacto por `clienteId`.
2. Si no existe, registrar advertencia y terminar.
3. Elegir destinatario:
   - `email` → `contacto.email`;
   - `sms` o `whatsapp` → `contacto.telefono`.
4. Si no existe destinatario, registrar advertencia y terminar.
5. `factory.crear(canal).enviar({ destinatario, mensaje })`.
6. No propagar el fallo al flujo que originó el evento.

No se cambia automáticamente a otro canal: se respeta la preferencia explícita.

### 11.9 Mensajes

- `CitaConfirmada`: confirmation de fecha, hora, motivo y empleado.
- `PedidoPagado`: pago recibido, total y referencia.

El mensaje debe ser testeable; no se depende de la zona horaria del servidor para construirlo. Se recibe o se formatea de manera determinista.

---

## 12. Frontend

### 12.1 Navegación

- Crear `apps/web/src/pages/Citas.tsx`.
- Agregar la ruta `/citas` en `App.tsx`.
- Activar el enlace Citas del sidebar.
- Corregir keys únicas del sidebar.

### 12.2 Página de agenda

Funciones:

- Header “Agenda de citas”.
- Filtro por fecha.
- Botón “Nueva cita”.
- Tabla con:
  - fecha y hora;
  - cliente;
  - empleado;
  - motivo;
  - estado;
  - acciones.
- Modal de creación con:
  - cliente;
  - empleado;
  - inicio;
  - fin;
  - motivo.
- Estados de carga y error.
- Controles deshabilitados mientras hay una operación en vuelo.

Acciones:

| Estado | Acciones |
|---|---|
| Pendiente | Confirmar, Cancelar |
| Confirmada | Iniciar, Cancelar |
| En Proceso | Completar |
| Completada | Ninguna |
| Cancelada | Ninguna |

### 12.3 Fechas y zona horaria

- La API recibe y devuelve ISO con offset o `Z`.
- PostgreSQL almacena `timestamptz`.
- El frontend muestra fechas con `America/Bogota`.
- `datetime-local` se convierte a ISO antes de enviarse.
- Para la demo se documentará que el navegador debe estar en la zona horaria esperada o que el valor representa la hora local del navegador.

### 12.4 Clientes

- Reemplazar el badge estático por un selector de canal preferido.
- Al cambiar, llamar `PATCH /api/clientes/:id`.
- Deshabilitar el selector mientras se guarda.
- Mostrar el error del backend.
- Actualizar el estado local sin recargar toda la página.
- Corregir el mapeo de `canalPreferido` de la API.

### 12.5 Tipos web

Agregar a `apps/web/src/types.ts`:

- `CanalNotificacion`.
- `Empleado`.
- `EstadoCita`.
- `Cita`.

`CanalPreferido` puede ser alias de `CanalNotificacion` o eliminarse en favor del tipo compartido dentro del frontend.

---

## 13. Pruebas y evidencia

### 13.1 Baseline

Antes de la Fase 5:

- `pnpm test` verde.
- `pnpm typecheck` verde.
- `pnpm lint` verde.
- Sin tests omitidos.
- Sin warnings de keys duplicadas.

### 13.2 State

Archivo:

```text
apps/api/src/modules/citas/domain/cita-estado.test.ts
```

Casos:

- Todas las transiciones legales.
- Todas las transiciones ilegales.
- El estado permanece intacto tras una transición inválida.
- Código `TRANSICION_CITA_INVALIDA`.
- `fin <= inicio` rechazado.
- Estado desconocido rechazado.
- Flujo `Pendiente → Confirmada → En Proceso → Completada`.
- `Cancelada → Completada` rechazado.

### 13.3 API de Citas

Archivo:

```text
apps/api/src/modules/citas/citas.routes.test.ts
```

Casos:

- Crear cita.
- Listar y filtrar agenda.
- Consultar por ID.
- Confirmar, iniciar, completar y cancelar.
- Rechazar transición ilegal con 409.
- Rechazar solapamiento con 409.
- Aceptar dos citas consecutivas sin solapamiento.
- Cancelar una cita y reutilizar su horario.
- Rechazar fechas inválidas con 400.
- Verificar `CitaConfirmada` en `outbox_events`.
- Verificar que una transición fallida no publica evento.
- Verificar cliente inexistente.
- Verificar empleado inexistente o inactivo.
- Dos creación simultáneas del mismo empleado y horario: una succeeds y otra recibe 409.

### 13.4 Factory y Notificaciones

Archivos:

```text
apps/api/src/modules/notificaciones/notificacion.factory.test.ts
apps/api/src/modules/notificaciones/notificaciones.service.test.ts
apps/api/src/modules/notificaciones/notificaciones.suscriptores.test.ts
```

Casos:

- Cada canal crea su sender correcto.
- Cada sender usa el destinatario correcto.
- La salida inyectada recibe la línea esperada.
- Cliente inexistente no rompe la confirmación.
- Canal preferido sin destinatario registra advertencia y omite envío.
- El canal inválido se normaliza en el límite de entrada de la API.
- Fallo del notificador no revierte la cita.

### 13.5 Integración Observer

Casos:

- Confirmar cita produce log `[Email]`.
- Cambiar el canal a WhatsApp y confirmar otra cita produce `[WhatsApp]`.
- El cambio no requiere modificar `CitasService`.
- `PedidoPagado` produce notificación de comprobante.
- El evento se entrega después del commit.
- El evento no se entrega si la transición hace rollback.

### 13.6 Clientes

Casos API:

- Actualizar solo el canal.
- Actualizar email y teléfono.
- Rechazar canal inválido.
- Cliente inexistente devuelve 404.
- El repositorio normaliza un valor persistido inválido sin cast inseguro.

Casos web:

- El canal mostrado refleja la respuesta `canalPreferido`.
- El selector dispara PATCH.
- Se muestra el error de una actualización fallida.

### 13.7 Frontend

Archivo:

```text
apps/web/src/pages/Citas.test.tsx
```

Casos:

- Renderiza agenda.
- Crea cita.
- Confirma, inicia, completa y cancela.
- Muestra errores del backend.
- Filtra por fecha.
- Cambia canal preferido en Clientes.

Actualizar `apps/web/src/App.test.tsx`:

- Navegación a `/citas`.
- Mock de `/api/empleados`.
- Mock de `/api/citas`.
- Mock de `PATCH /api/clientes/:id`.

### 13.8 Comandos de cierre

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Criterios:

- Sin `any`.
- Sin imports directos entre módulos.
- Sin tests omitidos.
- Sin warnings de React keys.
- Migraciones up/down correctas.
- Seed repetible.

---

## 14. Documentación y trazabilidad

### 14.1 Specs que deben crearse antes de implementar

```text
docs/citas.md
docs/notificaciones.md
```

Cada spec debe incluir:

- Objetivo.
- Entregables.
- Reglas de negocio.
- Matriz de transiciones.
- Contratos de API.
- Eventos publicados y consumidos.
- Archivos y roles del patrón.
- Pruebas de evidencia.
- Decisiones y limitaciones.

### 14.2 Documentos actualizados al cierre

- `docs/plan.md`: marcar Fase 5 solo cuando todos los criterios estén verdes.
- `docs/patrones.md`: se seguirá preparando la tabla, pero el documento final completo corresponde a Fase 9.
- `README.md`: corregir el comando de seed si sigue usando `--filter api` en vez de `@nexo/api` y actualizar el árbol de módulos.

### 14.3 Matriz de patrones para el documento final

| Patrón | Implementación prevista | Evidencia |
|---|---|---|
| State de Cita | `citas/domain/cita-estado.ts`, `states/*`, `cita.ts` | Tests del State y 409 en API. |
| Factory Method | `notificacion.factory.ts` + senders | Tests de canales y salida inyectada. |
| Observer | `event-bus.ts` + `notificaciones.suscriptores.ts` | Evento post-commit y test de integración. |
| Chain de Ventas | `cadena-validacion.ts` | Cliente/stock; caja explícitamente pendiente. |
| Facade | `pos-checkout.facade.ts` | Test del checkout. |
| Command | `pos/commands/*` | Tests de deshacer. |
| Strategy | `pricing/*`, `payments/*` | Tests de sustitución. |
| Builder | `factura.builder.ts` | Tests del Builder. |
| State de Pedido | `pedido-estado.ts`, `states/*` | Tests de transición. |
| Repository | `citas.repository.ts` | Persistencia y concurrencia. |
| Unit of Work | `unit-of-work.ts` | Commit/rollback de `CitaConfirmada`. |
| Outbox | `outbox.ts` | Evento persistido; worker todavía pendiente. |

---

## 15. Orden de implementación aprobado

Cada paso debe ser una rama o unidad revisable independiente.

### Paso 0 — Correcciones prerequisito

Rama sugerida:

```text
fix/phase5-baseline
```

- Vitest.
- Moneda web.
- Keys del sidebar.
- Contrato visual y normalización del canal.
- ESLint.

Gate: tests, typecheck y lint verdes.

### Paso 1 — Specs y contratos

Rama sugerida:

```text
docs/fase5-contracts
```

- `docs/citas.md`.
- `docs/notificaciones.md`.
- `shared/events/event-map.ts`.
- `shared/types/canal-notificacion.ts`.
- Alias de eventos de Ventas.
- Actualización mecánica de tipos genéricos.
- Typecheck verde.

### Paso 2 — Base de datos

Rama sugerida:

```text
feat/fase5-citas-migration
```

- Migración 0006 up/down.
- `schema.ts`.
- Seed.
- Limpiezas de tests.

### Paso 3 — Dominio State

Rama sugerida:

```text
feat/fase5-cita-state
```

- Estado base y error de transición.
- Cinco estados concretos.
- Entidad Cita.
- Tests unitarios.

### Paso 4 — API de Citas y Empleados

Rama sugerida:

```text
feat/fase5-citas-api
```

- Repositorios, puertos, servicios y rutas.
- Solapamiento transaccional.
- Control optimista.
- Tests de rutas y concurrencia.

### Paso 5 — Notificaciones

Rama sugerida:

```text
feat/fase5-notificaciones
```

- Tipos, factory y senders.
- Puerto de contactos.
- Servicio.
- Suscriptor.
- Integración en `app.ts`.
- Tests de canales y Observer.

### Paso 6 — Clientes

Rama sugerida:

```text
feat/fase5-cliente-canal
```

- PATCH parcial.
- Servicio/repositorio.
- Selector en frontend.
- Tests.

### Paso 7 — Frontend de Citas

Rama sugerida:

```text
feat/fase5-agenda-web
```

- Tipos.
- Ruta.
- Página.
- Modal y acciones.
- Formateo de fechas.
- Tests.

### Paso 8 — Cierre

Rama sugerida:

```text
chore/fase5-closure
```

- Suite completa.
- Build.
- Seed/migrations.
- Documentación y checklist.
- Revisión arquitectónica final.

---

## 16. Criterios de aceptación finales

### Dominio

- [ ] Una transición ilegal devuelve 409 y mensaje claro.
- [ ] El estado no cambia tras un intento ilegal.
- [ ] El flujo completo de cita funciona.
- [ ] No se puede agendar un empleado inactivo.
- [ ] La agenda rechaza solapamientos, también bajo concurrencia.
- [ ] Citas consecutivas son permitidas.
- [ ] Una cita cancelada libera el horario.

### Eventos y patrones

- [ ] Confirmar una cita persiste la transición y publica `CitaConfirmada` en el Outbox.
- [ ] El evento se entrega después del commit.
- [ ] Un rollback no entrega ni persiste el evento.
- [ ] `PedidoPagado` activa la notificación correspondiente.
- [ ] La Factory elige el canal sin modificar el evento.
- [ ] El State de Citas permanece separado del State de Pedido.
- [ ] No existen imports directos entre módulos de negocio.

### Notificaciones y clientes

- [ ] Cambiar `canalPreferido` cambia el canal de la siguiente notificación.
- [ ] La consulta de contacto ocurre al notificar, no al publicar el evento.
- [ ] Un canal sin destinatario omite el envío con advertencia.
- [ ] Un fallo de notificación no revierte la cita.
- [ ] El canal se valida sin casts inseguros.

### Frontend

- [ ] La agenda permite crear, confirmar, iniciar, completar y cancelar.
- [ ] Los filtros funcionan.
- [ ] El canal preferido puede editarse y actualiza la UI.
- [ ] Las fechas se muestran en `America/Bogota`.
- [ ] No hay keys duplicadas.

### Calidad

- [ ] `pnpm test` pasa.
- [ ] `pnpm typecheck` pasa.
- [ ] `pnpm lint` pasa.
- [ ] `pnpm build` pasa.
- [ ] No se usa `any`.
- [ ] No hay tests omitidos.
- [ ] Las specs y el checklist reflejan el estado real.

---

## 17. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Timeouts PGlite ocultan regresiones | Baseline verde antes de Citas y ajuste de configuración, no aumento ciego de timeout. |
| Dos reservas simultáneas pasan la validación | Lock de fila del empleado y revalidación en la misma transacción. |
| Fechas se interpretan con zonas incorrectas | `timestamptz`, ISO en API y `America/Bogota` en frontend. |
| El evento congela un canal antiguo | Publicar IDs y consultar la preferencia al enviar. |
| Un suscriptor rompe el caso de uso | Suscripción asíncrona, errores aislados y servicio best-effort. |
| `AppEventMap` se convierte en un dumping ground | Mantener payloads de integración en `shared/events/`; no mover lógica de dominio a shared. |
| Duplicación de tipos de canal | Tipo único compartido y normalizador central. |
| La Factory se presenta como GoF canónica | Documentar exactamente la terminología adoptada por el proyecto. |
| El Outbox parece garantiza reintentos | Documentar que no existe worker en esta fase. |
| La Fase 5 mezcla deuda de Fase 4 | Deuda registrada y ejecutada en ramas independientes. |
| El alcance crece hacia Caja/Nómina/Auth | Mantener la lista de exclusiones y revisar cada tarea contra esta spec. |

---

## 18. Inventario previsto de archivos

### Nuevos

```text
db/migrations/0006_citas.up.sql
db/migrations/0006_citas.down.sql

apps/api/src/shared/events/event-map.ts
apps/api/src/shared/types/canal-notificacion.ts

apps/api/src/modules/empleados/
├── empleados.repository.ts
├── empleados.routes.ts
├── empleados.service.ts
└── empleados.types.ts

apps/api/src/modules/citas/
├── citas.repository.ts
├── citas.routes.ts
├── citas.service.ts
├── citas.types.ts
├── ports.ts
└── domain/
    ├── cita-estado.ts
    ├── cita.ts
    └── states/
        ├── pendiente.state.ts
        ├── confirmada.state.ts
        ├── en-proceso.state.ts
        ├── completada.state.ts
        └── cancelada.state.ts

apps/api/src/modules/notificaciones/
├── notificacion.types.ts
├── notificaciones.service.ts
├── notificaciones.suscriptores.ts
├── ports.ts
└── notificadores/
    ├── email.sender.ts
    ├── sms.sender.ts
    └── whatsapp.sender.ts

apps/web/src/pages/Citas.tsx
apps/web/src/pages/Citas.test.tsx

docs/citas.md
docs/notificaciones.md
```

### Modificados

```text
apps/api/src/app.ts
apps/api/src/shared/db/schema.ts
apps/api/src/db/seed.ts
apps/api/vitest.config.ts

apps/api/src/modules/ventas/domain/eventos.ts
apps/api/src/modules/ventas/ventas.service.ts
apps/api/src/modules/ventas/ventas.routes.ts
apps/api/src/modules/ventas/pos/pos-checkout.facade.ts
apps/api/src/modules/ventas/pos/pos-checkout.facade.test.ts

apps/api/src/modules/clientes/clientes.repository.ts
apps/api/src/modules/clientes/clientes.service.ts
apps/api/src/modules/clientes/clientes.routes.ts
apps/api/src/modules/clientes/clientes.types.ts
apps/api/src/modules/clientes/clientes.routes.test.ts

apps/api/src/modules/fase2.routes.test.ts
apps/api/src/modules/ventas/pos/carrito.routes.test.ts

apps/api/src/modules/notificaciones/notificacion.factory.ts
apps/api/src/modules/notificaciones/notificacion.factory.test.ts

apps/web/src/App.tsx
apps/web/src/App.test.tsx
apps/web/src/components/Layout.tsx
apps/web/src/pages/Clientes.tsx
apps/web/src/types.ts

docs/plan.md
README.md
```

---

## 19. Gate de confirmación

No se ejecutará ninguna acción de este plan hasta que el usuario responda explícitamente.

Opciones de aprobación:

1. **Aprobar todo:** correcciones prerrequisito + Fase 5 completa.
2. **Aprobar correcciones solamente:** estabiliza el baseline sin iniciar Citas.
3. **Aprobar Fase 5:** asume que las correcciones prerrequisito se harán primero como paso interno del plan.
4. **Solicitar ajustes:** se modifica únicamente `planfase5final.md` antes de tocar código.

Al recibir la aprobación se informará la rama/commit inicial y se ejecutará un paso por vez, sin mezclar correcciones de Fase 4 con la implementación de Citas.

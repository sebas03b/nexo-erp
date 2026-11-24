# Especificación: Citas (Fase 5)

## Objetivo

Persistir una agenda de citas y controlar sus transiciones mediante el patrón **State**, sin acoplar el módulo de Citas a Clientes, Empleados o Notificaciones.

## Entregables

- Tablas mínimas `empleados` y `citas`.
- Entidad `Cita` y cinco estados concretos.
- Repositorio, servicio, puertos y rutas de Citas.
- Catálogo de empleados.
- Evento `CitaConfirmada` publicado dentro del Unit of Work.
- Pantalla web de agenda y creación de citas.
- Pruebas unitarias, de integración y de concurrencia.

## Reglas de negocio

1. Toda cita se crea inicialmente en estado `Pendiente`.
2. Los identificadores de cliente y empleado son obligatorios y no pueden estar vacíos.
3. `fin` debe ser posterior a `inicio`; ambas fechas deben ser válidas.
4. No se puede agendar con un empleado inexistente o inactivo.
5. Un empleado no puede tener dos citas solapadas.
6. Los horarios se interpretan como intervalos semiabiertos `[inicio, fin)`:
   - `10:00–11:00` y `11:00–12:00` son válidos.
   - `10:00–11:00` y `10:59–12:00` se solapan.
7. Una cita `Cancelada` no bloquea el horario.
8. Las transiciones de estado y la publicación de `CitaConfirmada` son atómicas.
9. Una transición fallida conserva el estado persistido y no publica eventos.

## Matriz de transiciones

| Estado actual | `confirmar()` | `iniciar()` | `completar()` | `cancelar()` |
|---|---|---|---|---|
| Pendiente | Confirmada | 409 | 409 | Cancelada |
| Confirmada | 409 | En Proceso | 409 | Cancelada |
| En Proceso | 409 | 409 | Completada | 409 |
| Completada | 409 | 409 | 409 | 409 |
| Cancelada | 409 | 409 | 409 | 409 |

Una transición ilegal produce el código `TRANSICION_CITA_INVALIDA`, HTTP `409`, con un mensaje como `Transición de cita inválida: Cancelada → Completada`.

## Persistencia y concurrencia

La creación de una cita se realiza en una única transacción:

1. Bloquear la fila del empleado con `SELECT ... FOR UPDATE`.
2. Verificar que el empleado existe y está activo.
3. Bloquear el cliente con `SELECT ... FOR KEY SHARE` y verificar que existe.
4. Consultar solapamientos dentro de la misma transacción.
5. Insertar la cita.
6. Confirmar la transacción.

El bloqueo de la fila del empleado serializa reservas concurrentes del mismo recurso. La condición de solapamiento excluye citas `Cancelada`.

La actualización de estado usa control optimista:

```sql
UPDATE citas
SET estado = $nuevo, actualizado_en = now()
WHERE id = $id AND estado = $esperado
```

Si no se actualiza una fila, la API responde `CONFLICTO_ESTADO_CITA`, HTTP `409`.

## Contratos de API

### Empleados

```http
GET /api/empleados
```

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

Los empleados se crean por seed durante esta fase.

### Citas

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

Las fechas de creación, detalle y filtros usan ISO estricto con offset (`Z` u offset numérico). `z.iso.datetime({ offset: true })` rechaza valores locales sin zona horaria. Los filtros `desde` y `hasta` son opcionales y seleccionan citas por solapamiento. `estado` admite `Pendiente`, `Confirmada`, `En Proceso`, `Completada` o `Cancelada`.

### Errores

| Código | HTTP | Condición |
|---|---:|---|
| `CITA_NO_ENCONTRADA` | 404 | La cita no existe. |
| `CLIENTE_NO_ENCONTRADO` | 404 | El cliente no existe. |
| `EMPLEADO_NO_ENCONTRADO` | 404 | El empleado no existe. |
| `EMPLEADO_INACTIVO` | 409 | El empleado está inactivo. |
| `CITA_FECHAS_INVALIDAS` | 400 | Fechas inválidas o `fin <= inicio`. |
| `CITA_SOLAPADA` | 409 | El horario está ocupado. |
| `TRANSICION_CITA_INVALIDA` | 409 | La transición no está permitida. |
| `CONFLICTO_ESTADO_CITA` | 409 | Otra operación cambió el estado primero. |

## Eventos

Citas publica `CitaConfirmada` dentro de la misma transacción que persiste la transición. La forma canónica del payload es `AppEventMap['CitaConfirmada']`, definida únicamente en `apps/api/src/shared/events/event-map.ts`:

```ts
// Payload ilustrativo; no se redeclara en el módulo de Citas.
type CitaConfirmada = {
  citaId: string;
  clienteId: string;
  empleadoId: string;
  empleadoNombre: string;
  motivo: string | null;
  inicio: string;
  fin: string;
  confirmadaEn: string;
};
```

El evento transporta identificadores y datos de agenda, no canal ni datos de contacto. `empleadoNombre` y `motivo` permiten que el mensaje de confirmación sea autosuficiente sin consultar el módulo de Citas desde Notificaciones. El Outbox lo persiste atómicamente y el bus en memoria lo entrega después del commit.

## Arquitectura y patrón State

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

Todos los archivos del dominio de estados comienzan con `// Patrón: State`.

- `CitaEstado` define el comportamiento común y el rechazo de transiciones inválidas.
- Cada estado concreto implementa únicamente las transiciones permitidas desde su estado.
- `Cita` es el Context: conserva el estado privado y delega las transiciones.
- `crearEstadoCita` rehidrata un estado válido desde persistencia.

`CitasService` depende de puertos para validar clientes y empleados. `app.ts` es el composition root y conecta esos puertos con sus repositorios. Citas no importa Clientes, Empleados ni Notificaciones.

## Frontend de Citas

La página `apps/web/src/pages/Citas.tsx` ofrece:

- Agenda ordenada por hora, filtro diario y estados de carga, vacío y error.
- Modal de creación con cliente, empleado activo, inicio, fin y motivo.
- Acciones derivadas exclusivamente del estado de cada cita.
- Bloqueo de controles mientras hay una creación o transición en vuelo.

Las fechas se interpretan de forma explícita en `America/Bogota`: el valor de `datetime-local` se convierte a ISO antes de enviarse y el filtro diario construye el intervalo `[00:00, 00:00 del día siguiente)` en esa zona. La API conserva instantes en `timestamptz`.

Los catálogos de clientes y empleados se solicitan de forma independiente. Si uno falla, se muestra el error y se ofrece reintento sin invalidar el otro catálogo. El modal gestiona foco inicial, contención de `Tab`, cierre con `Escape` y restauración del foco al botón «Nueva cita».

Ante `CONFLICTO_ESTADO_CITA`, la UI consulta `GET /api/citas/:id` y reconcilia el estado visible. Si la consulta tampoco es posible, retira la cita obsoleta de la lista y conserva el mensaje de error.

## Evidencia de pruebas

- Todas las transiciones legales e ilegales del State.
- Persistencia del estado tras una transición ilegal.
- Fechas inválidas, ISO sin offset y estado desconocido.
- Creación, consulta, listado y filtros de la API.
- Solapamiento, citas consecutivas y reutilización de horario cancelado.
- Empleado inexistente e inactivo.
- Persistencia de `CitaConfirmada` en `outbox_events` y ausencia del evento ante rollback.
- Dos solicitudes concurrentes por el mismo empleado y horario: una responde `201` y otra `409 CITA_SOLAPADA`.
- Dos confirmaciones concurrentes: una responde `200`, otra `409 CONFLICTO_ESTADO_CITA` y se publica un solo evento.
- En una verificación adicional contra PostgreSQL real, ocho solicitudes `POST /api/citas` simultáneas para el mismo empleado y horario produjeron exactamente un `201` y siete `409 CITA_SOLAPADA`.
- Flujo web completo: render, creación, filtro diario, transiciones, errores, reconciliación de conflictos, reintento de catálogos, gestión de foco y controles deshabilitados durante operaciones.

## Decisiones y limitaciones

- La concurrencia se serializa por empleado, no por toda la agenda.
- La especificación no reprograma citas ni permite cancelar una cita `En Proceso`.
- La agenda web usa `America/Bogota` para mostrar fechas; la API persiste `timestamptz` y exige ISO con offset.
- `TRANSICION_CITA_INVALIDA` indica que el estado cargado no admite la transición; `CONFLICTO_ESTADO_CITA` indica que otra operación cambió el estado antes del update optimista.
- La lectura de detalle puede unir Clientes y Empleados en el repositorio; las reglas de escritura usan puertos.
- La agenda es una vista operativa, no un calendario gráfico ni una herramienta de reprogramación.

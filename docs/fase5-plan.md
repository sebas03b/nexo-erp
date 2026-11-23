Fase 5 — Plan de implementación detallado
0. Decisiones bloqueadas
Decisión	Valor elegido
Nombre del evento de venta	Se mantiene PedidoPagado; se documenta como equivalente a OrdenPagada del plan.
Mapa de eventos	AppEventMap = VentasEventMap & CitasEventMap en shared/events.
Empleado de la cita	empleado_id text opcional, sin FK (Nómina es Fase 7).
Frontend	Sí se incluye en esta fase (ruta /citas, página, hook, enlace del sidebar).
Patrón State	Igual forma que pedidos: clase abstracta + estados concretos + DomainError 409.
Disparo de notificaciones	Dentro del UoW se guarda en outbox; el envío real ocurre después del commit vía EventSubscriber.
1. T1 — Migración y esquema
Rama: feat/fase5-citas-migracion
db/migrations/0006_citas.up.sql
CREATE TABLE citas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES clientes (id) ON DELETE RESTRICT,
  empleado_id text,
  inicio timestamptz NOT NULL,
  fin timestamptz NOT NULL,
  estado text NOT NULL DEFAULT 'Pendiente'
    CHECK (estado IN ('Pendiente','Confirmada','En Proceso','Completada','Cancelada')),
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT citas_rango_valido CHECK (fin > inicio)
);

CREATE INDEX citas_inicio_idx ON citas (inicio);
CREATE INDEX citas_empleado_rango_idx ON citas (empleado_id, inicio, fin);
db/migrations/0006_citas.down.sql
DROP TABLE citas;
apps/api/src/shared/db/schema.ts
Agregar:
export interface CitasTable {
  id: Generated<string>;
  cliente_id: string;
  empleado_id: string | null;
  inicio: Generated<Date> | Date;   // se inserta siempre desde la API
  fin: Date;
  estado: 'Pendiente' | 'Confirmada' | 'En Proceso' | 'Completada' | 'Cancelada';
  notas: string | null;
  created_at: Generated<Date>;
}
y citas: CitasTable en Database.
Detalle crítico para tests: en fase2.routes.test.ts y carrito.routes.test.ts hay que agregar await db.deleteFrom('citas').execute() antes de borrar clientes ( FK ON DELETE RESTRICT).
2. T2 — Dominio State de citas
Rama: feat/fase5-state-citas
modules/citas/domain/cita-estado.ts
// Patrón: State
export const ESTADOS_CITA = ['Pendiente','Confirmada','En Proceso','Completada','Cancelada'] as const;
export type EstadoCita = (typeof ESTADOS_CITA)[number];

export class TransicionCitaInvalida extends DomainError {
  constructor(actual: EstadoCita, intento: EstadoCita) {
    super(`Transición de cita inválida: ${actual} → ${intento}`, {
      code: 'TRANSICION_INVALIDA', statusCode: 409,
    });
  }
}

export abstract class CitaEstado {
  abstract readonly nombre: EstadoCita;
  confirmar(): CitaEstado { throw new TransicionCitaInvalida(this.nombre, 'Confirmada'); }
  iniciar(): CitaEstado   { throw new TransicionCitaInvalida(this.nombre, 'En Proceso'); }
  completar(): CitaEstado { throw new TransicionCitaInvalida(this.nombre, 'Completada'); }
  cancelar(): CitaEstado  { throw new TransicionCitaInvalida(this.nombre, 'Cancelada'); }
}
Matriz de transiciones (archivos states/*.state.ts, todos con // Patrón: State)
Estado actual	confirmar	iniciar	completar	cancelar
Pendiente	→ Confirmada	✗	✗	→ Cancelada
Confirmada	✗	→ En Proceso	✗	→ Cancelada
En Proceso	✗	✗	→ Completada	→ Cancelada
Completada	✗	✗	✗	✗
Cancelada	✗	✗	✗	✗
modules/citas/domain/cita.ts
Entidad con #estado: CitaEstado, getters (id, clienteId, empleadoId, inicio, fin, estado, notas) y métodos confirmar(), iniciar(), completar(), cancelar() que solo asignan this.#estado = this.#estado.confirmar() etc. Método estático Cita.crear(datos) que arranca en new PendienteState().
cita-estado.test.ts
- Cadena completa Pendiente → Confirmada → En Proceso → Completada.
- Cancelación desde Pendiente, Confirmada y En Proceso.
- Rechazos: Cancelada → Completada, Completada → Confirmada, Pendiente → Completada, En Proceso → Confirmada, Cancelada → Cancelada.
- Aserción de mensaje exacto y statusCode === 409.
3. T3 — Eventos y mapa global
Rama: feat/fase5-eventos-citas
modules/citas/domain/eventos.ts
export type CitasEventMap = {
  CitaConfirmada: {
    citaId: string;
    clienteId: string;
    inicio: string;   // ISO
    fin: string;      // ISO
    confirmadaEn: string;
  };
};
shared/events/app-event-map.ts
import type { CitasEventMap } from '../../modules/citas/domain/eventos.js';
import type { VentasEventMap } from '../../modules/ventas/domain/eventos.js';

export type AppEventMap = VentasEventMap & CitasEventMap;
(Solo import type: cero acoplamiento en runtime.)
Cambios mecánicos de tipo
- app.ts: new InMemoryEventBus<AppEventMap>(), new UnitOfWork<AppEventMap>(...).
- pos-checkout.facade.ts: UnitOfWork<AppEventMap> en constructor.
- ventas.routes.ts: UnitOfWork<AppEventMap> en RoutesOptions.
- Comentario en app.ts: // PedidoPagado = OrdenPagada del plan de fases.
4. T4 — Repositorio y servicio de citas
Rama: feat/fase5-citas-api
modules/citas/domain/ports.ts
export interface ObtenerClienteParaCita {
  obtener(id: string): Promise<{ id: string; nombre: string; canalPreferido: 'email'|'sms'|'whatsapp' } | null>;
}
(En app.ts se implementa con ClientesRepository.obtenerCliente; Citas no importa Clientes.)
modules/citas/citas.repository.ts
Métodos:
- crear(db, cita): Promise<Cita> — insert y mapCita(row).
- obtener(db, id): Promise<Cita | undefined>.
- listar(db, desde?, hasta?): Promise<Cita[]> — orderBy('inicio').
- actualizarEstado(db, id, esperado, nuevo): Promise<boolean> — update con where('estado','=',esperado), returning boolean (compare-and-set).
- existeSolapamiento(db, inicio, fin, empleadoId?): Promise<boolean>:
.where((eb) => eb.and(
  eb('inicio', '<', fin),
  eb('fin', '>', inicio),
  eb('estado', '!=', 'Cancelada'),
  empleadoId ? eb('empleado_id', '=', empleadoId) : eb('empleado_id', 'is', null),
))
- eliminar no se expone (no aplica en agenda).
modules/citas/citas.service.ts
export type AccionCita = 'confirmar'|'iniciar'|'completar'|'cancelar';

export class CitasService {
  constructor(private readonly repo: CitasRepository, private readonly uow: UnitOfWork<AppEventMap>) {}

  crear(data: CrearCitaData): Promise<Cita>       // valida rango + solapamiento ANTES del uow
  listar(desde?, hasta?): Promise<Cita[]>
  obtener(id): Promise<Cita>

  cambiarEstado(id: string, accion: AccionCita): Promise<Cita> {
    return this.uow.execute(async (ctx) => {
      const cita = await this.repo.obtener(ctx.db, id)
        ?? throw new RecursoNoEncontrado('CITA_NO_ENCONTRADA', 'Cita no encontrada');
      const anterior = cita.estado;
      cita[accion](); // TransicionCitaInvalida si no procede
      const ok = await this.repo.actualizarEstado(ctx.db, id, anterior, cita.estado);
      if (!ok) throw new DomainError('La cita cambió de estado', { code:'CONFLICTO_ESTADO_CITA', statusCode:409 });
      if (accion === 'confirmar') {
        await ctx.publish('CitaConfirmada', {
          citaId: cita.id, clienteId: cita.clienteId,
          inicio: cita.inicio.toISOString(), fin: cita.fin.toISOString(),
          confirmadaEn: new Date().toISOString(),
        });
      }
      return cita;
    });
  }
}
Errores de negocio:
- HORARIO_OCUPADO → 409, mensaje El horario seleccionado ya está ocupado.
- RANGO_INVALIDO → 400, mensaje La fecha de fin debe ser posterior a la de inicio.
5. T5 — Rutas REST y pruebas de integración
Rama: feat/fase5-citas-api (mismo commit o uno hijo)
modules/citas/citas.routes.ts con Zod
Método	Ruta	Body / Params	Respuesta
POST	/api/citas	{ clienteId: uuid, inicio: datetime con offset, fin: datetime con offset, empleadoId?: string, notas?: string } + .refine(fin > inicio)	201 Cita
GET	/api/citas	query desde?, hasta? (datetime)	200 Cita[]
GET	/api/citas/:id	id: uuid	200 / 404
PATCH	/api/citas/:id/estado	{ accion: enum de AccionCita }	200 / 409
app.ts registra await app.register(citasRoutes, { service: citasService }) (necesita uow ya creado).
modules/citas/citas.routes.test.ts (PGlite, mismo patrón que fase2.routes.test.ts)
Casos:
 1. Crear cita válida → 201, estado Pendiente.
 2. fin <= inicio → 400 RANGO_INVALIDO.
 3. Cliente inexistente → 404/400 según FK (definir 404 CLIENTE_NO_ENCONTRADO validando antes del insert).
 4. Solapamiento mismo empleado → 409 HORARIO_OCUPADO.
 5. Solape distinto empleado → 201.
 6. confirmar → 200, estado Confirmada, y una fila en outbox_events con tipo='CitaConfirmada'.
 7. iniciar → En Proceso, sin nueva fila en outbox.
 8. completar → Completada.
 9. cancelar desde Pendiente → Cancelada.
10. completar desde Cancelada → 409 con TRANSICION_INVALIDA y mensaje Transición de cita inválida: Cancelada → Completada.
11. Crear cita con empleado null y solape otra sin empleado → 409.
6. T6 — Notificaciones reactivas
Rama: feat/fase5-notificaciones-observer
notificacion.factory.ts (ajuste)
- Cambiar crear(canal: string) por crear(canal: CanalPreferido) (importa tipo desde clientes/clientes.types.ts — Clientes ya es un tipo compartido de dominio; si se quiere cero acoplamiento, mover CanalPreferido a shared/). Mantener EmailSender, SmsSender, WhatsAppSender y su prueba actual.
modules/notificaciones/servicio-notificaciones.ts
export interface Destinatario { nombre: string; canalPreferido: CanalPreferido }

export class ServicioNotificaciones {
  constructor(
    private readonly factory: NotificacionFactory,
    private readonly obtenerDestinatario: (id: string) => Promise<Destinatario | null>,
  ) {}

  async notificarCliente(clienteId: string, mensaje: string): Promise<void> {
    const dest = await this.obtenerDestinatario(clienteId);
    if (!dest) return;
    this.factory.crear(dest.canalPreferido)
      .enviar(`Hola ${dest.nombre}: ${mensaje}`);
  }
}
modules/notificaciones/suscripciones.ts
// Patrón: Observer
export function registrarSuscripcionesNotificaciones(
  bus: EventSubscriber<AppEventMap>,
  servicio: ServicioNotificaciones,
): void {
  bus.subscribe('CitaConfirmada', ({ citaId, clienteId, inicio }) =>
    servicio.notificarCliente(clienteId,
      `Su cita ${citaId} ha sido confirmada para ${inicio}.`));

  bus.subscribe('PedidoPagado', ({ pedidoId, clienteId, total }) =>
    servicio.notificarCliente(clienteId,
      `Comprobante de pago: pedido ${pedidoId}, total ${total}.`));
}
app.ts (composición)
const clientesRepo = new ClientesRepository(db);
const notificaciones = new ServicioNotificaciones(
  new NotificacionFactory(),
  async (id) => {
    const c = await clientesRepo.obtenerCliente(id);
    return c ? { nombre: c.nombre, canalPreferido: c.canalPreferido } : null;
  },
);
registrarSuscripcionesNotificaciones(eventBus, notificaciones);
Se registra antes de los app.register(...) de rutas.
suscripciones.test.ts
- Publicar CitaConfirmada con cliente email → console.log contiene [Email] y el mensaje de cita.
- Cambiar canal_preferido del cliente a whatsapp en DB y republicar → [WhatsApp], sin tocar el suscriptor.
- Publicar PedidoPagado → [SMS] (u otro) con el texto de comprobante.
- Cliente inexistente → no envía, no lanza.
- Un handler que lanza no impide el otro (usa InMemoryEventBus directo).
7. T7 — Frontend de agenda
Rama: feat/fase5-web-citas
Archivos
Archivo	Cambio
apps/web/src/types.ts	export interface Cita { id; clienteId; clienteNombre?; empleadoId?: string; inicio: string; fin: string; estado: 'Pendiente'|...; notas?: string }
apps/web/src/hooks/useCitas.ts	listar, crear, cambiarEstado(id, accion), error, cargando. Lee clientes con GET /api/clientes para el <select>.
apps/web/src/pages/Citas.tsx	Formulario: cliente, datetime-local inicio/fin, empleado (opcional), notas; tabla con estado y botones Confirmar, Iniciar, Completar, Cancelar. Convierte fechas con new Date(local).toISOString(). Muestra error.error.message del backend.
apps/web/src/App.tsx	<Route path="/citas" element={<Citas />} />.
apps/web/src/components/Layout.tsx	Enlace "Citas": to: '/citas' (ya tiene el icono BiCalendar).
apps/web/src/pages/Citas.test.tsx	Render con MemoryRouter, fetch mockeado: crea cita, confirma, intenta completar desde Cancelada y verifica que se muestra Transición de cita inválida.
8. T8 — Verificación y cierre
Rama: chore/fase5-verificacion
pnpm test
pnpm typecheck        # alias de tsc --noEmit
pnpm lint
Checklist de revisión (plantilla de docs/plan.md §5.4):
- Todo archivo de patrón empieza con // Patrón: X.
- No hay any.
- citas no importa ventas ni clientes; notificaciones no importa citas ni ventas.
- app.ts es el único que conoce todos los módulos.
- Outbox: evento de cita se escribe en la misma transacción; envío ocurre post-commit.
- Pruebas cubren casos de error (409/400/404).
- Marcar - [x] Fase 5 en docs/plan.md solo si autorizas editar ese archivo.
9. Orden de ejecución y commits
1. T1 → commit feat(citas): migración y esquema de citas
2. T2 → commit feat(citas): patrón State con transiciones validadas
3. T3 → commit feat(eventos): mapa global AppEventMap
4. T4+T5 → commit feat(citas): repositorio, servicio y endpoints REST
5. T6 → commit feat(notificaciones): suscripción Observer con Factory Method
6. T7 → commit feat(web): agenda de citas
7. T8 → commit chore: verificación fase 5
Cada rama se mergea a main solo con tests + typecheck en verde y revisión cruzada de freebuff, según AGENTS.md.
10. Riesgos concretos
- Kysely eb.and(...) con条件 dinámico: si da problemas de tipos, usar eb.where(...) encadenado condicionalmente; el test de solapamiento lo detecta enseguida.
- FK de clientes en tests: agregar el deleteFrom('citas') en el beforeEach es obligatorio o fallarán los tests existentes.
- canal_preferido nullable en BD: el repositorio ya lo mapea a 'email' por defecto, pero el nuevo test debe crear clientes con preferencia explícita para no depender del default.
- Fechas datetime-local: sin conversión a ISO con offset, Zod datetime({ offset: true }) rechazará el payload; el hook hace la conversión.
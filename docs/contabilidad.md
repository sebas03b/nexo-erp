# Fase 6 — Especificación de Contabilidad e integración externa

Patrones: **Observer** (suscriptor de eventos) y **Adapter** (facturación electrónica simulada).
Opcionales del plan: Template Method (reportes) y Composite (plan de cuentas) — **NO se implementan en esta fase**.

---

## 0. Decisiones bloqueadas

| Decisión | Valor elegido |
| :--- | :--- |
| Evento que dispara el asiento | `PedidoPagado` (ya existe en `VentasEventMap`); se **extiende su payload** con los ítems vendidos para que Contabilidad conozca productos/servicios sin importar Ventas |
| Desacoplamiento Ventas ↔ Contabilidad | Contabilidad se suscribe por `EventSubscriber<AppEventMap>`; **jamás importa `modules/ventas`** |
| Caja (apertura / cierre) | Vive en **Ventas/POS** (proceso operativo del punto de venta). Contabilidad solo lee cajas cerradas para reportes |
| `asientos.origen_id` | `uuid` sin FK a `pedidos`: evita acoplar el esquema de Contabilidad al de Ventas |
| Idempotencia | `UNIQUE (origen_id, cuenta)` + `ON CONFLICT DO NOTHING`: si el evento se re-entrega, no se duplican asientos |
| Plan de cuentas | Constantes tipadas (`CUENTA_CAJA`, `CUENTA_INGRESOS_VENTAS`); Composite queda para Fase 9 |
| Frontend | Página `/contabilidad` estilo dashboard con filtros, tarjetas de resumen, tabla de asientos y reporte de ventas |
| Reporte de ventas | Filtro `desde`/`hasta`, agrupación `dia` \| `mes` \| `anio` \| `medio_pago`, y desglose de productos/servicios vendidos |
| Lecturas dentro del UoW | Todo repositorio de Contabilidad recibe el `executor` (ctx.db); lección de Fase 5: con PGlite, consultar la conexión base dentro de una transacción abierta bloquea |
| Adapter de facturación | Se inyecta en `PosCheckoutFacade` y se llama **fuera del UoW** (best-effort post-commit). Una falla del adapter **no revierte** la venta |
| Autenticación y roles | **Fase 8**. En Fase 6, `usuario_id` es texto libre sin FK; se documenta como placeholder |

---

## 1. Extensión del evento `PedidoPagado`

Para que Contabilidad pueda mostrar qué productos o servicios se vendieron sin importar Ventas, el payload de `PedidoPagado` en `shared/events/event-map.ts` se extiende con `items`:

```ts
PedidoPagado: {
  pedidoId: string;
  clienteId: string;
  total: number;
  pagadoEn: string;
  metodoPago: string;
  referenciaPago: string;
  items: Array<{
    productoId: string;
    nombre: string;
    tipo: 'producto' | 'servicio';
    cantidad: number;
    precioUnitario: number;
    subtotal: number;
  }>;
};
```

Ventas es responsable de poblar `items` al publicar el evento. Contabilidad solo lo consume.

---

## 2. T1 — Migración y esquema

Rama: `feat/fase6-ventas-caja` (Ventas) + `feat/fase6-contabilidad-asientos` (Contabilidad)

### 2.1 Ventas — tabla `cajas`

```sql
-- db/migrations/0007_cajas.up.sql (o siguiente número disponible)
CREATE TABLE cajas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id text NOT NULL,
  apertura timestamptz NOT NULL DEFAULT now(),
  cierre timestamptz,
  monto_inicial numeric(12, 2) NOT NULL CHECK (monto_inicial >= 0),
  monto_final numeric(12, 2) CHECK (monto_final IS NULL OR monto_final >= 0),
  CONSTRAINT cajas_cierre_requiere_monto CHECK (
    (cierre IS NULL AND monto_final IS NULL) OR (cierre IS NOT NULL AND monto_final IS NOT NULL)
  )
);

-- Una sola caja abierta por usuario a la vez.
CREATE UNIQUE INDEX cajas_abierta_por_usuario_idx
  ON cajas (usuario_id) WHERE cierre IS NULL;
```

```sql
-- db/migrations/0007_cajas.down.sql
DROP INDEX IF EXISTS cajas_abierta_por_usuario_idx;
DROP TABLE IF EXISTS cajas;
```

### 2.2 Contabilidad — tabla `asientos`

```sql
-- db/migrations/0008_contabilidad.up.sql
CREATE TABLE asientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha timestamptz NOT NULL DEFAULT now(),
  cuenta text NOT NULL,
  debito numeric(12, 2) NOT NULL DEFAULT 0 CHECK (debito >= 0),
  credito numeric(12, 2) NOT NULL DEFAULT 0 CHECK (credito >= 0),
  origen_id uuid NOT NULL,
  metodo_pago text,
  descripcion text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT asientos_partida_doble CHECK ((debito = 0) <> (credito = 0))
);

-- Idempotencia: un pedido genera exactamente un asiento por cuenta.
CREATE UNIQUE INDEX asientos_origen_cuenta_idx ON asientos (origen_id, cuenta);
CREATE INDEX asientos_fecha_idx ON asientos (fecha);
```

```sql
-- db/migrations/0008_contabilidad.down.sql
DROP INDEX IF EXISTS asientos_origen_cuenta_idx;
DROP INDEX IF EXISTS asientos_fecha_idx;
DROP TABLE IF EXISTS asientos;
```

### 2.3 Esquema Kysely

`apps/api/src/shared/db/schema.ts` — agregar `CajasTable` (en Ventas, si aplica) y `AsientosTable` (en Contabilidad), registradas en `Database`. Numéricos como `NumericColumn`.

**Orden de borrado en tests:** `asientos`, `cajas`, `outbox_events`, y después `pedidos`, `clientes`, etc.

---

## 3. T2 — Dominio y repositorio (Contabilidad)

Rama: `feat/fase6-contabilidad-asientos`

### 3.1 Cuentas

`modules/contabilidad/domain/cuentas.ts`

```ts
export const CUENTA_CAJA = 'CAJA' as const;
export const CUENTA_INGRESOS_VENTAS = 'INGRESOS_VENTAS' as const;
export type Cuenta = typeof CUENTA_CAJA | typeof CUENTA_INGRESOS_VENTAS;
```

### 3.2 Producto/Servicio vendido

`modules/contabilidad/domain/producto-vendido.ts`

```ts
export interface ProductoVendido {
  productoId: string;
  nombre: string;
  tipo: 'producto' | 'servicio';
  cantidad: number;
  total: number;
}
```

### 3.3 Partida doble

`modules/contabilidad/domain/asiento.ts`

- Tipo `MovimientoContable { cuenta: Cuenta; debito: number; credito: number }`.
- Función pura `construirAsientoVenta(pedidoId, total, metodoPago, fecha): MovimientoContable[]` que devuelve:
  - `{ cuenta: CUENTA_CAJA, debito: total, credito: 0 }`
  - `{ cuenta: CUENTA_INGRESOS_VENTAS, debito: 0, credito: total }`
- Prueba pura de Vitest: suma de débitos === suma de créditos === total.

### 3.4 Repositorio

`modules/contabilidad/contabilidad.repository.ts`

Métodos (todos reciben `db: Executor` como primer parámetro):

- `registrarAsientos(db, movimientos, origenId, fecha, metodoPago): Promise<void>` — insert múltiple con `.onConflict(oc => oc.doNothing())`.
- `listarAsientos(db, desde?, hasta?): Promise<Asiento[]>` — orderBy fecha desc.
- `resumenVentas(db, desde?, hasta?, agrupacion: 'dia' | 'mes' | 'anio' | 'medio_pago'): Promise<ResumenVentas>` — groupBy según `agrupacion` sobre la cuenta `INGRESOS_VENTAS`.
- `productosServiciosVendidos(db, desde?, hasta?): Promise<ProductoVendido[]>` — agrega los ítems de los asientos/pagos del período. Como los asientos no guardan ítems, este método se construye a partir de los datos que Contabilidad almacena o consulta vía puerto de solo lectura (ver nota abajo).

> **Nota sobre productos/servicios:** como `asientos` no almacena ítems de pedido, el desglose de productos/servicios vendidos se construye en el servicio de Contabilidad a partir de los datos del evento `PedidoPagado` que se persisten temporalmente, o se consulta a través de un puerto de solo lectura definido en Contabilidad e implementado en Ventas (`app.ts` hace el puente). Ventas nunca importa Contabilidad.

### 3.5 Servicio

`modules/contabilidad/contabilidad.service.ts`

```ts
export class ContabilidadService {
  constructor(
    private readonly repo: ContabilidadRepository,
    private readonly uow: UnitOfWork<AppEventMap>,
  ) {}

  // Llamado SOLO por el suscriptor, nunca por una ruta:
  registrarVenta(pedidoId, total, metodoPago, fecha, items): Promise<void> {
    return this.uow.execute(async (ctx) => {
      const movimientos = construirAsientoVenta(pedidoId, total, metodoPago, fecha);
      await this.repo.registrarAsientos(ctx.db, movimientos, pedidoId, fecha, metodoPago);
    });
  }

  listarAsientos(desde?, hasta?): Promise<Asiento[]>
  resumenVentas(desde?, hasta?, agrupacion): Promise<ResumenVentas>
  productosServiciosVendidos(desde?, hasta?): Promise<ProductoVendido[]>
}
```

**Errores de negocio:** (mantenidos del borrador original, aplicables si se agregan rutas de caja en Contabilidad; si caja se queda solo en Ventas, estos errores viven en Ventas)

---

## 4. T3 — Suscripción Observer

Rama: `feat/fase6-contabilidad-observer`

`modules/contabilidad/suscripciones.ts`

```ts
// Patrón: Observer
export function registrarSuscripcionesContabilidad(
  bus: EventSubscriber<AppEventMap>,
  servicio: ContabilidadService,
): void {
  bus.subscribe('PedidoPagado', ({ pedidoId, total, metodoPago, pagadoEn, items }) =>
    servicio.registrarVenta(pedidoId, total, metodoPago, pagadoEn, items),
  );
}
```

`app.ts` (composición):
- `const contabilidadService = new ContabilidadService(contabilidadRepository, unitOfWork);`
- `registrarSuscripcionesContabilidad(eventBus, contabilidadService);`
- Se registra ANTES de los `app.register(...)` de rutas.

**Pruebas — suscripciones.test.ts:**
- Publicar `PedidoPagado` → 2 filas en `asientos` (CAJA débito total, INGRESOS_VENTAS crédito total).
- Partida doble: `sum(debito) === sum(credito) === total`.
- Republicar el MISMO evento → sigue habiendo 2 filas (idempotencia).
- Un fallo del suscriptor de Contabilidad no impide el de Notificaciones (ambos suscritos a `PedidoPagado`; `Promise.allSettled`).

---

## 5. T4 — Rutas REST de reportes (Contabilidad)

Rama: `feat/fase6-contabilidad-reportes`

`modules/contabilidad/contabilidad.routes.ts` con Zod

| Método | Ruta | Query | Respuesta |
| :--- | :--- | :--- | :--- |
| GET | `/api/contabilidad/asientos` | `desde?`, `hasta?` (datetime offset) | `200 Asiento[]` |
| GET | `/api/contabilidad/reporte-ventas` | `desde?`, `hasta?`, `agrupacion?` (`dia\|mes\|anio\|medio_pago`) | `200 ResumenVentas` |

```ts
ResumenVentas = {
  totalVentas: number;
  cantidadVentas: number;
  agrupacion: 'dia' | 'mes' | 'anio' | 'medio_pago';
  datos: Array<{
    clave: string;        // fecha (YYYY-MM-DD / YYYY-MM / YYYY) o nombre del medio de pago
    total: number;
    cantidad: number;
  }>;
  productosServicios: Array<{
    productoId: string;
    nombre: string;
    tipo: 'producto' | 'servicio';
    cantidadVendida: number;
    totalVendido: number;
  }>;
};
```

**Pruebas — contabilidad.routes.test.ts (PGlite):**
1. asientos vacíos al inicio → `200 []`.
2. reporte-ventas sin datos → `200 { totalVentas: 0, cantidadVentas: 0, agrupacion: 'dia', datos: [], productosServicios: [] }`.
3. reporte con `agrupacion=dia` → datos agrupados por día dentro del rango.
4. reporte con `agrupacion=mes` → datos agrupados por mes.
5. reporte con `agrupacion=anio` → datos agrupados por año.
6. reporte con `agrupacion=medio_pago` → datos agrupados por método de pago.
7. Filtro `desde`/`hasta` respeta el rango.
8. `productosServicios` devuelve los ítems vendidos en el período con cantidad y total.

---

## 6. T5 — Adapter de facturación electrónica (mock)

Rama: `feat/fase6-facturacion-adapter`

`integrations/facturacion-electronica/facturacion-electronica.port.ts`

```ts
export interface DatosFacturaInterna {
  facturaId: string;
  numero: string;
  pedidoId: string;
  total: number;
  fecha: string; // ISO
}

export interface ResultadoEmisionExterna {
  estado: 'ACEPTADA' | 'RECHAZADA';
  cufe: string;
  payloadXml: string;
}

export interface FacturacionElectronicaPort {
  emitir(datos: DatosFacturaInterna): Promise<ResultadoEmisionExterna>;
}
```

`integrations/facturacion-electronica/adapter-mock.ts`

```ts
// Patrón: Adapter
export class AdapterFacturacionElectronicaMock implements FacturacionElectronicaPort {
  async emitir(datos: DatosFacturaInterna): Promise<ResultadoEmisionExterna> {
    const xml = this.aXml(datos);
    return this.deRespuestaExterna(this.enviarMock(xml));
  }
}
```

- `aXml` produce `<FacturaElectronica numero="FAC-000001" ...>`.
- Respuesta simulada: `<AcuseRecibo><Estado>ACEPTADA</Estado><CUFE>...</CUFE></AcuseRecibo>`.
- El adapter **NO importa nada de `modules/ventas`**: solo conoce `DatosFacturaInterna`.
- **Cambios en Ventas (mínimos):** `PosCheckoutFacade` recibe `FacturacionElectronicaPort` en el constructor. Dentro del UoW, tras crear factura, guarda datos para emisión. **Después del commit**, llama `emitir(...)` y persiste `payload_externo` en `facturas.payload_externo`. Si el adapter falla o rechaza, la venta **no se revierte**.

**Pruebas:**
- `adapter-mock.test.ts`: dado `DatosFacturaInterna`, el XML contiene numero/pedidoId/total; resultado vuelve en formato interno; caso `RECHAZADA` no lanza.
- `pos-checkout.facade.test.ts`: tras checkout, `payload_externo` queda guardado; emisión `RECHAZADA` no revierte la venta.

---

## 7. T6 — Frontend mínimo (dashboard de contabilidad)

Rama: `feat/fase6-web-contabilidad`

| Archivo | Cambio |
| :--- | :--- |
| `apps/web/src/types.ts` | `Caja`, `Asiento`, `ResumenVentas`, `ProductoVendido` |
| `apps/web/src/hooks/useContabilidad.ts` | carga caja actual + asientos + reporte con filtros |
| `apps/web/src/pages/Contabilidad.tsx` | **Dashboard**: tarjetas resumen (ventas del período, transacciones, total), selector de agrupación (Día/Mes/Año/Medio de pago), inputs desde/hasta, tabla de resultados del reporte, tabla de productos/servicios vendidos, tabla de asientos recientes |
| `apps/web/src/App.tsx` | `<Route path="/contabilidad" element={<Contabilidad />} />` |
| `apps/web/src/components/Layout.tsx` | enlace Contabilidad: `to: '/contabilidad'` |
| `apps/web/src/pages/Contabilidad.test.tsx` | render con fetch mockeado: dashboard, filtro de agrupación, tabla de productos/servicios |

---

## 8. T7 — Verificación y cierre

Rama: `chore/fase6-verificacion`

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Checklist de revisión:
- Todo archivo de patrón empieza con `// Patrón: X`.
- No hay `any`.
- contabilidad NO importa ventas ni clientes; el adapter NO importa ningún módulo de negocio.
- `app.ts` es el único que conoce todos los módulos e integraciones.
- El asiento se crea dentro del UoW y es idempotente.
- Ventas puede importar `integrations` (adapter) pero nunca `modules/contabilidad`.
- Pruebas cubren 400/404/409, partida doble, idempotencia, aislamiento de fallos y desglose de productos/servicios.
- Marcar `[x] Fase 6` en `docs/plan.md` solo con autorización explícita.

---

## 9. Orden de ejecución y commits

1. `feat/fase6-ventas-caja` — migración y rutas de caja en Ventas (apertura, actual, cierre)
2. `feat/fase6-contabilidad-asientos` — migración asientos, dominio, repositorio, partida doble
3. `feat/fase6-contabilidad-observer` — suscripción a `PedidoPagado`, pruebas de idempotencia
4. `feat/fase6-contabilidad-reportes` — rutas de asientos y reporte-ventas con agrupación y productos/servicios
5. `feat/fase6-facturacion-adapter` — adapter mock, inyección en Facade fuera del UoW
6. `feat/fase6-web-contabilidad` — dashboard de contabilidad con filtros y desglose de productos/servicios
7. `chore/fase6-verificacion` — suite completa, build, documentación

Cada rama se mergea a `main` solo con tests + typecheck + lint en verde y revisión cruzada de freebuff, según `AGENTS.md`.

---

## 10. Riesgos concretos

- PGlite es de una sola conexión: TODO acceso a datos dentro de `uow.execute` debe usar `ctx.db`.
- El desglose de productos/servicios requiere que el evento `PedidoPagado` lleve `items`; si Ventas no los publica, Contabilidad no puede mostrar el desglose sin romper el desacoplamiento.
- Kysely `.onConflict(oc => oc.doNothing())` con índice único parcial: el conflicto se resuelve por `UNIQUE (origen_id, cuenta)`.
- Los numéricos llegan como string desde PG: mapear a number con `Number(row.total)`.
- El adapter fuera del UoW significa que una falla de facturación no revierte la venta; el rechazo queda registrado en `payload_externo` para auditoría.

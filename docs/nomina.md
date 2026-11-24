# Fase 7 — Especificación de Nómina

Patrón: **Chain of Responsibility** (cadena de conceptos de nómina: salario base, horas extras, auxilios, salud, pensión, retenciones → neto a pagar).
Opcionales del plan: ninguno adicional en esta fase.

---

## 0. Decisiones bloqueadas

| Decisión | Valor elegido |
| :--- | :--- |
| Patrón principal | **Chain of Responsibility** en `modules/nomina/cadena-liquidacion.ts`. Cada eslabón calcula un concepto y pasa el resultado al siguiente. |
| Desacoplamiento | Nómina **no importa** Ventas, Contabilidad, Clientes ni Citas. Solo lee de `empleados` (tabla propia o compartida de solo lectura). |
| Tabla empleados | Ya existe desde Fase 5 (`db/migrations/0006_citas.up.sql`). Se reutiliza; no se crea una nueva. No se agrega FK a usuarios (autenticación es Fase 8). |
| Liquidaciones | Tabla propia `liquidaciones` con detalle en JSONB y neto a pagar. No se vincula con asientos contables (eso es Fase 6/8). |
| Cálculo | Todo en memoria (TypeScript), sin consultas SQL intermedias por concepto. Solo se persiste el resultado final. |
| Moneda | Enteros en centavos internamente para evitar errores de punto flotante; se muestra con `formatearMoneda`. |
| Frontend | Página mínima `/nomina`: lista de empleados, botón "Calcular liquidación", tabla de resultados. |
| Eventos | No se publica ningún evento nuevo en esta fase (Nómina es independiente por ahora). |

---

## 1. Migración y esquema

Rama: `feat/fase7-nomina-migracion`

### 1.1 Tabla `conceptos_nomina` (catálogo de conceptos aplicables)

```sql
-- db/migrations/0009_nomina.up.sql
CREATE TABLE conceptos_nomina (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE CHECK (length(codigo) > 0),
  nombre text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('devengo', 'deduccion')),
  activo boolean NOT NULL DEFAULT true,
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX conceptos_nomina_tipo_idx ON conceptos_nomina (tipo);
CREATE INDEX conceptos_nomina_activo_idx ON conceptos_nomina (activo);
```

### 1.2 Tabla `liquidaciones`

```sql
CREATE TABLE liquidaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id uuid NOT NULL REFERENCES empleados (id) ON DELETE RESTRICT,
  periodo text NOT NULL CHECK (length(periodo) > 0), -- ej. "2026-11"
  salario_base numeric(12, 2) NOT NULL CHECK (salario_base >= 0),
  total_devengos numeric(12, 2) NOT NULL DEFAULT 0 CHECK (total_devengos >= 0),
  total_deducciones numeric(12, 2) NOT NULL DEFAULT 0 CHECK (total_deducciones >= 0),
  neto_a_pagar numeric(12, 2) NOT NULL CHECK (neto_a_pagar >= 0),
  detalle jsonb NOT NULL DEFAULT '{}',
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX liquidaciones_empleado_idx ON liquidaciones (empleado_id);
CREATE INDEX liquidaciones_periodo_idx ON liquidaciones (periodo);
CREATE UNIQUE INDEX liquidaciones_empleado_periodo_idx
  ON liquidaciones (empleado_id, periodo);
```

### 1.3 Down

```sql
-- db/migrations/0009_nomina.down.sql
DROP INDEX IF EXISTS liquidaciones_empleado_periodo_idx;
DROP INDEX IF EXISTS liquidaciones_periodo_idx;
DROP INDEX IF EXISTS liquidaciones_empleado_idx;
DROP INDEX IF EXISTS conceptos_nomina_activo_idx;
DROP INDEX IF EXISTS conceptos_nomina_tipo_idx;
DROP TABLE IF EXISTS liquidaciones;
DROP TABLE IF EXISTS conceptos_nomina;
```

### 1.4 Esquema Kysely

`apps/api/src/shared/db/schema.ts` — agregar `ConceptosNominaTable` y `LiquidacionesTable`, registrarlas en `Database`.

```ts
export interface ConceptosNominaTable {
  id: Generated<string>;
  codigo: string;
  nombre: string;
  tipo: 'devengo' | 'deduccion';
  activo: Generated<boolean>;
  creado_en: Generated<Date>;
}

export interface LiquidacionesTable {
  id: Generated<string>;
  empleado_id: string;
  periodo: string;
  salario_base: NumericColumn;
  total_devengos: NumericColumn;
  total_deducciones: NumericColumn;
  neto_a_pagar: NumericColumn;
  detalle: ColumnType<object, string, string>;
  creado_en: Generated<Date>;
  actualizado_en: Generated<Date>;
}
```

Registrar en `Database`:
```ts
  conceptos_nomina: ConceptosNominaTable;
  liquidaciones: LiquidacionesTable;
```

### 1.5 Seed

Agregar a `apps/api/src/db/seed.ts` (sin romper lo existente):
- 3 conceptos devengo: `SALARIO_BASE`, `HORAS_EXTRAS`, `AUXILIO_TRANSPORTE`.
- 2 conceptos deduccion: `SALUD`, `PENSION`.
- Empleados ya existen desde Fase 5 (no duplicar).

---

## 2. Dominio y repositorio (Cadena de Responsabilidad)

Rama: `feat/fase7-nomina-dominio`

### 2.1 Tipos de dominio

`modules/nomina/domain/tipos.ts`

```ts
export type ConceptoTipo = 'devengo' | 'deduccion';

export interface ConceptoNomina {
  id: string;
  codigo: string;
  nombre: string;
  tipo: ConceptoTipo;
  activo: boolean;
}

export interface EntradaConcepto {
  empleadoId: string;
  salarioBase: number;
  horasExtras?: number;
  auxilioTransporte?: number;
  periodo: string;
}

export interface ResultadoConcepto {
  codigo: string;
  nombre: string;
  tipo: ConceptoTipo;
  valor: number; // positivo para ambos; el tipo indica si se suma o resta
}

export interface LiquidacionResultado {
  empleadoId: string;
  periodo: string;
  salarioBase: number;
  totalDevengos: number;
  totalDeducciones: number;
  netoAPagar: number;
  conceptos: ResultadoConcepto[];
}
```

### 2.2 Cadena de Responsabilidad

`modules/nomina/cadena-liquidacion.ts` — **// Patrón: Chain of Responsibility**

```ts
export interface EslabonLiquidacion {
  ejecutar(entrada: EntradaConcepto, acumulado: ResultadoConcepto[]): Promise<ResultadoConcepto[]>;
  establecerSiguiente(eslabon: EslabonLiquidacion): EslabonLiquidacion;
}

export abstract class EslabonLiquidacionBase implements EslabonLiquidacion {
  #siguiente?: EslabonLiquidacion;

  establecerSiguiente(eslabon: EslabonLiquidacion): EslabonLiquidacion {
    this.#siguiente = eslabon;
    return eslabon;
  }

  protected siguiente(
    entrada: EntradaConcepto,
    acumulado: ResultadoConcepto[],
  ): Promise<ResultadoConcepto[]> {
    if (this.#siguiente) {
      return this.#siguiente.ejecutar(entrada, acumulado);
    }
    return Promise.resolve(acumulado);
  }
}
```

Eslabones concretos (cada uno en su propio archivo):

- `modules/nomina/cadena/salario-base.ts` — devengo: `valor = salarioBase`.
- `modules/nomina/cadena/horas-extras.ts` — devengo: `valor = horasExtras * (salarioBase / 240 / 2)` (aprox).
- `modules/nomina/cadena/auxilio-transporte.ts` — devengo: valor fijo si salarioBase <= umbral.
- `modules/nomina/cadena/salud.ts` — deducción: 4% del salario base (aprox).
- `modules/nomina/cadena/pension.ts` — deducción: 4% del salario base (apróx).

Cada archivo comienza con `// Patrón: Chain of Responsibility`.

Clase orquestadora:

`modules/nomina/cadena-liquidacion.ts` (o separado)

```ts
export class CadenaLiquidacion {
  #cabeza: EslabonLiquidacion | null = null;
  #cola: EslabonLiquidacion | null = null;

  agregar(eslabon: EslabonLiquidacion): void {
    if (!this.#cabeza) {
      this.#cabeza = eslabon;
      this.#cola = eslabon;
    } else {
      this.#cola!.establecerSiguiente(eslabon);
      this.#cola = eslabon;
    }
  }

  async ejecutar(entrada: EntradaConcepto): Promise<ResultadoConcepto[]> {
    if (!this.#cabeza) {
      return [];
    }
    return this.#cabeza.ejecutar(entrada, []);
  }
}
```

### 2.3 Repositorio

`modules/nomina/nomina.repository.ts` — **// Patrón: Repository**

Métodos (reciben `executor` o usan `this.#db`, siguiendo el estilo de `EmpleadosRepository`):

- `obtenerConceptosActivos(): Promise<ConceptoNomina[]>`
- `obtenerSalarioBase(empleadoId): Promise<number | null>` — lee de `empleados.salario_base` (agregar columna en migración si no existe) o de una tabla de contratos.
- `crearLiquidacion(datos): Promise<Liquidacion>`
- `obtenerLiquidacion(id): Promise<Liquidacion | null>`
- `listarLiquidaciones(empleadoId?, periodo?): Promise<Liquidacion[]>`

> Nota: la tabla `empleados` de Fase 5 no tiene `salario_base`. Se agrega en la migración 0009 o se asume un salario base por defecto para la demo. Decisión: agregar columna `salario_base numeric(12,2)` a `empleados` en la migración 0009.

---

## 3. Servicio

`modules/nomina/nomina.service.ts`

```ts
export class NominaService {
  constructor(
    private readonly repositorio: NominaRepository,
    private readonly cadena: CadenaLiquidacion,
  ) {}

  async calcularLiquidacion(empleadoId: string, periodo: string, entradas: EntradaConcepto): Promise<LiquidacionResultado> {
    // 1. Obtener salario base del empleado
    // 2. Ejecutar cadena de conceptos
    // 3. Calcular totales y neto
    // 4. Persistir liquidación
  }

  async listarLiquidaciones(...): Promise<Liquidacion[]>
  async obtenerLiquidacion(id: string): Promise<Liquidacion>
}
```

Errores de negocio:
- `EMPLEADO_NO_ENCONTRADO` → 404
- `LIQUIDACION_YA_EXISTE` → 409 (por `empleado_id` + `periodo`)
- `PERIODO_INVALIDO` → 400

---

## 4. Rutas REST

`modules/nomina/nomina.routes.ts` con Zod

| Método | Ruta | Body / Query | Respuesta |
| :--- | :--- | :--- | :--- |
| GET | `/api/nomina/conceptos` | — | `ConceptoNomina[]` |
| POST | `/api/nomina/calcular` | `{ empleadoId, periodo, horasExtras?, auxilioTransporte? }` | `LiquidacionResultado` |
| GET | `/api/nomina/liquidaciones` | `empleadoId?`, `periodo?` | `Liquidacion[]` |
| GET | `/api/nomina/liquidaciones/:id` | — | `Liquidacion` |

---

## 5. Pruebas (Vitest)

Archivos:
- `apps/api/src/modules/nomina/cadena-liquidacion.test.ts` — prueba de la cadena completa: salario + horas + auxilio - salud - pensión = neto.
- `apps/api/src/modules/nomina/cadena/salario-base.test.ts` (uno por eslabón) — cada concepto aislado.
- `apps/api/src/modules/nomina/nomina.repository.test.ts` — persistencia.
- `apps/api/src/modules/nomina/nomina.routes.test.ts` (PGlite) — endpoints 200/400/404/409.
- `apps/web/src/pages/Nomina.test.tsx` — frontend (fetch mockeado).

Criterios:
- El neto a pagar = suma(devengos) - suma(deducciones).
- Cada eslabón puede agregarse/quitarse sin modificar los demás (principio de la cadena).
- Un eslabón roto no rompe los siguientes (manejo de errores).

---

## 6. Frontend mínimo

Rama: `feat/fase7-web-nomina`

| Archivo | Cambio |
| :--- | :--- |
| `apps/web/src/types.ts` | `ConceptoNomina`, `Liquidacion`, `LiquidacionResultado`, `ResultadoConcepto` |
| `apps/web/src/hooks/useNomina.ts` | calcular, listar liquidaciones |
| `apps/web/src/pages/Nomina.tsx` | selector de empleado, periodo, inputs horas extras/auxilio, botón calcular, tabla de resultado por concepto y neto |
| `apps/web/src/App.tsx` | `<Route path="/nomina" element={<Nomina />} />` |
| `apps/web/src/components/Layout.tsx` | enlace Nómina: `to: '/nomina'` |
| `apps/web/src/pages/Nomina.test.tsx` | render con fetch mockeado |

---

## 7. Riesgos concretos

| Riesgo | Mitigación |
|--------|------------|
| Errores de punto flotante en dinero | Usar centavos (enteros) internamente, redondear solo al mostrar. |
| La cadena se vuelve difícil de probar | Una prueba por eslabón + una prueba de integración de la cadena completa. |
| Acoplar Nómina a Empleados | Nómina lee `empleados` como tabla de solo lectura; no importa el módulo. No hay eventos entre ambos. |
| Liquidación duplicada por periodo | `UNIQUE (empleado_id, periodo)` + `ON CONFLICT` o validación previa 409. |

---

## 8. Orden de ejecución y commits

1. `feat/fase7-nomina-migracion` — migración 0009 (conceptos_nomina, liquidaciones, salario_base en empleados) + esquema + seed.
2. `feat/fase7-nomina-dominio` — tipos, cadena de responsabilidad, eslabones, repositorio, pruebas de dominio.
3. `feat/fase7-nomina-api` — servicio, rutas, pruebas de API (PGlite).
4. `feat/fase7-web-nomina` — tipos web, hook, página, enlace sidebar, pruebas web.
5. `chore/fase7-cierre` — suite completa (`pnpm test`, `typecheck`, `lint`, `build`), documentación, actualizar `docs/patrones.md` y `docs/plan.md`.

Cada rama se mergea a `main` solo con tests + typecheck + lint en verde y revisión cruzada de freebuff, según `AGENTS.md`.

---

## 9. Evidencia esperada para el informe final

| Patrón | Archivo | Evidencia |
|--------|---------|-----------|
| Chain of Responsibility | `modules/nomina/cadena-liquidacion.ts`, `modules/nomina/cadena/*.ts` | Prueba de cadena completa, eslabones agregables/extraíbles sin modificar otros. |
| Repository | `modules/nomina/nomina.repository.ts` | Pruebas de persistencia y consulta. |

---

**Estado:** Plan listo para implementación. No se ha modificado código aún.
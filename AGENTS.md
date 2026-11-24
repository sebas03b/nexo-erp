# Instrucciones para Agentes (opencode, freebuff) - Proyecto Nexo-ERP

**Contexto:** Estás construyendo Nexo-ERP, una aplicación web de gestión de servicios y operaciones comerciales diseñada para demostrar la aplicación explícita de patrones de diseño GoF.

**REGLA DE ORO:** Lee este documento y la especificación del módulo en `docs/[modulo].md` antes de escribir o revisar cualquier código.

## 1. Stack Tecnológico
*   **Lenguaje:** TypeScript estricto (`"strict": true`, prohibido usar `any`).
*   **Monorepo:** pnpm workspaces (`apps/web` y `apps/api`).
*   **Backend:** Node.js + Fastify.
*   **Validación:** Zod.
*   **Acceso a datos:** Kysely o Drizzle + migraciones SQL puras.
*   **Base de datos:** PostgreSQL en Docker (`docker-compose.yml`).
*   **Frontend:** React + Vite + TypeScript.
*   **Pruebas:** Vitest (comando: `pnpm test`).

## 2. Arquitectura y Módulos
Basado en el diagrama de componentes y el plan de desarrollo, el sistema se divide en los siguientes módulos lógicos:
1.  **GUI:** Configuración y Vistas (Frontend).
2.  **Gestión de Inventario.**
3.  **Ventas:** Pedido y Factura (Checkout POS).
4.  **Contabilidad:** Reporte y Caja.
5.  **Gestión de Citas:** Agenda y Citas.
6.  **Notificaciones:** Alerta y Correo.
7.  **Nómina** (Integración posterior).

**Principios Arquitectónicos Estrictos:**
*   **Desacoplamiento:** Los módulos (Ventas, Inventario, Citas, etc.) NO se importan entre sí directamente. Se comunican mediante **eventos** (Patrón Observer / Event Bus) o interfaces claramente definidas.
*   **Transacciones:** Todo el proceso de Checkout POS debe correr en una *única transacción* de base de datos (Unit of Work).
*   **Patrones explícitos:** Un patrón por archivo. El archivo debe comenzar con el comentario: `// Patrón: [Nombre del Patrón]`. No apliques patrones sin una justificación de diseño concreta.

## 3. Mapa de Patrones de Diseño (GoF)
Cuando implementes una funcionalidad, debes aplicar el patrón correspondiente según esta tabla:

| Patrón | Módulo/Ubicación | Problema que resuelve |
| :--- | :--- | :--- |
| **Facade** | `pos-checkout.facade.ts` | Orquestar el checkout (stock, pago, factura) tras una interfaz simple. |
| **Command** | `pos/commands/*` | Encapsular acciones del POS para permitir deshacer (ej. quitar ítem). |
| **Chain of Responsibility** | `cadena-validacion.ts` (Ventas), `cadena-liquidacion.ts` (Nómina) | Validaciones apilables (caja, cliente, stock) o conceptos de nómina. |
| **Strategy** | `pricing/*`, `payments/*` | Alternar lógicas de descuentos, impuestos y pasarelas de pago. |
| **Builder** | `factura.builder.ts` | Construir una factura compleja paso a paso. |
| **Observer** | `event-bus.ts`, `outbox.ts` | Desacoplar módulos (ej. `OrdenPagada` dispara acciones en Inventario y Contabilidad). |
| **State** | `citas/domain/states/*` | Controlar transiciones válidas de una cita (ej. Pendiente -> Confirmada). |
| **Factory Method** | `notificacion.factory.ts` | Crear el canal adecuado de notificación (Email, SMS, WhatsApp). |
| **Adapter** | `integrations/*` | Adaptar formatos de APIs externas (ej. Facturación Electrónica simulada). |
| **Proxy** | `permisos.proxy.ts`, `cache.proxy.ts` | Interceptar llamadas para control de acceso (cajero bloqueado) o caché. |

## 4. Estructura de Directorios Esperada
```text
nexo-erp/
├── AGENTS.md
├── docker-compose.yml
├── docs/ (Especificaciones de módulos)
├── db/migrations/
└── apps/
    ├── web/ (React + Vite)
    └── api/
        └── src/
            ├── main.ts
            ├── shared/ (db, events, outbox)
            └── modules/ (ventas, citas, inventario, etc.)
```

## 5. Reglas de Trabajo para opencode (Constructor)
1.  Implementa **exactamente** contra la especificación (`docs/[modulo].md`), no inventes requerimientos.
2.  Mantén los PRs/Commits pequeños. Una tarea por prompt.
3.  **Siempre** incluye pruebas en Vitest para cada patrón implementado. La prueba es la evidencia de que el patrón funciona.
4.  Antes de finalizar, asegúrate de que `pnpm test` y `pnpm tsc --noEmit` pasen exitosamente.

## 6. Reglas de Trabajo para freebuff (Revisor)
1.  Revisa el código asumiendo el rol de Arquitecto de Software.
2.  Verifica la correcta aplicación del patrón (busca el comentario `// Patrón: X`).
3.  Busca violaciones arquitectónicas (módulos importando módulos directamente).
4.  Prohíbe el uso de `any`.
5.  Devuelve un reporte ordenado por gravedad, sin modificar el código directamente a menos que se te solicite.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **nexo-erp** (2544 symbols, 5799 relationships, 150 execution flows).

> Index stale? Run `node .gitnexus/run.cjs analyze --index-only` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? Bootstrap with `npx`, `bunx`, or `pnpm dlx` — e.g. `bunx gitnexus@latest analyze` (npm 11 npx crash; #1939).

## Always Do

- **MUST run impact before editing.** Use `impact({target: "symbolName", direction: "upstream"})` or `node .gitnexus/run.cjs impact "symbolName" --direction upstream --repo .`; report callers, processes, and risk. Never substitute grep for graph analysis.
- **MUST analyze graph changes before committing.** Use `detect_changes({scope: "all"})` (MCP) or `node .gitnexus/run.cjs detect-changes --scope all --repo .` (CLI fallback). `partial: true` or `truncated: true` is not a clean check — a zero means unseen, not unaffected; re-run it. For regression review: `detect_changes({scope: "compare", base_ref: "main"})` or `node .gitnexus/run.cjs detect-changes --scope compare --base-ref "main" --repo .`.
- MUST warn on HIGH/CRITICAL `risk` pre-edit; never use `riskSharedAxes` to waive a HIGH/CRITICAL `risk` warning. Compare File/symbol: MCP File omits axes; Graph-RAG expands File.
- **MUST treat `risk: UNKNOWN` as unresolved, not as low.** An empty caller set is not evidence the symbol is unused — it can also mean the callers are not resolvable by the index (plain-object property access, dynamic dispatch, cross-language calls). `impact` pairs `UNKNOWN` with a `riskNote` saying so. Confirm with a text search before treating the symbol as safe to change or delete; do not proceed on the strength of a zero.
- **MUST use `query({search_query: "concept"})` for concepts/flows, `context({name: "symbolName"})` for a named symbol, or `impact` for blast radius, on read-only callers, dependencies, imports, or execution flow.** Graph first; text search only for empty/`UNKNOWN`/literals.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method before MCP/CLI impact analysis.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis, and never read `UNKNOWN` as an all-clear — it means the walk could not answer, which is the one verdict that requires confirming by other means.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit before MCP/CLI graph change analysis.

## Resources

| Resource | Use for |
| --- | --- |
| `gitnexus://repo/nexo-erp/context` | Codebase overview, check index freshness |
| `gitnexus://repo/nexo-erp/clusters` | All functional areas |
| `gitnexus://repo/nexo-erp/processes` | All execution flows |
| `gitnexus://repo/nexo-erp/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
| --- | --- |
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->

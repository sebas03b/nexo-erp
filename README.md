# Nexo-ERP

Monorepo de Nexo-ERP. La arquitectura y las reglas de trabajo están descritas en
[`AGENTS.md`](./AGENTS.md), y el estado de avance por fases en
[`docs/plan.md`](./docs/plan.md).

## Requisitos

- Node.js `^22.12.0 || ^24.0.0 || >=26.0.0`
- pnpm `>=11`
- Docker y Docker Compose (solo para PostgreSQL)

## Puesta en marcha

```bash
pnpm install
cp .env.example .env
pnpm db:up
pnpm --filter @nexo/api db:migrate:up
pnpm --filter @nexo/api seed
pnpm dev
```

- Web: <http://localhost:5173>
- API: <http://localhost:3000>
- Health check: <http://localhost:3000/health>

## Comandos

| Comando | Descripción |
|---|---|
| `pnpm dev` | Inicia API y web en paralelo. |
| `pnpm dev:api` | Inicia solo la API con recarga en caliente. |
| `pnpm dev:web` | Inicia solo la web con Vite. |
| `pnpm build` | Compila todos los workspaces. |
| `pnpm test` | Ejecuta toda la suite de Vitest. |
| `pnpm test:watch` | Ejecuta Vitest en modo watch. |
| `pnpm typecheck` | Verifica TypeScript sin emitir archivos. |
| `pnpm tsc --noEmit` | Equivalente directo a la verificación de tipos. |
| `pnpm lint` | Ejecuta ESLint sobre todo el monorepo. |
| `pnpm lint:fix` | Corrige automáticamente lo que ESLint permita. |
| `pnpm db:up` | Levanta PostgreSQL con Docker Compose. |
| `pnpm db:down` | Detiene PostgreSQL. |
| `pnpm db:reset` | Detiene PostgreSQL y elimina su volumen. |
| `pnpm db:logs` | Sigue los logs de PostgreSQL. |
| `pnpm --filter @nexo/api db:migrate:up` | Aplica las migraciones pendientes. |
| `pnpm --filter @nexo/api db:migrate:down` | Revierte la última migración. |
| `pnpm --filter @nexo/api seed` | Carga datos de demostración de forma repetible. |

## Estructura

```text
apps/
├── api/                    # Node.js + Fastify + TypeScript
│   └── src/
│       ├── config/         # Variables de entorno
│       ├── db/             # Seed de demostración
│       ├── modules/
│       │   ├── citas/      # Agenda, State y persistencia de Citas
│       │   ├── clientes/   # Clientes y canal preferido
│       │   ├── empleados/  # Catálogo mínimo de empleados
│       │   ├── inventario/ # Productos y stock
│       │   ├── notificaciones/ # Observer y Factory Method
│       │   └── ventas/     # POS, pedidos, facturas y checkout
│       ├── shared/
│       │   ├── db/         # Kysely y Unit of Work
│       │   ├── events/     # Event Bus, Outbox y contratos
│       │   └── types/      # Contratos compartidos
│       ├── app.ts          # Composition root
│       └── main.ts
└── web/                    # React + Vite + TypeScript
    └── src/
        ├── components/     # Navegación y componentes compartidos
        ├── lib/            # Cliente HTTP y utilidades de formato
        ├── pages/          # POS, clientes, productos, ventas y citas
        └── App.tsx
db/migrations/              # Migraciones SQL puras (*.up.sql / *.down.sql)
docs/                       # Especificaciones y trazabilidad por fase
```

## Especificaciones

- [`docs/infraestructura.md`](./docs/infraestructura.md)
- [`docs/fase2-inventario-pedidos.md`](./docs/fase2-inventario-pedidos.md)
- [`docs/citas.md`](./docs/citas.md)
- [`docs/notificaciones.md`](./docs/notificaciones.md)
- [`docs/patrones.md`](./docs/patrones.md)

## Convenciones de código

- TypeScript estricto y prohibido `any`.
- Un patrón GoF por archivo, precedido por `// Patrón: [Nombre]`.
- Los módulos de negocio no se importan entre sí: se comunican por eventos o interfaces.
- Cada patrón implementado debe tener pruebas en Vitest.

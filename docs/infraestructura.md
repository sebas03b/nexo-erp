# Especificación: Infraestructura Compartida (Fase 1)

## Entregables
- `apps/api/src/shared/db/pool.ts`: Gestión de la conexión a la base de datos inyectable.
- `apps/api/src/shared/db/unit-of-work.ts`: Manejo de transacciones de base de datos.
- `apps/api/src/shared/events/event-bus.ts`: Implementación del patrón Observer.
- `apps/api/src/shared/events/outbox.ts`: Guardado de eventos en la misma transacción (Outbox pattern).
- `db/migrations/0002_outbox_events.up.sql` y `.down.sql`: Tabla `outbox_events` (id, tipo, payload, creado_en, procesado_en).

## Reglas Arquitectónicas
- **Patrón Observer**: `event-bus.ts` debe permitir suscripciones y publicación de eventos.
- **Inyección de Dependencias**: La conexión a la base de datos se entrega por inyección (parámetro o contenedor), no por Singleton clásico.
- **Transaccionalidad (Outbox)**: Un evento publicado dentro de un Unit of Work se guarda en la tabla `outbox_events` en la misma transacción. No se emite a los suscriptores en memoria hasta que la transacción haga commit de forma exitosa.

## Criterio de Aceptación
Una prueba en Vitest debe demostrar que un evento publicado dentro de una transacción solo se entrega a los múltiples suscriptores si la transacción hace commit exitosamente.
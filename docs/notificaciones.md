# Especificación: Notificaciones (Fase 5)

## Objetivo

Reaccionar a eventos de negocio mediante **Observer** y enviar notificaciones simuladas por email, SMS o WhatsApp mediante el **Factory Method** adoptado por Nexo-ERP, sin acoplar Notificaciones con Citas, Clientes o Ventas.

## Entregables

- Contrato compartido de canales de notificación.
- `NotificacionFactory` y tres productos concretos simulados.
- Servicio de notificaciones con consulta de contactos y salida inyectable.
- Suscriptor de `CitaConfirmada` y `PedidoPagado`.
- Integración desde `app.ts` como composition root.
- Actualización del canal preferido del cliente.
- Pruebas de canales, preferencias y entrega post-commit.

## Contrato de canal

`CanalNotificacion` vive en `apps/api/src/shared/types/canal-notificacion.ts` y admite únicamente:

- `email`
- `sms`
- `whatsapp`

Un type guard valida valores desconocidos. El normalizador usa `email` como valor seguro para datos preexistentes inválidos. La API valida el canal en el borde de entrada con Zod.

## Reglas de negocio

1. `CitaConfirmada` produce una notificación con fecha, hora, motivo y nombre del empleado.
2. `PedidoPagado` produce una notificación con el total y la referencia de pago.
3. Al notificar se consulta el contacto y la preferencia actuales del cliente.
4. El evento no congela el canal ni el correo o teléfono del destinatario.
5. Para `email` se usa `email`; para `sms` y `whatsapp` se usa `telefono`.
6. Si el cliente no existe, se registra una advertencia y se omite el envío.
7. Si el canal preferido no tiene destinatario, se registra una advertencia y se omite el envío.
8. No se cambia automáticamente a otro canal.
9. El envío es best-effort: un fallo del canal no revierte el negocio que originó el evento.
10. Las notificaciones de esta fase no se persisten.

## Patrón Factory Method

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

- **Creator:** `NotificacionFactory`.
- **Product:** `Notificador`.
- **Products concretos:** `EmailSender`, `SmsSender`, `WhatsAppSender`.

`notificacion.factory.ts` comienza con `// Patrón: Factory Method`.

### Nota académica

La factory con `switch` es funcionalmente una **Simple Factory** en la clasificación GoF estricta. Nexo-ERP conserva la denominación **Factory Method** adoptada en `docs/plan.md` y `AGENTS.md`: un creator central construye el producto concreto según el canal solicitado.

### Salidas simuladas

```text
[Email][ana@email.com] Cita confirmada para el 25/11/2026 10:00 con Laura Pérez. Motivo: Corte y color.
[SMS][3001112233] Pago recibido por el pedido 123. Total: $200.00. Referencia: PAGO-1.
[WhatsApp][3014445566] Cita confirmada para el 25/11/2026 10:00 con Laura Pérez. Motivo: Corte y color.
```

La salida del canal se inyecta en `NotificacionFactory`. El servicio recibe por separado un sumidero opcional de advertencias. Así las pruebas no dependen de `console.log` ni de `console.warn`.

## Contratos

### Mensaje y notificador

```ts
export interface MensajeNotificacion {
  destinatario: string;
  mensaje: string;
}

export interface Notificador {
  enviar(mensaje: MensajeNotificacion): Promise<void>;
}
```

### Contactos

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

`app.ts` construye el adaptador de contactos usando `ClientesRepository`. Notificaciones no importa el módulo de Clientes.

## Eventos consumidos

El contrato canónico vive en `apps/api/src/shared/events/event-map.ts`. Los bloques siguientes son ilustrativos y no se redeclaran en Notificaciones:

```ts
type CitaConfirmada = AppEventMap['CitaConfirmada'];
type PedidoPagado = AppEventMap['PedidoPagado'];
```

`CitaConfirmada` contiene `empleadoNombre` y `motivo` como datos de agenda. No contiene canal, correo ni teléfono. `PedidoPagado` contiene `total` y `referenciaPago`, que permiten componer el comprobante sin consultar Ventas.

`notificaciones.suscriptores.ts` comienza con `// Patrón: Observer` y registra ambos eventos. `app.ts` registra el suscriptor antes de aceptar peticiones.

## Actualización del canal preferido

```http
PATCH /api/clientes/:id
```

```json
{
  "canalPreferido": "whatsapp"
}
```

También se admiten actualizaciones parciales de `email` y `telefono`; ambos aceptan string válido o `null`. La API responde con el contrato camelCase `canalPreferido`.

## Flujo de Observer

1. Un caso de uso publica el evento mediante `UnitOfWork<AppEventMap>`.
2. El Outbox persiste el evento en la misma transacción.
3. Si la transacción hace rollback, no hay evento persistido ni entrega.
4. Después del commit, el bus entrega el evento al suscriptor.
5. El suscriptor consulta el contacto actual.
6. La factory construye el notificador del canal preferido.
7. El notificador escribe la salida simulada.

## Evidencia de pruebas

- Cada canal crea el sender correcto.
- Cada sender usa el destinatario y la línea esperados.
- Un cliente inexistente no rompe la confirmación.
- Un canal sin destinatario registra advertencia y omite el envío.
- Un fallo del notificador no revierte la cita.
- Confirmar una cita produce salida `[Email]`.
- Cambiar la preferencia a WhatsApp hace que la siguiente confirmación produzca `[WhatsApp]` sin modificar Citas.
- `PedidoPagado` produce la notificación de comprobante.
- El evento se entrega después del commit y no se entrega tras rollback.

## Decisiones y limitaciones

- El Outbox de esta fase entrega en memoria después del commit, pero no tiene worker de reintento después de reiniciar.
- `procesado_en` no se actualiza en el flujo productivo actual.
- Las notificaciones no se persisten.
- Los envíos son simulados y no se integran con proveedores reales.
- La consulta de contactos es secuencial dentro del suscriptor y ocurre después del commit, no al publicar.

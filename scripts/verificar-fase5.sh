#!/bin/bash
set -e

echo "══════════════════════════════════════════════════════════"
echo "  VERIFICACIÓN MANUAL — FASE 5: Citas y Notificaciones"
echo "══════════════════════════════════════════════════════════"

echo ""
echo ">>> PASO 1: Entorno (typecheck, lint, tests, build)"
echo "Ejecutar: pnpm typecheck && pnpm lint && pnpm test && pnpm build"
echo "Resultado esperado: TODO EN VERDE (0 fallos en 191 tests)"
echo ""

echo ">>> PASO 2: Levantar infraestructura"
echo "Ejecutar: docker compose up -d"
echo ""

echo ">>> PASO 3: Migraciones y seed"
echo "Ejecutar: pnpm --filter @nexo/api db:migrate"
echo "Ejecutar: pnpm --filter @nexo/api db:seed"
echo ""

echo ">>> PASO 4: Levantar API"
echo "Ejecutar: pnpm --filter @nexo/api dev"
echo "Esperar a que responda /health"
echo ""

echo ">>> PASO 5: Demo manual de la Fase 5 (agenda + notificaciones)"
echo ""
echo "1) GET /api/clientes"
curl -s http://localhost:3000/api/clientes | head -c 500
echo ""

echo "2) GET /api/empleados"
curl -s http://localhost:3000/api/empleados | head -c 500
echo ""

echo "3) POST /api/citas — crear cita"
# Reemplazar los UUIDs por clientes/empleados reales del seed
curl -s -X POST http://localhost:3000/api/citas \
  -H "Content-Type: application/json" \
  -d '{
    "clienteId": "00000000-0000-4000-8000-000000000001",
    "empleadoId": "00000000-0000-4000-8000-000000000001",
    "inicio": "2026-11-25T15:00:00.000Z",
    "fin": "2026-11-25T16:00:00.000Z",
    "motivo": "Corte y color"
  }' \
  -w "\nStatus: %{http_code}\n"

echo "4) POST /api/citas/:id/confirmar — debe publicar CitaConfirmada"
echo "   y generar salida por el canal preferido del cliente (log [Email]/[SMS]/[WhatsApp])"

echo "5) PATCH /api/clientes/:id — cambiar canalPreferido (email|sms|whatsapp)"
echo "   e intentar confirmar otra cita; debe usar el nuevo canal."

echo ">>> PASO 6: Verificar criterios de aceptación (docs/planfase5final.md)"
echo "  [ ] Transición ilegal -> 409 TRANSICION_CITA_INVALIDA"
echo "  [ ] Estado no cambia tras intento ilegal"
echo "  [ ] Flujo completo: Pendiente -> Confirmada -> En Proceso -> Completada"
echo "  [ ] Cancelada libera horario"
echo "  [ ] Cita solapada -> 409 CITA_SOLAPADA"
echo "  [ ] Empleado inactivo -> 409 EMPLEADO_INACTIVO"
echo "  [ ] Evento CitaConfirmada persiste en outbox y entrega post-commit"
echo "  [ ] PedidoPagado -> notificación de comprobante"
echo "  [ ] Cambiar canalPreferido cambia el canal (sin tocar CitasService)"
echo "  [ ] Frontend agenda carga, crea, confirma, inicia, completa, cancela"

echo ""
echo "══════════════════════════════════════════════════════════"
echo "  VERIFICACIÓN COMPLETA. Si los PASOS 1-3 están en verde y"
echo "  los PASOS 5-6 cumplen, la Fase 5 está LISTA para la demo."
echo "══════════════════════════════════════════════════════════"

import type { AppEventMap } from '../../../shared/events/event-map.js';

export type VentasEventMap = Pick<
  AppEventMap,
  'PedidoEmitido' | 'PedidoPagado'
>;

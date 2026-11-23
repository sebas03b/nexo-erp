import type { CitasEventMap } from '../../modules/citas/domain/eventos.js';
import type { VentasEventMap } from '../../modules/ventas/domain/eventos.js';

export type AppEventMap = VentasEventMap & CitasEventMap;

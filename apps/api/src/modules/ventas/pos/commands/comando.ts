// Patrón: Command

import type { ItemCarrito } from './carrito.js';

export type EstadoPrevioItem = ItemCarrito | null;

export interface Comando {
  ejecutar(): Promise<void>;
  deshacer(): Promise<void>;
}

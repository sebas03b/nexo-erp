// Patrón: State

import { PedidoEstado } from '../pedido-estado.js';

export class AnuladoState extends PedidoEstado {
  readonly nombre = 'Anulado' as const;
}

// Patrón: State

import { PedidoEstado } from '../pedido-estado.js';

export class PagadoState extends PedidoEstado {
  readonly nombre = 'Pagado' as const;
}

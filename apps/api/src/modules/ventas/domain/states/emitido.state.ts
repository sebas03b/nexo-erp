// Patrón: State

import { PedidoEstado } from '../pedido-estado.js';
import { AnuladoState } from './anulado.state.js';
import { PagadoState } from './pagado.state.js';

export class EmitidoState extends PedidoEstado {
  readonly nombre = 'Emitido' as const;

  override pagar(): PedidoEstado {
    return new PagadoState();
  }

  override anular(): PedidoEstado {
    return new AnuladoState();
  }
}

// Patrón: State

import { PedidoEstado } from '../pedido-estado.js';
import { AnuladoState } from './anulado.state.js';
import { EmitidoState } from './emitido.state.js';

export class BorradorState extends PedidoEstado {
  readonly nombre = 'Borrador' as const;

  override emitir(): PedidoEstado {
    return new EmitidoState();
  }

  override anular(): PedidoEstado {
    return new AnuladoState();
  }
}

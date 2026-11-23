// Patrón: State

import { CitaEstado } from '../cita-estado.js';
import { CanceladaState } from './cancelada.state.js';
import { ConfirmadaState } from './confirmada.state.js';

export class PendienteState extends CitaEstado {
  readonly nombre = 'Pendiente' as const;

  override confirmar(): CitaEstado {
    return new ConfirmadaState();
  }

  override cancelar(): CitaEstado {
    return new CanceladaState();
  }
}

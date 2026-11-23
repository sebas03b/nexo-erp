// Patrón: State

import { CitaEstado } from '../cita-estado.js';
import { CanceladaState } from './cancelada.state.js';
import { EnProcesoState } from './en-proceso.state.js';

export class ConfirmadaState extends CitaEstado {
  readonly nombre = 'Confirmada' as const;

  override iniciar(): CitaEstado {
    return new EnProcesoState();
  }

  override cancelar(): CitaEstado {
    return new CanceladaState();
  }
}

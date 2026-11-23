// Patrón: State

import { CitaEstado } from '../cita-estado.js';
import { CanceladaState } from './cancelada.state.js';
import { CompletadaState } from './completada.state.js';

export class EnProcesoState extends CitaEstado {
  readonly nombre = 'En Proceso' as const;

  override completar(): CitaEstado {
    return new CompletadaState();
  }

  override cancelar(): CitaEstado {
    return new CanceladaState();
  }
}

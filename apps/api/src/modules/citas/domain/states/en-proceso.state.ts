// Patrón: State

import { CitaEstado } from '../cita-estado.js';
import { CompletadaState } from './completada.state.js';

export class EnProcesoState extends CitaEstado {
  readonly nombre = 'En Proceso' as const;

  override completar(): CitaEstado {
    return new CompletadaState();
  }
}

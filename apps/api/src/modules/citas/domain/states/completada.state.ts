// Patrón: State

import { CitaEstado } from '../cita-estado.js';

export class CompletadaState extends CitaEstado {
  readonly nombre = 'Completada' as const;
}

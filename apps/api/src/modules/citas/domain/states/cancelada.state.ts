// Patrón: State

import { CitaEstado } from '../cita-estado.js';

export class CanceladaState extends CitaEstado {
  readonly nombre = 'Cancelada' as const;
}

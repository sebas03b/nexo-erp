import type { Empleado } from './empleados.types.js';
import type { EmpleadosRepository } from './empleados.repository.js';

export class EmpleadosService {
  readonly #repository: EmpleadosRepository;

  constructor(repository: EmpleadosRepository) {
    this.#repository = repository;
  }

  listarEmpleados(): Promise<Empleado[]> {
    return this.#repository.listarEmpleados();
  }
}

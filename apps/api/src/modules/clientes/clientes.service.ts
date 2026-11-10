import { DomainError, RecursoNoEncontrado } from '../../shared/errors/domain-error.js';
import type { Cliente, CrearClienteData } from './clientes.types.js';
import type { ClientesRepository } from './clientes.repository.js';

export class ClientesService {
  readonly #repository: ClientesRepository;

  constructor(repository: ClientesRepository) {
    this.#repository = repository;
  }

  listarClientes(): Promise<Cliente[]> {
    return this.#repository.listarClientes();
  }

  async obtenerCliente(id: string): Promise<Cliente> {
    const cliente = await this.#repository.obtenerCliente(id);

    if (!cliente) {
      throw new RecursoNoEncontrado('CLIENTE_NO_ENCONTRADO', 'Cliente no encontrado');
    }

    return cliente;
  }

  async eliminarCliente(id: string): Promise<void> {
    await this.obtenerCliente(id);

    const eliminado = await this.#repository.eliminarCliente(id);

    if (!eliminado) {
      throw new RecursoNoEncontrado('CLIENTE_NO_ENCONTRADO', 'Cliente no encontrado');
    }
  }

  async crearCliente(data: CrearClienteData): Promise<Cliente> {
    const existente = await this.#repository.obtenerClientePorDocumento(
      data.documento.trim(),
    );

    if (existente) {
      throw new DomainError('Ya existe un cliente con ese documento', {
        code: 'DOCUMENTO_DUPLICADO',
        statusCode: 409,
      });
    }

    return this.#repository.crearCliente({
      nombre: data.nombre.trim(),
      documento: data.documento.trim(),
      email: data.email,
      telefono: data.telefono,
      canalPreferido: data.canalPreferido,
    });
  }
}

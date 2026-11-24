import type { UnitOfWork, UnitOfWorkContext } from '../../shared/db/unit-of-work.js';
import type { AppEventMap } from '../../shared/events/event-map.js';
import { hashPassword as hashPasswordFn, verifyPassword } from '../../shared/auth/password.js';
import { firmarToken } from '../../shared/auth/jwt.js';
import { DomainError } from '../../shared/errors/domain-error.js';
import type { AuthRepository, Usuario } from './auth.repository.js';

export class AuthService {
  readonly #repository: AuthRepository;
  readonly #unitOfWork: UnitOfWork<AppEventMap>;

  constructor(repository: AuthRepository, unitOfWork: UnitOfWork<AppEventMap>) {
    this.#repository = repository;
    this.#unitOfWork = unitOfWork;
  }

  async login(nombre: string, password: string): Promise<{
    usuario: Usuario;
    token: string;
  }> {
    const usuario = await this.#repository.obtenerUsuarioPorNombre(nombre);

    if (!usuario) {
      throw new DomainError('Usuario o contraseña incorrectos', {
        code: 'CREDENCIALES_INVALIDAS',
        statusCode: 401,
      });
    }

    const valido = await verifyPassword(password, usuario.hashPassword);

    if (!valido) {
      throw new DomainError('Usuario o contraseña incorrectos', {
        code: 'CREDENCIALES_INVALIDAS',
        statusCode: 401,
      });
    }

    const token = firmarToken({ usuarioId: usuario.id, rol: usuario.rol });

    const expiraEn = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.#unitOfWork.execute(async (ctx: UnitOfWorkContext<AppEventMap>) => {
      await this.#repository.crearSesion(ctx.db, {
        usuarioId: usuario.id,
        tokenHash: token,
        expiraEn,
      });
    });

    return { usuario, token };
  }

  async registrarUsuario(
    nombre: string,
    rol: string,
    password: string,
  ): Promise<Usuario> {
    const existente = await this.#repository.obtenerUsuarioPorNombre(nombre);

    if (existente) {
      throw new DomainError('El usuario ya existe', {
        code: 'USUARIO_DUPLICADO',
        statusCode: 409,
      });
    }

    const hash = await hashPasswordFn(password);

    return this.#unitOfWork.execute(async (ctx: UnitOfWorkContext<AppEventMap>) => {
      return this.#repository.crearUsuario(ctx.db, {
        nombre,
        rol,
        hashPassword: hash,
      });
    });
  }

  async obtenerUsuarioPorId(id: string): Promise<Usuario | null> {
    return this.#repository.obtenerUsuarioPorId(id);
  }

  async logout(token: string): Promise<void> {
    await this.#repository.invalidarSesion(token);
  }

  async listarUsuarios(rol?: string): Promise<Usuario[]> {
    return this.#repository.listarUsuarios(rol);
  }
}

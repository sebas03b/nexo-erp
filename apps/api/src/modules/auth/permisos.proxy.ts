// Patrón: Proxy

import { DomainError } from '../../shared/errors/domain-error.js';

export type RolUsuario = 'admin' | 'cajero' | 'contador';

export interface Permiso {
  modulo: string;
  accion: string;
}

const PERMISOS_POR_ROL: Record<RolUsuario, Permiso[]> = {
  admin: [
    { modulo: '*', accion: '*' },
  ],
  cajero: [
    { modulo: 'caja', accion: 'abrir' },
    { modulo: 'caja', accion: 'cerrar' },
    { modulo: 'caja', accion: 'listar' },
    { modulo: 'ventas', accion: 'checkout' },
    { modulo: 'citas', accion: '*' },
  ],
  contador: [
    { modulo: 'contabilidad', accion: 'listar' },
    { modulo: 'contabilidad', accion: 'reporte' },
  ],
};

// Mapeo de nombre de método a (modulo, accion)
const METODO_A_PERMISO: Record<string, Permiso> = {
  abrirCaja: { modulo: 'caja', accion: 'abrir' },
  cerrarCaja: { modulo: 'caja', accion: 'cerrar' },
  listarCajas: { modulo: 'caja', accion: 'listar' },
  listarAsientos: { modulo: 'contabilidad', accion: 'listar' },
  resumenVentas: { modulo: 'contabilidad', accion: 'reporte' },
  registrarVenta: { modulo: 'contabilidad', accion: 'crear' },
  confirmarCita: { modulo: 'citas', accion: 'confirmar' },
  iniciarCita: { modulo: 'citas', accion: 'iniciar' },
  completarCita: { modulo: 'citas', accion: 'completar' },
  cancelarCita: { modulo: 'citas', accion: 'cancelar' },
};

function tienePermiso(rol: RolUsuario, modulo: string, accion: string): boolean {
  const permisos = PERMISOS_POR_ROL[rol];
  return permisos.some((p) =>
    (p.modulo === '*' || p.modulo === modulo) &&
    (p.accion === '*' || p.accion === accion),
  );
}

export function crearPermisosProxy<T extends object>(
  servicio: T,
  rol: RolUsuario,
): T {
  return new Proxy<T>(servicio, {
    get(target, prop: string) {
      const valor = target[prop as keyof T];

      if (typeof valor === 'function') {
        return async (...args: unknown[]) => {
          const metodo = prop as string;

          const permiso = METODO_A_PERMISO[metodo];
          const modulo = permiso?.modulo ?? 'desconocido';
          const accion = permiso?.accion ?? metodo;

          if (!tienePermiso(rol, modulo, accion)) {
            throw new DomainError(
              `Sin permisos para ejecutar ${metodo} en ${modulo}`,
              {
                code: 'SIN_PERMISOS',
                statusCode: 403,
              },
            );
          }

          return valor.apply(target, args);
        };
      }

      return valor;
    },
  });
}

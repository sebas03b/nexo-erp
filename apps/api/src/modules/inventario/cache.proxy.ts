// Patrón: Proxy

export function crearCacheProxy<T extends object>(
  servicio: T,
  ttlMs: number = 60000,
): T {
  const cache = new Map<string, { valor: unknown; expiraEn: number }>();

  function claveCache(metodo: string, args: unknown[]): string {
    return `${metodo}:${JSON.stringify(args)}`;
  }

  function estaExpirada(entrada: { expiraEn: number }): boolean {
    return Date.now() > entrada.expiraEn;
  }

  return new Proxy<T>(servicio, {
    get(target, prop: string) {
      const valor = target[prop as keyof T];

      if (typeof valor === 'function') {
        return async (...args: unknown[]) => {
          const metodo = prop as string;
          const clave = claveCache(metodo, args);

          const entrada = cache.get(clave);
          if (entrada && !estaExpirada(entrada)) {
            return entrada.valor as unknown;
          }

          const resultado = await valor.apply(target, args);
          cache.set(clave, {
            valor: resultado,
            expiraEn: Date.now() + ttlMs,
          });
          return resultado;
        };
      }

      return valor;
    },
  });
}

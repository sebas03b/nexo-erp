import { createHmac } from 'node:crypto';

const JWT_SECRET = 'nexo-erp-dev-secret-change-in-production';
const JWT_EXPIRA_EN_SEGUNDOS = 24 * 60 * 60; // 24 horas

export function firmarToken(payload: { usuarioId: string; rol: string }): string {
  const header = Buffer.from(
    JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
  ).toString('base64url');
  const payloadB64 = Buffer.from(
    JSON.stringify({
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + JWT_EXPIRA_EN_SEGUNDOS,
    }),
  ).toString('base64url');
  const firma = createHmac('sha256', JWT_SECRET)
    .update(`${header}.${payloadB64}`)
    .digest('base64url');

  return `${header}.${payloadB64}.${firma}`;
}

export function verificarToken(token: string): {
  valido: boolean;
  payload?: { usuarioId: string; rol: string; iat: number; exp: number };
  error?: string;
} {
  try {
    const [headerB64, payloadB64, firmaB64] = token.split('.');
    if (!headerB64 || !payloadB64 || !firmaB64) {
      return { valido: false, error: 'Token mal formado' };
    }

    const firmaEsperada = createHmac('sha256', JWT_SECRET)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url');

    if (firmaB64 !== firmaEsperada) {
      return { valido: false, error: 'Firma inválida' };
    }

    const payload = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8'),
    ) as { usuarioId: string; rol: string; iat: number; exp: number };

    if (Date.now() / 1000 > payload.exp) {
      return { valido: false, error: 'Token expirado' };
    }

    return { valido: true, payload };
  } catch {
    return { valido: false, error: 'Token inválido' };
  }
}

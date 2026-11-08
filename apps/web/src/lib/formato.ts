const formatoMoneda = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 2,
});

export function formatearMoneda(valor: number): string {
  return formatoMoneda.format(valor);
}

export function redondearMoneda(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

const formatoFechaHora = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function formatearFechaHora(valor: string): string {
  const fecha = new Date(valor);

  if (Number.isNaN(fecha.getTime())) {
    return '—';
  }

  const partes = formatoFechaHora.formatToParts(fecha);
  const valorDe = (tipo: Intl.DateTimeFormatPartTypes): string =>
    partes.find((parte) => parte.type === tipo)?.value ?? '';

  return `${valorDe('day')}/${valorDe('month')}/${valorDe('year')} ${valorDe('hour')}:${valorDe('minute')}`;
}

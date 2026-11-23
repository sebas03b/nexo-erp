const formatoMoneda = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatearMoneda(valor: number): string {
  return formatoMoneda.format(valor);
}

export function redondearMoneda(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

export const ZONA_HORA_AGENDA = 'America/Bogota';

const formatoFechaHora = new Intl.DateTimeFormat('es-CO', {
  timeZone: ZONA_HORA_AGENDA,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const partesEnZona = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA_HORA_AGENDA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

interface PartesFechaZona {
  anio: number;
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
  segundo: number;
}

function obtenerPartesEnZona(fecha: Date): PartesFechaZona {
  const partes = partesEnZona.formatToParts(fecha);
  const valorDe = (tipo: Intl.DateTimeFormatPartTypes): number => {
    const parte = partes.find((item) => item.type === tipo);
    return parte ? Number(parte.value) : Number.NaN;
  };

  return {
    anio: valorDe('year'),
    mes: valorDe('month'),
    dia: valorDe('day'),
    hora: valorDe('hour'),
    minuto: valorDe('minute'),
    segundo: valorDe('second'),
  };
}

function desplazamientoDeZona(fecha: Date): number {
  const partes = obtenerPartesEnZona(fecha);
  const instanteLocalComoUtc = Date.UTC(
    partes.anio,
    partes.mes - 1,
    partes.dia,
    partes.hora,
    partes.minuto,
    partes.segundo,
  );
  const instanteUtc = Math.floor(fecha.getTime() / 1000) * 1000;

  return instanteLocalComoUtc - instanteUtc;
}

function instanteDesdeZona(
  anio: number,
  mes: number,
  dia: number,
  hora = 0,
  minuto = 0,
  segundo = 0,
): Date {
  const instanteInicial = Date.UTC(
    anio,
    mes - 1,
    dia,
    hora,
    minuto,
    segundo,
  );
  const desplazamientoInicial = desplazamientoDeZona(
    new Date(instanteInicial),
  );
  let resultado = instanteInicial - desplazamientoInicial;
  const desplazamientoCorregido = desplazamientoDeZona(new Date(resultado));

  if (desplazamientoCorregido !== desplazamientoInicial) {
    resultado = instanteInicial - desplazamientoCorregido;
  }

  return new Date(resultado);
}

function esFechaValida(
  anio: number,
  mes: number,
  dia: number,
  hora = 0,
  minuto = 0,
  segundo = 0,
): boolean {
  const fecha = new Date(Date.UTC(anio, mes - 1, dia, hora, minuto, segundo));

  return (
    fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === mes - 1 &&
    fecha.getUTCDate() === dia &&
    fecha.getUTCHours() === hora &&
    fecha.getUTCMinutes() === minuto &&
    fecha.getUTCSeconds() === segundo
  );
}

function analizarDateTimeLocal(valor: string): {
  anio: number;
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
  segundo: number;
} {
  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(
    valor,
  );

  if (!coincidencia) {
    throw new Error('La fecha y hora local no son válidas');
  }

  const anio = Number(coincidencia[1]);
  const mes = Number(coincidencia[2]);
  const dia = Number(coincidencia[3]);
  const hora = Number(coincidencia[4]);
  const minuto = Number(coincidencia[5]);
  const segundo = coincidencia[6] === undefined ? 0 : Number(coincidencia[6]);

  if (
    ![anio, mes, dia, hora, minuto, segundo].every((parte) =>
      Number.isInteger(parte),
    ) ||
    !esFechaValida(anio, mes, dia, hora, minuto, segundo)
  ) {
    throw new Error('La fecha y hora local no son válidas');
  }

  return { anio, mes, dia, hora, minuto, segundo };
}

export function convertirDateTimeLocalAISO(valor: string): string {
  const partes = analizarDateTimeLocal(valor);
  return instanteDesdeZona(
    partes.anio,
    partes.mes,
    partes.dia,
    partes.hora,
    partes.minuto,
    partes.segundo,
  ).toISOString();
}

export function obtenerRangoDiaBogota(
  fecha: string,
): { desde: string; hasta: string } {
  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);

  if (!coincidencia) {
    throw new Error('La fecha del filtro no es válida');
  }

  const anio = Number(coincidencia[1]);
  const mes = Number(coincidencia[2]);
  const dia = Number(coincidencia[3]);

  if (
    ![anio, mes, dia].every((parte) => Number.isInteger(parte)) ||
    !esFechaValida(anio, mes, dia)
  ) {
    throw new Error('La fecha del filtro no es válida');
  }

  const diaSiguiente = new Date(Date.UTC(anio, mes - 1, dia + 1));
  const inicio = instanteDesdeZona(anio, mes, dia);
  const fin = instanteDesdeZona(
    diaSiguiente.getUTCFullYear(),
    diaSiguiente.getUTCMonth() + 1,
    diaSiguiente.getUTCDate(),
  );

  return {
    desde: inicio.toISOString(),
    hasta: fin.toISOString(),
  };
}

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

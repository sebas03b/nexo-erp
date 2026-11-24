import { useCallback, useEffect, useState } from 'react';

import { obtenerJson, enviarJson } from '../lib/api';
import type { AgrupacionVentas, Asiento, Caja, ResumenVentas } from '../types';

export interface UseContabilidadResult {
  caja: Caja | null;
  asientos: Asiento[];
  reporte: ResumenVentas | null;
  cargando: boolean;
  error: string | null;
  abrirCaja: (usuarioId: string, montoInicial: number) => Promise<void>;
  cerrarCaja: (id: string, montoFinal: number) => Promise<void>;
  cargarCajaActual: (usuarioId: string) => Promise<void>;
  cargarAsientos: (desde?: string, hasta?: string) => Promise<void>;
  cargarReporte: (
    desde?: string,
    hasta?: string,
    agrupacion?: AgrupacionVentas,
  ) => Promise<void>;
  limpiarError: () => void;
}

export function useContabilidad(): UseContabilidadResult {
  const [caja, setCaja] = useState<Caja | null>(null);
  const [asientos, setAsientos] = useState<Asiento[]>([]);
  const [reporte, setReporte] = useState<ResumenVentas | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const limpiarError = useCallback(() => setError(null), []);

  const abrirCaja = useCallback(
    async (usuarioId: string, montoInicial: number) => {
      setCargando(true);
      setError(null);
      try {
        const nueva = await enviarJson<Caja>('/api/caja/apertura', 'POST', {
          usuarioId,
          montoInicial,
        });
        setCaja(nueva);
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : 'No se pudo abrir la caja',
        );
      } finally {
        setCargando(false);
      }
    },
    [],
  );

  const cerrarCaja = useCallback(
    async (id: string, montoFinal: number) => {
      setCargando(true);
      setError(null);
      try {
        const cerrada = await enviarJson<Caja>(`/api/caja/${id}/cierre`, 'POST', {
          montoFinal,
        });
        setCaja(cerrada);
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : 'No se pudo cerrar la caja',
        );
      } finally {
        setCargando(false);
      }
    },
    [],
  );

  const cargarCajaActual = useCallback(
    async (usuarioId: string) => {
      setCargando(true);
      setError(null);
      try {
        const data = await obtenerJson<Caja>(
          `/api/caja/actual?usuarioId=${usuarioId}`,
        );
        setCaja(data);
      } catch {
        setCaja(null);
      } finally {
        setCargando(false);
      }
    },
    [],
  );

  const cargarAsientos = useCallback(
    async (desde?: string, hasta?: string) => {
      setCargando(true);
      setError(null);
      try {
        const url = new URL('/api/contabilidad/asientos', window.location.origin);
        if (desde) url.searchParams.set('desde', desde);
        if (hasta) url.searchParams.set('hasta', hasta);
        const data = await obtenerJson<Asiento[]>(url.toString());
        setAsientos(data);
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : 'No se pudieron cargar los asientos',
        );
      } finally {
        setCargando(false);
      }
    },
    [],
  );

  const cargarReporte = useCallback(
    async (desde?: string, hasta?: string, agrupacion: AgrupacionVentas = 'dia') => {
      setCargando(true);
      setError(null);
      try {
        const url = new URL(
          '/api/contabilidad/reporte-ventas',
          window.location.origin,
        );
        if (desde) url.searchParams.set('desde', desde);
        if (hasta) url.searchParams.set('hasta', hasta);
        url.searchParams.set('agrupacion', agrupacion);
        const data = await obtenerJson<ResumenVentas>(url.toString());
        setReporte(data);
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : 'No se pudo cargar el reporte',
        );
      } finally {
        setCargando(false);
      }
    },
    [],
  );

  useEffect(() => {
    void cargarReporte();
  }, [cargarReporte]);

  return {
    caja,
    asientos,
    reporte,
    cargando,
    error,
    abrirCaja,
    cerrarCaja,
    cargarCajaActual,
    cargarAsientos,
    cargarReporte,
    limpiarError,
  };
}

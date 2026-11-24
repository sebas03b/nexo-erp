import { useCallback, useEffect, useState } from 'react';

import { obtenerJson, enviarJson } from '../lib/api';
import type {
  ConceptoNomina,
  LiquidacionResultado,
} from '../types';

export interface UseNominaResult {
  conceptos: ConceptoNomina[];
  liquidaciones: LiquidacionResultado[];
  cargando: boolean;
  error: string | null;
  calcularLiquidacion: (
    empleadoId: string,
    periodo: string,
    salarioBase: number,
    horasExtras?: number,
    auxilioTransporte?: number,
  ) => Promise<void>;
  listarLiquidaciones: (
    empleadoId?: string,
    periodo?: string,
  ) => Promise<void>;
  limpiarError: () => void;
}

export function useNomina(): UseNominaResult {
  const [conceptos, setConceptos] = useState<ConceptoNomina[]>([]);
  const [liquidaciones, setLiquidaciones] = useState<LiquidacionResultado[]>(
    [],
  );
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const limpiarError = useCallback(() => setError(null), []);

  const cargarConceptos = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const data = await obtenerJson<ConceptoNomina[]>('/api/nomina/conceptos');
      setConceptos(data);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'No se pudieron cargar los conceptos de nómina',
      );
    } finally {
      setCargando(false);
    }
  }, []);

  const calcularLiquidacion = useCallback(
    async (
      empleadoId: string,
      periodo: string,
      salarioBase: number,
      horasExtras?: number,
      auxilioTransporte?: number,
    ) => {
      setCargando(true);
      setError(null);
      try {
        const resultado = await enviarJson<LiquidacionResultado>(
          '/api/nomina/calcular',
          'POST',
          {
            empleadoId,
            periodo,
            salarioBase,
            horasExtras,
            auxilioTransporte,
          },
        );
        setLiquidaciones((prev) => [
          resultado,
          ...prev.filter((l) => !(l.empleadoId === empleadoId && l.periodo === periodo)),
        ]);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : 'No se pudo calcular la liquidación',
        );
      } finally {
        setCargando(false);
      }
    },
    [],
  );

  const listarLiquidaciones = useCallback(
    async (empleadoId?: string, periodo?: string) => {
      setCargando(true);
      setError(null);
      try {
        const url = new URL('/api/nomina/liquidaciones', window.location.origin);
        if (empleadoId) url.searchParams.set('empleadoId', empleadoId);
        if (periodo) url.searchParams.set('periodo', periodo);
        const data = await obtenerJson<LiquidacionResultado[]>(url.toString());
        setLiquidaciones(data);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : 'No se pudieron cargar las liquidaciones',
        );
      } finally {
        setCargando(false);
      }
    },
    [],
  );

  useEffect(() => {
    void cargarConceptos();
  }, [cargarConceptos]);

  return {
    conceptos,
    liquidaciones,
    cargando,
    error,
    calcularLiquidacion,
    listarLiquidaciones,
    limpiarError,
  };
}

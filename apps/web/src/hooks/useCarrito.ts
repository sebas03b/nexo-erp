import { useCallback, useEffect, useRef, useState } from 'react';

import { enviarJson, obtenerJson } from '../lib/api';
import type { Carrito } from '../types';

const STORAGE_KEY = 'nexo-pos-carrito-id';

type AccionCarrito =
  | 'AGREGAR_ITEM'
  | 'DECREMENTAR_ITEM'
  | 'QUITAR_ITEM'
  | 'ESTABLECER_CANTIDAD';

export interface UseCarritoResult {
  carritoId: string | null;
  carrito: Carrito | null;
  cargando: boolean;
  error: string | null;
  despacharComando: (
    accion: AccionCarrito,
    payload: Record<string, unknown>,
  ) => Promise<void>;
  deshacer: () => Promise<void>;
  limpiarError: () => void;
  reiniciar: () => Promise<void>;
}

export function useCarrito(): UseCarritoResult {
  const [carrito, setCarrito] = useState<Carrito | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const carritoIdRef = useRef<string | null>(null);
  const enVueloRef = useRef(false);

  const aplicarCarrito = useCallback((nuevo: Carrito) => {
    carritoIdRef.current = nuevo.id;
    sessionStorage.setItem(STORAGE_KEY, nuevo.id);
    setCarrito(nuevo);
  }, []);

  const crearCarrito = useCallback(async () => {
    const nuevo = await enviarJson<Carrito>('/api/carritos', 'POST', {});
    aplicarCarrito(nuevo);
    return nuevo;
  }, [aplicarCarrito]);

  const inicializar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const guardado = sessionStorage.getItem(STORAGE_KEY);
      if (guardado) {
        try {
          const existente = await obtenerJson<Carrito>(`/api/carritos/${guardado}`);
          if (existente.estado === 'Abierto') {
            aplicarCarrito(existente);
            return;
          }
        } catch {
          sessionStorage.removeItem(STORAGE_KEY);
        }
      }
      await crearCarrito();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo inicializar el carrito');
    } finally {
      setCargando(false);
    }
  }, [aplicarCarrito, crearCarrito]);

  useEffect(() => {
    void inicializar();
  }, [inicializar]);

  const despacharComando = useCallback(
    async (accion: AccionCarrito, payload: Record<string, unknown>) => {
      const id = carritoIdRef.current;
      if (!id || enVueloRef.current) return;

      enVueloRef.current = true;
      setCargando(true);
      setError(null);
      try {
        const actualizado = await enviarJson<Carrito>(
          `/api/carritos/${id}/comandos`,
          'POST',
          { accion, payload },
        );
        aplicarCarrito(actualizado);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'No se pudo ejecutar el comando');
      } finally {
        enVueloRef.current = false;
        setCargando(false);
      }
    },
    [aplicarCarrito],
  );

  const deshacer = useCallback(async () => {
    const id = carritoIdRef.current;
    if (!id || enVueloRef.current) return;

    enVueloRef.current = true;
    setCargando(true);
    setError(null);
    try {
      const actualizado = await enviarJson<Carrito>(
        `/api/carritos/${id}/deshacer`,
        'POST',
        {},
      );
      aplicarCarrito(actualizado);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo deshacer');
    } finally {
      enVueloRef.current = false;
      setCargando(false);
    }
  }, [aplicarCarrito]);

  const limpiarError = useCallback(() => setError(null), []);

  const reiniciar = useCallback(async () => {
    sessionStorage.removeItem(STORAGE_KEY);
    carritoIdRef.current = null;
    setCarrito(null);
    await inicializar();
  }, [inicializar]);

  return {
    carritoId: carrito?.id ?? null,
    carrito,
    cargando,
    error,
    despacharComando,
    deshacer,
    limpiarError,
    reiniciar,
  };
}
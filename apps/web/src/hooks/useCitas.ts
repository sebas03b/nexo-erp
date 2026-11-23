import { useCallback, useEffect, useState } from 'react';

import type { Cita, Cliente } from '../types';

const API_BASE = '/api';

interface ApiErrorResponse {
  error?: {
    message?: string;
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = (await response.json().catch(() => ({}))) as T & ApiErrorResponse;

  if (!response.ok) {
    throw new Error(payload.error?.message ?? 'Error inesperado');
  }

  return payload;
}

export function useCitas() {
  const [citas, setCitas] = useState<Cita[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const listar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [citasRes, clientesRes] = await Promise.all([
        request<Cita[]>('/citas'),
        request<Cliente[]>('/clientes'),
      ]);
      setCitas(citasRes);
      setClientes(clientesRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void listar();
  }, [listar]);

  const crear = useCallback(
    async (data: {
      clienteId: string;
      inicio: string;
      fin: string;
      empleadoId?: string;
      notas?: string;
    }) => {
      setError(null);
      await request<Cita>('/citas', { method: 'POST', body: JSON.stringify(data) });
      await listar();
    },
    [listar],
  );

  const cambiarEstado = useCallback(
    async (id: string, accion: 'confirmar' | 'iniciar' | 'completar' | 'cancelar') => {
      setError(null);
      try {
        await request<Cita>(`/citas/${id}/estado`, {
          method: 'PATCH',
          body: JSON.stringify({ accion }),
        });
        await listar();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error inesperado';
        setError(message);
      }
    },
    [listar],
  );

  return { citas, clientes, error, cargando, listar, crear, cambiarEstado };
}

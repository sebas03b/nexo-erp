import { useEffect, useState } from 'react';

import { obtenerJson } from '../lib/api';
import type { Producto, StockItem } from '../types';

interface EstadoCatalogo {
  productos: Producto[];
  stock: Record<string, number>;
  cargando: boolean;
  error: string | null;
  recargar: () => void;
}

export function useCatalogo(): EstadoCatalogo {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [stock, setStock] = useState<Record<string, number>>({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let activo = true;

    async function cargar(): Promise<void> {
      setCargando(true);
      setError(null);

      try {
        const [productosApi, stockApi] = await Promise.all([
          obtenerJson<Producto[]>('/api/productos'),
          obtenerJson<StockItem[]>('/api/stock'),
        ]);

        if (!activo) {
          return;
        }

        setProductos(productosApi);
        setStock(
          Object.fromEntries(stockApi.map((item) => [item.productoId, item.cantidad])),
        );
      } catch (caught) {
        if (activo) {
          setError(
            caught instanceof Error
              ? caught.message
              : 'No se pudieron cargar los productos',
          );
        }
      } finally {
        if (activo) {
          setCargando(false);
        }
      }
    }

    void cargar();

    return () => {
      activo = false;
    };
  }, [recarga]);

  return {
    productos,
    stock,
    cargando,
    error,
    recargar: () => setRecarga((valor) => valor + 1),
  };
}

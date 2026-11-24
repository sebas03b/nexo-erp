export interface MovimientoContable {
  cuenta: 'CAJA' | 'INGRESOS_VENTAS';
  debito: number;
  credito: number;
}

export interface ProductoVendido {
  productoId: string;
  nombre: string;
  tipo: 'producto' | 'servicio';
  cantidad: number;
  total: number;
}

export function construirAsientoVenta(total: number): MovimientoContable[] {
  return [
    { cuenta: 'CAJA', debito: total, credito: 0 },
    { cuenta: 'INGRESOS_VENTAS', debito: 0, credito: total },
  ];
}

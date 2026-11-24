export interface Asiento {
  id: string;
  fecha: string;
  cuenta: string;
  debito: number;
  credito: number;
  origenId: string;
  metodoPago: string | null;
  descripcion: string | null;
  createdAt: string;
}

export interface ResumenVentaDato {
  clave: string;
  total: number;
  cantidad: number;
}

export interface ResumenVentas {
  totalVentas: number;
  cantidadVentas: number;
  agrupacion: 'dia' | 'mes' | 'anio' | 'medio_pago';
  datos: ResumenVentaDato[];
  productosServicios: ProductoVendido[];
}

export interface ProductoVendido {
  productoId: string;
  nombre: string;
  tipo: 'producto' | 'servicio';
  cantidad: number;
  total: number;
}

export interface PedidoPagadoItem {
  productoId: string;
  nombre: string;
  tipo: 'producto' | 'servicio';
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

export interface RegistrarVentaInput {
  pedidoId: string;
  total: number;
  metodoPago: string;
  fecha: string;
  items: PedidoPagadoItem[];
}

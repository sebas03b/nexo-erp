export interface CatalogoProductos {
  obtenerPrecio(productoId: string): Promise<number | null>;
}

export interface ClienteResumen {
  id: string;
  esClienteFrecuente?: boolean;
}

export interface VerificadorClientes {
  obtenerPorDocumento(documento: string): Promise<ClienteResumen | null>;
}

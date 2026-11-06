export interface CatalogoProductos {
  obtenerPrecio(productoId: string): Promise<number | null>;
}

export interface VerificadorClientes {
  existe(clienteId: string): Promise<boolean>;
}

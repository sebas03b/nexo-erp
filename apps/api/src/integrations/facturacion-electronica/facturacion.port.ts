export interface DatosFacturaElectronica {
  readonly numeroFactura: string;
  readonly clienteNombre: string;
  readonly clienteDocumento: string;
  readonly total: number;
  readonly fechaIso: string;
}

export interface ResultadoFacturaElectronica {
  readonly cufe: string;
  readonly xml: string;
}

export interface FacturacionElectronicaPort {
  emitir(datos: DatosFacturaElectronica): Promise<ResultadoFacturaElectronica>;
}

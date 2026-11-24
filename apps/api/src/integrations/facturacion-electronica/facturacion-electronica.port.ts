export interface DatosFacturaInterna {
  facturaId: string;
  numero: string;
  pedidoId: string;
  total: number;
  fecha: string; // ISO
}

export interface ResultadoEmisionExterna {
  estado: 'ACEPTADA' | 'RECHAZADA';
  cufe: string;
  payloadXml: string; // formato externo crudo, para auditar en payload_externo
}

export interface FacturacionElectronicaPort {
  emitir(datos: DatosFacturaInterna): Promise<ResultadoEmisionExterna>;
}

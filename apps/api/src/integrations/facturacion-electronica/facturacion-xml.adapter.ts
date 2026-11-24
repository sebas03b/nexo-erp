// Patrón: Adapter

import type {
  DatosFacturaElectronica,
  FacturacionElectronicaPort,
  ResultadoFacturaElectronica,
} from './facturacion.port.js';
import { LegacyTaxXmlClient } from './proveedor-externo.mock.js';

function extraerCufe(xml: string): string {
  const coincidencia = /<CUFE>([^<]+)<\/CUFE>/.exec(xml);
  const cufe = coincidencia?.[1];

  if (!cufe) {
    throw new Error('La respuesta del proveedor no incluye CUFE');
  }

  return cufe;
}

/** Traduce el contrato de Ventas al formato del cliente legacy y viceversa. */
export class FacturacionXmlAdapter implements FacturacionElectronicaPort {
  constructor(private readonly proveedor: LegacyTaxXmlClient = new LegacyTaxXmlClient()) {}

  async emitir(datos: DatosFacturaElectronica): Promise<ResultadoFacturaElectronica> {
    const xml = this.proveedor.transmitDocument({
      doc_ref: datos.numeroFactura,
      tax_id: datos.clienteDocumento,
      buyer_name: datos.clienteNombre,
      amount_cents: Math.round(datos.total * 100),
      issued_at: datos.fechaIso,
    });

    return { cufe: extraerCufe(xml), xml };
  }
}

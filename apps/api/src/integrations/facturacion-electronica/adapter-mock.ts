// Patrón: Adapter

import type {
  DatosFacturaInterna,
  FacturacionElectronicaPort,
  ResultadoEmisionExterna,
} from './facturacion-electronica.port.js';

const SEMILLA_RECHAZO = 7; // 1 de cada 7 emisiones se rechaza (demo)

export class AdapterFacturacionElectronicaMock implements FacturacionElectronicaPort {
  #contador = 0;

  async emitir(datos: DatosFacturaInterna): Promise<ResultadoEmisionExterna> {
    // 1. Traduce el modelo interno a un XML ajeno (p. ej. DIAN simulada).
    const xml = this.aXml(datos);

    // 2. Simula la respuesta externa y la traduce de vuelta al modelo interno.
    const respuestaExterna = await this.enviarMock();
    return this.deRespuestaExterna(respuestaExterna, xml);
  }

  private aXml(datos: DatosFacturaInterna): string {
    return `<FacturaElectronica>
  <Numero>${datos.numero}</Numero>
  <PedidoId>${datos.pedidoId}</PedidoId>
  <Total>${datos.total}</Total>
  <Fecha>${datos.fecha}</Fecha>
  <FacturaId>${datos.facturaId}</FacturaId>
</FacturaElectronica>`;
  }

  private async enviarMock(): Promise<{ estado: 'ACEPTADA' | 'RECHAZADA'; cufe: string }> {
    await Promise.resolve();
    this.#contador += 1;
    const rechazado = this.#contador % SEMILLA_RECHAZO === 0;
    return {
      estado: rechazado ? 'RECHAZADA' : 'ACEPTADA',
      cufe: `CUFE-${this.#contador}-${Date.now()}`,
    };
  }

  private deRespuestaExterna(
    respuesta: { estado: 'ACEPTADA' | 'RECHAZADA'; cufe: string },
    payloadXml: string,
  ): ResultadoEmisionExterna {
    return {
      estado: respuesta.estado,
      cufe: respuesta.cufe,
      payloadXml,
    };
  }
}

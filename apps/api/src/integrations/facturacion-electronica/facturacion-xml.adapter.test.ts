import { describe, expect, it } from 'vitest';

import { FacturacionXmlAdapter } from './facturacion-xml.adapter.js';

describe('Patrón Adapter - facturación electrónica', () => {
  it('traduce el total a centavos y extrae el CUFE del XML del proveedor', async () => {
    const adapter = new FacturacionXmlAdapter();

    const resultado = await adapter.emitir({
      numeroFactura: 'FAC-000001',
      clienteNombre: 'Cliente & Prueba',
      clienteDocumento: '123456789',
      total: 123.45,
      fechaIso: '2026-11-24T12:00:00.000Z',
    });

    expect(resultado.cufe).toBe('CUFE-FAC-000001-12345');
    expect(resultado.xml).toContain('<AmountCents>12345</AmountCents>');
    expect(resultado.xml).toContain(`<CUFE>${resultado.cufe}</CUFE>`);
    expect(resultado.xml).toContain('<Buyer>Cliente &amp; Prueba</Buyer>');
    expect(resultado.xml).toContain('<IssuedAt>2026-11-24T12:00:00.000Z</IssuedAt>');
  });
});

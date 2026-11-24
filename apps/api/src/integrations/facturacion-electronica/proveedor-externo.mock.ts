interface DocumentoLegacy {
  doc_ref: string;
  tax_id: string;
  buyer_name: string;
  amount_cents: number;
  issued_at: string;
}

function escaparXml(valor: string): string {
  return valor
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** Simula una librería externa con nombres y formatos incompatibles con el dominio. */
export class LegacyTaxXmlClient {
  transmitDocument(raw: DocumentoLegacy): string {
    const cufe = `CUFE-${raw.doc_ref}-${raw.amount_cents}`;

    return [
      '<Invoice>',
      `<CUFE>${cufe}</CUFE>`,
      `<Number>${escaparXml(raw.doc_ref)}</Number>`,
      `<TaxId>${escaparXml(raw.tax_id)}</TaxId>`,
      `<Buyer>${escaparXml(raw.buyer_name)}</Buyer>`,
      `<AmountCents>${raw.amount_cents}</AmountCents>`,
      `<IssuedAt>${escaparXml(raw.issued_at)}</IssuedAt>`,
      '</Invoice>',
    ].join('');
  }
}

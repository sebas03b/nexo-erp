export type CitasEventMap = {
  CitaConfirmada: {
    citaId: string;
    clienteId: string;
    inicio: string;
    fin: string;
    confirmadaEn: string;
  };
  RecordatorioCitaSolicitado: {
    citaId: string;
    clienteId: string;
    inicio: string;
    fin: string;
    notas: string | null;
  };
};

export interface ObtenerClienteParaCita {
  obtener(id: string): Promise<{
    id: string;
    nombre: string;
    canalPreferido: 'email' | 'sms' | 'whatsapp';
  } | null>;
}

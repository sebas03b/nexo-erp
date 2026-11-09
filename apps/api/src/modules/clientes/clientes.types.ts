export type CanalPreferido = 'email' | 'sms' | 'whatsapp';

export interface Cliente {
  id: string;
  nombre: string;
  documento: string;
  email: string | undefined;
  telefono: string | undefined;
  canalPreferido: CanalPreferido;
}

export interface CrearClienteData {
  nombre: string;
  documento: string;
  email?: string;
  telefono?: string;
  canalPreferido: CanalPreferido;
}

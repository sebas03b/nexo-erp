// Patrón: Command

export interface Comando {
  ejecutar(): Promise<void>;
  deshacer(): Promise<void>;
}

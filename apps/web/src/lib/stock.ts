export function claseStock(cantidad: number): string {
  if (cantidad <= 0) {
    return 'stock-critico';
  }

  if (cantidad <= 5) {
    return 'stock-bajo';
  }

  if (cantidad <= 15) {
    return 'stock-medio';
  }

  return 'stock-alto';
}

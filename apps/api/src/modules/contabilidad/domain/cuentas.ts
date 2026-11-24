export const CUENTA_CAJA = 'CAJA' as const;
export const CUENTA_INGRESOS_VENTAS = 'INGRESOS_VENTAS' as const;

export type Cuenta = typeof CUENTA_CAJA | typeof CUENTA_INGRESOS_VENTAS;

// Script de siembra (seed) de datos para el entorno de desarrollo/demo.
// Limpia las tablas de inventario, clientes, pedidos y facturas,
// luego inserta datos semilla realistas para probar el POS.

import { createDatabase } from '../shared/db/database.js';

const db = createDatabase();

const CLIENTES = [
  {
    nombre: 'Ana González',
    documento: '1098765432',
    email: 'anagonzalez@email.com',
    telefono: '3001112233',
    canal_preferido: 'email',
  },
  {
    nombre: 'Carlos Ramírez',
    documento: '1122334455',
    email: 'carlosramirez@email.com',
    telefono: '3014445566',
    canal_preferido: 'whatsapp',
  },
  {
    nombre: 'María Díaz',
    documento: '1234567890',
    email: 'mariadiaz@email.com',
    telefono: '3027778899',
    canal_preferido: 'sms',
  },
];

const PRODUCTOS = [
  { sku: 'BEL-001', nombre: 'Shampoo Kérastase Nutritive 250ml', precio: 129900, tipo: 'producto' },
  { sku: 'BEL-002', nombre: 'Mascarilla Capilar Olaplex N°3 100ml', precio: 149900, tipo: 'producto' },
  { sku: 'BEL-003', nombre: 'Esmalte Semipermanente OPI Gel Color', precio: 54900, tipo: 'producto' },
  { sku: 'BEL-004', nombre: 'Aceite Argán Moroccanoil Treatment 100ml', precio: 179900, tipo: 'producto' },
  { sku: 'SRV-001', nombre: 'Corte de Cabello Dama', precio: 45000, tipo: 'servicio' },
  { sku: 'SRV-002', nombre: 'Tinte y Coloración Completa', precio: 180000, tipo: 'servicio' },
  { sku: 'SRV-003', nombre: 'Manicure Semipermanente', precio: 60000, tipo: 'servicio' },
  { sku: 'SRV-004', nombre: 'Tratamiento de Keratina', precio: 250000, tipo: 'servicio' },
];

const STOCK_POR_PRODUCTO = [30, 20, 60, 25, 0, 0, 0, 0];

async function main(): Promise<void> {
  try {
    console.log('Limpiando tablas de inventario y clientes…');

    await db.deleteFrom('pedido_items').execute();
    await db.deleteFrom('facturas').execute();
    await db.deleteFrom('pedidos').execute();
    await db.deleteFrom('stock').execute();
    await db.deleteFrom('productos').execute();
    await db.deleteFrom('clientes').execute();

    console.log('Insertando clientes…');

    const clientesInsertados = await db
      .insertInto('clientes')
      .values(CLIENTES)
      .returning(['id', 'nombre', 'documento'])
      .execute();

    console.log(
      `   Se insertaron ${clientesInsertados.length} clientes:`,
    );
    for (const cliente of clientesInsertados) {
      console.log(`   - ${cliente.nombre} (${cliente.documento})`);
    }

    console.log('Insertando productos y stock…');

    const productosInsertados = await db
      .insertInto('productos')
      .values(PRODUCTOS)
      .returning(['id', 'sku', 'nombre'])
      .execute();

    for (let i = 0; i < productosInsertados.length; i += 1) {
      const producto = productosInsertados[i];

      if (!producto || PRODUCTOS[i]?.tipo !== 'producto') {
        continue;
      }

      const cantidad = STOCK_POR_PRODUCTO[i] ?? 0;

      await db
        .insertInto('stock')
        .values({ producto_id: producto.id, cantidad })
        .execute();

      console.log(`   - ${producto.sku} ${producto.nombre} — stock: ${cantidad}`);
    }

    console.log('Seed completado exitosamente.');
  } catch (error) {
    console.error('Error durante el seed:', error);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

void main();

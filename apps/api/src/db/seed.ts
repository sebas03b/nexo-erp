// Script de siembra (seed) de datos para el entorno de desarrollo/demo.
// Limpia las tablas de inventario, clientes, pedidos y facturas,
// luego inserta datos semilla realistas para probar el POS.

import { createDatabase } from '../shared/db/database.js';
import { hashPassword } from '../shared/auth/password.js';

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

const EMPLEADOS = [
  {
    nombre: 'Laura Pérez',
    email: 'lauraperez@email.com',
    telefono: '3001112233',
    activo: true,
    salario_base: 1500000,
  },
  {
    nombre: 'Mateo Rojas',
    email: 'mateorojas@email.com',
    telefono: '3014445566',
    activo: true,
    salario_base: 1800000,
  },
  {
    nombre: 'Sofía Navarro',
    email: 'sofianavarro@email.com',
    telefono: '3027778899',
    activo: true,
    salario_base: 1200000,
  },
];

const CONCEPTOS_NOMINA = [
  { codigo: 'SALARIO_BASE', nombre: 'Salario base', tipo: 'devengo' as const, activo: true },
  { codigo: 'HORAS_EXTRAS', nombre: 'Horas extras', tipo: 'devengo' as const, activo: true },
  { codigo: 'AUXILIO_TRANSPORTE', nombre: 'Auxilio de transporte', tipo: 'devengo' as const, activo: true },
  { codigo: 'SALUD', nombre: 'Salud (4%)', tipo: 'deduccion' as const, activo: true },
  { codigo: 'PENSION', nombre: 'Pensión (4%)', tipo: 'deduccion' as const, activo: true },
];

const USUARIOS_SEED = [
  { nombre: 'admin', rol: 'admin', password: 'admin123' },
  { nombre: 'cajero1', rol: 'cajero', password: 'cajero123' },
  { nombre: 'contador1', rol: 'contador', password: 'contador123' },
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

function crearInicioDemo(): Date {
  const inicio = new Date();
  inicio.setHours(14, 0, 0, 0);

  if (inicio.getTime() <= Date.now()) {
    inicio.setDate(inicio.getDate() + 1);
  }

  return inicio;
}

async function main(): Promise<void> {
  try {
    console.log('Limpiando tablas de inventario y clientes…');

    await db.deleteFrom('citas').execute();
    await db.deleteFrom('asientos').execute();
    await db.deleteFrom('cajas').execute();
    await db.deleteFrom('sesiones').execute();
    await db.deleteFrom('usuarios').execute();
    await db.deleteFrom('liquidaciones').execute();
    await db.deleteFrom('conceptos_nomina').execute();
    await db.deleteFrom('empleados').execute();
    await db.deleteFrom('facturas').execute();
    await db.deleteFrom('pedido_items').execute();
    await db.deleteFrom('pedidos').execute();
    await db.deleteFrom('carrito_comandos').execute();
    await db.deleteFrom('carrito_items').execute();
    await db.deleteFrom('carritos').execute();
    await db.deleteFrom('stock').execute();
    await db.deleteFrom('productos').execute();
    await db.deleteFrom('clientes').execute();
    await db.deleteFrom('outbox_events').execute();

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

    console.log('Insertando empleados…');

    const empleadosInsertados = await db
      .insertInto('empleados')
      .values(EMPLEADOS)
      .returning(['id', 'nombre'])
      .execute();

    for (const empleado of empleadosInsertados) {
      console.log(`   - ${empleado.nombre}`);
    }

    console.log('Insertando usuarios…');

    const usuariosConHash = await Promise.all(
      USUARIOS_SEED.map(async (u) => ({
        nombre: u.nombre,
        rol: u.rol,
        hash_password: await hashPassword(u.password),
      })),
    );

    const usuariosInsertados = await db
      .insertInto('usuarios')
      .values(usuariosConHash)
      .returning(['id', 'nombre', 'rol'])
      .execute();

    for (const usuario of usuariosInsertados) {
      console.log(`   - ${usuario.nombre} (${usuario.rol})`);
    }

    console.log('Insertando conceptos de nómina…');

    const conceptosInsertados = await db
      .insertInto('conceptos_nomina')
      .values(CONCEPTOS_NOMINA)
      .returning(['id', 'codigo', 'tipo'])
      .execute();

    for (const concepto of conceptosInsertados) {
      console.log(`   - ${concepto.codigo} (${concepto.tipo})`);
    }

    const clienteDemo = clientesInsertados[0];
    const empleadoDemo = empleadosInsertados[0];
    const inicioDemo = crearInicioDemo();
    const finDemo = new Date(inicioDemo.getTime() + 60 * 60 * 1000);
    const inicioDemoSecundario = new Date(finDemo.getTime());
    const finDemoSecundario = new Date(inicioDemoSecundario.getTime() + 60 * 60 * 1000);

    if (clienteDemo && empleadoDemo) {
      console.log('Insertando citas de demostración…');

      await db
        .insertInto('citas')
        .values([
          {
            cliente_id: clienteDemo.id,
            empleado_id: empleadoDemo.id,
            inicio: inicioDemo,
            fin: finDemo,
            estado: 'Pendiente',
            motivo: 'Corte y color',
          },
          {
            cliente_id: clienteDemo.id,
            empleado_id: empleadoDemo.id,
            inicio: inicioDemoSecundario,
            fin: finDemoSecundario,
            estado: 'Confirmada',
            motivo: 'Manicure semipermanente',
          },
        ])
        .execute();
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

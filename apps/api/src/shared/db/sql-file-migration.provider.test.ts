import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { SqlFileMigrationProvider } from './sql-file-migration.provider.js';

const MIGRATIONS_DIRECTORY = fileURLToPath(
  new URL('../../../../../db/migrations', import.meta.url),
);

describe('SqlFileMigrationProvider', () => {
  it('carga la migración inicial con sus scripts up y down', async () => {
    const provider = new SqlFileMigrationProvider(MIGRATIONS_DIRECTORY);

    const migrations = await provider.getMigrations();

    expect(Object.keys(migrations)).toEqual([
      '0001_initial_schema',
      '0002_outbox_events',
      '0003_inventario_pedidos',
      '0004_pedidos_created_at',
      '0005_carritos',
      '0006_citas',
      '0007_carrito_items_lineas',
    ]);
    expect(typeof migrations['0002_outbox_events']?.up).toBe('function');
    expect(typeof migrations['0002_outbox_events']?.down).toBe('function');
    expect(typeof migrations['0003_inventario_pedidos']?.up).toBe('function');
    expect(typeof migrations['0003_inventario_pedidos']?.down).toBe('function');
    expect(typeof migrations['0004_pedidos_created_at']?.up).toBe('function');
    expect(typeof migrations['0004_pedidos_created_at']?.down).toBe('function');
    expect(typeof migrations['0005_carritos']?.up).toBe('function');
    expect(typeof migrations['0005_carritos']?.down).toBe('function');
    expect(typeof migrations['0007_carrito_items_lineas']?.up).toBe('function');
    expect(typeof migrations['0007_carrito_items_lineas']?.down).toBe('function');
  });
});

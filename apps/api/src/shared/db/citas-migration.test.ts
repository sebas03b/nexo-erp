import { fileURLToPath } from 'node:url';

import { PGlite } from '@electric-sql/pglite';
import { Kysely, PGliteDialect, sql } from 'kysely';
import { Migrator } from 'kysely/migration';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SqlFileMigrationProvider } from './sql-file-migration.provider.js';
import type { Database } from './schema.js';

const MIGRATIONS_DIRECTORY = fileURLToPath(
  new URL('../../../../../db/migrations', import.meta.url),
);

describe('Migración de Citas y Empleados', () => {
  let db: Kysely<Database>;
  let migrator: Migrator;

  beforeAll(async () => {
    const pglite = new PGlite();
    db = new Kysely<Database>({
      dialect: new PGliteDialect({ pglite }),
    });
    migrator = new Migrator({
      db,
      provider: new SqlFileMigrationProvider(MIGRATIONS_DIRECTORY),
    });

    const { error } = await migrator.migrateToLatest();
    if (error) {
      throw new Error('No se pudieron aplicar las migraciones de prueba', {
        cause: error,
      });
    }
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('crea las tablas de la agenda y revierte la migración 0006', async () => {
    const tablas = await sql<{ tabla: string | null }>`
      select to_regclass('citas')::text as tabla
    `.execute(db);
    const empleados = await sql<{ tabla: string | null }>`
      select to_regclass('empleados')::text as tabla
    `.execute(db);

    expect(tablas.rows.at(0)?.tabla).toBe('citas');
    expect(empleados.rows.at(0)?.tabla).toBe('empleados');

    const { error } = await migrator.migrateDown();
    if (error) {
      throw new Error('No se pudo revertir la migración de prueba', {
        cause: error,
      });
    }

    const tablasRevertidas = await sql<{ tabla: string | null }>`
      select to_regclass('citas')::text as tabla
    `.execute(db);

    expect(tablasRevertidas.rows.at(0)?.tabla).toBeNull();
  });
});

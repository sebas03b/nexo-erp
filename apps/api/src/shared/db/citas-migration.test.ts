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

  it('crea la agenda, aplica sus restricciones y revierte la migración 0006', async () => {
    const tablas = await sql<{ tabla: string | null }>`
      select to_regclass('citas')::text as tabla
    `.execute(db);
    const empleados = await sql<{ tabla: string | null }>`
      select to_regclass('empleados')::text as tabla
    `.execute(db);

    expect(tablas.rows.at(0)?.tabla).toBe('citas');
    expect(empleados.rows.at(0)?.tabla).toBe('empleados');

    const cliente = await db
      .insertInto('clientes')
      .values({
        nombre: 'Cliente de migración',
        documento: 'migracion-1',
        email: null,
        telefono: null,
        canal_preferido: 'email',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const empleado = await db
      .insertInto('empleados')
      .values({
        nombre: 'Empleado de migración',
        email: null,
        telefono: null,
        activo: true,
        salario_base: 1500000,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const inicio = new Date('2026-11-25T15:00:00.000Z');
    const fin = new Date('2026-11-25T16:00:00.000Z');
    const cita = await db
      .insertInto('citas')
      .values({
        cliente_id: cliente.id,
        empleado_id: empleado.id,
        inicio,
        fin,
        motivo: null,
      })
      .returning(['estado', 'creado_en', 'actualizado_en'])
      .executeTakeFirstOrThrow();

    expect(cita.estado).toBe('Pendiente');
    expect(cita.creado_en).toBeInstanceOf(Date);
    expect(cita.actualizado_en).toBeInstanceOf(Date);

    await expect(
      sql`
        insert into citas (cliente_id, empleado_id, inicio, fin, estado)
        values (${cliente.id}, ${empleado.id}, ${inicio}, ${fin}, 'Inventado')
      `.execute(db),
    ).rejects.toThrow();
    await expect(
      sql`
        insert into citas (cliente_id, empleado_id, inicio, fin)
        values (${cliente.id}, ${empleado.id}, ${fin}, ${inicio})
      `.execute(db),
    ).rejects.toThrow();
    await expect(
      db.deleteFrom('empleados').where('id', '=', empleado.id).execute(),
    ).rejects.toThrow();

    const indices = await sql<{ indexname: string }>`
      select indexname
      from pg_indexes
      where tablename = 'citas'
    `.execute(db);
    expect(indices.rows.map((row) => row.indexname)).toEqual(
      expect.arrayContaining([
        'citas_agenda_idx',
        'citas_cliente_idx',
        'citas_estado_idx',
      ]),
    );

    const { error } = await migrator.migrateDown();
    if (error) {
      throw new Error('No se pudo revertir la migración de prueba', {
        cause: error,
      });
    }
    // 0009_nomina, 0008_contabilidad y 0007_cajas se aplican después de 0006_citas.
    // migrateDown() revierte una a la vez; revertimos hasta llegar a 0006.
    await migrator.migrateDown();
    await migrator.migrateDown();
    await migrator.migrateDown();

    const tablasRevertidas = await sql<{ tabla: string | null }>`
      select to_regclass('citas')::text as tabla
    `.execute(db);
    const empleadosRevertidos = await sql<{ tabla: string | null }>`
      select to_regclass('empleados')::text as tabla
    `.execute(db);

    expect(tablasRevertidas.rows.at(0)?.tabla).toBeNull();
    expect(empleadosRevertidos.rows.at(0)?.tabla).toBeNull();
  });
});

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
    const initialMigration = migrations['0001_initial_schema'];

    expect(typeof initialMigration?.up).toBe('function');
    expect(typeof initialMigration?.down).toBe('function');
  });
});

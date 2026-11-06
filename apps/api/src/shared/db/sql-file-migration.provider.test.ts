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

    expect(Object.keys(migrations)).toEqual(['0001_initial_schema', '0002_outbox_events']);
    expect(typeof migrations['0002_outbox_events']?.up).toBe('function');
    expect(typeof migrations['0002_outbox_events']?.down).toBe('function');
  });
});

import { fileURLToPath } from 'node:url';

import { Migrator } from 'kysely/migration';

import { createDatabase } from './database.js';
import { SqlFileMigrationProvider } from './sql-file-migration.provider.js';

const MIGRATIONS_DIRECTORY = fileURLToPath(
  new URL('../../../../../db/migrations', import.meta.url),
);

const direction = process.argv[2];

if (direction !== 'up' && direction !== 'down') {
  console.error('Uso: pnpm db:migrate:<up|down>');
  process.exit(1);
}

const db = createDatabase();
const migrator = new Migrator({
  db,
  provider: new SqlFileMigrationProvider(MIGRATIONS_DIRECTORY),
});

try {
  const { error, results } =
    direction === 'up' ? await migrator.migrateToLatest() : await migrator.migrateDown();

  for (const migration of results ?? []) {
    console.log(
      `${migration.status === 'Success' ? 'OK' : 'ERROR'} ${migration.direction} ${migration.migrationName}`,
    );
  }

  if (error) {
    console.error('La migración falló:', error);
    process.exitCode = 1;
  } else if ((results ?? []).length === 0) {
    console.log('No hay migraciones para ejecutar.');
  }
} finally {
  await db.destroy();
}

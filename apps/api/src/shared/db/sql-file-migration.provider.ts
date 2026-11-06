import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { sql, type Kysely } from 'kysely';
import type { Migration, MigrationProvider } from 'kysely/migration';

const UP_SUFFIX = '.up.sql';
const DOWN_SUFFIX = '.down.sql';

function createSqlMigration(script: string): (db: Kysely<unknown>) => Promise<void> {
  return async (db) => {
    await sql.raw(script).execute(db);
  };
}

export class SqlFileMigrationProvider implements MigrationProvider {
  readonly #directory: string;

  constructor(directory: string) {
    this.#directory = directory;
  }

  async getMigrations(): Promise<Record<string, Migration>> {
    const files = await readdir(this.#directory);
    const migrations: Record<string, Migration> = {};

    for (const file of files.filter((name) => name.endsWith(UP_SUFFIX)).sort()) {
      const name = file.slice(0, -UP_SUFFIX.length);
      const upPath = join(this.#directory, file);
      const downPath = join(this.#directory, `${name}${DOWN_SUFFIX}`);

      const [upSql, downSql] = await Promise.all([
        readFile(upPath, 'utf8'),
        readFile(downPath, 'utf8').catch(() => {
          throw new Error(`Falta el archivo down para la migración "${name}": ${downPath}`);
        }),
      ]);

      migrations[name] = {
        up: createSqlMigration(upSql),
        down: createSqlMigration(downSql),
      };
    }

    return migrations;
  }
}

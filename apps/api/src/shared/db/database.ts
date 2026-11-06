import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';

import { env } from '../../config/env.js';
import type { Database } from './schema.js';

export function createDatabase(): Kysely<Database> {
  return new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString: env.DATABASE_URL,
      }),
    }),
  });
}

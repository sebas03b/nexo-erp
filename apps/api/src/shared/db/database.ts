import type { Kysely } from 'kysely';

import { env } from '../../config/env.js';
import { createDatabasePool } from './pool.js';
import type { Database } from './schema.js';

export function createDatabase(): Kysely<Database> {
  return createDatabasePool({ connectionString: env.DATABASE_URL }).db;
}

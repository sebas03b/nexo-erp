import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';

import type { Database } from './schema.js';

export interface DatabasePoolConfig {
  connectionString: string;
  maxConnections?: number;
  idleTimeoutMillis?: number;
}

export interface DatabasePool {
  readonly pool: Pool;
  readonly db: Kysely<Database>;
  close(): Promise<void>;
}

export function createDatabasePool(config: DatabasePoolConfig): DatabasePool {
  const pool = new Pool({
    connectionString: config.connectionString,
    max: config.maxConnections,
    idleTimeoutMillis: config.idleTimeoutMillis,
  });

  const db = new Kysely<Database>({
    dialect: new PostgresDialect({ pool }),
  });

  return {
    pool,
    db,
    async close() {
      await db.destroy();
    },
  };
}

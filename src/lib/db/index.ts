import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

// Allow building without DATABASE_URL - it will be required at runtime
const databaseUrl = process.env.DATABASE_URL || 'postgresql://dummy:dummy@localhost/dummy';

/**
 * Initialize Neon serverless connection
 */
let sql: ReturnType<typeof neon>;
try {
  sql = neon(databaseUrl);
} catch (error) {
  // During build, if neon initialization fails, provide a fallback
  sql = neon('postgresql://dummy:dummy@localhost/dummy');
}

/**
 * Create Drizzle ORM instance
 */
export const db = drizzle(sql, { schema });

/**
 * Export schema for type safety
 */
export * from './schema';

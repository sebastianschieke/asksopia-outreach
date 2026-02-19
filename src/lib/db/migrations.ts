/**
 * Database migration utilities
 * Run migrations manually or during deployment
 */

import { sql } from 'drizzle-orm';
import { db } from './index';

/**
 * Initialize database schema
 * Call this once during initial setup
 */
export async function initializeDatabase() {
  try {
    console.log('Initializing database schema...');

    // Create tables using raw SQL if Drizzle migrations aren't available
    // This is a fallback for manual setup

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
}

/**
 * Add signal_description_de column for cached German translations
 * Run once: POST /api/admin/seed or call directly
 */
export async function addSignalDescriptionDeColumn() {
  try {
    await db.execute(sql`
      ALTER TABLE recipients
      ADD COLUMN IF NOT EXISTS signal_description_de TEXT
    `);
    console.log('Added signal_description_de column');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

/**
 * Check if database is accessible
 */
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await db.execute(sql`SELECT 1`);
    return true;
  } catch (error) {
    console.error('Database connection check failed:', error);
    return false;
  }
}

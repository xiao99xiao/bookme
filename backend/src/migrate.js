#!/usr/bin/env node
/**
 * Database Migration Runner
 *
 * Runs all SQL migration files in order before deployment.
 * All migrations must be idempotent (use IF NOT EXISTS, etc.)
 *
 * Usage:
 *   node src/migrate.js
 *   npm run migrate
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Migration directory (relative to backend root)
const MIGRATIONS_DIR = path.resolve(__dirname, '../../database/migrations');

/**
 * Get all SQL migration files sorted by name
 */
function getMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.log(`⚠️  Migrations directory not found: ${MIGRATIONS_DIR}`);
    return [];
  }

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort(); // Alphabetical order

  return files;
}

/**
 * Run a single migration file
 */
async function runMigration(client, filename) {
  const filepath = path.join(MIGRATIONS_DIR, filename);
  const sql = fs.readFileSync(filepath, 'utf8');

  console.log(`  📄 Running: ${filename}`);

  try {
    await client.query(sql);
    console.log(`  ✅ Success: ${filename}`);
    return { success: true, filename };
  } catch (error) {
    console.error(`  ❌ Failed: ${filename}`);
    console.error(`     Error: ${error.message}`);
    return { success: false, filename, error: error.message };
  }
}

/**
 * Main migration runner
 */
async function runMigrations() {
  console.log('🚀 Starting database migrations...\n');

  // Check for DATABASE_URL
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  // Get migration files
  const files = getMigrationFiles();

  if (files.length === 0) {
    console.log('ℹ️  No migration files found');
    process.exit(0);
  }

  console.log(`📁 Found ${files.length} migration file(s):\n`);

  // Create database connection
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Run each migration
    const results = [];
    for (const file of files) {
      const result = await runMigration(client, file);
      results.push(result);
    }

    // Summary
    console.log('\n📊 Migration Summary:');
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`   ✅ Successful: ${successful}`);
    console.log(`   ❌ Failed: ${failed}`);

    if (failed > 0) {
      console.error('\n❌ Some migrations failed. Please check the errors above.');
      process.exit(1);
    }

    console.log('\n✅ All migrations completed successfully!\n');

  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run migrations
runMigrations();

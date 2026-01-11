/**
 * Database Migration Runner
 *
 * Usage:
 *   node database/run-migration.js database/migrations/add_points_system.sql
 *
 * Environment:
 *   DATABASE_URL - PostgreSQL connection string
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env' });

const { Pool } = pg;

async function runMigration() {
  const migrationFile = process.argv[2];

  if (!migrationFile) {
    console.error('Usage: node database/run-migration.js <migration-file.sql>');
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL environment variable is not set');
    console.error('Make sure backend/.env contains DATABASE_URL');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    // Read migration file
    const migrationPath = path.resolve(migrationFile);
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log(`\n📄 Running migration: ${migrationFile}`);
    console.log('=' .repeat(50));

    // Execute migration
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('COMMIT');
      console.log('\n✅ Migration completed successfully!');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('\n❌ Migration failed, rolled back');
      throw error;
    } finally {
      client.release();
    }

    // Verify tables created
    const verifyResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('user_points', 'point_transactions', 'funding_records')
      ORDER BY table_name
    `);

    console.log('\n📊 Verification:');
    console.log('Tables created:', verifyResult.rows.map(r => r.table_name).join(', '));

    // Count records
    const countsResult = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM user_points) as user_points_count,
        (SELECT COUNT(*) FROM point_transactions) as point_transactions_count,
        (SELECT COUNT(*) FROM funding_records) as funding_records_count
    `);
    console.log('Record counts:', countsResult.rows[0]);

    // Check bookings columns
    const columnsResult = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'bookings'
      AND column_name IN ('original_amount', 'points_used', 'points_value', 'usdc_paid')
    `);
    console.log('New booking columns:', columnsResult.rows.map(r => r.column_name).join(', '));

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.detail) console.error('Detail:', error.detail);
    if (error.hint) console.error('Hint:', error.hint);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();

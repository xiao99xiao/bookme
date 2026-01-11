/**
 * PostgreSQL Database Connection Module for Backend-Cron
 *
 * Uses pg library to connect to Railway PostgreSQL
 */

import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config({ path: '.env' })

const { Pool } = pg

// Create connection pool
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
  max: 5, // Smaller pool for cron service
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
})

// Connection events
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL')
})

pool.on('error', (err) => {
  console.error('❌ PostgreSQL pool error:', err)
})

/**
 * Execute a query
 * @param {string} text - SQL query
 * @param {any[]} params - Query parameters
 */
export async function query(text, params) {
  const start = Date.now()
  const result = await pool.query(text, params)
  const duration = Date.now() - start

  // Slow query warning
  if (duration > 100) {
    console.log('⚠️ Slow query:', { text: text.substring(0, 100), duration, rows: result.rowCount })
  }

  return result
}

/**
 * Get single row result
 * @param {string} text - SQL query
 * @param {any[]} params - Query parameters
 */
export async function queryOne(text, params) {
  const result = await query(text, params)
  return result.rows[0] || null
}

/**
 * Get multiple rows result
 * @param {string} text - SQL query
 * @param {any[]} params - Query parameters
 */
export async function queryAll(text, params) {
  const result = await query(text, params)
  return result.rows
}

export default pool

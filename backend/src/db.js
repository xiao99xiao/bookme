/**
 * PostgreSQL 数据库连接模块
 *
 * 使用 pg 库连接 Railway PostgreSQL
 */

import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config({ path: '.env' })

const { Pool } = pg

// 创建连接池
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})

// 连接事件
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL')
})

pool.on('error', (err) => {
  console.error('❌ PostgreSQL pool error:', err)
})

/**
 * 执行查询
 * @param {string} text - SQL 查询
 * @param {any[]} params - 查询参数
 */
export async function query(text, params) {
  const start = Date.now()
  const result = await pool.query(text, params)
  const duration = Date.now() - start

  // 慢查询警告
  if (duration > 100) {
    console.log('⚠️ Slow query:', { text: text.substring(0, 100), duration, rows: result.rowCount })
  }

  return result
}

/**
 * 获取单行结果
 * @param {string} text - SQL 查询
 * @param {any[]} params - 查询参数
 */
export async function queryOne(text, params) {
  const result = await query(text, params)
  return result.rows[0] || null
}

/**
 * 获取多行结果
 * @param {string} text - SQL 查询
 * @param {any[]} params - 查询参数
 */
export async function queryAll(text, params) {
  const result = await query(text, params)
  return result.rows
}

/**
 * 事务支持
 * @param {Function} callback - 事务回调函数
 */
export async function withTransaction(callback) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}

export default pool

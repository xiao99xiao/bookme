/**
 * Database Client for Backend-Cron
 *
 * Provides a fluent query builder API similar to Supabase JS Client
 * Uses native PostgreSQL (pg) driver internally
 * Connects to Railway PostgreSQL
 *
 * This is a self-contained version for the cron service
 */

import { pool, query, queryOne, queryAll } from './db.js'

/**
 * Query Builder Class
 */
class QueryBuilder {
  constructor(tableName) {
    this.tableName = tableName
    this.operation = 'SELECT'
    this.selectFields = '*'
    this.joins = []
    this.conditions = []
    this.orderByFields = []
    this.limitValue = null
    this.offsetValue = null
    this.params = []
    this.insertData = null
    this.updateData = null
    this.returnSingle = false
  }

  /**
   * SELECT fields
   */
  select(fields = '*') {
    this.selectFields = fields
    this._parseJoins(fields)
    return this
  }

  /**
   * Parse nested relation queries
   * e.g., "*, provider:users!provider_id(display_name, avatar)"
   */
  _parseJoins(fields) {
    const regex = /(\w+):(\w+)(?:!(\w+))?\(([^)]+)\)/g
    let match
    while ((match = regex.exec(fields)) !== null) {
      const [, alias, table, foreignKey, selectFields] = match
      this.joins.push({
        alias,
        table,
        foreignKey: foreignKey || `${alias}_id`,
        selectFields: selectFields.trim()
      })
    }
  }

  /**
   * Equals condition
   */
  eq(column, value) {
    this.params.push(value)
    this.conditions.push(`${column} = $${this.params.length}`)
    return this
  }

  /**
   * Not equals condition
   */
  neq(column, value) {
    this.params.push(value)
    this.conditions.push(`${column} != $${this.params.length}`)
    return this
  }

  /**
   * Greater than condition
   */
  gt(column, value) {
    this.params.push(value)
    this.conditions.push(`${column} > $${this.params.length}`)
    return this
  }

  /**
   * Greater than or equals condition
   */
  gte(column, value) {
    this.params.push(value)
    this.conditions.push(`${column} >= $${this.params.length}`)
    return this
  }

  /**
   * Less than condition
   */
  lt(column, value) {
    this.params.push(value)
    this.conditions.push(`${column} < $${this.params.length}`)
    return this
  }

  /**
   * Less than or equals condition
   */
  lte(column, value) {
    this.params.push(value)
    this.conditions.push(`${column} <= $${this.params.length}`)
    return this
  }

  /**
   * IN condition
   */
  in(column, values) {
    if (!values || values.length === 0) {
      this.conditions.push('FALSE')
      return this
    }
    const placeholders = values.map((v) => {
      this.params.push(v)
      return `$${this.params.length}`
    })
    this.conditions.push(`${column} IN (${placeholders.join(', ')})`)
    return this
  }

  /**
   * IS condition (for NULL checks)
   */
  is(column, value) {
    if (value === null) {
      this.conditions.push(`${column} IS NULL`)
    } else {
      this.params.push(value)
      this.conditions.push(`${column} IS $${this.params.length}`)
    }
    return this
  }

  /**
   * Order by
   */
  order(column, options = {}) {
    const dir = options.ascending === false ? 'DESC' : 'ASC'
    this.orderByFields.push(`${column} ${dir}`)
    return this
  }

  /**
   * Limit
   */
  limit(n) {
    this.limitValue = n
    return this
  }

  /**
   * Expect single result
   */
  single() {
    this.returnSingle = true
    this.limitValue = 1
    return this
  }

  /**
   * Insert data
   */
  insert(data) {
    this.operation = 'INSERT'
    this.insertData = Array.isArray(data) ? data : [data]
    return this
  }

  /**
   * Update data
   */
  update(data) {
    this.operation = 'UPDATE'
    this.updateData = data
    return this
  }

  /**
   * Delete data
   */
  delete() {
    this.operation = 'DELETE'
    return this
  }

  /**
   * Clean SELECT fields (remove nested syntax)
   */
  _cleanSelectFields() {
    let fields = this.selectFields
    fields = fields.replace(/\w+:\w+(?:!\w+)?\([^)]+\)/g, '')
    fields = fields.replace(/,\s*,/g, ',').replace(/^,|,$/g, '').trim()
    return fields || '*'
  }

  /**
   * Promise interface
   */
  then(resolve, reject) {
    this._execute()
      .then(resolve)
      .catch((error) => {
        if (reject) reject(error)
        else resolve({ data: null, error })
      })
  }

  /**
   * Execute query
   */
  async _execute() {
    try {
      switch (this.operation) {
        case 'SELECT':
          return await this._executeSelect()
        case 'INSERT':
          return await this._executeInsert()
        case 'UPDATE':
          return await this._executeUpdate()
        case 'DELETE':
          return await this._executeDelete()
        default:
          throw new Error(`Unknown operation: ${this.operation}`)
      }
    } catch (error) {
      console.error('Query execution error:', error)
      return { data: null, error }
    }
  }

  /**
   * Execute SELECT
   */
  async _executeSelect() {
    if (this.joins.length > 0) {
      return await this._executeSelectWithJoins()
    }

    let sql = `SELECT ${this._cleanSelectFields()} FROM ${this.tableName}`

    if (this.conditions.length > 0) {
      sql += ` WHERE ${this.conditions.join(' AND ')}`
    }

    if (this.orderByFields.length > 0) {
      sql += ` ORDER BY ${this.orderByFields.join(', ')}`
    }

    if (this.limitValue !== null) {
      sql += ` LIMIT ${this.limitValue}`
    }

    if (this.offsetValue !== null) {
      sql += ` OFFSET ${this.offsetValue}`
    }

    const result = await pool.query(sql, this.params)
    const data = this.returnSingle
      ? (result.rows[0] || null)
      : result.rows

    if (this.returnSingle && !data) {
      return {
        data: null,
        error: { code: 'PGRST116', message: 'The result contains 0 rows' }
      }
    }

    return { data, error: null }
  }

  /**
   * Execute SELECT with joins
   */
  async _executeSelectWithJoins() {
    let mainSql = `SELECT * FROM ${this.tableName}`

    if (this.conditions.length > 0) {
      mainSql += ` WHERE ${this.conditions.join(' AND ')}`
    }

    if (this.orderByFields.length > 0) {
      mainSql += ` ORDER BY ${this.orderByFields.join(', ')}`
    }

    if (this.limitValue !== null) {
      mainSql += ` LIMIT ${this.limitValue}`
    }

    if (this.offsetValue !== null) {
      mainSql += ` OFFSET ${this.offsetValue}`
    }

    const mainResult = await pool.query(mainSql, this.params)
    let rows = mainResult.rows

    if (rows.length === 0) {
      if (this.returnSingle) {
        return {
          data: null,
          error: { code: 'PGRST116', message: 'The result contains 0 rows' }
        }
      }
      return { data: [], error: null }
    }

    for (const join of this.joins) {
      const fkValues = [...new Set(rows.map(r => r[join.foreignKey]).filter(Boolean))]

      if (fkValues.length === 0) {
        rows = rows.map(r => ({ ...r, [join.alias]: null }))
        continue
      }

      let joinSelect = join.selectFields
      if (joinSelect !== '*' && !joinSelect.includes('id')) {
        joinSelect = 'id, ' + joinSelect
      }

      const joinPlaceholders = fkValues.map((_, i) => `$${i + 1}`).join(', ')
      const joinSql = `SELECT ${joinSelect} FROM ${join.table} WHERE id IN (${joinPlaceholders})`
      const joinResult = await pool.query(joinSql, fkValues)

      const joinMap = new Map(joinResult.rows.map(r => [r.id, r]))

      rows = rows.map(r => ({
        ...r,
        [join.alias]: joinMap.get(r[join.foreignKey]) || null
      }))
    }

    const data = this.returnSingle ? (rows[0] || null) : rows
    return { data, error: null }
  }

  /**
   * Execute INSERT
   */
  async _executeInsert() {
    const row = this.insertData[0]
    const columns = Object.keys(row)
    const values = Object.values(row)
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ')

    const sql = `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`

    const result = await pool.query(sql, values)
    const data = this.returnSingle ? result.rows[0] : result.rows

    return { data, error: null }
  }

  /**
   * Execute UPDATE
   */
  async _executeUpdate() {
    const columns = Object.keys(this.updateData)
    const values = Object.values(this.updateData)

    const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ')

    const offset = values.length
    const adjustedConditions = this.conditions.map(cond => {
      return cond.replace(/\$(\d+)/g, (_, num) => `$${parseInt(num) + offset}`)
    })

    let sql = `UPDATE ${this.tableName} SET ${setClause}`
    if (adjustedConditions.length > 0) {
      sql += ` WHERE ${adjustedConditions.join(' AND ')}`
    }
    sql += ' RETURNING *'

    const allParams = [...values, ...this.params]
    const result = await pool.query(sql, allParams)
    const data = this.returnSingle ? result.rows[0] : result.rows

    return { data, error: null, count: result.rowCount }
  }

  /**
   * Execute DELETE
   */
  async _executeDelete() {
    let sql = `DELETE FROM ${this.tableName}`

    if (this.conditions.length > 0) {
      sql += ` WHERE ${this.conditions.join(' AND ')}`
    }

    const result = await pool.query(sql, this.params)
    return { data: null, error: null, count: result.rowCount }
  }
}

/**
 * Main export object - compatible with Supabase Admin Client API
 */
export const dbClient = {
  from: (table) => new QueryBuilder(table),
  pool,
  query,
  queryOne,
  queryAll
}

export default dbClient

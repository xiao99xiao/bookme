/**
 * Database Query Builder
 *
 * Provides a fluent query builder API similar to Supabase JS Client
 * Uses native PostgreSQL (pg) driver internally
 * Connects to Railway PostgreSQL
 *
 * This allows minimal changes to route files during migration
 */

import { pool, query, queryOne, queryAll } from './db.js'
import { storage as r2Storage } from './r2-storage.js'

/**
 * 查询构建器类
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
   * SELECT 字段
   */
  select(fields = '*') {
    this.selectFields = fields
    this._parseJoins(fields)
    return this
  }

  /**
   * 解析嵌套关联查询
   * 例如: "*, provider:users!provider_id(display_name, avatar)"
   */
  _parseJoins(fields) {
    // 匹配 alias:table!foreignKey(fields) 或 alias:table(fields)
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
   * 等于条件
   */
  eq(column, value) {
    this.params.push(value)
    this.conditions.push(`${this._qualify(column)} = $${this.params.length}`)
    return this
  }

  /**
   * 不等于条件
   */
  neq(column, value) {
    this.params.push(value)
    this.conditions.push(`${this._qualify(column)} != $${this.params.length}`)
    return this
  }

  /**
   * 大于条件
   */
  gt(column, value) {
    this.params.push(value)
    this.conditions.push(`${this._qualify(column)} > $${this.params.length}`)
    return this
  }

  /**
   * 大于等于条件
   */
  gte(column, value) {
    this.params.push(value)
    this.conditions.push(`${this._qualify(column)} >= $${this.params.length}`)
    return this
  }

  /**
   * 小于条件
   */
  lt(column, value) {
    this.params.push(value)
    this.conditions.push(`${this._qualify(column)} < $${this.params.length}`)
    return this
  }

  /**
   * 小于等于条件
   */
  lte(column, value) {
    this.params.push(value)
    this.conditions.push(`${this._qualify(column)} <= $${this.params.length}`)
    return this
  }

  /**
   * IN 条件
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
    this.conditions.push(`${this._qualify(column)} IN (${placeholders.join(', ')})`)
    return this
  }

  /**
   * OR 条件
   * 支持格式: "user1_id.eq.xxx,user2_id.eq.xxx"
   * 支持格式: "and(customer_id.eq.xxx,provider_id.eq.yyy),and(...)"
   */
  or(orString) {
    const parts = this._parseOrString(orString)
    if (parts.length > 0) {
      this.conditions.push(`(${parts.join(' OR ')})`)
    }
    return this
  }

  _parseOrString(orString) {
    const results = []
    let depth = 0
    let current = ''

    // 按逗号分割，但要考虑括号内的逗号
    for (let i = 0; i < orString.length; i++) {
      const char = orString[i]
      if (char === '(') depth++
      if (char === ')') depth--

      if (char === ',' && depth === 0) {
        if (current.trim()) {
          results.push(this._parseSingleCondition(current.trim()))
        }
        current = ''
      } else {
        current += char
      }
    }

    if (current.trim()) {
      results.push(this._parseSingleCondition(current.trim()))
    }

    return results
  }

  _parseSingleCondition(condStr) {
    // 处理 and(...) 语法
    if (condStr.startsWith('and(') && condStr.endsWith(')')) {
      const inner = condStr.slice(4, -1)
      const parts = inner.split(',').map(p => this._parseOperator(p.trim()))
      return `(${parts.join(' AND ')})`
    }

    return this._parseOperator(condStr)
  }

  _parseOperator(opStr) {
    // 解析 "field.op.value" 格式
    const match = opStr.match(/^(\w+)\.(eq|neq|gt|gte|lt|lte|ilike|like)\.(.+)$/)
    if (match) {
      const [, field, op, value] = match
      this.params.push(value)
      const opMap = {
        eq: '=',
        neq: '!=',
        gt: '>',
        gte: '>=',
        lt: '<',
        lte: '<=',
        ilike: 'ILIKE',
        like: 'LIKE'
      }
      return `${field} ${opMap[op]} $${this.params.length}`
    }
    return opStr
  }

  /**
   * ILIKE 模糊搜索
   */
  ilike(column, pattern) {
    this.params.push(pattern)
    this.conditions.push(`${this._qualify(column)} ILIKE $${this.params.length}`)
    return this
  }

  /**
   * 排序
   */
  order(column, options = {}) {
    const dir = options.ascending === false ? 'DESC' : 'ASC'
    this.orderByFields.push(`${column} ${dir}`)
    return this
  }

  /**
   * 限制数量
   */
  limit(n) {
    this.limitValue = n
    return this
  }

  /**
   * 分页范围
   */
  range(start, end) {
    this.offsetValue = start
    this.limitValue = end - start + 1
    return this
  }

  /**
   * 期望单个结果
   */
  single() {
    this.returnSingle = true
    this.limitValue = 1
    return this
  }

  /**
   * 插入数据
   */
  insert(data) {
    this.operation = 'INSERT'
    this.insertData = Array.isArray(data) ? data : [data]
    return this
  }

  /**
   * 更新数据
   */
  update(data) {
    this.operation = 'UPDATE'
    this.updateData = data
    return this
  }

  /**
   * 删除数据
   */
  delete() {
    this.operation = 'DELETE'
    return this
  }

  /**
   * Upsert 操作
   */
  upsert(data) {
    this.operation = 'UPSERT'
    this.insertData = Array.isArray(data) ? data : [data]
    return this
  }

  /**
   * 列名处理
   */
  _qualify(column) {
    return column
  }

  /**
   * 清理 SELECT 字段（移除嵌套语法）
   */
  _cleanSelectFields() {
    let fields = this.selectFields
    // 移除嵌套关联语法
    fields = fields.replace(/\w+:\w+(?:!\w+)?\([^)]+\)/g, '')
    // 清理多余逗号和空格
    fields = fields.replace(/,\s*,/g, ',').replace(/^,|,$/g, '').trim()
    return fields || '*'
  }

  /**
   * Promise 接口
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
   * 执行查询
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
        case 'UPSERT':
          return await this._executeUpsert()
        default:
          throw new Error(`Unknown operation: ${this.operation}`)
      }
    } catch (error) {
      console.error('Query execution error:', error)
      return { data: null, error }
    }
  }

  /**
   * 执行 SELECT
   */
  async _executeSelect() {
    // 如果有关联查询，使用多查询模式
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

    // 模拟 PGRST116 错误（单行查询无结果）
    if (this.returnSingle && !data) {
      return {
        data: null,
        error: { code: 'PGRST116', message: 'The result contains 0 rows' }
      }
    }

    return { data, error: null }
  }

  /**
   * 执行带关联的 SELECT
   */
  async _executeSelectWithJoins() {
    // 先获取主表数据
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

    // 获取每个关联的数据
    for (const join of this.joins) {
      const fkValues = [...new Set(rows.map(r => r[join.foreignKey]).filter(Boolean))]

      if (fkValues.length === 0) {
        // 所有外键为空，设置关联为 null
        rows = rows.map(r => ({ ...r, [join.alias]: null }))
        continue
      }

      // 处理 selectFields 中的 * 或具体字段
      let joinSelect = join.selectFields
      if (joinSelect === '*') {
        joinSelect = '*'
      } else {
        // 确保包含 id
        if (!joinSelect.includes('id')) {
          joinSelect = 'id, ' + joinSelect
        }
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
   * 执行 INSERT
   */
  async _executeInsert() {
    const row = this.insertData[0]
    const columns = Object.keys(row)
    // Serialize objects/arrays to JSON strings for JSONB columns
    const values = Object.values(row).map(val => {
      if (val !== null && typeof val === 'object') {
        return JSON.stringify(val)
      }
      return val
    })
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ')

    const sql = `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`

    const result = await pool.query(sql, values)
    const data = this.returnSingle ? result.rows[0] : result.rows

    return { data, error: null }
  }

  /**
   * 执行 UPDATE
   */
  async _executeUpdate() {
    const columns = Object.keys(this.updateData)
    // Serialize objects/arrays to JSON strings for JSONB columns
    const values = Object.values(this.updateData).map(val => {
      if (val !== null && typeof val === 'object') {
        return JSON.stringify(val)
      }
      return val
    })

    const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ')

    // 调整条件中的参数位置
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

    return { data, error: null }
  }

  /**
   * 执行 DELETE
   */
  async _executeDelete() {
    let sql = `DELETE FROM ${this.tableName}`

    if (this.conditions.length > 0) {
      sql += ` WHERE ${this.conditions.join(' AND ')}`
    }

    const result = await pool.query(sql, this.params)
    return { data: null, error: null, count: result.rowCount }
  }

  /**
   * 执行 UPSERT
   */
  async _executeUpsert() {
    const row = this.insertData[0]
    const columns = Object.keys(row)
    // Serialize objects/arrays to JSON strings for JSONB columns
    const values = Object.values(row).map(val => {
      if (val !== null && typeof val === 'object') {
        return JSON.stringify(val)
      }
      return val
    })
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ')

    // 构建 ON CONFLICT 更新子句
    const updateColumns = columns.filter(c => c !== 'id' && c !== 'created_at')
    const updateClause = updateColumns.map(col => `${col} = EXCLUDED.${col}`).join(', ')

    let sql = `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders})`

    if (updateClause) {
      sql += ` ON CONFLICT (id) DO UPDATE SET ${updateClause}`
    } else {
      sql += ' ON CONFLICT (id) DO NOTHING'
    }

    sql += ' RETURNING *'

    const result = await pool.query(sql, values)
    return { data: result.rows[0], error: null }
  }
}

/**
 * Storage layer - uses Cloudflare R2
 * API compatible with Supabase Storage
 */

/**
 * Channel compatibility layer (for Realtime, now uses pg NOTIFY)
 */
function createChannel(name) {
  console.warn(`⚠️ Channel "${name}" - use pg NOTIFY instead`)
  return {
    on: () => ({
      subscribe: () => ({
        unsubscribe: () => {}
      })
    })
  }
}

/**
 * Main export object - compatible with Supabase Admin Client API
 */
export const db = {
  from: (table) => new QueryBuilder(table),

  storage: r2Storage,

  channel: createChannel,

  // 直接访问底层连接
  pool,
  query,
  queryOne,
  queryAll
}

export default db

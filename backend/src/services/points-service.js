/**
 * Points Service
 *
 * Handles all points-related operations:
 * - Awarding points when users fund their wallets
 * - Calculating points for service bookings
 * - Deducting points when bookings are paid
 * - Getting user point balances
 * - Recording point transactions
 *
 * Points Exchange Rate: 100 points = $1 USD
 */

import pool from '../db.js'

class PointsService {
  constructor() {
    // 100 points = $1 USD
    this.POINTS_PER_DOLLAR = 100
    // Maximum percentage of service cost that can be paid with points
    this.MAX_POINTS_USAGE_PERCENT = 5 // 5% of service cost can be paid with points
  }

  /**
   * Award points to a user after funding their wallet
   *
   * @param {string} userId - User's UUID
   * @param {number} usdcAmount - Amount of USDC funded
   * @param {number} feeAmount - Fee amount charged (points compensation)
   * @param {string} transactionHash - Blockchain transaction hash
   * @param {string} fundingMethod - How they funded (card, crypto, etc.)
   * @returns {Object} - Points awarded and new balance
   */
  async awardPointsForFunding(userId, usdcAmount, feeAmount, transactionHash, fundingMethod = 'card') {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Calculate points to award based on fee amount
      // Fee in USD * 100 = points (e.g., $0.20 fee = 20 points)
      const pointsToAward = Math.round(feeAmount * this.POINTS_PER_DOLLAR)

      if (pointsToAward <= 0) {
        await client.query('COMMIT')
        return { pointsAwarded: 0, newBalance: await this.getBalance(userId) }
      }

      // Record the funding
      await client.query(
        `INSERT INTO funding_records (
          user_id, usdc_amount, fee_amount, points_awarded,
          transaction_hash, funding_method
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, usdcAmount, feeAmount, pointsToAward, transactionHash, fundingMethod]
      )

      // Add points to user balance
      await client.query(
        `INSERT INTO user_points (user_id, balance, total_earned, total_spent)
         VALUES ($1, $2, $2, 0)
         ON CONFLICT (user_id) DO UPDATE SET
           balance = user_points.balance + $2,
           total_earned = user_points.total_earned + $2,
           updated_at = NOW()`,
        [userId, pointsToAward]
      )

      // Record the transaction
      await client.query(
        `INSERT INTO point_transactions (
          user_id, type, amount, description, reference_id
        ) VALUES ($1, 'earn', $2, $3, $4)`,
        [userId, pointsToAward, `Points for funding $${usdcAmount} USDC`, transactionHash]
      )

      await client.query('COMMIT')

      const newBalance = await this.getBalance(userId)
      console.log(`✅ Awarded ${pointsToAward} points to user ${userId}. New balance: ${newBalance}`)

      return {
        pointsAwarded: pointsToAward,
        newBalance
      }
    } catch (error) {
      await client.query('ROLLBACK')
      console.error('❌ Error awarding points:', error)
      throw error
    } finally {
      client.release()
    }
  }

  /**
   * Get user's current points balance
   *
   * @param {string} userId - User's UUID
   * @returns {number} - Current points balance
   */
  async getBalance(userId) {
    const result = await pool.query(
      'SELECT balance FROM user_points WHERE user_id = $1',
      [userId]
    )
    return result.rows[0]?.balance || 0
  }

  /**
   * Get user's full points info
   *
   * @param {string} userId - User's UUID
   * @returns {Object} - Points balance, total earned, total spent
   */
  async getPointsInfo(userId) {
    const result = await pool.query(
      `SELECT balance, total_earned, total_spent, updated_at
       FROM user_points WHERE user_id = $1`,
      [userId]
    )

    if (result.rows.length === 0) {
      return {
        balance: 0,
        totalEarned: 0,
        totalSpent: 0,
        updatedAt: null
      }
    }

    const row = result.rows[0]
    return {
      balance: row.balance,
      totalEarned: row.total_earned,
      totalSpent: row.total_spent,
      updatedAt: row.updated_at
    }
  }

  /**
   * Calculate how many points can be used for a service
   *
   * @param {number} servicePrice - Service price in USDC
   * @param {number} userBalance - User's current points balance
   * @param {number} maxUsagePercent - Max percentage of price payable by points (default 100%)
   * @returns {Object} - Points usable, USD value, remaining to pay
   */
  calculatePointsUsage(servicePrice, userBalance, maxUsagePercent = this.MAX_POINTS_USAGE_PERCENT) {
    // Max points that could be used based on service price
    const maxPointsFromPrice = Math.floor(servicePrice * this.POINTS_PER_DOLLAR * (maxUsagePercent / 100))

    // Actual points to use (minimum of user balance and max allowed)
    const pointsToUse = Math.min(userBalance, maxPointsFromPrice)

    // USD value of points
    const pointsValue = pointsToUse / this.POINTS_PER_DOLLAR

    // Remaining USDC to pay
    const usdcToPay = servicePrice - pointsValue

    return {
      pointsToUse,
      pointsValue: Math.round(pointsValue * 100) / 100, // Round to 2 decimal places
      usdcToPay: Math.round(usdcToPay * 100) / 100,
      originalPrice: servicePrice
    }
  }

  /**
   * Reserve points for a booking (before blockchain payment)
   * Points are held but not yet deducted
   *
   * @param {string} userId - User's UUID
   * @param {string} bookingId - Booking ID
   * @param {number} pointsAmount - Points to reserve
   * @returns {boolean} - Success status
   */
  async reservePoints(userId, bookingId, pointsAmount) {
    if (pointsAmount <= 0) return true

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Check if user has enough points
      const balanceResult = await client.query(
        'SELECT balance FROM user_points WHERE user_id = $1 FOR UPDATE',
        [userId]
      )

      const currentBalance = balanceResult.rows[0]?.balance || 0
      if (currentBalance < pointsAmount) {
        throw new Error(`Insufficient points. Balance: ${currentBalance}, Required: ${pointsAmount}`)
      }

      // Record the pending transaction
      await client.query(
        `INSERT INTO point_transactions (
          user_id, type, amount, description, reference_id
        ) VALUES ($1, 'reserve', $2, $3, $4)`,
        [userId, pointsAmount, 'Points reserved for booking', bookingId]
      )

      await client.query('COMMIT')
      console.log(`✅ Reserved ${pointsAmount} points for booking ${bookingId}`)
      return true
    } catch (error) {
      await client.query('ROLLBACK')
      console.error('❌ Error reserving points:', error)
      throw error
    } finally {
      client.release()
    }
  }

  /**
   * Deduct points after successful booking payment
   *
   * @param {string} userId - User's UUID
   * @param {string} bookingId - Booking ID
   * @param {number} pointsAmount - Points to deduct
   * @param {number} pointsValue - USD value of points
   * @returns {Object} - New balance
   */
  async deductPoints(userId, bookingId, pointsAmount, pointsValue) {
    if (pointsAmount <= 0) {
      return { newBalance: await this.getBalance(userId) }
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Deduct from balance
      const result = await client.query(
        `UPDATE user_points
         SET balance = balance - $2,
             total_spent = total_spent + $2,
             updated_at = NOW()
         WHERE user_id = $1 AND balance >= $2
         RETURNING balance`,
        [userId, pointsAmount]
      )

      if (result.rows.length === 0) {
        throw new Error('Insufficient points balance')
      }

      // Record the spend transaction
      await client.query(
        `INSERT INTO point_transactions (
          user_id, type, amount, description, reference_id
        ) VALUES ($1, 'spend', $2, $3, $4)`,
        [userId, pointsAmount, `Booking payment (${pointsAmount} points = $${pointsValue})`, bookingId]
      )

      // Update any reservation to confirmed
      await client.query(
        `UPDATE point_transactions
         SET type = 'spend_confirmed'
         WHERE user_id = $1 AND reference_id = $2 AND type = 'reserve'`,
        [userId, bookingId]
      )

      await client.query('COMMIT')

      const newBalance = result.rows[0].balance
      console.log(`✅ Deducted ${pointsAmount} points from user ${userId}. New balance: ${newBalance}`)

      return { newBalance }
    } catch (error) {
      await client.query('ROLLBACK')
      console.error('❌ Error deducting points:', error)
      throw error
    } finally {
      client.release()
    }
  }

  /**
   * Refund points for cancelled booking
   *
   * @param {string} userId - User's UUID
   * @param {string} bookingId - Booking ID
   * @param {number} pointsAmount - Points to refund
   * @returns {Object} - New balance
   */
  async refundPoints(userId, bookingId, pointsAmount) {
    if (pointsAmount <= 0) {
      return { newBalance: await this.getBalance(userId) }
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Add back to balance
      await client.query(
        `INSERT INTO user_points (user_id, balance, total_earned, total_spent)
         VALUES ($1, $2, 0, 0)
         ON CONFLICT (user_id) DO UPDATE SET
           balance = user_points.balance + $2,
           total_spent = GREATEST(0, user_points.total_spent - $2),
           updated_at = NOW()`,
        [userId, pointsAmount]
      )

      // Record the refund transaction
      await client.query(
        `INSERT INTO point_transactions (
          user_id, type, amount, description, reference_id
        ) VALUES ($1, 'refund', $2, $3, $4)`,
        [userId, pointsAmount, 'Points refunded for cancelled booking', bookingId]
      )

      await client.query('COMMIT')

      const newBalance = await this.getBalance(userId)
      console.log(`✅ Refunded ${pointsAmount} points to user ${userId}. New balance: ${newBalance}`)

      return { newBalance }
    } catch (error) {
      await client.query('ROLLBACK')
      console.error('❌ Error refunding points:', error)
      throw error
    } finally {
      client.release()
    }
  }

  /**
   * Release reserved points (if booking fails)
   *
   * @param {string} userId - User's UUID
   * @param {string} bookingId - Booking ID
   */
  async releaseReservedPoints(userId, bookingId) {
    await pool.query(
      `UPDATE point_transactions
       SET type = 'reserve_released'
       WHERE user_id = $1 AND reference_id = $2 AND type = 'reserve'`,
      [userId, bookingId]
    )
    console.log(`✅ Released reserved points for booking ${bookingId}`)
  }

  /**
   * Get point transactions for a user
   *
   * @param {string} userId - User's UUID
   * @param {number} limit - Max transactions to return
   * @param {number} offset - Pagination offset
   * @returns {Array} - Transaction history
   */
  async getTransactionHistory(userId, limit = 50, offset = 0) {
    const result = await pool.query(
      `SELECT id, type, amount, description, reference_id, created_at
       FROM point_transactions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    )

    return result.rows.map((row) => ({
      id: row.id,
      type: row.type,
      amount: row.amount,
      description: row.description,
      referenceId: row.reference_id,
      createdAt: row.created_at
    }))
  }

  /**
   * Convert USD to points
   *
   * @param {number} usdAmount - USD amount
   * @returns {number} - Equivalent points
   */
  usdToPoints(usdAmount) {
    return Math.round(usdAmount * this.POINTS_PER_DOLLAR)
  }

  /**
   * Convert points to USD
   *
   * @param {number} points - Points amount
   * @returns {number} - Equivalent USD
   */
  pointsToUsd(points) {
    return Math.round((points / this.POINTS_PER_DOLLAR) * 100) / 100
  }
}

// Export singleton instance
const pointsService = new PointsService()
export default pointsService

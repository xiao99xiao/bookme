import { useState, useCallback, useEffect } from 'react'
import { ApiClient } from '@/lib/api-migration'

interface PointsBalance {
  balance: number
  totalEarned: number
  totalSpent: number
  usdValue: number
  updatedAt: string | null
}

interface PointsCalculation {
  pointsToUse: number
  pointsValue: number
  usdcToPay: number
  originalPrice: number
  currentBalance: number
}

interface PointsTransaction {
  id: string
  type: string
  amount: number
  description: string
  referenceId: string | null
  createdAt: string
}

/**
 * Hook for managing user points
 *
 * Usage:
 * ```tsx
 * const { balance, loading, error, refreshBalance, calculateForService } = usePoints()
 *
 * // Get points calculation for a service
 * const calc = await calculateForService(50) // $50 service
 * console.log(`Use ${calc.pointsToUse} points ($${calc.pointsValue}) and pay $${calc.usdcToPay} USDC`)
 * ```
 */
export function usePoints() {
  const [pointsInfo, setPointsInfo] = useState<PointsBalance | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchBalance = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await ApiClient.getPointsBalance()
      setPointsInfo(data)
      return data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch points'
      setError(errorMessage)
      console.error('Error fetching points:', err)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const calculateForService = useCallback(async (servicePrice: number): Promise<PointsCalculation | null> => {
    try {
      const data = await ApiClient.calculatePointsForService(servicePrice)
      return data
    } catch (err) {
      console.error('Error calculating points:', err)
      return null
    }
  }, [])

  const fetchHistory = useCallback(async (limit: number = 50, offset: number = 0): Promise<PointsTransaction[]> => {
    try {
      const data = await ApiClient.getPointsHistory(limit, offset)
      return data.transactions
    } catch (err) {
      console.error('Error fetching points history:', err)
      return []
    }
  }, [])

  // Fetch balance on mount
  useEffect(() => {
    fetchBalance()
  }, [fetchBalance])

  return {
    // Current balance
    balance: pointsInfo?.balance ?? 0,
    usdValue: pointsInfo?.usdValue ?? 0,
    totalEarned: pointsInfo?.totalEarned ?? 0,
    totalSpent: pointsInfo?.totalSpent ?? 0,

    // State
    loading,
    error,

    // Actions
    refreshBalance: fetchBalance,
    calculateForService,
    fetchHistory,

    // Utility
    formatPoints: (points: number) => points.toLocaleString(),
    formatUsdValue: (points: number) => `$${(points / 100).toFixed(2)}`,
  }
}

/**
 * Utility function to convert USD to points
 */
export function usdToPoints(usd: number): number {
  return Math.round(usd * 100)
}

/**
 * Utility function to convert points to USD
 */
export function pointsToUsd(points: number): number {
  return Math.round((points / 100) * 100) / 100
}

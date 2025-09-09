import { useState, useCallback, useEffect } from 'react'
import { TransactionStatus } from '@/lib/blockchain-service'

export type TransactionState = 'idle' | 'preparing' | 'prompting' | 'pending' | 'success' | 'error'

export interface UseTransactionOptions {
  onSuccess?: (txHash: string) => void
  onError?: (error: string) => void
  timeout?: number // milliseconds, default 180000 (3 minutes)
}

export interface TransactionHookReturn {
  status: TransactionState
  message: string
  txHash?: string
  error?: string
  isLoading: boolean
  isSuccess: boolean
  isError: boolean
  execute: (transactionFn: () => Promise<string>) => Promise<void>
  reset: () => void
}

/**
 * Hook for managing transaction status and lifecycle
 */
export function useTransaction(options: UseTransactionOptions = {}): TransactionHookReturn {
  const { onSuccess, onError, timeout = 180000 } = options
  
  const [transactionStatus, setTransactionStatus] = useState<TransactionStatus>({
    status: 'idle',
    message: ''
  })

  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null)

  const reset = useCallback(() => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      setTimeoutId(null)
    }
    setTransactionStatus({
      status: 'idle',
      message: ''
    })
  }, [timeoutId])

  const execute = useCallback(async (transactionFn: () => Promise<string>) => {
    try {
      reset()
      
      setTransactionStatus({
        status: 'preparing',
        message: 'Preparing transaction...'
      })

      // Set timeout for transaction
      const timeout_id = setTimeout(() => {
        setTransactionStatus(prev => ({
          ...prev,
          status: 'error',
          message: 'Transaction timeout. Please check your transaction status manually.',
          error: 'Transaction timeout'
        }))
        onError?.('Transaction timeout')
      }, timeout)
      
      setTimeoutId(timeout_id)

      // Execute the transaction function
      const txHash = await transactionFn()

      // Clear timeout on success
      clearTimeout(timeout_id)
      setTimeoutId(null)

      setTransactionStatus({
        status: 'success',
        message: 'Transaction completed successfully!',
        txHash
      })

      onSuccess?.(txHash)
      
    } catch (error: any) {
      // Clear timeout on error
      if (timeoutId) {
        clearTimeout(timeoutId)
        setTimeoutId(null)
      }

      const errorMessage = error.message || 'Transaction failed'
      setTransactionStatus({
        status: 'error',
        message: errorMessage,
        error: errorMessage
      })

      onError?.(errorMessage)
    }
  }, [onSuccess, onError, timeout, timeoutId, reset])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [timeoutId])

  const isLoading = ['preparing', 'prompting', 'pending'].includes(transactionStatus.status)
  const isSuccess = transactionStatus.status === 'success'
  const isError = transactionStatus.status === 'error'

  return {
    status: transactionStatus.status,
    message: transactionStatus.message,
    txHash: transactionStatus.txHash,
    error: transactionStatus.error,
    isLoading,
    isSuccess,
    isError,
    execute,
    reset
  }
}

/**
 * Hook for managing blockchain payment transactions with status updates
 */
export function usePaymentTransaction(options: UseTransactionOptions = {}) {
  const [transactionStatus, setTransactionStatus] = useState<TransactionStatus>({
    status: 'idle',
    message: ''
  })

  const executePayment = useCallback(async (
    paymentFn: (onStatusChange: (status: TransactionStatus) => void) => Promise<string>
  ) => {
    try {
      setTransactionStatus({
        status: 'preparing',
        message: 'Preparing payment...'
      })

      const txHash = await paymentFn((status) => {
        setTransactionStatus(status)
      })

      setTransactionStatus({
        status: 'success',
        message: 'Payment completed successfully!',
        txHash
      })

      options.onSuccess?.(txHash)
      return txHash

    } catch (error: any) {
      const errorMessage = error.message || 'Payment failed'
      setTransactionStatus({
        status: 'error',
        message: errorMessage,
        error: errorMessage
      })

      options.onError?.(errorMessage)
      throw error
    }
  }, [options])

  const reset = useCallback(() => {
    setTransactionStatus({
      status: 'idle',
      message: ''
    })
  }, [])

  const isLoading = ['preparing', 'prompting', 'pending'].includes(transactionStatus.status)
  const isSuccess = transactionStatus.status === 'success'
  const isError = transactionStatus.status === 'error'

  return {
    status: transactionStatus.status,
    message: transactionStatus.message,
    txHash: transactionStatus.txHash,
    error: transactionStatus.error,
    isLoading,
    isSuccess,
    isError,
    executePayment,
    reset
  }
}

/**
 * Hook for monitoring booking status changes
 */
export interface UseBookingStatusOptions {
  bookingId: string
  onStatusChange?: (status: string) => void
  pollInterval?: number // milliseconds, default 5000
}

export function useBookingStatusMonitor({ 
  bookingId, 
  onStatusChange, 
  pollInterval = 5000 
}: UseBookingStatusOptions) {
  const [currentStatus, setCurrentStatus] = useState<string>('')
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startMonitoring = useCallback(() => {
    if (isMonitoring) return
    
    setIsMonitoring(true)
    setError(null)

    const checkStatus = async () => {
      try {
        // This would call your backend API to get booking status
        const response = await fetch(`/api/bookings/${bookingId}/status`)
        
        if (!response.ok) {
          throw new Error('Failed to fetch booking status')
        }
        
        const { status } = await response.json()
        
        if (status !== currentStatus) {
          setCurrentStatus(status)
          onStatusChange?.(status)
        }
        
      } catch (err: any) {
        setError(err.message)
        setIsMonitoring(false)
      }
    }

    // Initial check
    checkStatus()

    // Set up polling
    const intervalId = setInterval(checkStatus, pollInterval)

    // Cleanup function
    return () => {
      clearInterval(intervalId)
      setIsMonitoring(false)
    }
  }, [bookingId, currentStatus, onStatusChange, pollInterval, isMonitoring])

  const stopMonitoring = useCallback(() => {
    setIsMonitoring(false)
  }, [])

  // Auto-start monitoring when bookingId changes
  useEffect(() => {
    if (bookingId) {
      const cleanup = startMonitoring()
      return cleanup
    }
  }, [bookingId, startMonitoring])

  return {
    currentStatus,
    isMonitoring,
    error,
    startMonitoring,
    stopMonitoring
  }
}

/**
 * Hook for managing multiple concurrent transactions
 */
export function useTransactionQueue() {
  const [queue, setQueue] = useState<Array<{
    id: string
    name: string
    status: TransactionState
    txHash?: string
    error?: string
  }>>([])

  const addTransaction = useCallback((id: string, name: string) => {
    setQueue(prev => [...prev, { id, name, status: 'preparing' }])
  }, [])

  const updateTransaction = useCallback((id: string, updates: Partial<{
    status: TransactionState
    txHash: string
    error: string
  }>) => {
    setQueue(prev => prev.map(tx => 
      tx.id === id ? { ...tx, ...updates } : tx
    ))
  }, [])

  const removeTransaction = useCallback((id: string) => {
    setQueue(prev => prev.filter(tx => tx.id !== id))
  }, [])

  const clearCompleted = useCallback(() => {
    setQueue(prev => prev.filter(tx => 
      !['success', 'error'].includes(tx.status)
    ))
  }, [])

  return {
    queue,
    addTransaction,
    updateTransaction,
    removeTransaction,
    clearCompleted,
    hasActiveTransactions: queue.some(tx => 
      ['preparing', 'prompting', 'pending'].includes(tx.status)
    )
  }
}
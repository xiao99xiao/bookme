import { useCallback, useRef } from 'react'
import { useFundWallet } from '@privy-io/react-auth'
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets'
import { usePrivy } from '@privy-io/react-auth'
import { toast } from 'sonner'
import { base, baseSepolia } from 'viem/chains'
import { ApiClient } from '@/lib/api-migration'

interface FundingOptions {
  amount?: string
  onSuccess?: (fundedAmount: number, pointsAwarded: number) => void
  onError?: (error: Error) => void
}

/**
 * Global hook for wallet funding with automatic points earning
 *
 * This hook should be used anywhere in the app where wallet funding is triggered.
 * It automatically:
 * 1. Tracks balance before/after funding
 * 2. Calls backend API to record funding and award points
 * 3. Shows toast notifications for points earned
 *
 * Usage:
 * ```tsx
 * const { fundWallet, isFunding } = useFunding()
 *
 * // Trigger funding
 * await fundWallet({
 *   amount: '10',
 *   onSuccess: (fundedAmount, pointsAwarded) => {
 *     console.log(`Funded $${fundedAmount}, earned ${pointsAwarded} points`)
 *   }
 * })
 * ```
 */
export function useFunding() {
  const { user } = usePrivy()
  const { client: smartWalletClient } = useSmartWallets()

  const isProduction = import.meta.env.MODE === 'production'
  const chain = isProduction ? base : baseSepolia

  // Track funding state
  const fundingOptionsRef = useRef<FundingOptions | null>(null)
  const balanceBeforeFundingRef = useRef<bigint | null>(null)

  // Get user's smart wallet address
  const getWalletAddress = useCallback((): string | null => {
    const smartWallet = user?.linkedAccounts?.find(
      (account: any) => account.type === 'smart_wallet'
    )
    return smartWallet?.address || null
  }, [user])

  // Handle funding completion
  const handleFundingComplete = useCallback(async ({
    balance,
    address,
    fundingMethod
  }: {
    balance?: bigint
    address: string
    fundingMethod?: string
  }) => {
    const options = fundingOptionsRef.current
    const balanceBefore = balanceBeforeFundingRef.current

    // Reset refs
    fundingOptionsRef.current = null
    balanceBeforeFundingRef.current = null

    // Only process card funding for points
    if (fundingMethod !== 'card') {
      return
    }

    // Calculate funded amount if we have both balances
    if (balance !== undefined && balanceBefore !== null) {
      const fundedAmountRaw = balance - balanceBefore

      // USDC has 6 decimals
      const fundedAmount = Number(fundedAmountRaw) / 1_000_000

      if (fundedAmount > 0.01) {
        try {
          // Estimate fee (MoonPay typically charges ~3.5% + $3.99)
          const estimatedFee = fundedAmount * 0.035 + 3.99

          // Record funding and earn points
          const result = await ApiClient.recordFunding({
            usdcAmount: fundedAmount,
            feeAmount: estimatedFee,
            fundingMethod: 'card'
          })

          if (result.pointsAwarded > 0) {
            toast.success(`You earned ${result.pointsAwarded} points!`, {
              description: `Your new balance: ${result.newBalance} points`
            })
          }

          // Call success callback
          options?.onSuccess?.(fundedAmount, result.pointsAwarded)
        } catch (error) {
          console.error('Error recording funding for points:', error)
          // Don't show error to user - points are a bonus feature
          // Still call success callback since funding itself succeeded
          options?.onSuccess?.(fundedAmount, 0)
        }
      }
    }
  }, [])

  const { fundWallet: privyFundWallet } = useFundWallet({
    onUserExited: handleFundingComplete
  })

  // Main fund wallet function
  const fundWallet = useCallback(async (options: FundingOptions = {}) => {
    const walletAddress = getWalletAddress()

    if (!walletAddress) {
      const error = new Error('No wallet address found')
      toast.error('No wallet address found')
      options.onError?.(error)
      return
    }

    // Store options for callback
    fundingOptionsRef.current = options

    // Get current balance before funding
    try {
      // We'll let the callback handle balance comparison
      // The balance parameter in onUserExited gives us the new balance
      // We need to get current balance now
      const { createPublicClient, http } = await import('viem')
      const publicClient = createPublicClient({
        chain,
        transport: http()
      })

      const USDC_ADDRESS = isProduction
        ? '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'
        : '0x036CbD53842c5426634e7929541eC2318f3dCF7e'

      const USDC_ABI = [{
        inputs: [{ name: 'owner', type: 'address' }],
        name: 'balanceOf',
        outputs: [{ name: '', type: 'uint256' }],
        type: 'function',
        stateMutability: 'view'
      }] as const

      const currentBalance = await publicClient.readContract({
        address: USDC_ADDRESS as `0x${string}`,
        abi: USDC_ABI,
        functionName: 'balanceOf',
        args: [walletAddress as `0x${string}`]
      })

      balanceBeforeFundingRef.current = currentBalance
    } catch (error) {
      console.error('Error getting balance before funding:', error)
      // Continue anyway - we just won't be able to calculate exact funded amount
    }

    try {
      await privyFundWallet({
        address: walletAddress,
        options: {
          chain,
          asset: 'USDC',
          amount: options.amount || '10',
          defaultFundingMethod: 'card',
          card: {
            preferredProvider: 'moonpay'
          },
          uiConfig: {
            receiveFundsTitle: 'Fund Your Wallet with USDC',
            receiveFundsSubtitle: `Add USDC to your wallet on ${chain.name}. Earn points for every credit card purchase!`
          }
        }
      })
    } catch (error) {
      console.error('Funding error:', error)
      toast.error('Failed to initiate funding')
      options.onError?.(error as Error)

      // Reset refs on error
      fundingOptionsRef.current = null
      balanceBeforeFundingRef.current = null
    }
  }, [getWalletAddress, privyFundWallet, chain, isProduction])

  return {
    fundWallet,
    getWalletAddress
  }
}

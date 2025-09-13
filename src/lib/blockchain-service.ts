import { ethers } from 'ethers'
import { usePrivy } from '@privy-io/react-auth'
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets'
import { encodeFunctionData } from 'viem'
import { baseSepolia } from 'viem/chains'

// Contract configuration
const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || '0x33ddEd6F8183aa4dAB04E2aE216a5a3f9871405a'
const USDC_ADDRESS = import.meta.env.VITE_USDC_ADDRESS || '0x036CbD53842c5426634e7929541eC2318f3dCF7e'
const CHAIN_ID = parseInt(import.meta.env.VITE_CHAIN_ID || '84532') // Base Sepolia
const BLOCKCHAIN_EXPLORER = import.meta.env.VITE_BLOCKCHAIN_EXPLORER || 'https://sepolia.basescan.org'

// Contract ABI - we'll import the actual ABI
import contractABI from '/contracts/contract-abi.json'

// Minimal USDC ABI for approval and balance checking
const USDC_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)"
]

export interface PaymentAuthorization {
  bookingId: string
  customer: string
  provider: string
  inviter: string
  amount: string
  platformFeeRate: string
  inviterFeeRate: string
  expiry: string
  nonce: string
}

export interface TransactionResult {
  hash: string
  success: boolean
  error?: string
}

export interface TransactionStatus {
  status: 'idle' | 'preparing' | 'prompting' | 'pending' | 'success' | 'error'
  message: string
  txHash?: string
  error?: string
}

export class BlockchainService {
  private contract: ethers.Contract | null = null
  private usdcContract: ethers.Contract | null = null
  private signer: ethers.Signer | null = null
  private provider: ethers.BrowserProvider | null = null
  private smartWalletClient: any = null // Smart wallet client from Privy

  /**
   * Set the smart wallet client from Privy
   */
  setSmartWalletClient(client: any): void {
    this.smartWalletClient = client
    console.log('Smart wallet client set:', !!client)
  }

  /**
   * Initialize the blockchain service with user's wallet
   */
  async initialize(wallet?: any): Promise<void> {
    // With smart wallets, we don't need traditional initialization
    // The smart wallet client handles everything
    console.log('Blockchain service ready with smart wallet')
  }

  /**
   * Check if service is properly initialized
   */
  isInitialized(): boolean {
    return !!this.smartWalletClient
  }

  /**
   * Get user's USDC balance
   */
  async getUSDCBalance(): Promise<string> {
    if (!this.signer || !this.usdcContract) {
      throw new Error('Service not initialized')
    }

    try {
      const userAddress = await this.signer.getAddress()
      const balance = await this.usdcContract.balanceOf(userAddress)
      return ethers.formatUnits(balance, 6) // USDC has 6 decimals
    } catch (error) {
      console.error('❌ Error getting USDC balance:', error)
      throw new Error('Failed to get USDC balance')
    }
  }

  /**
   * Check if user has approved sufficient USDC for spending
   */
  async checkUSDCAllowance(amount: string): Promise<boolean> {
    if (!this.signer || !this.usdcContract) {
      throw new Error('Service not initialized')
    }

    try {
      const userAddress = await this.signer.getAddress()
      const amountWei = ethers.parseUnits(amount, 6)
      const allowance = await this.usdcContract.allowance(userAddress, CONTRACT_ADDRESS)
      
      return allowance >= amountWei
    } catch (error) {
      console.error('❌ Error checking USDC allowance:', error)
      throw new Error('Failed to check USDC allowance')
    }
  }

  /**
   * Approve USDC spending for the contract
   */
  async approveUSDC(amount: string): Promise<string> {
    if (!this.signer || !this.usdcContract) {
      throw new Error('Service not initialized')
    }

    try {
      const amountWei = ethers.parseUnits(amount, 6)
      const tx = await this.usdcContract.approve(CONTRACT_ADDRESS, amountWei)
      await tx.wait()
      
      return tx.hash
    } catch (error) {
      console.error('❌ Error approving USDC:', error)
      throw new Error('Failed to approve USDC spending')
    }
  }

  /**
   * Execute payment for booking
   */
  async payForBooking(
    authorization: PaymentAuthorization,
    signature: string,
    onStatusChange?: (status: TransactionStatus) => void
  ): Promise<string> {
    if (!this.smartWalletClient) {
      throw new Error('Smart wallet not connected')
    }

    try {
      onStatusChange?.({
        status: 'preparing',
        message: 'Preparing transaction...'
      })

      onStatusChange?.({
        status: 'prompting',
        message: 'Please confirm the payment transaction...'
      })

      // Convert authorization data to proper types for encoding
      const formattedAuthorization = {
        bookingId: authorization.bookingId, // Already a hex string
        customer: authorization.customer as `0x${string}`,
        provider: authorization.provider as `0x${string}`,
        inviter: authorization.inviter as `0x${string}`,
        amount: BigInt(authorization.amount), // Convert string to BigInt
        platformFeeRate: BigInt(authorization.platformFeeRate), // Convert to BigInt
        inviterFeeRate: BigInt(authorization.inviterFeeRate), // Convert to BigInt
        expiry: BigInt(authorization.expiry), // Convert to BigInt
        nonce: BigInt(authorization.nonce) // Convert to BigInt
      }

      // Prepare the transaction data using viem's encodeFunctionData
      const txData = encodeFunctionData({
        abi: contractABI,
        functionName: 'createAndPayBooking',
        args: [formattedAuthorization, signature]
      })

      console.log('🔍 Sending batched transaction for USDC payment')
      console.log('🔍 Contract:', CONTRACT_ADDRESS)
      console.log('🔍 USDC Address:', USDC_ADDRESS)
      console.log('🔍 Amount:', authorization.amount)
      console.log('🔍 Customer address in auth:', authorization.customer)
      console.log('🔍 Provider address in auth:', authorization.provider)
      
      // Encode the USDC approval
      const approvalData = encodeFunctionData({
        abi: [
          {
            name: 'approve',
            type: 'function',
            inputs: [
              { name: 'spender', type: 'address' },
              { name: 'amount', type: 'uint256' }
            ],
            outputs: [{ name: '', type: 'bool' }],
            stateMutability: 'nonpayable'
          }
        ],
        functionName: 'approve',
        args: [CONTRACT_ADDRESS as `0x${string}`, BigInt(authorization.amount)]
      })
      
      // Use batched transaction with both approval and payment
      const txHash = await this.smartWalletClient.sendTransaction({
        calls: [
          // Approve USDC spending
          {
            to: USDC_ADDRESS,
            data: approvalData,
            value: 0
          },
          // Execute payment
          {
            to: CONTRACT_ADDRESS,
            data: txData,
            value: 0
          }
        ]
      }, {
        uiOptions: {
          title: 'Complete Booking Payment',
          description: `Pay ${ethers.formatUnits(authorization.amount, 6)} USDC for your booking`,
          buttonText: 'Confirm Payment'
        }
      })

      onStatusChange?.({
        status: 'pending',
        message: 'Transaction submitted. Waiting for confirmation...',
        txHash: txHash
      })

      // Transaction is already confirmed when using smart wallets
      // Privy handles the confirmation internally
      onStatusChange?.({
        status: 'success',
        message: 'Payment successful! Booking confirmed.',
        txHash: txHash
      })

      console.log('✅ Payment transaction hash:', txHash)
      return txHash
    } catch (error: any) {
      console.error('❌ Payment error:', error)
      
      const errorMessage = this.parseTransactionError(error)
      onStatusChange?.({
        status: 'error',
        message: errorMessage,
        error: error.message
      })
      
      throw new Error(errorMessage)
    }
  }

  /**
   * Complete service for a booking
   */
  async completeService(
    bookingId: string,
    blockchainBookingId?: string,
    onStatusChange?: (status: TransactionStatus) => void
  ): Promise<string> {
    if (!this.smartWalletClient) {
      throw new Error('Smart wallet not connected')
    }

    try {
      onStatusChange?.({
        status: 'preparing',
        message: 'Preparing service completion...'
      })

      onStatusChange?.({
        status: 'prompting',
        message: 'Please confirm service completion...'
      })

      // Use the blockchain booking ID if provided, otherwise hash the booking ID
      // The blockchain booking ID is already the hashed value stored when payment was made
      const bookingIdBytes = blockchainBookingId || ethers.keccak256(ethers.toUtf8Bytes(bookingId))
      
      console.log('🎉 Completing service for booking:', bookingId)
      console.log('🔍 Using blockchain booking ID:', bookingIdBytes)

      // Prepare the transaction data using viem's encodeFunctionData
      const txData = encodeFunctionData({
        abi: contractABI,
        functionName: 'completeService',
        args: [bookingIdBytes]
      })

      // Send transaction through smart wallet
      const txHash = await this.smartWalletClient.sendTransaction({
        calls: [
          {
            to: CONTRACT_ADDRESS,
            data: txData,
            value: 0
          }
        ]
      }, {
        uiOptions: {
          title: 'Complete Service',
          description: 'Mark this service as complete and release payment to provider',
          buttonText: 'Complete Service'
        }
      })

      onStatusChange?.({
        status: 'pending',
        message: 'Transaction submitted. Completing service...',
        txHash: txHash
      })

      // Transaction is already confirmed when using smart wallets
      // Privy handles the confirmation internally
      onStatusChange?.({
        status: 'success',
        message: 'Service completed successfully! Funds have been distributed.',
        txHash: txHash
      })

      console.log('✅ Service completion transaction hash:', txHash)
      return txHash
    } catch (error: any) {
      console.error('❌ Service completion error:', error)
      
      const errorMessage = this.parseTransactionError(error)
      onStatusChange?.({
        status: 'error',
        message: errorMessage,
        error: error.message
      })
      
      throw new Error(errorMessage)
    }
  }

  /**
   * Cancel a booking as customer using blockchain
   */
  async cancelBookingAsCustomer(
    authorization: any,
    signature: string,
    onStatusChange?: (status: TransactionStatus) => void
  ): Promise<string> {
    if (!this.smartWalletClient) {
      throw new Error('Smart wallet not connected')
    }

    try {
      onStatusChange?.({
        status: 'preparing',
        message: 'Preparing cancellation transaction...'
      })

      onStatusChange?.({
        status: 'prompting',
        message: 'Please confirm the cancellation transaction...'
      })

      // Extract bookingId from authorization (it's already in the authorization object)
      const bookingIdBytes = authorization.bookingId

      // Prepare the transaction data using viem's encodeFunctionData
      const txData = encodeFunctionData({
        abi: contractABI,
        functionName: 'cancelBookingAsCustomer',
        args: [bookingIdBytes, authorization, signature]
      })

      console.log('🚫 Cancelling booking as customer')
      console.log('🔍 Authorization:', authorization)
      
      // Send transaction through smart wallet
      const txHash = await this.smartWalletClient.sendTransaction({
        calls: [
          {
            to: CONTRACT_ADDRESS,
            data: txData,
            value: 0
          }
        ]
      }, {
        uiOptions: {
          title: 'Cancel Booking',
          description: 'Cancel your booking and process refund according to cancellation policy',
          buttonText: 'Confirm Cancellation'
        }
      })

      onStatusChange?.({
        status: 'pending',
        message: 'Transaction submitted. Processing cancellation...',
        txHash: txHash
      })

      // Transaction is already confirmed when using smart wallets
      onStatusChange?.({
        status: 'success',
        message: 'Booking cancelled successfully! Refund has been processed.',
        txHash: txHash
      })

      console.log('✅ Customer cancellation transaction hash:', txHash)
      return txHash
    } catch (error: any) {
      console.error('❌ Customer cancellation error:', error)
      
      const errorMessage = this.parseTransactionError(error)
      onStatusChange?.({
        status: 'error',
        message: errorMessage,
        error: error.message
      })
      
      throw new Error(errorMessage)
    }
  }

  /**
   * Cancel a booking as provider using blockchain
   */
  async cancelBookingAsProvider(
    authorization: any,
    signature: string,
    onStatusChange?: (status: TransactionStatus) => void
  ): Promise<string> {
    if (!this.smartWalletClient) {
      throw new Error('Smart wallet not connected')
    }

    try {
      onStatusChange?.({
        status: 'preparing',
        message: 'Preparing cancellation transaction...'
      })

      onStatusChange?.({
        status: 'prompting',
        message: 'Please confirm the cancellation transaction...'
      })

      // Extract bookingId from authorization (it's already in the authorization object)
      const bookingIdBytes = authorization.bookingId

      // Prepare the transaction data using viem's encodeFunctionData
      const txData = encodeFunctionData({
        abi: contractABI,
        functionName: 'cancelBookingAsProvider',
        args: [bookingIdBytes, authorization, signature]
      })

      console.log('🚫 Cancelling booking as provider')
      console.log('🔍 Authorization:', authorization)
      
      // Send transaction through smart wallet
      const txHash = await this.smartWalletClient.sendTransaction({
        calls: [
          {
            to: CONTRACT_ADDRESS,
            data: txData,
            value: 0
          }
        ]
      }, {
        uiOptions: {
          title: 'Cancel Booking',
          description: 'Cancel the booking and process refund according to cancellation policy',
          buttonText: 'Confirm Cancellation'
        }
      })

      onStatusChange?.({
        status: 'pending',
        message: 'Transaction submitted. Processing cancellation...',
        txHash: txHash
      })

      // Transaction is already confirmed when using smart wallets
      onStatusChange?.({
        status: 'success',
        message: 'Booking cancelled successfully! Refund has been distributed.',
        txHash: txHash
      })

      console.log('✅ Provider cancellation transaction hash:', txHash)
      return txHash
    } catch (error: any) {
      console.error('❌ Provider cancellation error:', error)
      
      const errorMessage = this.parseTransactionError(error)
      onStatusChange?.({
        status: 'error',
        message: errorMessage,
        error: error.message
      })
      
      throw new Error(errorMessage)
    }
  }

  /**
   * Get transaction URL for blockchain explorer
   */
  getTransactionUrl(txHash: string): string {
    return `${BLOCKCHAIN_EXPLORER}/tx/${txHash}`
  }

  /**
   * Parse blockchain transaction errors into user-friendly messages
   */
  private parseTransactionError(error: any): string {
    if (error.code === 'ACTION_REJECTED') {
      return 'Transaction was rejected by user'
    }
    
    if (error.code === 'INSUFFICIENT_FUNDS') {
      return 'Insufficient funds for transaction'
    }

    if (error.reason) {
      return error.reason
    }

    if (error.message) {
      // Extract revert reason if available
      const revertMatch = error.message.match(/revert (.+)/)
      if (revertMatch) {
        return revertMatch[1]
      }
      
      // Handle common error patterns
      if (error.message.includes('insufficient funds')) {
        return 'Insufficient funds for transaction'
      }
      
      if (error.message.includes('user rejected')) {
        return 'Transaction was rejected by user'
      }
      
      // Handle paymaster/smart wallet specific errors
      if (error.message.includes('pm_getPaymasterStubData')) {
        if (error.message.includes('invalid 4th argument')) {
          return 'Transaction format error. The smart wallet is having trouble processing this payment. Please try again or contact support.'
        }
        return 'Paymaster service error. Please check your USDC balance and try again.'
      }
      
      if (error.message.includes('HTTP request failed')) {
        return 'Network error. Please check your USDC balance and try again.'
      }
      
      // More specific error logging for debugging
      if (error.message.includes('context value was not an object')) {
        console.error('🔍 Paymaster context error details:', error)
        return 'Smart wallet configuration error. Please try again in a moment.'
      }
    }

    return 'Transaction failed. Please try again.'
  }

  /**
   * Estimate gas for a transaction (useful for showing fees)
   */
  async estimatePaymentGas(authorization: PaymentAuthorization, signature: string): Promise<string> {
    if (!this.contract) {
      throw new Error('Service not initialized')
    }

    try {
      const gasEstimate = await this.contract.createAndPayBooking.estimateGas(authorization, signature)
      return gasEstimate.toString()
    } catch (error) {
      console.error('❌ Gas estimation error:', error)
      return '0'
    }
  }
}

// Singleton instance
export const blockchainService = new BlockchainService()

// Hook for easy integration with React components
export function useBlockchainService() {
  const { user, authenticated } = usePrivy()
  const { client: smartWalletClient } = useSmartWallets()
  
  const initializeService = async () => {
    if (!user || !authenticated) {
      throw new Error('User not authenticated')
    }
    // Store smart wallet client in the blockchain service for later use
    blockchainService.setSmartWalletClient(smartWalletClient)
    console.log('🔐 Blockchain service initialized for user:', user.id)
  }

  return {
    blockchainService,
    initializeService,
    isWalletConnected: !!(user && authenticated), // User is always "connected" via Privy
    smartWalletClient
  }
}
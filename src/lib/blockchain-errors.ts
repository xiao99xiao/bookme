/**
 * Blockchain Error Handling Utilities
 * Provides consistent error handling and user-friendly messages for blockchain interactions
 */

export enum BlockchainErrorCode {
  // Wallet & Connection Errors
  WALLET_NOT_CONNECTED = 'WALLET_NOT_CONNECTED',
  WALLET_NOT_INSTALLED = 'WALLET_NOT_INSTALLED',
  WRONG_NETWORK = 'WRONG_NETWORK',
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  
  // Transaction Errors
  USER_REJECTED = 'USER_REJECTED',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  INSUFFICIENT_ALLOWANCE = 'INSUFFICIENT_ALLOWANCE',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  TRANSACTION_TIMEOUT = 'TRANSACTION_TIMEOUT',
  GAS_ESTIMATION_FAILED = 'GAS_ESTIMATION_FAILED',
  NONCE_TOO_LOW = 'NONCE_TOO_LOW',
  REPLACEMENT_UNDERPRICED = 'REPLACEMENT_UNDERPRICED',
  
  // Contract Errors
  CONTRACT_NOT_FOUND = 'CONTRACT_NOT_FOUND',
  CONTRACT_CALL_FAILED = 'CONTRACT_CALL_FAILED',
  INVALID_SIGNATURE = 'INVALID_SIGNATURE',
  EXPIRED_SIGNATURE = 'EXPIRED_SIGNATURE',
  BOOKING_NOT_FOUND = 'BOOKING_NOT_FOUND',
  BOOKING_ALREADY_PAID = 'BOOKING_ALREADY_PAID',
  BOOKING_ALREADY_CANCELLED = 'BOOKING_ALREADY_CANCELLED',
  BOOKING_ALREADY_COMPLETED = 'BOOKING_ALREADY_COMPLETED',
  UNAUTHORIZED_ACTION = 'UNAUTHORIZED_ACTION',
  
  // API Errors
  API_ERROR = 'API_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTHORIZATION_FAILED = 'AUTHORIZATION_FAILED',
  
  // Generic
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface BlockchainError {
  code: BlockchainErrorCode
  message: string
  originalError?: any
  txHash?: string
  suggestions?: string[]
}

export class BlockchainErrorHandler {
  private static readonly ERROR_MESSAGES: Record<BlockchainErrorCode, string> = {
    // Wallet & Connection Errors
    [BlockchainErrorCode.WALLET_NOT_CONNECTED]: 'Please connect your wallet to continue',
    [BlockchainErrorCode.WALLET_NOT_INSTALLED]: 'No crypto wallet found. Please install MetaMask or connect via Privy',
    [BlockchainErrorCode.WRONG_NETWORK]: 'Please switch to the correct network',
    [BlockchainErrorCode.CONNECTION_FAILED]: 'Failed to connect to blockchain network',
    
    // Transaction Errors
    [BlockchainErrorCode.USER_REJECTED]: 'Transaction was cancelled by user',
    [BlockchainErrorCode.INSUFFICIENT_FUNDS]: 'Insufficient funds for this transaction',
    [BlockchainErrorCode.INSUFFICIENT_ALLOWANCE]: 'Please approve USDC spending first',
    [BlockchainErrorCode.TRANSACTION_FAILED]: 'Transaction failed. Please try again',
    [BlockchainErrorCode.TRANSACTION_TIMEOUT]: 'Transaction timed out. Please check blockchain explorer',
    [BlockchainErrorCode.GAS_ESTIMATION_FAILED]: 'Unable to estimate transaction cost',
    [BlockchainErrorCode.NONCE_TOO_LOW]: 'Transaction conflict. Please try again',
    [BlockchainErrorCode.REPLACEMENT_UNDERPRICED]: 'Transaction fee too low. Please increase and retry',
    
    // Contract Errors
    [BlockchainErrorCode.CONTRACT_NOT_FOUND]: 'Smart contract not found on this network',
    [BlockchainErrorCode.CONTRACT_CALL_FAILED]: 'Smart contract call failed',
    [BlockchainErrorCode.INVALID_SIGNATURE]: 'Invalid payment authorization. Please try again',
    [BlockchainErrorCode.EXPIRED_SIGNATURE]: 'Payment authorization expired. Please create a new booking',
    [BlockchainErrorCode.BOOKING_NOT_FOUND]: 'Booking not found on blockchain',
    [BlockchainErrorCode.BOOKING_ALREADY_PAID]: 'This booking has already been paid',
    [BlockchainErrorCode.BOOKING_ALREADY_CANCELLED]: 'This booking has already been cancelled',
    [BlockchainErrorCode.BOOKING_ALREADY_COMPLETED]: 'This booking has already been completed',
    [BlockchainErrorCode.UNAUTHORIZED_ACTION]: 'You are not authorized to perform this action',
    
    // API Errors
    [BlockchainErrorCode.API_ERROR]: 'Server error. Please try again',
    [BlockchainErrorCode.NETWORK_ERROR]: 'Network connection error. Please check your internet',
    [BlockchainErrorCode.AUTHORIZATION_FAILED]: 'Failed to get payment authorization',
    
    // Generic
    [BlockchainErrorCode.UNKNOWN_ERROR]: 'An unexpected error occurred. Please try again'
  }

  private static readonly ERROR_SUGGESTIONS: Partial<Record<BlockchainErrorCode, string[]>> = {
    [BlockchainErrorCode.WALLET_NOT_CONNECTED]: [
      'Click the wallet connection button',
      'Make sure your wallet is unlocked',
      'Try refreshing the page'
    ],
    [BlockchainErrorCode.WRONG_NETWORK]: [
      'Switch to Base Sepolia network in your wallet',
      'Check network settings in wallet'
    ],
    [BlockchainErrorCode.INSUFFICIENT_FUNDS]: [
      'Add more funds to your wallet',
      'Check your USDC balance',
      'Consider using a different payment method'
    ],
    [BlockchainErrorCode.INSUFFICIENT_ALLOWANCE]: [
      'Approve USDC spending in the next transaction',
      'This requires two transactions: approve then pay'
    ],
    [BlockchainErrorCode.USER_REJECTED]: [
      'Try the transaction again',
      'Make sure you confirm in your wallet'
    ],
    [BlockchainErrorCode.TRANSACTION_TIMEOUT]: [
      'Check transaction status on block explorer',
      'Try with higher gas fees',
      'Wait for network congestion to clear'
    ],
    [BlockchainErrorCode.EXPIRED_SIGNATURE]: [
      'Create a new booking',
      'Payment authorizations expire after 15 minutes'
    ]
  }

  /**
   * Parse any error into a structured BlockchainError
   */
  static parseError(error: any, context?: string): BlockchainError {
    // Handle ethers.js errors
    if (error.code) {
      switch (error.code) {
        case 'ACTION_REJECTED':
        case 4001: // MetaMask user rejection
          return {
            code: BlockchainErrorCode.USER_REJECTED,
            message: this.ERROR_MESSAGES[BlockchainErrorCode.USER_REJECTED],
            originalError: error,
            suggestions: this.ERROR_SUGGESTIONS[BlockchainErrorCode.USER_REJECTED]
          }

        case 'INSUFFICIENT_FUNDS':
        case -32000: // Insufficient funds
          return {
            code: BlockchainErrorCode.INSUFFICIENT_FUNDS,
            message: this.ERROR_MESSAGES[BlockchainErrorCode.INSUFFICIENT_FUNDS],
            originalError: error,
            suggestions: this.ERROR_SUGGESTIONS[BlockchainErrorCode.INSUFFICIENT_FUNDS]
          }

        case 'NONCE_TOO_LOW':
          return {
            code: BlockchainErrorCode.NONCE_TOO_LOW,
            message: this.ERROR_MESSAGES[BlockchainErrorCode.NONCE_TOO_LOW],
            originalError: error
          }

        case 'REPLACEMENT_UNDERPRICED':
          return {
            code: BlockchainErrorCode.REPLACEMENT_UNDERPRICED,
            message: this.ERROR_MESSAGES[BlockchainErrorCode.REPLACEMENT_UNDERPRICED],
            originalError: error
          }

        case 'NETWORK_ERROR':
          return {
            code: BlockchainErrorCode.NETWORK_ERROR,
            message: this.ERROR_MESSAGES[BlockchainErrorCode.NETWORK_ERROR],
            originalError: error
          }
      }
    }

    // Handle contract revert reasons
    if (error.reason) {
      const reason = error.reason.toLowerCase()
      
      if (reason.includes('signature') && reason.includes('invalid')) {
        return {
          code: BlockchainErrorCode.INVALID_SIGNATURE,
          message: this.ERROR_MESSAGES[BlockchainErrorCode.INVALID_SIGNATURE],
          originalError: error,
          suggestions: this.ERROR_SUGGESTIONS[BlockchainErrorCode.EXPIRED_SIGNATURE]
        }
      }
      
      if (reason.includes('expired')) {
        return {
          code: BlockchainErrorCode.EXPIRED_SIGNATURE,
          message: this.ERROR_MESSAGES[BlockchainErrorCode.EXPIRED_SIGNATURE],
          originalError: error,
          suggestions: this.ERROR_SUGGESTIONS[BlockchainErrorCode.EXPIRED_SIGNATURE]
        }
      }
      
      if (reason.includes('already paid')) {
        return {
          code: BlockchainErrorCode.BOOKING_ALREADY_PAID,
          message: this.ERROR_MESSAGES[BlockchainErrorCode.BOOKING_ALREADY_PAID],
          originalError: error
        }
      }
      
      if (reason.includes('already cancelled')) {
        return {
          code: BlockchainErrorCode.BOOKING_ALREADY_CANCELLED,
          message: this.ERROR_MESSAGES[BlockchainErrorCode.BOOKING_ALREADY_CANCELLED],
          originalError: error
        }
      }
      
      if (reason.includes('already completed')) {
        return {
          code: BlockchainErrorCode.BOOKING_ALREADY_COMPLETED,
          message: this.ERROR_MESSAGES[BlockchainErrorCode.BOOKING_ALREADY_COMPLETED],
          originalError: error
        }
      }
      
      if (reason.includes('unauthorized')) {
        return {
          code: BlockchainErrorCode.UNAUTHORIZED_ACTION,
          message: this.ERROR_MESSAGES[BlockchainErrorCode.UNAUTHORIZED_ACTION],
          originalError: error
        }
      }
      
      if (reason.includes('not found')) {
        return {
          code: BlockchainErrorCode.BOOKING_NOT_FOUND,
          message: this.ERROR_MESSAGES[BlockchainErrorCode.BOOKING_NOT_FOUND],
          originalError: error
        }
      }
    }

    // Handle network/chain mismatch
    if (error.message && error.message.includes('chain')) {
      return {
        code: BlockchainErrorCode.WRONG_NETWORK,
        message: this.ERROR_MESSAGES[BlockchainErrorCode.WRONG_NETWORK],
        originalError: error,
        suggestions: this.ERROR_SUGGESTIONS[BlockchainErrorCode.WRONG_NETWORK]
      }
    }

    // Handle timeout errors
    if (error.message && (error.message.includes('timeout') || error.message.includes('timed out'))) {
      return {
        code: BlockchainErrorCode.TRANSACTION_TIMEOUT,
        message: this.ERROR_MESSAGES[BlockchainErrorCode.TRANSACTION_TIMEOUT],
        originalError: error,
        suggestions: this.ERROR_SUGGESTIONS[BlockchainErrorCode.TRANSACTION_TIMEOUT]
      }
    }

    // Handle API errors
    if (error.status && error.status >= 400) {
      return {
        code: BlockchainErrorCode.API_ERROR,
        message: this.ERROR_MESSAGES[BlockchainErrorCode.API_ERROR],
        originalError: error
      }
    }

    // Handle string errors
    if (typeof error === 'string') {
      const lowerError = error.toLowerCase()
      
      if (lowerError.includes('user rejected') || lowerError.includes('user denied')) {
        return {
          code: BlockchainErrorCode.USER_REJECTED,
          message: this.ERROR_MESSAGES[BlockchainErrorCode.USER_REJECTED],
          originalError: error,
          suggestions: this.ERROR_SUGGESTIONS[BlockchainErrorCode.USER_REJECTED]
        }
      }
      
      if (lowerError.includes('insufficient') && lowerError.includes('fund')) {
        return {
          code: BlockchainErrorCode.INSUFFICIENT_FUNDS,
          message: this.ERROR_MESSAGES[BlockchainErrorCode.INSUFFICIENT_FUNDS],
          originalError: error,
          suggestions: this.ERROR_SUGGESTIONS[BlockchainErrorCode.INSUFFICIENT_FUNDS]
        }
      }
    }

    // Default unknown error
    return {
      code: BlockchainErrorCode.UNKNOWN_ERROR,
      message: this.ERROR_MESSAGES[BlockchainErrorCode.UNKNOWN_ERROR],
      originalError: error
    }
  }

  /**
   * Get user-friendly error message
   */
  static getErrorMessage(error: any): string {
    const parsedError = this.parseError(error)
    return parsedError.message
  }

  /**
   * Get error suggestions for user
   */
  static getErrorSuggestions(error: any): string[] {
    const parsedError = this.parseError(error)
    return parsedError.suggestions || []
  }

  /**
   * Check if error is recoverable (user can retry)
   */
  static isRecoverableError(error: any): boolean {
    const parsedError = this.parseError(error)
    
    const recoverableErrors = [
      BlockchainErrorCode.USER_REJECTED,
      BlockchainErrorCode.INSUFFICIENT_FUNDS,
      BlockchainErrorCode.INSUFFICIENT_ALLOWANCE,
      BlockchainErrorCode.TRANSACTION_FAILED,
      BlockchainErrorCode.TRANSACTION_TIMEOUT,
      BlockchainErrorCode.NONCE_TOO_LOW,
      BlockchainErrorCode.REPLACEMENT_UNDERPRICED,
      BlockchainErrorCode.NETWORK_ERROR,
      BlockchainErrorCode.API_ERROR,
      BlockchainErrorCode.UNKNOWN_ERROR
    ]
    
    return recoverableErrors.includes(parsedError.code)
  }

  /**
   * Check if error requires wallet connection
   */
  static requiresWalletConnection(error: any): boolean {
    const parsedError = this.parseError(error)
    
    const walletErrors = [
      BlockchainErrorCode.WALLET_NOT_CONNECTED,
      BlockchainErrorCode.WALLET_NOT_INSTALLED
    ]
    
    return walletErrors.includes(parsedError.code)
  }

  /**
   * Check if error requires network switch
   */
  static requiresNetworkSwitch(error: any): boolean {
    const parsedError = this.parseError(error)
    return parsedError.code === BlockchainErrorCode.WRONG_NETWORK
  }

  /**
   * Log error for debugging (removes sensitive data)
   */
  static logError(error: any, context?: string): void {
    const parsedError = this.parseError(error, context)
    
    console.group(`🔗 Blockchain Error${context ? ` (${context})` : ''}`)
    console.error('Code:', parsedError.code)
    console.error('Message:', parsedError.message)
    if (parsedError.suggestions) {
      console.info('Suggestions:', parsedError.suggestions)
    }
    console.error('Original Error:', parsedError.originalError)
    console.groupEnd()
  }
}
import { ethers } from 'ethers'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

class EIP712Signer {
  constructor() {
    this.CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS
    this.CHAIN_ID = parseInt(process.env.CONTRACT_CHAIN_ID) || 84532
    
    // Initialize backend signer
    if (!process.env.BACKEND_SIGNER_PRIVATE_KEY) {
      throw new Error('BACKEND_SIGNER_PRIVATE_KEY not configured')
    }
    
    this.backendSigner = new ethers.Wallet(process.env.BACKEND_SIGNER_PRIVATE_KEY)
    
    // EIP-712 Domain - Must match contract's EIP712 constructor
    this.domain = {
      name: "BookMe Escrow", // Must match contract: EIP712("BookMe Escrow", "1")
      version: "1",
      chainId: this.CHAIN_ID,
      verifyingContract: this.CONTRACT_ADDRESS
    }
    
    // EIP-712 Types
    this.types = {
      BookingAuthorization: [
        { name: "bookingId", type: "bytes32" },
        { name: "customer", type: "address" },
        { name: "provider", type: "address" },
        { name: "inviter", type: "address" },
        { name: "amount", type: "uint256" },
        { name: "platformFeeRate", type: "uint256" },
        { name: "inviterFeeRate", type: "uint256" },
        { name: "expiry", type: "uint256" },
        { name: "nonce", type: "uint256" }
      ],
      CancellationAuthorization: [
        { name: "bookingId", type: "bytes32" },
        { name: "customerAmount", type: "uint256" },
        { name: "providerAmount", type: "uint256" },
        { name: "platformAmount", type: "uint256" },
        { name: "inviterAmount", type: "uint256" },
        { name: "reason", type: "string" },
        { name: "expiry", type: "uint256" },
        { name: "nonce", type: "uint256" }
      ]
    }
    
    console.log('🔐 EIP-712 Signer initialized')
    console.log('Backend Signer Address:', this.backendSigner.address)
    console.log('Contract Address:', this.CONTRACT_ADDRESS)
    console.log('Chain ID:', this.CHAIN_ID)
  }

  /**
   * Generate a unique nonce for signatures
   */
  generateNonce() {
    return Date.now() + Math.floor(Math.random() * 1000000)
  }

  /**
   * Generate booking authorization signature
   */
  async signBookingAuthorization({
    bookingId,
    customer,
    provider,
    inviter = ethers.ZeroAddress,
    amount,
    platformFeeRate = 1000, // 10% default
    inviterFeeRate = 0,     // 0% default (5% if inviter exists)
    expiryMinutes = 5       // 5 minutes default
  }) {
    try {
      const expiry = Math.floor(Date.now() / 1000) + (expiryMinutes * 60)
      const nonce = this.generateNonce()
      
      // Convert booking ID to bytes32
      const bookingIdBytes = ethers.keccak256(ethers.toUtf8Bytes(bookingId))
      
      // Convert amount to USDC wei (6 decimals)
      const amountWei = ethers.parseUnits(amount.toString(), 6)
      
      const authorizationData = {
        bookingId: bookingIdBytes,
        customer,
        provider,
        inviter: inviter || ethers.ZeroAddress,
        amount: amountWei,
        platformFeeRate,
        inviterFeeRate,
        expiry,
        nonce
      }
      
      // Sign the structured data
      const signature = await this.backendSigner.signTypedData(
        this.domain,
        { BookingAuthorization: this.types.BookingAuthorization },
        authorizationData
      )
      
      console.log('✅ Generated booking authorization signature')
      console.log('Booking ID:', bookingId)
      console.log('Amount:', amount, 'USDC')
      console.log('Expiry:', new Date(expiry * 1000).toISOString())
      
      return {
        authorization: authorizationData,
        signature,
        expiry,
        nonce
      }
      
    } catch (error) {
      console.error('❌ Error signing booking authorization:', error)
      throw error
    }
  }

  /**
   * Generate cancellation authorization signature
   */
  async signCancellationAuthorization({
    bookingId,
    customerAmount,
    providerAmount,
    platformAmount,
    inviterAmount = 0,
    reason = "Booking cancelled",
    expiryMinutes = 5
  }) {
    try {
      const expiry = Math.floor(Date.now() / 1000) + (expiryMinutes * 60)
      const nonce = this.generateNonce()
      
      // Convert booking ID to bytes32
      const bookingIdBytes = ethers.keccak256(ethers.toUtf8Bytes(bookingId))
      
      // Convert amounts to USDC wei (6 decimals)
      const customerAmountWei = ethers.parseUnits(customerAmount.toString(), 6)
      const providerAmountWei = ethers.parseUnits(providerAmount.toString(), 6)
      const platformAmountWei = ethers.parseUnits(platformAmount.toString(), 6)
      const inviterAmountWei = ethers.parseUnits(inviterAmount.toString(), 6)
      
      const authorizationData = {
        bookingId: bookingIdBytes,
        customerAmount: customerAmountWei,
        providerAmount: providerAmountWei,
        platformAmount: platformAmountWei,
        inviterAmount: inviterAmountWei,
        reason,
        expiry,
        nonce
      }
      
      // Sign the structured data
      const signature = await this.backendSigner.signTypedData(
        this.domain,
        { CancellationAuthorization: this.types.CancellationAuthorization },
        authorizationData
      )
      
      console.log('✅ Generated cancellation authorization signature')
      console.log('Booking ID:', bookingId)
      console.log('Customer refund:', customerAmount, 'USDC')
      console.log('Provider compensation:', providerAmount, 'USDC')
      
      return {
        authorization: authorizationData,
        signature,
        expiry,
        nonce
      }
      
    } catch (error) {
      console.error('❌ Error signing cancellation authorization:', error)
      throw error
    }
  }

  /**
   * Verify a signature (for testing/debugging)
   */
  async verifySignature(authorization, signature, type = 'BookingAuthorization') {
    try {
      const recoveredAddress = ethers.verifyTypedData(
        this.domain,
        { [type]: this.types[type] },
        authorization,
        signature
      )
      
      const isValid = recoveredAddress.toLowerCase() === this.backendSigner.address.toLowerCase()
      
      console.log('🔍 Signature verification:', isValid ? 'VALID' : 'INVALID')
      console.log('Expected signer:', this.backendSigner.address)
      console.log('Recovered signer:', recoveredAddress)
      
      return isValid
    } catch (error) {
      console.error('❌ Error verifying signature:', error)
      return false
    }
  }

  /**
   * Calculate fee distribution based on inviter presence
   */
  calculateFees(totalAmount, hasInviter = false) {
    const platformFeeRate = hasInviter ? 500 : 1000  // 5% if inviter, 10% if no inviter
    const inviterFeeRate = hasInviter ? 500 : 0      // 5% if inviter, 0% if no inviter
    
    const platformFee = (totalAmount * platformFeeRate) / 10000
    const inviterFee = (totalAmount * inviterFeeRate) / 10000
    const providerAmount = totalAmount - platformFee - inviterFee
    
    return {
      platformFeeRate,
      inviterFeeRate,
      platformFee,
      inviterFee,
      providerAmount,
      totalAmount
    }
  }

  /**
   * Get signer address
   */
  getSignerAddress() {
    return this.backendSigner.address
  }
}

export default EIP712Signer
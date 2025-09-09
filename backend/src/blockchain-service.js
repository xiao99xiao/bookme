import { ethers } from 'ethers'
import dotenv from 'dotenv'
import contractABI from './contract-abi.json' with { type: 'json' }

// Load environment variables
dotenv.config()

class BlockchainService {
  constructor() {
    this.CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS
    this.CHAIN_ID = parseInt(process.env.CONTRACT_CHAIN_ID)
    this.RPC_URL = process.env.BASE_SEPOLIA_RPC
    this.USDC_ADDRESS = process.env.USDC_ADDRESS
    
    // Initialize provider and contract
    this.provider = new ethers.JsonRpcProvider(this.RPC_URL)
    this.contract = new ethers.Contract(this.CONTRACT_ADDRESS, contractABI, this.provider)
    
    // Backend signer for authorizations
    if (process.env.BACKEND_SIGNER_PRIVATE_KEY) {
      this.signer = new ethers.Wallet(process.env.BACKEND_SIGNER_PRIVATE_KEY, this.provider)
      this.contractWithSigner = new ethers.Contract(this.CONTRACT_ADDRESS, contractABI, this.signer)
    }
    
    console.log('🔗 Blockchain service initialized')
    console.log('Contract Address:', this.CONTRACT_ADDRESS)
    console.log('Chain ID:', this.CHAIN_ID)
    console.log('RPC URL:', this.RPC_URL)
    console.log('Backend Signer:', this.signer ? this.signer.address : 'Not configured')
  }

  /**
   * Test contract connection
   */
  async testConnection() {
    try {
      const network = await this.provider.getNetwork()
      console.log('✅ Connected to network:', network.name, 'Chain ID:', network.chainId.toString())
      
      // Test contract read
      const contractExists = await this.provider.getCode(this.CONTRACT_ADDRESS)
      if (contractExists === '0x') {
        throw new Error('Contract not found at address')
      }
      console.log('✅ Contract exists at address:', this.CONTRACT_ADDRESS)
      
      return { success: true, network: network.name, chainId: network.chainId.toString() }
    } catch (error) {
      console.error('❌ Blockchain connection test failed:', error.message)
      return { success: false, error: error.message }
    }
  }

  /**
   * Get booking from contract
   */
  async getBooking(bookingId) {
    try {
      const bookingIdBytes = ethers.keccak256(ethers.toUtf8Bytes(bookingId))
      const booking = await this.contract.bookings(bookingIdBytes)
      return booking
    } catch (error) {
      console.error('Error getting booking:', error)
      throw error
    }
  }

  /**
   * Complete service as backend signer
   */
  async completeServiceAsBackend(bookingIdBytes) {
    try {
      if (!this.contractWithSigner) {
        throw new Error('Backend signer not configured')
      }
      
      console.log('🎉 Backend completing service for booking:', bookingIdBytes)
      
      const tx = await this.contractWithSigner.completeService(bookingIdBytes)
      
      console.log('🔄 Service completion transaction submitted:', tx.hash)
      const receipt = await tx.wait()
      
      console.log('✅ Service completion confirmed on blockchain')
      
      return tx.hash
    } catch (error) {
      console.error('❌ Backend service completion failed:', error)
      throw error
    }
  }

  /**
   * Emergency cancel booking (backend only)
   */
  async emergencyCancelBooking(bookingId, reason) {
    try {
      if (!this.contractWithSigner) {
        throw new Error('Backend signer not configured')
      }
      
      const bookingIdBytes = ethers.keccak256(ethers.toUtf8Bytes(bookingId))
      const tx = await this.contractWithSigner.emergencyCancelBooking(bookingIdBytes, reason)
      
      console.log('🚨 Emergency cancellation transaction:', tx.hash)
      const receipt = await tx.wait()
      
      return { success: true, txHash: tx.hash, receipt }
    } catch (error) {
      console.error('❌ Emergency cancellation failed:', error)
      throw error
    }
  }

  /**
   * Format booking ID to bytes32
   */
  formatBookingId(bookingId) {
    return ethers.keccak256(ethers.toUtf8Bytes(bookingId))
  }

  /**
   * Format USDC amount (6 decimals)
   */
  formatUSDC(amount) {
    return ethers.parseUnits(amount.toString(), 6)
  }

  /**
   * Parse USDC amount from wei
   */
  parseUSDC(amount) {
    return parseFloat(ethers.formatUnits(amount, 6))
  }
}

export default BlockchainService
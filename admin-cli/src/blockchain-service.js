import { ethers } from 'ethers'
import contractABI from './contract-abi.json' with { type: 'json' }

export class AdminBlockchainService {
  constructor() {
    this.CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || '0x33ddEd6F8183aa4dAB04E2aE216a5a3f9871405a'
    this.RPC_URL = process.env.BLOCKCHAIN_RPC_URL
    this.BACKEND_SIGNER_PRIVATE_KEY = process.env.BACKEND_SIGNER_PRIVATE_KEY
    this.USDC_ADDRESS = process.env.USDC_ADDRESS
    
    if (!this.CONTRACT_ADDRESS || !this.RPC_URL || !this.BACKEND_SIGNER_PRIVATE_KEY) {
      throw new Error('Missing required environment variables. Check CONTRACT_ADDRESS, BLOCKCHAIN_RPC_URL, and BACKEND_SIGNER_PRIVATE_KEY')
    }
    
    // Initialize provider and signer
    this.provider = new ethers.JsonRpcProvider(this.RPC_URL)
    this.signer = new ethers.Wallet(this.BACKEND_SIGNER_PRIVATE_KEY, this.provider)
    this.contract = new ethers.Contract(this.CONTRACT_ADDRESS, contractABI, this.signer)
    
    console.log('🔗 Admin Blockchain Service initialized')
    console.log('Contract Address:', this.CONTRACT_ADDRESS)
    console.log('Backend Signer:', this.signer.address)
  }

  /**
   * Test connection to blockchain
   */
  async testConnection() {
    try {
      const network = await this.provider.getNetwork()
      console.log('✅ Connected to network:', network.name, 'Chain ID:', network.chainId.toString())
      
      // Test contract exists
      const contractCode = await this.provider.getCode(this.CONTRACT_ADDRESS)
      if (contractCode === '0x') {
        throw new Error('Contract not found at address')
      }
      console.log('✅ Contract exists at address:', this.CONTRACT_ADDRESS)
      
      // Test signer balance
      const balance = await this.provider.getBalance(this.signer.address)
      console.log('✅ Backend signer balance:', ethers.formatEther(balance), 'ETH')
      
      return { success: true, network: network.name, chainId: network.chainId.toString() }
    } catch (error) {
      console.error('❌ Blockchain connection test failed:', error.message)
      throw error
    }
  }

  /**
   * Parse transaction and extract booking ID from events
   */
  async getBookingIdFromTransaction(txHash) {
    try {
      console.log('🔍 Fetching transaction receipt...')
      
      // Get transaction receipt which contains the events
      const receipt = await this.provider.getTransactionReceipt(txHash)
      
      if (!receipt) {
        throw new Error('Transaction not found or not yet mined')
      }
      
      console.log('✅ Transaction found, parsing events...')
      
      // Parse logs using the contract interface
      const contract = new ethers.Contract(this.CONTRACT_ADDRESS, contractABI, this.provider)
      
      for (const log of receipt.logs) {
        try {
          // Try to parse each log with our contract interface
          if (log.address.toLowerCase() === this.CONTRACT_ADDRESS.toLowerCase()) {
            const parsedLog = contract.interface.parseLog(log)
            
            if (parsedLog) {
              console.log(`📋 Found event: ${parsedLog.name}`)
              
              // Look for events that contain booking information
              if (parsedLog.name === 'BookingCreatedAndPaid' || 
                  parsedLog.name === 'BookingCancelled' || 
                  parsedLog.name === 'ServiceCompleted') {
                
                const bookingId = parsedLog.args.bookingId
                console.log(`✅ Extracted booking ID: ${bookingId}`)
                
                return {
                  bookingId: bookingId,
                  eventName: parsedLog.name,
                  transactionHash: txHash,
                  blockNumber: receipt.blockNumber,
                  eventData: parsedLog.args
                }
              }
            }
          }
        } catch (parseError) {
          // Skip logs that can't be parsed (might be from other contracts)
          continue
        }
      }
      
      throw new Error('No booking-related events found in this transaction')
      
    } catch (error) {
      console.error('❌ Error parsing transaction:', error.message)
      throw error
    }
  }

  /**
   * Get all active bookings from smart contract using enumeration functions
   */
  async getActiveBookings() {
    try {
      console.log('🔍 Fetching active bookings from smart contract...')
      
      // Use the new enumeration functions instead of event queries
      const activeBookingIds = await this.contract.getActiveBookingIds()
      console.log(`📋 Found ${activeBookingIds.length} active booking IDs`)
      
      const activeBookings = []
      
      for (const bookingId of activeBookingIds) {
        try {
          // Get booking details from contract
          const booking = await this.contract.bookings(bookingId)
          
          const bookingData = {
            blockchainId: bookingId,
            customer: booking.customer,
            provider: booking.provider,
            inviter: booking.inviter,
            amount: booking.amount.toString(),
            amountUSDC: parseFloat(ethers.formatUnits(booking.amount, 6)),
            platformFeeRate: booking.platformFeeRate.toString(),
            inviterFeeRate: booking.inviterFeeRate.toString(),
            status: this.getStatusName(booking.status),
            createdAt: new Date(Number(booking.createdAt) * 1000).toISOString()
          }
          activeBookings.push(bookingData)
        } catch (bookingError) {
          console.warn(`⚠️ Could not fetch details for booking ${bookingId}:`, bookingError.message)
        }
      }
      
      console.log(`✅ Found ${activeBookings.length} active bookings`)
      return activeBookings
      
    } catch (error) {
      console.error('❌ Error fetching active bookings:', error)
      throw error
    }
  }

  /**
   * Get all active bookings from database (alternative method)
   */
  async getActiveBookingsFromDatabase(databaseService) {
    try {
      console.log('🔍 Fetching active bookings from database...')
      
      // This would require the database service to find bookings with blockchain_booking_id
      // and status 'paid' or similar blockchain-tracked statuses
      
      // For now, return instructions
      console.log('💡 Database method not implemented yet')
      console.log('📋 To implement: Query database for bookings with blockchain_booking_id != null and status = "paid"')
      
      return []
      
    } catch (error) {
      console.error('❌ Error fetching bookings from database:', error)
      throw error
    }
  }

  /**
   * Emergency cancel a specific booking (using backend signer)
   */
  async emergencyCancelBooking(blockchainBookingId, reason = 'Admin emergency cancellation') {
    try {
      console.log(`🚨 Emergency cancelling booking: ${blockchainBookingId}`)
      console.log(`📝 Reason: ${reason}`)
      
      // Call the renamed cancel function
      const tx = await this.contract.cancelBookingAsBackend(blockchainBookingId, reason)
      console.log(`📋 Transaction submitted: ${tx.hash}`)
      
      // Wait for confirmation
      console.log('⏳ Waiting for confirmation...')
      const receipt = await tx.wait()
      
      console.log(`✅ Booking cancelled successfully!`)
      console.log(`📋 Transaction: ${receipt.transactionHash}`)
      console.log(`⛽ Gas used: ${receipt.gasUsed.toString()}`)
      
      return {
        success: true,
        txHash: receipt.transactionHash,
        gasUsed: receipt.gasUsed.toString(),
        blockNumber: receipt.blockNumber
      }
      
    } catch (error) {
      console.error(`❌ Emergency cancellation failed:`, error)
      
      if (error.reason) {
        console.error(`📋 Reason: ${error.reason}`)
      }
      
      throw error
    }
  }

  /**
   * Emergency cancel all active bookings
   */
  async emergencyCancelAllBookings(reason = 'Admin bulk emergency cancellation') {
    try {
      const activeBookings = await this.getActiveBookings()
      
      if (activeBookings.length === 0) {
        console.log('✅ No active bookings to cancel')
        return { success: true, cancelled: 0, results: [] }
      }
      
      console.log(`🚨 Cancelling ${activeBookings.length} active bookings...`)
      
      const results = []
      let successCount = 0
      let failureCount = 0
      
      for (const booking of activeBookings) {
        try {
          console.log(`\n🔄 Cancelling booking ${booking.blockchainId.slice(0, 10)}... (${booking.amountUSDC} USDC)`)
          
          const result = await this.emergencyCancelBooking(booking.blockchainId, reason)
          results.push({ booking: booking.blockchainId, success: true, ...result })
          successCount++
          
          // Small delay between cancellations to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000))
          
        } catch (error) {
          console.error(`❌ Failed to cancel booking ${booking.blockchainId}:`, error.message)
          results.push({ booking: booking.blockchainId, success: false, error: error.message })
          failureCount++
        }
      }
      
      console.log(`\n📊 Bulk cancellation summary:`)
      console.log(`✅ Successful: ${successCount}`)
      console.log(`❌ Failed: ${failureCount}`)
      console.log(`📋 Total: ${activeBookings.length}`)
      
      return {
        success: true,
        cancelled: successCount,
        failed: failureCount,
        total: activeBookings.length,
        results
      }
      
    } catch (error) {
      console.error('❌ Bulk cancellation failed:', error)
      throw error
    }
  }

  /**
   * Get human-readable status name
   */
  getStatusName(statusNumber) {
    const statuses = {
      0: 'Paid',
      1: 'Completed', 
      2: 'Cancelled',
      3: 'Disputed'
    }
    return statuses[statusNumber] || `Unknown(${statusNumber})`
  }

  /**
   * Get transaction details from blockchain
   */
  async getTransactionDetails(txHash) {
    try {
      const tx = await this.provider.getTransaction(txHash)
      if (!tx) {
        return null
      }

      const receipt = await this.provider.getTransactionReceipt(txHash)
      return {
        transaction: tx,
        receipt: receipt,
        blockNumber: receipt?.blockNumber,
        status: receipt?.status === 1 ? 'success' : 'failed'
      }
    } catch (error) {
      console.error('❌ Error fetching transaction details:', error.message)
      return null
    }
  }

  /**
   * Get ServiceCompleted event from transaction
   */
  async getServiceCompletedEvent(txHash) {
    try {
      const receipt = await this.provider.getTransactionReceipt(txHash)

      if (!receipt) {
        return null
      }

      // Parse logs to find ServiceCompleted event
      for (const log of receipt.logs) {
        try {
          if (log.address.toLowerCase() === this.CONTRACT_ADDRESS.toLowerCase()) {
            const parsedLog = this.contract.interface.parseLog(log)

            if (parsedLog && parsedLog.name === 'ServiceCompleted') {
              return {
                bookingId: parsedLog.args.bookingId,
                provider: parsedLog.args.provider,
                providerAmount: this.parseUSDC(parsedLog.args.providerAmount),
                platformFee: this.parseUSDC(parsedLog.args.platformFee),
                inviterFee: parsedLog.args.inviterFee ? this.parseUSDC(parsedLog.args.inviterFee) : 0,
                transactionHash: txHash,
                blockNumber: receipt.blockNumber
              }
            }
          }
        } catch (parseError) {
          // Skip logs that can't be parsed
          continue
        }
      }

      return null
    } catch (error) {
      console.error('❌ Error fetching ServiceCompleted event:', error.message)
      return null
    }
  }

  /**
   * Format booking ID for display
   */
  formatBookingId(bookingId) {
    return `${bookingId.slice(0, 8)}...${bookingId.slice(-6)}`
  }

  /**
   * Parse USDC amount from wei
   */
  parseUSDC(amount) {
    return parseFloat(ethers.formatUnits(amount, 6))
  }
}
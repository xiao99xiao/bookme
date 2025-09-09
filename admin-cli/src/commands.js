import chalk from 'chalk'
import inquirer from 'inquirer'
import { AdminBlockchainService } from './blockchain-service.js'
import { DatabaseService } from './database-service.js'

export class AdminCommands {
  constructor() {
    this.blockchainService = new AdminBlockchainService()
    this.databaseService = new DatabaseService()
  }

  /**
   * Test connection to blockchain and database
   */
  async testConnection() {
    console.log(chalk.blue('🔍 Testing connections...\n'))
    
    try {
      await this.blockchainService.testConnection()
      console.log(chalk.green('✅ Blockchain connection successful\n'))
      return true
    } catch (error) {
      console.log(chalk.red('❌ Connection failed:'), error.message)
      return false
    }
  }

  /**
   * List all active bookings
   */
  async listActiveBookings() {
    console.log(chalk.blue('📋 Fetching active bookings from smart contract...\n'))
    
    try {
      const activeBookings = await this.blockchainService.getActiveBookings()
      
      if (activeBookings.length === 0) {
        console.log(chalk.yellow('✨ No active bookings found in smart contract'))
        return []
      }
      
      // Get enhanced details from database
      console.log(chalk.blue('🔍 Fetching additional details from database...\n'))
      const enhancedBookings = await this.databaseService.getEnhancedBookingDetails(activeBookings)
      
      // Display bookings table
      this.displayBookingsTable(enhancedBookings)
      
      return enhancedBookings
      
    } catch (error) {
      console.log(chalk.red('❌ Error listing bookings:'), error.message)
      throw error
    }
  }

  /**
   * Cancel a specific booking
   */
  async cancelBooking(bookingId, reason) {
    try {
      if (!bookingId) {
        // Interactive mode - let user select booking
        const activeBookings = await this.listActiveBookings()
        
        if (activeBookings.length === 0) {
          console.log(chalk.yellow('No bookings to cancel'))
          return
        }
        
        const { selectedBooking } = await inquirer.prompt([
          {
            type: 'list',
            name: 'selectedBooking',
            message: 'Select a booking to cancel:',
            choices: activeBookings.map(booking => ({
              name: `${this.blockchainService.formatBookingId(booking.blockchainId)} - ${booking.amountUSDC} USDC - ${booking.database?.service?.title || 'Unknown Service'}`,
              value: booking.blockchainId
            }))
          }
        ])
        
        bookingId = selectedBooking
      }
      
      if (!reason) {
        const { enteredReason } = await inquirer.prompt([
          {
            type: 'input',
            name: 'enteredReason',
            message: 'Enter cancellation reason:',
            default: 'Admin emergency cancellation'
          }
        ])
        reason = enteredReason
      }
      
      // Confirm cancellation
      const { confirmed } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmed',
          message: `Are you sure you want to cancel booking ${this.blockchainService.formatBookingId(bookingId)}?`,
          default: false
        }
      ])
      
      if (!confirmed) {
        console.log(chalk.yellow('🚫 Cancellation aborted'))
        return
      }
      
      console.log(chalk.blue('🚨 Processing emergency cancellation...\n'))
      
      const result = await this.blockchainService.emergencyCancelBooking(bookingId, reason)
      
      // Update database status
      await this.databaseService.updateBookingStatus(bookingId, 'cancelled', result.txHash)
      
      console.log(chalk.green('\n✅ Booking cancelled successfully!'))
      console.log(chalk.gray(`📋 Transaction: ${result.txHash}`))
      
      return result
      
    } catch (error) {
      console.log(chalk.red('❌ Cancellation failed:'), error.message)
      throw error
    }
  }

  /**
   * Cancel all active bookings
   */
  async cancelAllBookings(reason) {
    try {
      const activeBookings = await this.listActiveBookings()
      
      if (activeBookings.length === 0) {
        console.log(chalk.yellow('✨ No active bookings to cancel'))
        return
      }
      
      if (!reason) {
        const { enteredReason } = await inquirer.prompt([
          {
            type: 'input',
            name: 'enteredReason',
            message: 'Enter reason for bulk cancellation:',
            default: 'Admin bulk emergency cancellation'
          }
        ])
        reason = enteredReason
      }
      
      // Calculate total value
      const totalValue = activeBookings.reduce((sum, booking) => sum + booking.amountUSDC, 0)
      
      console.log(chalk.red(`\n⚠️  WARNING: About to cancel ${activeBookings.length} bookings worth ${totalValue.toFixed(2)} USDC`))
      
      const { confirmed } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmed',
          message: 'Are you absolutely sure you want to cancel ALL active bookings?',
          default: false
        }
      ])
      
      if (!confirmed) {
        console.log(chalk.yellow('🚫 Bulk cancellation aborted'))
        return
      }
      
      const { doubleConfirmed } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'doubleConfirmed',
          message: 'This action cannot be undone. Proceed with bulk cancellation?',
          default: false
        }
      ])
      
      if (!doubleConfirmed) {
        console.log(chalk.yellow('🚫 Bulk cancellation aborted'))
        return
      }
      
      console.log(chalk.blue('🚨 Processing bulk emergency cancellation...\n'))
      
      const result = await this.blockchainService.emergencyCancelAllBookings(reason)
      
      // Update database statuses for successful cancellations
      for (const cancellation of result.results) {
        if (cancellation.success) {
          await this.databaseService.updateBookingStatus(
            cancellation.booking, 
            'cancelled', 
            cancellation.txHash
          )
        }
      }
      
      console.log(chalk.green('\n✅ Bulk cancellation completed!'))
      console.log(chalk.gray(`📊 Successfully cancelled: ${result.cancelled}/${result.total} bookings`))
      
      if (result.failed > 0) {
        console.log(chalk.yellow(`⚠️  Failed cancellations: ${result.failed}`))
      }
      
      return result
      
    } catch (error) {
      console.log(chalk.red('❌ Bulk cancellation failed:'), error.message)
      throw error
    }
  }

  /**
   * Display bookings in a formatted table
   */
  displayBookingsTable(bookings) {
    console.log(chalk.blue('📋 Active Bookings in Smart Contract:\n'))
    
    bookings.forEach((booking, index) => {
      const header = chalk.cyan(`[${index + 1}] ${this.blockchainService.formatBookingId(booking.blockchainId)}`)
      const amount = chalk.green(`${booking.amountUSDC} USDC`)
      const status = chalk.yellow(`Status: ${booking.status}`)
      
      console.log(`${header} - ${amount} - ${status}`)
      
      // Smart contract details
      console.log(chalk.gray(`  📱 Customer: ${this.formatAddress(booking.customer)}`))
      console.log(chalk.gray(`  🛠️  Provider: ${this.formatAddress(booking.provider)}`))
      
      if (booking.inviter !== '0x0000000000000000000000000000000000000000') {
        console.log(chalk.gray(`  👥 Inviter: ${this.formatAddress(booking.inviter)}`))
      }
      
      console.log(chalk.gray(`  💰 Platform Fee: ${booking.platformFeeRate / 100}%`))
      console.log(chalk.gray(`  🔗 Created: ${new Date(booking.createdAt).toLocaleString()}`))
      console.log(chalk.gray(`  📋 Tx Hash: ${booking.txHash}`))
      
      // Database details if available
      if (booking.database) {
        const db = booking.database
        console.log(chalk.blue(`  📊 Database Details:`))
        console.log(chalk.gray(`     Service: ${db.service?.title || 'Unknown'}`))
        console.log(chalk.gray(`     Customer: ${db.customer?.display_name || 'Unknown'} (@${db.customer?.username || 'no-username'})`))
        console.log(chalk.gray(`     Provider: ${db.provider?.display_name || 'Unknown'} (@${db.provider?.username || 'no-username'})`))
        console.log(chalk.gray(`     Scheduled: ${new Date(db.scheduledAt).toLocaleString()}`))
        console.log(chalk.gray(`     Duration: ${db.durationMinutes} minutes`))
        console.log(chalk.gray(`     Location: ${db.isOnline ? '🌐 Online' : '📍 ' + (db.location || 'TBD')}`))
        console.log(chalk.gray(`     DB Status: ${db.status}`))
      } else if (booking.warning) {
        console.log(chalk.yellow(`  ⚠️  ${booking.warning}`))
      }
      
      console.log() // Empty line between bookings
    })
    
    const totalValue = bookings.reduce((sum, booking) => sum + booking.amountUSDC, 0)
    console.log(chalk.cyan(`📊 Total: ${bookings.length} active bookings worth ${totalValue.toFixed(2)} USDC\n`))
  }

  /**
   * Format wallet address for display
   */
  formatAddress(address) {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }
}
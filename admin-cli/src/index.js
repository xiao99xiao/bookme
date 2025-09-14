#!/usr/bin/env node

import { Command } from 'commander'
import chalk from 'chalk'
import dotenv from 'dotenv'
import { AdminCommands } from './commands.js'

// Load environment variables
dotenv.config()

const program = new Command()

// CLI Information
program
  .name('bookme-admin')
  .description(chalk.blue('BookMe Admin CLI - Smart Contract Management Tool'))
  .version('1.0.0')

// Global error handler
process.on('unhandledRejection', (error) => {
  console.error(chalk.red('❌ Unhandled error:'), error.message)
  process.exit(1)
})

async function initializeCommands() {
  try {
    const commands = new AdminCommands()
    
    // Test connection command
    program
      .command('test')
      .description('Test connection to blockchain and database')
      .action(async () => {
        console.log(chalk.blue('🚀 BookMe Admin CLI - Connection Test\n'))
        const success = await commands.testConnection()
        process.exit(success ? 0 : 1)
      })

    // List active bookings command
    program
      .command('list')
      .alias('ls')
      .description('List all active bookings in smart contract')
      .action(async () => {
        try {
          console.log(chalk.blue('🚀 BookMe Admin CLI - List Active Bookings\n'))
          await commands.listActiveBookings()
          process.exit(0)
        } catch (error) {
          console.error(chalk.red('❌ Command failed:'), error.message)
          process.exit(1)
        }
      })

    // Cancel single booking command
    program
      .command('cancel [booking-id]')
      .description('Cancel a specific booking (interactive if no ID provided)')
      .option('-r, --reason <reason>', 'Cancellation reason')
      .action(async (bookingId, options) => {
        try {
          console.log(chalk.blue('🚀 BookMe Admin CLI - Cancel Booking\n'))
          await commands.cancelBooking(bookingId, options.reason)
          process.exit(0)
        } catch (error) {
          console.error(chalk.red('❌ Cancellation failed:'), error.message)
          process.exit(1)
        }
      })

    // Cancel all bookings command
    program
      .command('cancel-all')
      .description('Cancel ALL active bookings (use with extreme caution)')
      .option('-r, --reason <reason>', 'Cancellation reason')
      .action(async (options) => {
        try {
          console.log(chalk.blue('🚀 BookMe Admin CLI - Cancel All Bookings\n'))
          await commands.cancelAllBookings(options.reason)
          process.exit(0)
        } catch (error) {
          console.error(chalk.red('❌ Bulk cancellation failed:'), error.message)
          process.exit(1)
        }
      })

    // Find booking by transaction hash command
    program
      .command('find-tx <tx-hash>')
      .description('Find booking by transaction hash and optionally mark as paid')
      .option('-p, --mark-paid', 'Automatically mark booking as paid if found')
      .action(async (txHash, options) => {
        try {
          console.log(chalk.blue('🚀 BookMe Admin CLI - Find Booking by Transaction Hash\n'))
          await commands.findBookingByTxHash(txHash, options.markPaid)
          process.exit(0)
        } catch (error) {
          console.error(chalk.red('❌ Transaction lookup failed:'), error.message)
          process.exit(1)
        }
      })

    // Generate transaction records command
    program
      .command('generate-transactions')
      .alias('gen-tx')
      .description('Generate transaction records from completed bookings')
      .option('--dry-run', 'Preview what would be created without making changes')
      .action(async (options) => {
        try {
          console.log(chalk.blue('🚀 BookMe Admin CLI - Generate Transaction Records\n'))
          await commands.generateTransactionRecords(options.dryRun)
          process.exit(0)
        } catch (error) {
          console.error(chalk.red('❌ Transaction generation failed:'), error.message)
          process.exit(1)
        }
      })

    // Interactive mode (default command)
    program
      .command('interactive', { isDefault: true })
      .description('Start interactive mode')
      .action(async () => {
        await runInteractiveMode(commands)
      })

    // Parse command line arguments
    program.parse()
    
  } catch (error) {
    console.error(chalk.red('❌ Failed to initialize CLI:'), error.message)
    console.error(chalk.yellow('💡 Make sure your .env file is configured correctly'))
    process.exit(1)
  }
}

async function runInteractiveMode(commands) {
  const inquirer = (await import('inquirer')).default
  
  console.log(chalk.blue('🚀 BookMe Admin CLI - Interactive Mode\n'))
  
  // Test connection first
  const connectionOk = await commands.testConnection()
  if (!connectionOk) {
    console.log(chalk.red('❌ Cannot proceed without valid connections'))
    process.exit(1)
  }
  
  while (true) {
    try {
      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: [
            { name: '📋 List active bookings', value: 'list' },
            { name: '🔍 Find booking by transaction hash', value: 'find-tx' },
            { name: '💰 Generate transaction records', value: 'generate-transactions' },
            { name: '🚨 Cancel a booking', value: 'cancel' },
            { name: '💥 Cancel ALL bookings', value: 'cancel-all' },
            { name: '🔧 Test connections', value: 'test' },
            { name: '🚪 Exit', value: 'exit' }
          ]
        }
      ])
      
      console.log() // Empty line
      
      switch (action) {
        case 'list':
          await commands.listActiveBookings()
          break
          
        case 'find-tx':
          await commands.findBookingByTxHash()
          break
          
        case 'generate-transactions':
          await commands.generateTransactionRecords()
          break
          
        case 'cancel':
          await commands.cancelBooking()
          break
          
        case 'cancel-all':
          await commands.cancelAllBookings()
          break
          
        case 'test':
          await commands.testConnection()
          break
          
        case 'exit':
          console.log(chalk.blue('👋 Goodbye!'))
          process.exit(0)
          break
      }
      
      // Pause before showing menu again
      await inquirer.prompt([
        {
          type: 'input',
          name: 'continue',
          message: 'Press Enter to continue...'
        }
      ])
      
      console.clear() // Clear screen for better UX
      
    } catch (error) {
      console.error(chalk.red('❌ Error in interactive mode:'), error.message)
      
      const { retry } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'retry',
          message: 'Would you like to continue?',
          default: true
        }
      ])
      
      if (!retry) {
        process.exit(1)
      }
    }
  }
}

// Show help if no command provided
if (process.argv.length === 2) {
  console.log(chalk.blue('🚀 BookMe Admin CLI\n'))
  console.log(chalk.yellow('Usage:'))
  console.log('  npm start                    # Interactive mode')
  console.log('  npm run list                 # List active bookings')
  console.log('  npm run cancel               # Cancel a booking (interactive)')
  console.log('  npm run cancel-all           # Cancel all bookings')
  console.log()
  console.log(chalk.yellow('Direct commands:'))
  console.log('  node src/index.js test       # Test connections')
  console.log('  node src/index.js list       # List active bookings')
  console.log('  node src/index.js find-tx <hash> [-p]        # Find booking by transaction hash')
  console.log('  node src/index.js generate-transactions [--dry-run]  # Generate transaction records from completed bookings')
  console.log('  node src/index.js cancel [id] [-r "reason"]  # Cancel specific booking')
  console.log('  node src/index.js cancel-all [-r "reason"]   # Cancel all bookings')
  console.log()
  console.log(chalk.gray('Make sure to configure your .env file first!'))
  process.exit(0)
}

// Initialize and run
initializeCommands()
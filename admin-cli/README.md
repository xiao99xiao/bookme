# Nook Admin CLI

A command-line interface for managing Nook smart contract bookings. This tool allows administrators to view and emergency-cancel active bookings directly from the smart contract.

## Features

- 📋 **List Active Bookings**: View all bookings currently active in the smart contract
- 🚨 **Emergency Cancel**: Cancel individual bookings with full customer refund
- 💥 **Bulk Cancel**: Cancel all active bookings at once (use with caution)
- ✅ **Mark Complete by Tx**: Mark booking as completed using ServiceCompleted transaction hash
- 🔍 **Find by Tx Hash**: Find and mark bookings as paid by transaction hash
- 💰 **Generate Transactions**: Create transaction records for completed bookings
- 🔍 **Connection Test**: Verify blockchain and database connectivity
- 🎯 **Interactive Mode**: User-friendly interface for all operations

## Prerequisites

- Node.js 18+ 
- Access to Nook environment variables
- Backend signer private key (for emergency cancellations)

## Setup

### 1. Install Dependencies
```bash
cd admin-cli
npm install
```

### 2. Configure Environment
Copy the example environment file:
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```env
# Smart Contract Configuration
CONTRACT_ADDRESS=0xdBf76eAc2B7aa6CCb5BB744d85F89F01A8Da6e51
BLOCKCHAIN_RPC_URL=https://sepolia.base.org
CONTRACT_CHAIN_ID=84532

# Backend Signer (Required for emergency cancellations)
BACKEND_SIGNER_PRIVATE_KEY=your_private_key_here

# Database Access (Railway PostgreSQL)
DATABASE_URL=postgresql://user:password@host:port/database

# USDC Token Address
USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
```

### 3. Test Connection
```bash
npm run test
```

## Usage

### Interactive Mode (Recommended)
```bash
npm start
```

This launches an interactive menu where you can:
- List active bookings
- Cancel individual bookings
- Cancel all bookings
- Mark bookings as complete by transaction hash
- Find bookings by transaction hash
- Generate transaction records
- Test connections

### Command Line Interface

#### List Active Bookings
```bash
npm run list
# or
node src/index.js list
```

#### Cancel a Specific Booking
```bash
# Interactive selection
npm run cancel

# Direct cancellation
node src/index.js cancel 0xabc123... -r "Emergency maintenance"
```

#### Cancel All Bookings
```bash
# Interactive with confirmations
npm run cancel-all

# Direct with reason
node src/index.js cancel-all -r "System maintenance"
```

#### Mark Booking Complete by Transaction Hash
```bash
# Interactive mode
node src/index.js complete-tx

# Direct with transaction hash
node src/index.js complete-tx 0xdaa4d555fa389a75fc7a5e066874667fbb853b7a87884e7b486cce96ff1ab48d
```

This command:
1. Verifies the transaction contains a ServiceCompleted event
2. Extracts the blockchain booking ID from the event
3. Finds the corresponding booking in the database
4. Updates the booking status to 'completed' with the transaction hash

#### Find Booking by Transaction Hash
```bash
# Interactive mode
node src/index.js find-tx

# Direct with auto-mark as paid
node src/index.js find-tx 0xabc123... --mark-paid
```

#### Generate Transaction Records
```bash
# Preview what would be created
node src/index.js generate-transactions --dry-run

# Create transaction records
node src/index.js generate-transactions
```

#### Test Connections
```bash
node src/index.js test
```

## Example Output

### Listing Active Bookings
```
📋 Active Bookings in Smart Contract:

[1] 0xabc123...def456 - 50.0 USDC - Status: Paid
  📱 Customer: 0x1234...5678
  🛠️  Provider: 0x9abc...def0
  💰 Platform Fee: 10%
  🔗 Created: 12/1/2024, 2:30:00 PM
  📋 Tx Hash: 0x789...012
  📊 Database Details:
     Service: 1-Hour Consultation
     Customer: John Doe (@johndoe)
     Provider: Jane Smith (@janesmith)
     Scheduled: 12/1/2024, 3:00:00 PM
     Duration: 60 minutes
     Location: 🌐 Online
     DB Status: confirmed

📊 Total: 1 active bookings worth 50.0 USDC
```

### Emergency Cancellation
```
🚨 Emergency cancelling booking: 0xabc123...def456
📝 Reason: Emergency maintenance
📋 Transaction submitted: 0x123...abc
⏳ Waiting for confirmation...
✅ Booking cancelled successfully!
📋 Transaction: 0x123...abc
⛽ Gas used: 85000
```

## Security Notes

### Private Key Management
- **Never commit** your `.env` file to version control
- Store the backend signer private key securely
- The backend signer should have sufficient ETH for gas fees
- Monitor all emergency cancellations for audit purposes

### Emergency Cancellation Behavior
- **100% refund** to customer (no provider payment)
- **Irreversible** once transaction is confirmed
- **Gas costs** paid by backend signer
- **Audit trail** recorded on blockchain

## Troubleshooting

### Connection Issues
```bash
# Test all connections
node src/index.js test
```

Common issues:
- **Invalid RPC URL**: Check `BLOCKCHAIN_RPC_URL`
- **Wrong contract address**: Verify `CONTRACT_ADDRESS`
- **Private key format**: Ensure private key has `0x` prefix
- **Insufficient ETH**: Backend signer needs ETH for gas fees

### Database Issues
- **DATABASE_URL**: Check PostgreSQL connection string format
- **Network access**: Ensure Railway PostgreSQL allows connections
- **SSL Mode**: May need `?sslmode=require` in connection string

### Smart Contract Issues
- **Contract not found**: Verify contract is deployed at address
- **Permission denied**: Ensure backend signer is authorized
- **Booking not found**: Booking may already be completed/cancelled

## Development

### Project Structure
```
admin-cli/
├── src/
│   ├── index.js              # Main CLI entry point
│   ├── commands.js           # Command implementations
│   ├── blockchain-service.js # Smart contract interactions
│   ├── database-service.js   # Database operations
│   └── contract-abi.json     # Smart contract ABI
├── package.json              # Dependencies and scripts
├── .env.example              # Environment template
└── README.md                 # This file
```

### Adding New Commands
1. Add command logic to `commands.js`
2. Register command in `index.js`
3. Add npm script to `package.json`
4. Update help text and README

### Testing
```bash
# Test connection
npm run test

# List bookings (read-only)
npm run list

# Test cancellation on testnet only
node src/index.js cancel 0xtest... -r "Testing"
```

## Production Usage

### Pre-deployment Checklist
- [ ] Test all commands on testnet first
- [ ] Verify backend signer permissions
- [ ] Confirm sufficient ETH balance for gas
- [ ] Set up monitoring for emergency cancellations
- [ ] Document cancellation procedures

### Monitoring
- Monitor backend signer ETH balance
- Track emergency cancellation transactions
- Log all CLI usage for audit purposes
- Set up alerts for bulk cancellations

## Support

For issues or questions:
1. Check the troubleshooting section
2. Verify environment configuration
3. Test connections with `npm run test`
4. Check smart contract status on Base Sepolia explorer

## Warning

⚠️ **This tool has the power to cancel bookings and refund customers immediately. Use with extreme caution, especially the `cancel-all` command.**

All cancellations are irreversible and result in full customer refunds. Always verify the booking details before cancelling.
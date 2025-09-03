# BookMe Payment System - Technical Implementation Plan

## Architecture Overview

### Technology Stack
- **Smart Contract**: Solidity on Base network
- **Frontend**: React/TypeScript with Viem for blockchain interactions
- **Backend**: Hono.js with enhanced payment endpoints
- **Database**: PostgreSQL (Supabase) with payment tables
- **Wallet**: Privy Smart Wallets with embedded wallet creation
- **Token**: USDC on Base (mainnet) and Base Sepolia (testnet)

### System Flow Diagram
```
Customer Booking → USDC Payment → Escrow Contract → Service Completion → Fund Release
                                      ↓
                              Database Tracking & Status Updates
                                      ↓  
                           Provider Wallet (90%) + Platform Wallet (10%)
```

## Phase 1: Smart Contract Development

### 1.1 Escrow Contract Specifications

```solidity
// BookMeEscrow.sol
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract BookMeEscrow is ReentrancyGuard, Ownable {
    IERC20 public immutable usdc;
    address public platformWallet;
    uint256 public platformFeePercent = 1000; // 10.00% (basis points)
    
    struct EscrowDeposit {
        bytes32 bookingId;
        address customer;
        address provider;
        uint256 amount;
        uint256 depositedAt;
        bool released;
        bool refunded;
    }
    
    mapping(bytes32 => EscrowDeposit) public escrows;
    mapping(address => uint256) public pendingEarnings; // Provider pending balances
    
    event FundsDeposited(bytes32 indexed bookingId, address customer, address provider, uint256 amount);
    event FundsReleased(bytes32 indexed bookingId, address provider, uint256 providerAmount, uint256 platformFee);
    event FundsRefunded(bytes32 indexed bookingId, address customer, uint256 amount);
    
    constructor(address _usdc, address _platformWallet) {
        usdc = IERC20(_usdc);
        platformWallet = _platformWallet;
    }
    
    function depositFunds(
        bytes32 bookingId,
        address provider,
        uint256 amount
    ) external nonReentrant {
        require(amount > 0, "Amount must be positive");
        require(escrows[bookingId].amount == 0, "Booking already paid");
        
        require(usdc.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        
        escrows[bookingId] = EscrowDeposit({
            bookingId: bookingId,
            customer: msg.sender,
            provider: provider,
            amount: amount,
            depositedAt: block.timestamp,
            released: false,
            refunded: false
        });
        
        emit FundsDeposited(bookingId, msg.sender, provider, amount);
    }
    
    function releaseFunds(bytes32 bookingId) external nonReentrant {
        EscrowDeposit storage deposit = escrows[bookingId];
        require(deposit.amount > 0, "Booking not found");
        require(!deposit.released && !deposit.refunded, "Already processed");
        require(
            msg.sender == owner() || msg.sender == deposit.customer || msg.sender == deposit.provider,
            "Unauthorized"
        );
        
        uint256 platformFee = (deposit.amount * platformFeePercent) / 10000;
        uint256 providerAmount = deposit.amount - platformFee;
        
        deposit.released = true;
        
        require(usdc.transfer(deposit.provider, providerAmount), "Provider transfer failed");
        require(usdc.transfer(platformWallet, platformFee), "Platform transfer failed");
        
        emit FundsReleased(bookingId, deposit.provider, providerAmount, platformFee);
    }
    
    function refundFunds(bytes32 bookingId) external nonReentrant {
        EscrowDeposit storage deposit = escrows[bookingId];
        require(deposit.amount > 0, "Booking not found");
        require(!deposit.released && !deposit.refunded, "Already processed");
        require(msg.sender == owner(), "Only admin can refund");
        
        deposit.refunded = true;
        
        require(usdc.transfer(deposit.customer, deposit.amount), "Refund transfer failed");
        
        emit FundsRefunded(bookingId, deposit.customer, deposit.amount);
    }
    
    // Admin functions
    function setPlatformFee(uint256 _platformFeePercent) external onlyOwner {
        require(_platformFeePercent <= 2000, "Fee cannot exceed 20%");
        platformFeePercent = _platformFeePercent;
    }
    
    function setPlatformWallet(address _platformWallet) external onlyOwner {
        platformWallet = _platformWallet;
    }
    
    function getEscrowStatus(bytes32 bookingId) external view returns (
        address customer,
        address provider, 
        uint256 amount,
        bool released,
        bool refunded
    ) {
        EscrowDeposit memory deposit = escrows[bookingId];
        return (deposit.customer, deposit.provider, deposit.amount, deposit.released, deposit.refunded);
    }
}
```

### 1.2 Contract Deployment Strategy

```typescript
// deploy/001_deploy_escrow.ts
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deploy = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  
  // USDC addresses
  const usdcAddresses = {
    baseSepolia: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    base: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"
  };
  
  const platformWallet = process.env.PLATFORM_WALLET_ADDRESS!;
  const usdcAddress = usdcAddresses[hre.network.name as keyof typeof usdcAddresses];
  
  await deploy("BookMeEscrow", {
    from: deployer,
    args: [usdcAddress, platformWallet],
    log: true,
    deterministicDeployment: false,
  });
};

export default deploy;
deploy.tags = ["BookMeEscrow"];
```

## Phase 2: Backend Integration

### 2.1 Enhanced Payment Service

```typescript
// backend/src/services/paymentService.ts
import { parseUnits, formatUnits } from "viem";
import { createPublicClient, createWalletClient, http } from "viem";
import { base, baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

class PaymentService {
  private escrowContract: `0x${string}`;
  private usdcContract: `0x${string}`;
  private chain = process.env.NODE_ENV === 'production' ? base : baseSepolia;
  
  constructor() {
    this.escrowContract = process.env.ESCROW_CONTRACT_ADDRESS as `0x${string}`;
    this.usdcContract = process.env.NODE_ENV === 'production' 
      ? "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"  // Base mainnet
      : "0x036CbD53842c5426634e7929541eC2318f3dCF7e"; // Base Sepolia
  }
  
  async processBookingPayment(bookingId: string, amount: string, customerAddress: string, providerAddress: string) {
    try {
      // Convert booking ID to bytes32
      const bookingIdBytes32 = this.stringToBytes32(bookingId);
      
      // Store payment record in database
      await this.createPaymentRecord({
        booking_id: bookingId,
        amount: parseFloat(amount),
        status: 'pending',
        escrow_address: this.escrowContract
      });
      
      // Return transaction data for frontend to execute
      return {
        contractAddress: this.escrowContract,
        functionName: 'depositFunds',
        args: [bookingIdBytes32, providerAddress, parseUnits(amount, 6)],
        bookingIdBytes32
      };
      
    } catch (error) {
      console.error('Payment processing failed:', error);
      throw new Error('Payment processing failed');
    }
  }
  
  async confirmPaymentTransaction(bookingId: string, transactionHash: string) {
    // Wait for transaction confirmation
    const publicClient = createPublicClient({
      chain: this.chain,
      transport: http()
    });
    
    const receipt = await publicClient.waitForTransactionReceipt({ hash: transactionHash as `0x${string}` });
    
    if (receipt.status === 'success') {
      // Update payment and booking status
      await Promise.all([
        this.updatePaymentStatus(bookingId, 'held', transactionHash),
        this.updateBookingPaymentStatus(bookingId, 'paid', transactionHash)
      ]);
      
      return { success: true, receipt };
    } else {
      await this.updatePaymentStatus(bookingId, 'failed', transactionHash);
      throw new Error('Transaction failed');
    }
  }
  
  async releaseFunds(bookingId: string, isAutomatic = false) {
    const account = privateKeyToAccount(process.env.ADMIN_PRIVATE_KEY as `0x${string}`);
    
    const walletClient = createWalletClient({
      account,
      chain: this.chain,
      transport: http()
    });
    
    const bookingIdBytes32 = this.stringToBytes32(bookingId);
    
    try {
      const hash = await walletClient.writeContract({
        address: this.escrowContract,
        abi: escrowABI,
        functionName: 'releaseFunds',
        args: [bookingIdBytes32],
      });
      
      // Update database records
      await Promise.all([
        this.updatePaymentStatus(bookingId, 'released', hash),
        this.updateBookingStatus(bookingId, 'completed'),
        this.updateUserEarnings(bookingId)
      ]);
      
      return { success: true, transactionHash: hash };
      
    } catch (error) {
      console.error('Fund release failed:', error);
      throw new Error('Fund release failed');
    }
  }
  
  // Helper methods
  private stringToBytes32(str: string): `0x${string}` {
    return `0x${Buffer.from(str.padEnd(32, '\0').slice(0, 32)).toString('hex')}`;
  }
  
  private async createPaymentRecord(payment: any) {
    // Database insertion logic
  }
  
  private async updatePaymentStatus(bookingId: string, status: string, txHash?: string) {
    // Database update logic
  }
  
  private async updateBookingPaymentStatus(bookingId: string, paymentStatus: string, txHash?: string) {
    // Database update logic
  }
  
  private async updateUserEarnings(bookingId: string) {
    // Update provider earnings and customer spending totals
  }
}
```

### 2.2 Enhanced API Endpoints

```typescript
// backend/src/routes/payments.ts
import { Hono } from 'hono';
import { PaymentService } from '../services/paymentService';

const payments = new Hono();
const paymentService = new PaymentService();

// Process booking payment
payments.post('/bookings/:id/pay', async (c) => {
  const bookingId = c.req.param('id');
  const { amount, customerAddress, providerAddress } = await c.req.json();
  
  try {
    const transactionData = await paymentService.processBookingPayment(
      bookingId, 
      amount, 
      customerAddress, 
      providerAddress
    );
    
    return c.json({ success: true, transactionData });
  } catch (error) {
    return c.json({ success: false, error: error.message }, 400);
  }
});

// Confirm payment transaction
payments.post('/bookings/:id/confirm-payment', async (c) => {
  const bookingId = c.req.param('id');
  const { transactionHash } = await c.req.json();
  
  try {
    const result = await paymentService.confirmPaymentTransaction(bookingId, transactionHash);
    return c.json({ success: true, result });
  } catch (error) {
    return c.json({ success: false, error: error.message }, 400);
  }
});

// Release funds (admin or automatic)
payments.post('/bookings/:id/release', async (c) => {
  const bookingId = c.req.param('id');
  const { isAutomatic = false } = await c.req.json();
  
  try {
    const result = await paymentService.releaseFunds(bookingId, isAutomatic);
    return c.json({ success: true, result });
  } catch (error) {
    return c.json({ success: false, error: error.message }, 400);
  }
});

// Get payment status
payments.get('/bookings/:id/payment-status', async (c) => {
  const bookingId = c.req.param('id');
  // Get payment status from database
  return c.json({ bookingId, status: 'held' }); // Example response
});

export default payments;
```

## Phase 3: Frontend Integration

### 3.1 Payment Processing Hook

```typescript
// src/hooks/usePayment.ts
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import { ApiClient } from '../lib/api-migration';

const ESCROW_ABI = [
  {
    name: 'depositFunds',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'bookingId', type: 'bytes32' },
      { name: 'provider', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: []
  }
] as const;

export const usePayment = () => {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const processBookingPayment = async (
    bookingId: string,
    amount: string,
    providerAddress: `0x${string}`,
    escrowContractAddress: `0x${string}`
  ) => {
    try {
      // Get transaction data from backend
      const response = await ApiClient.processBookingPayment(bookingId, amount, providerAddress);
      const { transactionData } = response;
      
      // Execute blockchain transaction
      writeContract({
        address: escrowContractAddress,
        abi: ESCROW_ABI,
        functionName: 'depositFunds',
        args: [
          transactionData.bookingIdBytes32,
          providerAddress,
          parseUnits(amount, 6)
        ]
      });
      
      return { success: true };
    } catch (error) {
      console.error('Payment failed:', error);
      throw error;
    }
  };

  return {
    processBookingPayment,
    isPending: isPending || isConfirming,
    isSuccess,
    transactionHash: hash
  };
};
```

### 3.2 Enhanced Booking Modal with Payment

```typescript
// src/components/BookingModal.tsx
import React, { useState, useEffect } from 'react';
import { usePayment } from '../hooks/usePayment';
import { useBalance } from 'wagmi';
import { formatUnits } from 'viem';

interface BookingModalProps {
  service: Service;
  isOpen: boolean;
  onClose: () => void;
}

export const BookingModal: React.FC<BookingModalProps> = ({ service, isOpen, onClose }) => {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [customerNotes, setCustomerNotes] = useState('');
  const [paymentStep, setPaymentStep] = useState<'booking' | 'payment' | 'confirming'>('booking');
  
  const { processBookingPayment, isPending, isSuccess, transactionHash } = usePayment();
  const { data: usdcBalance } = useBalance({
    address: user?.wallet?.address as `0x${string}`,
    token: process.env.NODE_ENV === 'production' 
      ? '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'  // Base USDC
      : '0x036CbD53842c5426634e7929541eC2318f3dCF7e'  // Base Sepolia USDC
  });

  const hasInsufficientFunds = usdcBalance 
    ? parseFloat(formatUnits(usdcBalance.value, 6)) < service.price
    : true;

  const handleBookingSubmission = async () => {
    if (!selectedDate) return;
    
    try {
      // Step 1: Create booking record
      const booking = await ApiClient.createBooking({
        service_id: service.id,
        scheduled_at: selectedDate.toISOString(),
        customer_notes: customerNotes
      });
      
      setPaymentStep('payment');
      
      // Step 2: Process payment
      await processBookingPayment(
        booking.id,
        service.price.toString(),
        service.provider.wallet_address,
        process.env.VITE_ESCROW_CONTRACT_ADDRESS as `0x${string}`
      );
      
      setPaymentStep('confirming');
      
    } catch (error) {
      console.error('Booking failed:', error);
      // Handle error state
    }
  };

  // Monitor transaction confirmation
  useEffect(() => {
    if (isSuccess && transactionHash) {
      // Confirm payment with backend
      ApiClient.confirmBookingPayment(bookingId, transactionHash)
        .then(() => {
          // Show success message and close modal
          onClose();
        })
        .catch(error => {
          console.error('Payment confirmation failed:', error);
        });
    }
  }, [isSuccess, transactionHash]);

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-6">
        <h2 className="text-2xl font-semibold mb-4">Book {service.title}</h2>
        
        {paymentStep === 'booking' && (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Select Date & Time</label>
              <DateTimePicker 
                value={selectedDate} 
                onChange={setSelectedDate}
                availableSlots={service.availability_schedule}
              />
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Notes (Optional)</label>
              <textarea
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                className="w-full p-3 border rounded-lg"
                rows={3}
              />
            </div>
            
            <div className="border-t pt-4">
              <div className="flex justify-between mb-2">
                <span>Service Price</span>
                <span>${service.price} USDC</span>
              </div>
              <div className="flex justify-between mb-2 text-sm text-gray-600">
                <span>Platform Fee (10%)</span>
                <span>${(service.price * 0.1).toFixed(2)} USDC</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span>${service.price} USDC</span>
              </div>
            </div>
            
            {hasInsufficientFunds && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800 text-sm">
                  Insufficient USDC balance. You need ${service.price} USDC but have ${usdcBalance ? formatUnits(usdcBalance.value, 6) : '0'} USDC.
                </p>
                <button className="mt-2 text-blue-600 underline text-sm">
                  Add funds to your wallet
                </button>
              </div>
            )}
            
            <button
              onClick={handleBookingSubmission}
              disabled={!selectedDate || hasInsufficientFunds}
              className="w-full mt-4 bg-blue-600 text-white py-3 px-4 rounded-lg disabled:opacity-50"
            >
              {hasInsufficientFunds ? 'Insufficient Funds' : 'Book & Pay'}
            </button>
          </>
        )}
        
        {paymentStep === 'payment' && (
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <h3 className="text-lg font-medium mb-2">Processing Payment</h3>
            <p className="text-gray-600">Please confirm the transaction in your wallet</p>
          </div>
        )}
        
        {paymentStep === 'confirming' && (
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <h3 className="text-lg font-medium mb-2">Confirming Transaction</h3>
            <p className="text-gray-600">Waiting for blockchain confirmation...</p>
            {transactionHash && (
              <a 
                href={`https://basescan.org/tx/${transactionHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline text-sm mt-2 block"
              >
                View Transaction
              </a>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
```

## Phase 4: Automated Service Completion

### 4.1 Background Job Service

```typescript
// backend/src/services/completionService.ts
import cron from 'node-cron';
import { PaymentService } from './paymentService';

class CompletionService {
  private paymentService: PaymentService;
  
  constructor() {
    this.paymentService = new PaymentService();
    this.startAutoCompletion();
  }
  
  startAutoCompletion() {
    // Run every 10 minutes
    cron.schedule('*/10 * * * *', async () => {
      try {
        await this.processAutoCompletions();
      } catch (error) {
        console.error('Auto-completion job failed:', error);
      }
    });
  }
  
  private async processAutoCompletions() {
    // Find bookings eligible for auto-completion
    const eligibleBookings = await this.getEligibleBookings();
    
    console.log(`Found ${eligibleBookings.length} bookings eligible for auto-completion`);
    
    for (const booking of eligibleBookings) {
      try {
        console.log(`Auto-completing booking ${booking.id}`);
        
        await this.paymentService.releaseFunds(booking.id, true);
        
        // Send notifications
        await this.sendCompletionNotifications(booking);
        
        console.log(`Successfully auto-completed booking ${booking.id}`);
        
      } catch (error) {
        console.error(`Failed to auto-complete booking ${booking.id}:`, error);
        
        // Mark for manual review
        await this.flagForManualReview(booking.id, error.message);
      }
    }
  }
  
  private async getEligibleBookings() {
    // SQL query to find bookings that should be auto-completed
    const query = `
      SELECT b.* FROM bookings b
      JOIN payments p ON b.id = p.booking_id
      WHERE b.status = 'confirmed'
        AND p.payment_status = 'held' 
        AND NOW() > (b.scheduled_at + INTERVAL '1 hour' * (b.duration_minutes / 60) + INTERVAL '24 hours')
        AND b.auto_complete_at IS NULL
    `;
    
    // Execute query and return results
    return await this.executeQuery(query);
  }
  
  private async sendCompletionNotifications(booking: any) {
    // Send email/in-app notifications to customer and provider
    // Implementation depends on notification system
  }
  
  private async flagForManualReview(bookingId: string, reason: string) {
    // Flag booking for admin review
    const query = `
      UPDATE bookings 
      SET needs_manual_review = true, manual_review_reason = $1 
      WHERE id = $2
    `;
    
    await this.executeQuery(query, [reason, bookingId]);
  }
}

export default CompletionService;
```

## Phase 5: Database Migrations

### 5.1 Payment Tables Migration

```sql
-- Migration: 001_create_payment_tables.sql

-- Enhanced payments table
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID UNIQUE NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  amount NUMERIC(18,6) NOT NULL CHECK (amount > 0),
  service_fee NUMERIC(18,6) NOT NULL DEFAULT 0 CHECK (service_fee >= 0),
  status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending','held','released','refunded','failed')),
  escrow_transaction_hash TEXT,
  release_transaction_hash TEXT,
  refund_transaction_hash TEXT,
  escrow_address TEXT NOT NULL,
  held_at TIMESTAMP,
  released_at TIMESTAMP,
  refunded_at TIMESTAMP,
  failure_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Platform earnings tracking
CREATE TABLE platform_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  amount NUMERIC(18,6) NOT NULL CHECK (amount > 0),
  transaction_hash TEXT NOT NULL,
  earned_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add payment-related fields to bookings
ALTER TABLE bookings ADD COLUMN payment_status TEXT DEFAULT 'unpaid' 
  CHECK (payment_status IN ('unpaid','paid','held','released','refunded'));
ALTER TABLE bookings ADD COLUMN escrow_deposit_hash TEXT;
ALTER TABLE bookings ADD COLUMN auto_complete_at TIMESTAMP;
ALTER TABLE bookings ADD COLUMN needs_manual_review BOOLEAN DEFAULT FALSE;
ALTER TABLE bookings ADD COLUMN manual_review_reason TEXT;

-- Indexes for performance
CREATE INDEX idx_payments_booking_id ON payments(booking_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_bookings_payment_status ON bookings(payment_status);
CREATE INDEX idx_bookings_auto_complete ON bookings(auto_complete_at) WHERE auto_complete_at IS NOT NULL;
CREATE INDEX idx_platform_earnings_booking_id ON platform_earnings(booking_id);

-- Update user earnings when payments are released
CREATE OR REPLACE FUNCTION update_user_earnings()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'released' AND OLD.status != 'released' THEN
    -- Update provider earnings
    UPDATE users 
    SET total_earnings = total_earnings + (NEW.amount - NEW.service_fee)
    WHERE id = (SELECT provider_id FROM bookings WHERE id = NEW.booking_id);
    
    -- Update customer spending
    UPDATE users 
    SET total_spent = total_spent + NEW.amount
    WHERE id = (SELECT customer_id FROM bookings WHERE id = NEW.booking_id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_earnings
  AFTER UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_user_earnings();
```

## Phase 6: Environment Configuration

### 6.1 Environment Variables

```bash
# .env.local additions

# Smart Contract Addresses
VITE_ESCROW_CONTRACT_ADDRESS=0x... # Deployed escrow contract
ESCROW_CONTRACT_ADDRESS=0x... # Backend needs non-prefixed version

# Platform Wallet
PLATFORM_WALLET_ADDRESS=0x... # Platform fee collection wallet
ADMIN_PRIVATE_KEY=0x... # For automated fund releases (keep secure!)

# Blockchain Configuration
VITE_BASE_MAINNET_RPC=https://mainnet.base.org
VITE_BASE_SEPOLIA_RPC=https://sepolia.base.org

# Development
NODE_ENV=development # or production
```

### 6.2 Contract Deployment Configuration

```typescript
// hardhat.config.ts
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    baseSepolia: {
      url: "https://sepolia.base.org",
      accounts: [process.env.DEPLOYER_PRIVATE_KEY!],
      chainId: 84532,
    },
    base: {
      url: "https://mainnet.base.org",
      accounts: [process.env.DEPLOYER_PRIVATE_KEY!],
      chainId: 8453,
    },
  },
  etherscan: {
    apiKey: {
      base: process.env.BASESCAN_API_KEY!,
      baseSepolia: process.env.BASESCAN_API_KEY!,
    },
  },
};

export default config;
```

## Implementation Timeline

### Week 1-2: Smart Contract Development
- [ ] Create escrow contract with comprehensive testing
- [ ] Deploy to Base Sepolia testnet  
- [ ] Verify contract functionality with test transactions
- [ ] Security audit preparation

### Week 3-4: Backend Integration  
- [ ] Implement PaymentService class
- [ ] Create new payment API endpoints
- [ ] Database migration and schema updates
- [ ] Integration testing with testnet

### Week 5-6: Frontend Integration
- [ ] Build payment processing hooks
- [ ] Update booking flow with payment steps
- [ ] Balance validation and funding UI
- [ ] Transaction status tracking

### Week 7-8: Automation & Admin Tools
- [ ] Implement auto-completion service
- [ ] Build admin dashboard for payment management
- [ ] Refund processing system
- [ ] Error handling and monitoring

### Week 9-10: Production Deployment
- [ ] Smart contract security audit
- [ ] Mainnet deployment on Base
- [ ] End-to-end testing
- [ ] Performance optimization

This comprehensive technical plan provides the complete architecture for implementing a secure, automated payment and escrow system for BookMe using blockchain technology and Privy's smart wallet infrastructure.
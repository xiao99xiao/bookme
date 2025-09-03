# BookMe Payment & Escrow System Requirements

## Executive Summary

BookMe requires a complete blockchain-based payment and escrow system that securely handles USDC transactions between customers and service providers, with automatic platform fee collection and funds held in escrow until service completion.

## Current State Analysis

### Existing Infrastructure ✅
- **Smart Wallet Integration**: Privy-powered smart wallets with automatic creation
- **USDC Integration**: Base/Base Sepolia networks configured with contract addresses
- **Service Pricing**: Fixed pricing per service with 10% platform fee calculation  
- **Booking Lifecycle**: Complete booking management system (pending → confirmed → completed)
- **User Authentication**: Privy DID system with UUID mapping for database operations
- **Database Schema**: Payment-ready tables with escrow status tracking
- **Balance Management**: Real-time USDC/ETH balance display with credit card funding

### Missing Components ❌
- **Payment Processing**: No actual USDC transfer during booking creation
- **Escrow Smart Contract**: No funds holding mechanism
- **Automated Release**: No automatic payment release after completion
- **Fee Collection**: No platform fee transfer to dedicated wallet
- **Refund System**: No automated refund processing

## Detailed Requirements

### 1. Payment Flow Architecture

#### Customer Booking Payment Process
1. **Customer initiates booking** for a service priced at X USDC
2. **System validates** customer has sufficient USDC balance (X + gas fees)
3. **Customer pays** X USDC which is **transferred to escrow smart contract**
4. **Booking status** changes to "confirmed" and is recorded in database
5. **Funds remain locked** in escrow contract until service completion

#### Service Completion & Fund Release
1. **Service completion** is marked automatically after `scheduled_at + duration_minutes + buffer_time`
2. **Escrow contract releases funds**:
   - **Provider receives**: X USDC × 0.9 (90% after 10% platform fee)
   - **Platform receives**: X USDC × 0.1 (10% platform fee) → dedicated fee wallet
3. **Database updates**:
   - `bookings.status` → "completed"
   - `users.total_earnings` (provider) += X × 0.9
   - `users.total_spent` (customer) += X

#### Cancellation & Refund Process
1. **Before service time**: Full refund (X USDC) returned to customer
2. **After service time**: No refund (funds released to provider as normal)
3. **Dispute cases**: Manual admin intervention required

### 2. Smart Contract Requirements

#### Escrow Smart Contract Specifications
```solidity
// Core Functions Required:
- depositFunds(bookingId, amount, customer, provider)
- releaseFunds(bookingId) -> splits payment (90%/10%)
- refundFunds(bookingId) -> returns full amount to customer
- emergencyWithdraw(bookingId) -> admin-only function

// State Management:
- Track booking ID → escrow details mapping
- Record deposit timestamps and amounts
- Lock funds until explicit release/refund
- Emit events for all state changes
```

#### Platform Fee Collection
- **Dedicated fee wallet address** for platform earnings
- **Automatic 10% deduction** during fund release
- **Transparent fee calculation** visible to all parties
- **Admin-configurable fee percentage** for future adjustments

#### Security Features
- **Time-based automatic release** (e.g., 7 days after scheduled service completion)
- **Emergency pause functionality** for contract upgrades
- **Multi-signature admin controls** for sensitive operations
- **Reentrancy protection** on all fund movements

### 3. Database Schema Updates

#### Enhanced Payments Table
```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID UNIQUE NOT NULL REFERENCES bookings(id),
  amount NUMERIC(18,6) NOT NULL, -- Support USDC's 6 decimals
  service_fee NUMERIC(18,6) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending','held','released','refunded','failed')),
  escrow_transaction_hash TEXT, -- On-chain escrow deposit transaction
  release_transaction_hash TEXT, -- On-chain release transaction  
  refund_transaction_hash TEXT, -- On-chain refund transaction
  escrow_address TEXT NOT NULL, -- Smart contract address holding funds
  held_at TIMESTAMP,
  released_at TIMESTAMP,
  refunded_at TIMESTAMP,
  failure_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Enhanced Bookings Table
```sql
-- Add payment-related fields to existing bookings table:
ALTER TABLE bookings ADD COLUMN payment_status TEXT DEFAULT 'unpaid' 
  CHECK (payment_status IN ('unpaid','paid','held','released','refunded'));
ALTER TABLE bookings ADD COLUMN escrow_deposit_hash TEXT;
ALTER TABLE bookings ADD COLUMN auto_complete_at TIMESTAMP; -- For automatic completion
```

#### Platform Financial Tracking
```sql
CREATE TABLE platform_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id),
  amount NUMERIC(18,6) NOT NULL,
  transaction_hash TEXT NOT NULL,
  earned_at TIMESTAMP DEFAULT NOW()
);
```

### 4. Technical Implementation Components

#### Frontend Integration Points
1. **Booking Creation Flow**:
   - Balance validation before payment
   - USDC approval transaction (if needed)
   - Escrow deposit transaction
   - Transaction confirmation UI

2. **Payment Status Tracking**:
   - Real-time transaction status updates
   - Payment confirmation notifications
   - Balance updates after transactions

3. **Provider Earnings Dashboard**:
   - Pending escrow amounts display
   - Released earnings history
   - Withdrawal functionality to personal wallet

#### Backend API Extensions
```javascript
// New Payment Endpoints:
POST /api/bookings/:id/pay - Process booking payment
GET /api/payments/user/:userId - Get user payment history
POST /api/payments/:id/refund - Process refund (admin)
GET /api/escrow/status/:bookingId - Check escrow status
POST /api/admin/complete-booking/:id - Manual completion (admin)

// Enhanced Booking Endpoints:
POST /api/bookings - Now includes payment processing
GET /api/bookings/user/:userId - Includes payment status
```

#### Smart Contract Integration Service
```javascript
class EscrowService {
  async depositFunds(bookingId, amount, customerAddress, providerAddress)
  async checkEscrowStatus(bookingId)  
  async releaseFunds(bookingId, isAutomatic = false)
  async refundFunds(bookingId)
  async getContractBalance()
  async estimateGasFees(operation)
}
```

### 5. Automated Service Completion

#### Auto-Completion Logic
```javascript
// Scheduled job runs every 10 minutes:
1. Find bookings where: 
   - status = 'confirmed' 
   - payment_status = 'held'
   - NOW() > scheduled_at + duration_minutes + 24 hours buffer

2. For each eligible booking:
   - Call escrow.releaseFunds(bookingId)
   - Update booking status to 'completed'
   - Update payment status to 'released'
   - Update user earnings/spending totals
   - Send completion notifications
```

#### Buffer Time Considerations
- **24-hour grace period** after scheduled end time
- **Allows for service delays** and customer satisfaction verification
- **Prevents premature fund release** for disputed services

### 6. Error Handling & Edge Cases

#### Transaction Failures
- **Insufficient funds**: Clear error message with funding options
- **Network congestion**: Automatic retry with higher gas fees
- **Contract failures**: Fallback to manual admin intervention
- **Partial failures**: Transaction rollback and user notification

#### Dispute Resolution
- **Customer complaints**: Freeze fund release, manual admin review
- **Provider non-delivery**: Immediate refund processing capability
- **Service quality issues**: Partial refund mechanisms

#### System Maintenance
- **Contract upgrades**: Migration strategy for funds in escrow
- **Emergency stops**: Pause new deposits while allowing existing releases
- **Data consistency**: Blockchain events ↔ database synchronization

### 7. Monitoring & Analytics

#### Financial Metrics Tracking
- **Total platform revenue** (10% fees collected)
- **Average transaction volume** per day/week/month
- **Escrow balance monitoring** (funds currently held)
- **Transaction success rates** and failure analysis
- **Gas cost optimization** metrics

#### Business Intelligence
- **Most profitable service categories**
- **Provider earning distributions**
- **Customer spending patterns**  
- **Transaction volume trends**

## Security Considerations

### Smart Contract Security
- **Professional audit required** before mainnet deployment
- **Testnet validation** on Base Sepolia with real transaction flows
- **Time-locked admin functions** for critical changes
- **Maximum escrow limits** to reduce blast radius

### User Protection
- **Clear payment confirmations** before transactions
- **Transaction timeout handling** for failed payments
- **Balance validation** at multiple checkpoints
- **Secure key management** via Privy's infrastructure

### Platform Protection
- **Rate limiting** on payment operations
- **Minimum/maximum transaction amounts** 
- **Automated anomaly detection** for unusual patterns
- **Hot/cold wallet strategy** for platform earnings

## Success Metrics

### Technical KPIs
- **Payment success rate**: >99% of initiated payments complete successfully
- **Average transaction confirmation time**: <2 minutes
- **Gas cost optimization**: <$0.50 average per transaction
- **System uptime**: 99.9% availability

### Business KPIs
- **Platform revenue growth**: Track 10% fee collection over time
- **User adoption**: Percentage of bookings that include payment
- **Provider satisfaction**: Reduced payment delays and disputes
- **Customer confidence**: Repeat booking rates with payments

## Implementation Phases

### Phase 1: Infrastructure (Week 1-2)
- Deploy escrow smart contract to Base Sepolia
- Update database schema with payment tables
- Create basic payment service integration

### Phase 2: Core Payment Flow (Week 3-4)  
- Implement booking payment process
- Build escrow deposit/release functionality
- Add payment status tracking UI

### Phase 3: Automation (Week 5-6)
- Build automated service completion system
- Implement platform fee collection
- Add comprehensive error handling

### Phase 4: Advanced Features (Week 7-8)
- Refund processing system
- Admin tools for dispute resolution
- Analytics dashboard and monitoring

### Phase 5: Production Deployment (Week 9-10)
- Smart contract security audit
- Mainnet deployment on Base
- Full system testing and optimization

This comprehensive payment and escrow system will transform BookMe from a scheduling platform into a complete service marketplace with secure, automated financial transactions.
# 📋 Smart Contract Integration PRD
## BookMe Platform - Blockchain Payment Flow Integration

---

## 🎯 Executive Summary

This PRD outlines the integration of BookingEscrow smart contract (deployed on Base Sepolia) with BookMe's existing booking system. The integration enables secure, trustless USDC payments between customers and providers with automated escrow functionality.

**Contract Address:** `0x33ddEd6F8183aa4dAB04E2aE216a5a3f9871405a`  
**Network:** Base Sepolia (Chain ID: 84532)  
**Payment Token:** USDC (`0x036CbD53842c5426634e7929541eC2318f3dCF7e`)

---

## 📊 Current State Analysis

### Existing System
- **Database:** PostgreSQL with booking records, user profiles, service management
- **Auth:** Privy (primary) + Supabase profiles (secondary)  
- **Frontend:** React with smart wallet integration via Privy
- **Backend:** Hono server with Privy token validation
- **Payment:** Currently no payment processing

### Smart Contract Capabilities
- **Escrow System:** Secure USDC holding during booking lifecycle
- **Multi-Role Access:** Customer, Provider, Backend, Platform, Inviter
- **Fee Distribution:** Automated platform (10% or 5% with inviter) and inviter (5%) fees
- **Authorization:** EIP-712 signatures for secure booking creation
- **Emergency Controls:** Backend emergency cancellation capabilities

---

## 🎯 Integration Objectives

### Primary Goals
1. **Seamless Payment Flow:** Integrate blockchain payments without disrupting UX
2. **State Synchronization:** Keep database and blockchain states synchronized
3. **Security First:** Maintain high security standards with proper authorization
4. **Reliable Event Processing:** Ensure all blockchain events are properly handled
5. **Error Recovery:** Robust handling of failed transactions and edge cases

### Success Metrics
- **Transaction Success Rate:** >99% successful payment processing
- **State Sync Accuracy:** 100% database-blockchain state consistency
- **User Experience:** <30 second transaction confirmation times
- **Error Recovery:** <1% orphaned transactions requiring manual intervention

---

## 🔄 Detailed User Flow Specifications

### 1. Booking Creation & Payment Flow

#### 1.1 Initial Booking Creation (Off-Chain)
**Trigger:** Customer selects service and time slot  
**Actor:** Customer  
**System:** Frontend → Backend → Database

**Steps:**
1. Customer selects service, date/time, and optional inviter
2. Frontend validates service availability and pricing
3. Frontend calls backend API: `POST /api/bookings/create`
4. Backend validates customer, provider, service availability
5. Backend creates booking record with status: `PENDING_PAYMENT`
6. Backend generates unique `bookingId` (UUID → bytes32 hash)
7. Backend returns booking details to frontend

**Database State:**
```sql
INSERT INTO bookings (
    id, customer_id, provider_id, service_id,
    amount, scheduled_at, status, blockchain_booking_id
) VALUES (
    'uuid', 'customer_uuid', 'provider_uuid', 'service_uuid',
    100.00, '2024-09-08 14:00:00', 'PENDING_PAYMENT', 'bytes32_hash'
)
```

#### 1.2 Payment Authorization Generation (Backend)
**Trigger:** Frontend requests payment authorization  
**Actor:** Backend System  
**System:** Backend → Smart Contract Authorization

**Steps:**
1. Frontend calls: `POST /api/bookings/:id/authorize-payment`
2. Backend validates booking exists and is in `PENDING_PAYMENT` state
3. Backend calculates fees (platform: 10% if no inviter, 5% if inviter present; inviter: 5% if present)
4. Backend generates EIP-712 signature with booking authorization struct:
   ```javascript
   BookingAuthorization {
     bookingId: bytes32(hash(booking.id)),
     customer: address(customer.wallet_address),
     provider: address(provider.wallet_address), 
     inviter: address(inviter?.wallet_address || ZeroAddress),
     amount: uint256(booking.amount * 1e6), // USDC decimals
     platformFeeRate: uint256(inviter ? 500 : 1000), // 5% if inviter, 10% if no inviter
     inviterFeeRate: uint256(inviter ? 500 : 0), // 5% if inviter
     expiry: uint256(Date.now() + 300000), // 5 minutes
     nonce: uint256(incrementingNonce)
   }
   ```
5. Backend signs authorization with backend signer private key
6. Backend returns signed authorization to frontend

**Response:**
```json
{
  "authorization": {
    "bookingId": "0x...",
    "customer": "0x...",
    "provider": "0x...",
    "inviter": "0x...",
    "amount": "100000000",
    "platformFeeRate": 500,
    "inviterFeeRate": 500,
    "expiry": 1725789900,
    "nonce": 12345
  },
  "signature": "0x...",
  "contractAddress": "0x33ddEd6F8183aa4dAB04E2aE216a5a3f9871405a",
  "estimatedGas": "261265"
}
```

#### 1.3 On-Chain Payment Execution (Frontend)
**Trigger:** Customer confirms payment  
**Actor:** Customer  
**System:** Frontend → Smart Contract

**Steps:**
1. Frontend displays payment confirmation modal with:
   - Service details and amount
   - Gas fee estimation
   - USDC approval requirement (if needed)
2. Customer reviews and confirms transaction
3. Frontend checks USDC allowance: `usdc.allowance(customer, contractAddress)`
4. If insufficient allowance, frontend prompts USDC approval first:
   ```javascript
   await usdc.approve(contractAddress, amount)
   ```
5. Frontend calls smart contract: `createAndPayBooking(authorization, signature)`
6. Transaction is submitted to blockchain with proper gas estimation
7. Frontend shows transaction pending state with tx hash
8. Frontend polls for transaction confirmation

**Smart Contract State:**
```solidity
bookings[bookingId] = Booking({
    id: bookingId,
    customer: customerAddress,
    provider: providerAddress,
    inviter: inviterAddress,
    amount: 100 * 1e6, // 100 USDC
    platformFeeRate: 500,
    inviterFeeRate: 500,
    status: BookingStatus.PAID,
    createdAt: block.timestamp
});
```

#### 1.4 Payment Confirmation & State Sync
**Trigger:** Smart contract emits `BookingCreatedAndPaid` event  
**Actor:** Backend Event Listener  
**System:** Backend → Database

**Event Monitoring:**
```javascript
contract.on("BookingCreatedAndPaid", async (
  bookingId, customer, provider, inviter, amount, platformFeeRate, inviterFeeRate
) => {
  await handleBookingPaid(bookingId, {
    customer, provider, inviter, amount, platformFeeRate, inviterFeeRate
  });
});
```

**Steps:**
1. Backend event listener detects `BookingCreatedAndPaid` event
2. Backend maps `bytes32 bookingId` to database booking record
3. If booking found: Update status to `PAID` and store blockchain data
4. If booking NOT found: Log error and execute emergency cancellation
5. Backend sends real-time notification to customer and provider
6. Frontend updates UI to show "Booking Confirmed" state

**Database Update:**
```sql
UPDATE bookings SET 
    status = 'PAID',
    blockchain_tx_hash = '0x...',
    blockchain_confirmed_at = NOW(),
    blockchain_data = '{
        "customer": "0x...",
        "provider": "0x...",
        "amount": "100000000",
        "platformFeeRate": 500,
        "inviterFeeRate": 500
    }'
WHERE blockchain_booking_id = '0x...';
```

### 2. Service Completion & Payment Distribution

#### 2.1 Service Completion Request
**Trigger:** Customer marks service as completed  
**Actor:** Customer  
**System:** Frontend → Backend → Database

**Steps:**
1. Customer clicks "Mark as Complete" after service delivery
2. Frontend calls: `POST /api/bookings/:id/request-completion`
3. Backend validates booking is in `PAID` status
4. Backend updates booking status to `PENDING_COMPLETION`
5. Backend generates completion authorization (no signature needed for completeService)
6. Frontend prompts customer to confirm on-chain completion

#### 2.2 On-Chain Service Completion
**Trigger:** Customer confirms completion transaction  
**Actor:** Customer  
**System:** Frontend → Smart Contract

**Steps:**
1. Frontend shows completion confirmation with gas estimation
2. Customer confirms transaction
3. Frontend calls smart contract: `completeService(bookingId)`
4. Transaction distributes USDC automatically:
   - Provider receives: 90 USDC (90%)
   - Platform receives: 10 USDC (10%)
   - Inviter receives: 0 USDC (0% in this example)
5. Smart contract emits `ServiceCompleted` event

#### 2.3 Completion Confirmation & Final State
**Trigger:** Smart contract emits `ServiceCompleted` event  
**Actor:** Backend Event Listener  

**Steps:**
1. Backend detects `ServiceCompleted` event
2. Backend updates booking status to `COMPLETED`
3. Backend updates user earnings and statistics
4. Backend triggers review system activation
5. Backend sends completion notifications

**Database Update:**
```sql
UPDATE bookings SET 
    status = 'COMPLETED',
    completed_at = NOW(),
    completion_tx_hash = '0x...'
WHERE blockchain_booking_id = '0x...';

UPDATE users SET 
    total_earnings = total_earnings + 90.00,
    completed_services = completed_services + 1
WHERE id = (SELECT provider_id FROM bookings WHERE blockchain_booking_id = '0x...');
```

### 3. Cancellation Flows

#### 3.1 Customer-Initiated Cancellation
**Trigger:** Customer requests cancellation  
**Actor:** Customer  
**System:** Multi-step authorization flow

**Steps:**
1. Customer clicks "Cancel Booking"
2. Frontend calls: `POST /api/bookings/:id/request-cancellation`
3. Backend generates `CancellationAuthorization` with fee distribution:
   ```javascript
   CancellationAuthorization {
     bookingId: bytes32,
     customerAmount: uint256(80 * 1e6), // 80% refund
     providerAmount: uint256(0),
     platformAmount: uint256(15 * 1e6), // 15% cancellation fee
     inviterAmount: uint256(5 * 1e6), // 5% inviter fee
     reason: "Customer requested cancellation",
     expiry: uint256(Date.now() + 300000),
     nonce: uint256(incrementingNonce)
   }
   ```
4. Backend signs authorization and returns to frontend
5. Customer confirms cancellation transaction
6. Frontend calls: `cancelBookingAsCustomer(bookingId, auth, signature)`

#### 3.2 Provider-Initiated Cancellation
**Similar flow but with different fee distribution favoring customer**

#### 3.3 Emergency Cancellation (Backend Only)
**Trigger:** Orphaned blockchain event or system emergency  
**Actor:** Backend System  
**System:** Backend → Smart Contract

**Steps:**
1. Backend detects orphaned booking (blockchain event without database record)
2. Backend calls: `emergencyCancelBooking(bookingId, "System emergency")`
3. All funds returned to customer minus platform fee
4. Backend logs incident for investigation

---

## 🔧 Technical Requirements

### Backend Requirements

#### Event Monitoring System
- **Real-time Event Listening:** WebSocket connection to Base Sepolia RPC
- **Event Processing Queue:** Redis-based queue for reliable event processing
- **Duplicate Detection:** Prevent processing same event multiple times
- **Error Handling:** Retry logic with exponential backoff
- **Dead Letter Queue:** Handle events that fail processing repeatedly

#### Database Schema Extensions
```sql
-- Add blockchain-related fields to existing bookings table
ALTER TABLE bookings ADD COLUMN blockchain_booking_id VARCHAR(66); -- bytes32 hash
ALTER TABLE bookings ADD COLUMN blockchain_tx_hash VARCHAR(66);
ALTER TABLE bookings ADD COLUMN blockchain_confirmed_at TIMESTAMP;
ALTER TABLE bookings ADD COLUMN completion_tx_hash VARCHAR(66);
ALTER TABLE bookings ADD COLUMN cancellation_tx_hash VARCHAR(66);
ALTER TABLE bookings ADD COLUMN blockchain_data JSONB;

-- Create event processing tracking table
CREATE TABLE blockchain_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL,
    transaction_hash VARCHAR(66) NOT NULL,
    block_number BIGINT NOT NULL,
    booking_id VARCHAR(66),
    event_data JSONB NOT NULL,
    processed_at TIMESTAMP DEFAULT NOW(),
    processing_status VARCHAR(20) DEFAULT 'PROCESSED',
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(transaction_hash, event_type)
);

-- Create nonce tracking table for signature replay protection
CREATE TABLE signature_nonces (
    id SERIAL PRIMARY KEY,
    nonce BIGINT UNIQUE NOT NULL,
    used_at TIMESTAMP DEFAULT NOW(),
    booking_id UUID,
    signature_type VARCHAR(50)
);
```

#### API Endpoints Extensions
```typescript
// New endpoints for blockchain integration
POST /api/bookings/:id/authorize-payment
POST /api/bookings/:id/request-completion  
POST /api/bookings/:id/request-cancellation
GET /api/bookings/:id/blockchain-status
POST /api/webhooks/blockchain-events

// Enhanced existing endpoints
GET /api/bookings (include blockchain status)
GET /api/users/:id/earnings (blockchain-verified earnings)
```

### Frontend Requirements

#### Smart Contract Integration
- **Contract Instance:** Initialize BookingEscrow contract with ethers.js
- **Transaction Management:** Proper gas estimation and error handling
- **Loading States:** Clear feedback during blockchain interactions
- **Error Recovery:** User-friendly error messages and retry options

#### UI/UX Enhancements
```typescript
// New components needed
<PaymentConfirmationModal />
<BlockchainTransactionStatus />
<GasEstimationDisplay />
<USDCApprovalFlow />
<CompletionConfirmationModal />
<CancellationModal />
```

#### Privy Smart Wallet Integration
- **USDC Balance Checks:** Display user USDC balance
- **Approval Management:** Handle USDC spending approvals
- **Transaction Signing:** Use Privy's smart wallet for contract interactions
- **Network Management:** Ensure users are on Base Sepolia

---

## 🚨 Risk Mitigation & Edge Cases

### Technical Risks

#### Blockchain Event Processing Failures
**Risk:** Events missed or processed incorrectly  
**Mitigation:**
- Implement event polling fallback mechanism
- Store last processed block number for recovery
- Manual reconciliation tools for admins
- Monitoring alerts for processing delays

#### Transaction Failures
**Risk:** User pays gas but transaction reverts  
**Mitigation:**
- Comprehensive input validation before transaction
- Gas estimation with safety margin
- Clear error messages for common revert reasons
- Transaction retry mechanisms where appropriate

#### Database-Blockchain Desync
**Risk:** Database and blockchain states become inconsistent  
**Mitigation:**
- Atomic database operations with blockchain events
- Regular reconciliation jobs
- Admin tools for manual state correction
- Comprehensive logging and monitoring

### Business Risks

#### Customer Fund Loss
**Risk:** USDC locked due to system failures  
**Mitigation:**
- Emergency cancellation capabilities
- Smart contract pause functionality
- 24/7 monitoring and incident response
- Insurance considerations for platform

#### Regulatory Compliance
**Risk:** Regulatory issues with USDC handling  
**Mitigation:**
- Legal review of payment flow
- KYC/AML compliance where required
- Terms of service updates
- Jurisdiction-specific considerations

---

## 📊 Success Criteria & KPIs

### Technical KPIs
- **Event Processing Success Rate:** >99.9%
- **Transaction Success Rate:** >99%
- **Average Transaction Confirmation Time:** <30 seconds
- **Database-Blockchain Sync Accuracy:** 100%
- **System Uptime:** 99.9%

### Business KPIs
- **Payment Flow Completion Rate:** >95%
- **Customer Support Tickets (Blockchain):** <5% of total bookings
- **Average Resolution Time for Blockchain Issues:** <2 hours
- **User Satisfaction with Payment Process:** >4.5/5

### User Experience KPIs
- **Time from Booking to Payment Confirmation:** <2 minutes
- **User Drop-off Rate at Payment Step:** <10%
- **Repeat Usage Rate:** >80%

---

## 🗓️ Implementation Timeline

### Phase 1: Foundation (Weeks 1-2)
- Backend blockchain event monitoring system
- Database schema extensions
- Basic smart contract integration
- Development environment setup

### Phase 2: Core Integration (Weeks 3-4)
- Booking creation and payment flow
- Frontend transaction handling
- Basic error handling and recovery
- Internal testing and validation

### Phase 3: Advanced Features (Weeks 5-6)
- Service completion flow
- Cancellation mechanisms
- Comprehensive error handling
- User experience optimization

### Phase 4: Production Readiness (Weeks 7-8)
- Security auditing and testing
- Performance optimization
- Monitoring and alerting setup
- Production deployment preparation

---

## 🔍 Acceptance Criteria

### Functional Requirements
✅ **Booking Creation:** Customer can create booking and pay with USDC  
✅ **Payment Confirmation:** System accurately tracks payment status  
✅ **Service Completion:** Customer can complete service and trigger payment distribution  
✅ **Cancellation:** Both parties can cancel with appropriate fee distribution  
✅ **Emergency Controls:** Backend can handle system emergencies  

### Non-Functional Requirements
✅ **Performance:** All blockchain operations complete within SLA timeframes  
✅ **Reliability:** System handles blockchain network issues gracefully  
✅ **Security:** All transactions require proper authorization  
✅ **Usability:** Users understand and can successfully complete payment flows  
✅ **Monitoring:** System provides visibility into all blockchain operations  

---

## 📝 Dependencies & Assumptions

### External Dependencies
- **Base Sepolia Network:** Reliable RPC access and network stability
- **USDC Token:** Sufficient liquidity and token availability
- **Privy Service:** Continued smart wallet functionality
- **Etherscan API:** Contract verification and monitoring capabilities

### Assumptions
- Users have basic understanding of blockchain interactions
- USDC will remain the primary payment token
- Base Sepolia provides adequate performance for testing
- Smart contract audit findings have been addressed
- Legal approval for USDC payment processing

---

**Document Version:** 1.0  
**Last Updated:** September 7, 2025  
**Next Review:** September 14, 2025  

*This PRD serves as the foundation for technical implementation planning and stakeholder alignment.*
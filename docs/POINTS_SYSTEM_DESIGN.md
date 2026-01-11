# Nook Points System - Technical Design Document

## Version History
| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-11 | Claude | Initial design |

---

## 1. Executive Summary

### 1.1 Problem Statement
Users funding their wallets via credit card are charged 1-2% processing fees by payment providers (Privy/MoonPay). This creates a poor user experience:
- User wants to buy a $20 service
- Credit card charges ~$20.20-$20.40
- User receives only $19.80 USDC
- User cannot afford the $20 service they intended to buy

### 1.2 Solution Overview
Introduce a **Points System** that compensates users for credit card fees:
- When user funds $20 via credit card, they receive $19.80 USDC + 20 points ($0.20 value)
- Points can be used to pay the difference when booking services
- Provider still receives their full share (90% of original price)
- Platform absorbs the points cost from their 10% fee

### 1.3 Key Principles
1. **Provider earnings are never affected** - Always receives 90% of the original service price
2. **Points are platform-subsidized** - Cost absorbed by platform fee
3. **Transparent to blockchain** - Contract modified to understand original vs paid amounts
4. **No gaming** - Points only earned from funding, only spent on services

---

## 2. System Architecture

### 2.1 High-Level Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        FUNDING FLOW                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  User: "I want to add $20"                                       │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────┐      ┌──────────────────┐                  │
│  │ Credit Card     │      │ Privy/MoonPay    │                  │
│  │ Charges $20.20  │ ───► │ Delivers $19.80  │                  │
│  └─────────────────┘      │ USDC to wallet   │                  │
│                           └────────┬─────────┘                  │
│                                    │                             │
│                                    ▼                             │
│                           ┌──────────────────┐                  │
│                           │ Backend Webhook  │                  │
│                           │ Calculates gap:  │                  │
│                           │ $20 - $19.80 = 20│                  │
│                           │ points credited  │                  │
│                           └────────┬─────────┘                  │
│                                    │                             │
│                                    ▼                             │
│  User Account: $19.80 USDC + 20 Points (= $0.20)                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        PAYMENT FLOW                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Service Price: $20 (includes 10% platform fee)                  │
│  User Balance: $19.80 USDC + 20 Points                          │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────────────────────────────────────┐            │
│  │ Backend calculates:                              │            │
│  │   Original Amount: $20.00                        │            │
│  │   USDC Available: $19.80                         │            │
│  │   Points Available: 20 ($0.20)                   │            │
│  │   Points to Use: 20 (covers $0.20 shortfall)     │            │
│  │   USDC to Pay: $19.80                            │            │
│  └─────────────────────┬───────────────────────────┘            │
│                        │                                         │
│                        ▼                                         │
│  ┌─────────────────────────────────────────────────┐            │
│  │ Smart Contract receives:                         │            │
│  │   - $19.80 USDC from customer                    │            │
│  │   - Authorization with originalAmount=$20        │            │
│  │                                                  │            │
│  │ Smart Contract distributes (on completion):      │            │
│  │   - Provider: $18.00 (90% of $20 original)       │            │
│  │   - Platform: $1.80 (remaining USDC)             │            │
│  └─────────────────────────────────────────────────┘            │
│                                                                  │
│  Points Accounting:                                              │
│  ┌─────────────────────────────────────────────────┐            │
│  │ Customer: -20 points                             │            │
│  │ Platform: Points worth $0.20 absorbed as cost    │            │
│  │ Provider: Receives full $18.00 (unaffected)      │            │
│  └─────────────────────────────────────────────────┘            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Financial Flow Analysis

#### Scenario: $20 service, 1% funding fee, no inviter

| Step | User | Provider | Platform |
|------|------|----------|----------|
| **Funding $20** | +$19.80 USDC, +20 pts | - | - |
| **Book $20 service** | -$19.80 USDC, -20 pts | - | - |
| **Service complete** | - | +$18.00 | +$1.80 |
| **Net** | Paid $20 (card), Got service | Earned $18 | Earned $1.80, Gave 20 pts |

Platform net earnings: $1.80 - $0.20 (points cost) = **$1.60**
This is acceptable because platform fee is 10% ($2), minus points subsidy ($0.20) = $1.80 margin.

#### Edge Cases

**Case 1: User has more USDC than needed**
```
Service: $20, User has $25 USDC + 50 points
→ Use $20 USDC, 0 points
→ Points saved for future use
```

**Case 2: User has points but no USDC shortfall**
```
Service: $20, User has $20 USDC + 50 points
→ Use $20 USDC, 0 points
→ Points saved (no need to use)
```

**Case 3: Points don't fully cover shortfall**
```
Service: $20, User has $19.50 USDC + 20 points ($0.20)
→ User can't afford ($0.30 short)
→ Block booking, prompt to fund more
```

**Case 4: Service with inviter (5% platform + 5% inviter)**
```
Service: $20, User pays $19.80 USDC + 20 pts
Provider: $18.00 (90% of original)
Inviter: $1.00 (5% of original)
Platform: $0.80 (remaining USDC - provider - inviter)
```

---

## 3. Smart Contract Modifications

### 3.1 Current Contract Structure

```solidity
// Current BookingAuthorization
struct BookingAuthorization {
    bytes32 bookingId;
    address customer;
    address provider;
    address inviter;
    uint256 amount;           // USDC amount (actual payment)
    uint256 platformFeeRate;  // e.g., 1000 = 10%
    uint256 inviterFeeRate;   // e.g., 500 = 5%
    uint256 expiry;
    uint256 nonce;
}

// Current distribution (in completeService):
platformFee = amount * platformFeeRate / 10000
inviterFee = amount * inviterFeeRate / 10000
providerAmount = amount - platformFee - inviterFee
```

### 3.2 Modified Contract Structure

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Modified BookingAuthorization - ADD originalAmount
struct BookingAuthorization {
    bytes32 bookingId;
    address customer;
    address provider;
    address inviter;
    uint256 amount;              // Actual USDC being paid (may be less than original)
    uint256 originalAmount;      // Original service price (NEW FIELD)
    uint256 platformFeeRate;     // Basis points
    uint256 inviterFeeRate;      // Basis points
    uint256 expiry;
    uint256 nonce;
}

// Modified Booking storage - ADD originalAmount
struct Booking {
    address customer;
    address provider;
    address inviter;
    uint256 amount;              // USDC actually received
    uint256 originalAmount;      // Original service price (NEW FIELD)
    uint256 platformFeeRate;
    uint256 inviterFeeRate;
    BookingStatus status;
}
```

### 3.3 Modified Distribution Logic

```solidity
function completeService(bytes32 bookingId) external nonReentrant {
    Booking storage booking = bookings[bookingId];
    require(booking.status == BookingStatus.Paid, "Booking not in Paid status");
    require(
        msg.sender == booking.customer || msg.sender == backendSigner,
        "Only customer or backend can complete"
    );

    booking.status = BookingStatus.Completed;

    // CRITICAL CHANGE: Calculate fees based on originalAmount, not amount
    uint256 providerAmount = (booking.originalAmount * (10000 - booking.platformFeeRate - booking.inviterFeeRate)) / 10000;
    uint256 inviterAmount = (booking.originalAmount * booking.inviterFeeRate) / 10000;

    // Platform gets whatever USDC is left after paying provider and inviter
    // This may be less than 10% if points were used
    uint256 platformAmount = booking.amount - providerAmount - inviterAmount;

    // Safety check: ensure we have enough USDC to pay provider
    require(booking.amount >= providerAmount + inviterAmount, "Insufficient USDC for distribution");

    // Transfer to provider (guaranteed full amount)
    require(usdc.transfer(booking.provider, providerAmount), "Provider transfer failed");

    // Transfer to inviter (if any)
    if (inviterAmount > 0 && booking.inviter != address(0)) {
        require(usdc.transfer(booking.inviter, inviterAmount), "Inviter transfer failed");
    }

    // Transfer remaining to platform
    if (platformAmount > 0) {
        require(usdc.transfer(platformWallet, platformAmount), "Platform transfer failed");
    }

    emit ServiceCompleted(
        bookingId,
        booking.customer,
        booking.provider,
        providerAmount,
        platformAmount,
        inviterAmount
    );
}
```

### 3.4 Updated EIP-712 Type Hash

```solidity
bytes32 public constant BOOKING_AUTHORIZATION_TYPEHASH = keccak256(
    "BookingAuthorization(bytes32 bookingId,address customer,address provider,address inviter,uint256 amount,uint256 originalAmount,uint256 platformFeeRate,uint256 inviterFeeRate,uint256 expiry,uint256 nonce)"
);

function _hashBookingAuthorization(BookingAuthorization calldata auth) internal pure returns (bytes32) {
    return keccak256(abi.encode(
        BOOKING_AUTHORIZATION_TYPEHASH,
        auth.bookingId,
        auth.customer,
        auth.provider,
        auth.inviter,
        auth.amount,
        auth.originalAmount,  // NEW
        auth.platformFeeRate,
        auth.inviterFeeRate,
        auth.expiry,
        auth.nonce
    ));
}
```

### 3.5 Validation in createAndPayBooking

```solidity
function createAndPayBooking(
    BookingAuthorization calldata auth,
    bytes calldata signature
) external nonReentrant {
    // Existing validations...

    // NEW: Validate originalAmount >= amount
    require(auth.originalAmount >= auth.amount, "Original amount must be >= actual amount");

    // NEW: Validate that provider can be paid from amount
    uint256 providerAmount = (auth.originalAmount * (10000 - auth.platformFeeRate - auth.inviterFeeRate)) / 10000;
    uint256 inviterAmount = (auth.originalAmount * auth.inviterFeeRate) / 10000;
    require(auth.amount >= providerAmount + inviterAmount, "Amount insufficient for provider + inviter");

    // Store booking with originalAmount
    bookings[auth.bookingId] = Booking({
        customer: auth.customer,
        provider: auth.provider,
        inviter: auth.inviter,
        amount: auth.amount,
        originalAmount: auth.originalAmount,  // NEW
        platformFeeRate: auth.platformFeeRate,
        inviterFeeRate: auth.inviterFeeRate,
        status: BookingStatus.Paid
    });

    // Transfer USDC (only the actual amount)
    require(usdc.transferFrom(msg.sender, address(this), auth.amount), "USDC transfer failed");

    emit BookingCreatedAndPaid(/* ... */);
}
```

---

## 4. Database Schema

### 4.1 New Tables

```sql
-- ============================================
-- USER POINTS BALANCE
-- ============================================
CREATE TABLE user_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Balance tracking
    balance INTEGER NOT NULL DEFAULT 0,              -- Current points (in cents, 100 = $1)
    lifetime_earned INTEGER NOT NULL DEFAULT 0,     -- Total points ever earned
    lifetime_spent INTEGER NOT NULL DEFAULT 0,      -- Total points ever spent

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT user_points_user_unique UNIQUE (user_id),
    CONSTRAINT user_points_balance_non_negative CHECK (balance >= 0)
);

CREATE INDEX idx_user_points_user_id ON user_points(user_id);

-- ============================================
-- POINT TRANSACTIONS (AUDIT LOG)
-- ============================================
CREATE TABLE point_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Transaction details
    type TEXT NOT NULL CHECK (type IN (
        'funding_credit',      -- Points earned from funding
        'booking_debit',       -- Points spent on booking
        'refund_credit',       -- Points returned from cancelled booking
        'admin_credit',        -- Manual adjustment (credit)
        'admin_debit',         -- Manual adjustment (debit)
        'expiry_debit'         -- Points expired (future use)
    )),

    amount INTEGER NOT NULL,                        -- Points amount (always positive)
    balance_after INTEGER NOT NULL,                 -- Balance after this transaction

    -- References
    reference_type TEXT CHECK (reference_type IN ('funding', 'booking', 'admin')),
    reference_id TEXT,                              -- funding tx hash, booking id, or admin note

    -- Metadata
    description TEXT,
    metadata JSONB,                                 -- Additional data (funding amount, etc.)

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_point_transactions_user_id ON point_transactions(user_id);
CREATE INDEX idx_point_transactions_reference ON point_transactions(reference_type, reference_id);
CREATE INDEX idx_point_transactions_created ON point_transactions(created_at DESC);

-- ============================================
-- FUNDING RECORDS (TRACK CREDIT CARD DEPOSITS)
-- ============================================
CREATE TABLE funding_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Funding details
    requested_amount DECIMAL(10, 2) NOT NULL,       -- Amount user requested ($20)
    received_amount DECIMAL(10, 2) NOT NULL,        -- USDC actually received ($19.80)
    fee_amount DECIMAL(10, 2) NOT NULL,             -- Difference ($0.20)
    points_credited INTEGER NOT NULL DEFAULT 0,     -- Points given (20)

    -- Payment info
    payment_method TEXT DEFAULT 'credit_card',
    payment_provider TEXT,                          -- 'moonpay', 'privy', etc.
    transaction_hash TEXT,                          -- On-chain tx hash
    external_reference TEXT,                        -- Provider's reference ID

    -- Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',      -- Waiting for confirmation
        'completed',    -- USDC received, points credited
        'failed'        -- Transaction failed
    )),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_funding_records_user_id ON funding_records(user_id);
CREATE INDEX idx_funding_records_status ON funding_records(status);
CREATE INDEX idx_funding_records_tx_hash ON funding_records(transaction_hash);
```

### 4.2 Modifications to Existing Tables

```sql
-- ============================================
-- MODIFY BOOKINGS TABLE
-- ============================================
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS original_amount DECIMAL(10, 2);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS points_used INTEGER DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS points_value DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS usdc_paid DECIMAL(10, 2);

-- Add comment for clarity
COMMENT ON COLUMN bookings.original_amount IS 'Original service price before points discount';
COMMENT ON COLUMN bookings.points_used IS 'Number of points used (100 points = $1)';
COMMENT ON COLUMN bookings.points_value IS 'USD value of points used';
COMMENT ON COLUMN bookings.usdc_paid IS 'Actual USDC paid to smart contract';

-- ============================================
-- ENSURE USER_POINTS RECORD EXISTS FOR ALL USERS
-- ============================================
-- Trigger to auto-create user_points record
CREATE OR REPLACE FUNCTION create_user_points_on_user_insert()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_points (user_id) VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_user_points
AFTER INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION create_user_points_on_user_insert();

-- Backfill existing users
INSERT INTO user_points (user_id)
SELECT id FROM users
WHERE id NOT IN (SELECT user_id FROM user_points)
ON CONFLICT DO NOTHING;
```

---

## 5. Backend Implementation

### 5.1 Modified EIP-712 Signer

**File: `/backend/src/eip712-signer.js`**

```javascript
// Add originalAmount to type definition
const BOOKING_AUTHORIZATION_TYPES = {
  BookingAuthorization: [
    { name: "bookingId", type: "bytes32" },
    { name: "customer", type: "address" },
    { name: "provider", type: "address" },
    { name: "inviter", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "originalAmount", type: "uint256" },  // NEW
    { name: "platformFeeRate", type: "uint256" },
    { name: "inviterFeeRate", type: "uint256" },
    { name: "expiry", type: "uint256" },
    { name: "nonce", type: "uint256" },
  ],
};

/**
 * Sign booking authorization with points support
 * @param {Object} params
 * @param {string} params.bookingId - Booking UUID
 * @param {string} params.customer - Customer wallet address
 * @param {string} params.provider - Provider wallet address
 * @param {string} params.inviter - Inviter wallet address (or zero address)
 * @param {number} params.amount - Actual USDC to pay (after points)
 * @param {number} params.originalAmount - Original service price
 * @param {number} params.platformFeeRate - Platform fee in basis points
 * @param {number} params.inviterFeeRate - Inviter fee in basis points
 * @param {number} params.expiryMinutes - Signature validity in minutes
 */
async signBookingAuthorization({
  bookingId,
  customer,
  provider,
  inviter,
  amount,
  originalAmount,  // NEW PARAMETER
  platformFeeRate = 1000,
  inviterFeeRate = 0,
  expiryMinutes = 5,
}) {
  const expiry = Math.floor(Date.now() / 1000) + expiryMinutes * 60;
  const nonce = Date.now() + Math.floor(Math.random() * 1000000);

  // Convert to USDC wei (6 decimals)
  const amountWei = ethers.parseUnits(amount.toFixed(6), 6);
  const originalAmountWei = ethers.parseUnits(originalAmount.toFixed(6), 6);

  const authorization = {
    bookingId: ethers.keccak256(ethers.toUtf8Bytes(bookingId)),
    customer,
    provider,
    inviter: inviter || ethers.ZeroAddress,
    amount: amountWei,
    originalAmount: originalAmountWei,  // NEW
    platformFeeRate: BigInt(platformFeeRate),
    inviterFeeRate: BigInt(inviterFeeRate),
    expiry: BigInt(expiry),
    nonce: BigInt(nonce),
  };

  const signature = await this.backendSigner.signTypedData(
    this.domain,
    BOOKING_AUTHORIZATION_TYPES,
    authorization
  );

  return {
    authorization: this._serializeAuthorization(authorization),
    signature,
    expiry,
    nonce,
  };
}

_serializeAuthorization(auth) {
  return {
    bookingId: auth.bookingId,
    customer: auth.customer,
    provider: auth.provider,
    inviter: auth.inviter,
    amount: auth.amount.toString(),
    originalAmount: auth.originalAmount.toString(),  // NEW
    platformFeeRate: auth.platformFeeRate.toString(),
    inviterFeeRate: auth.inviterFeeRate.toString(),
    expiry: auth.expiry.toString(),
    nonce: auth.nonce.toString(),
  };
}
```

### 5.2 Points Service

**File: `/backend/src/services/points-service.js`** (NEW FILE)

```javascript
/**
 * Points Service
 * Handles all points-related operations
 */

import { supabaseAdmin } from '../db-client.js';

// 1 point = $0.01 USD
const POINTS_PER_DOLLAR = 100;

/**
 * Get user's current points balance
 */
export async function getUserPoints(userId) {
  const { data, error } = await supabaseAdmin
    .from('user_points')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  // Return default if no record exists
  return data || {
    user_id: userId,
    balance: 0,
    lifetime_earned: 0,
    lifetime_spent: 0,
  };
}

/**
 * Credit points to user (e.g., from funding)
 */
export async function creditPoints({
  userId,
  amount,
  type,
  referenceType,
  referenceId,
  description,
  metadata = {},
}) {
  // Get current balance
  const userPoints = await getUserPoints(userId);
  const newBalance = userPoints.balance + amount;

  // Update balance
  const { error: updateError } = await supabaseAdmin
    .from('user_points')
    .upsert({
      user_id: userId,
      balance: newBalance,
      lifetime_earned: userPoints.lifetime_earned + amount,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

  if (updateError) throw updateError;

  // Record transaction
  const { error: txError } = await supabaseAdmin
    .from('point_transactions')
    .insert({
      user_id: userId,
      type,
      amount,
      balance_after: newBalance,
      reference_type: referenceType,
      reference_id: referenceId,
      description,
      metadata,
    });

  if (txError) throw txError;

  return { balance: newBalance, credited: amount };
}

/**
 * Debit points from user (e.g., for booking)
 */
export async function debitPoints({
  userId,
  amount,
  type,
  referenceType,
  referenceId,
  description,
  metadata = {},
}) {
  // Get current balance
  const userPoints = await getUserPoints(userId);

  if (userPoints.balance < amount) {
    throw new Error(`Insufficient points: have ${userPoints.balance}, need ${amount}`);
  }

  const newBalance = userPoints.balance - amount;

  // Update balance
  const { error: updateError } = await supabaseAdmin
    .from('user_points')
    .update({
      balance: newBalance,
      lifetime_spent: userPoints.lifetime_spent + amount,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (updateError) throw updateError;

  // Record transaction
  const { error: txError } = await supabaseAdmin
    .from('point_transactions')
    .insert({
      user_id: userId,
      type,
      amount,
      balance_after: newBalance,
      reference_type: referenceType,
      reference_id: referenceId,
      description,
      metadata,
    });

  if (txError) throw txError;

  return { balance: newBalance, debited: amount };
}

/**
 * Calculate points to use for a booking
 *
 * @param {number} originalAmount - Full service price in USD
 * @param {number} userUsdcBalance - User's USDC balance
 * @param {number} userPointsBalance - User's points balance
 * @param {boolean} usePoints - Whether user wants to use points
 * @returns {Object} Calculation result
 */
export function calculatePointsUsage({
  originalAmount,
  userUsdcBalance,
  userPointsBalance,
  usePoints = true,
}) {
  // If user doesn't want to use points, or has no points
  if (!usePoints || userPointsBalance <= 0) {
    return {
      originalAmount,
      usdcToPay: originalAmount,
      pointsToUse: 0,
      pointsValue: 0,
      canAfford: userUsdcBalance >= originalAmount,
    };
  }

  // Calculate shortfall
  const shortfall = Math.max(0, originalAmount - userUsdcBalance);

  // Points value in USD
  const maxPointsValueUsd = userPointsBalance / POINTS_PER_DOLLAR;

  // How much can points cover?
  const pointsValueToUse = Math.min(maxPointsValueUsd, shortfall);
  const pointsToUse = Math.round(pointsValueToUse * POINTS_PER_DOLLAR);

  // Actual USDC needed
  const usdcToPay = originalAmount - pointsValueToUse;

  return {
    originalAmount,
    usdcToPay: Math.round(usdcToPay * 100) / 100,  // Round to 2 decimals
    pointsToUse,
    pointsValue: pointsValueToUse,
    canAfford: userUsdcBalance >= usdcToPay,
  };
}

/**
 * Process funding and credit points for fee compensation
 */
export async function processFunding({
  userId,
  requestedAmount,
  receivedAmount,
  transactionHash,
  paymentProvider = 'unknown',
}) {
  // Calculate fee and points to credit
  const feeAmount = requestedAmount - receivedAmount;
  const pointsToCredit = Math.round(feeAmount * POINTS_PER_DOLLAR);

  // Record funding
  const { data: funding, error: fundingError } = await supabaseAdmin
    .from('funding_records')
    .insert({
      user_id: userId,
      requested_amount: requestedAmount,
      received_amount: receivedAmount,
      fee_amount: feeAmount,
      points_credited: pointsToCredit,
      payment_provider: paymentProvider,
      transaction_hash: transactionHash,
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (fundingError) throw fundingError;

  // Credit points if there was a fee
  if (pointsToCredit > 0) {
    await creditPoints({
      userId,
      amount: pointsToCredit,
      type: 'funding_credit',
      referenceType: 'funding',
      referenceId: funding.id,
      description: `Fee compensation for $${requestedAmount} funding`,
      metadata: {
        requestedAmount,
        receivedAmount,
        feeAmount,
        transactionHash,
      },
    });
  }

  return {
    funding,
    pointsCredited: pointsToCredit,
  };
}
```

### 5.3 Modified Booking Route

**File: `/backend/src/routes/bookings.js`** (MODIFICATIONS)

```javascript
import { getUserPoints, calculatePointsUsage, debitPoints } from '../services/points-service.js';

// POST /api/bookings
app.post("/api/bookings", authenticateUser, async (c) => {
  try {
    const body = await c.req.json();
    const {
      service_id: serviceId,
      scheduled_at: scheduledAt,
      duration_minutes: durationMinutes,
      customer_notes: customerNotes,
      is_online: isOnline,
      use_points: usePoints = true,  // NEW: default to true
    } = body;

    // ... existing validation code ...

    // Calculate original amount (with service fee)
    const originalAmount = parseFloat(service.price) * 1.1;  // 10% service fee

    // NEW: Get user's points balance
    const userPoints = await getUserPoints(userId);

    // NEW: Get user's USDC balance (from frontend or estimate)
    // In production, this should come from the frontend which checks on-chain balance
    const userUsdcBalance = body.usdc_balance || originalAmount;  // Assume enough if not provided

    // NEW: Calculate points usage
    const pointsCalc = calculatePointsUsage({
      originalAmount,
      userUsdcBalance,
      userPointsBalance: userPoints.balance,
      usePoints,
    });

    if (!pointsCalc.canAfford) {
      return c.json({
        error: "Insufficient balance",
        required: originalAmount,
        usdcAvailable: userUsdcBalance,
        pointsAvailable: userPoints.balance,
        pointsValue: userPoints.balance / 100,
      }, 400);
    }

    // Create booking with points info
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from("bookings")
      .insert({
        id: crypto.randomUUID(),
        service_id: serviceId,
        customer_id: userId,
        provider_id: service.provider_id,
        total_price: parseFloat(service.price),
        service_fee: parseFloat(service.price) * 0.1,
        original_amount: originalAmount,        // NEW
        points_used: pointsCalc.pointsToUse,    // NEW
        points_value: pointsCalc.pointsValue,   // NEW
        usdc_paid: pointsCalc.usdcToPay,        // NEW
        scheduled_at: scheduledAt,
        duration_minutes: durationMinutes || service.duration_minutes,
        customer_notes: customerNotes || null,
        is_online: isOnline ?? service.is_online,
        status: "pending",
      })
      .select()
      .single();

    if (bookingError) throw bookingError;

    // Generate EIP-712 authorization with originalAmount
    const hasInviter = !!customerData?.referred_by;
    const platformFeeRate = hasInviter ? 500 : 1000;
    const inviterFeeRate = hasInviter ? 500 : 0;

    const authResult = await eip712Signer.signBookingAuthorization({
      bookingId: booking.id,
      customer: customerData.wallet_address,
      provider: providerData.wallet_address,
      inviter: inviterAddress || ethers.ZeroAddress,
      amount: pointsCalc.usdcToPay,           // Actual USDC to pay
      originalAmount: originalAmount,          // Full price (NEW)
      platformFeeRate,
      inviterFeeRate,
      expiryMinutes: 5,
    });

    // Update booking with blockchain ID
    const blockchainBookingId = authResult.authorization.bookingId;
    await supabaseAdmin
      .from("bookings")
      .update({
        blockchain_booking_id: blockchainBookingId,
        status: "pending_payment",
      })
      .eq("id", booking.id);

    // Store nonce
    await supabaseAdmin.from("signature_nonces").insert({
      nonce: authResult.nonce.toString(),
      booking_id: booking.id,
      signature_type: "booking_authorization",
    });

    return c.json({
      success: true,
      booking,
      authorization: authResult.authorization,
      signature: authResult.signature,
      contractAddress: CONTRACT_ADDRESS,
      usdcAddress: USDC_ADDRESS,
      // NEW: Points info
      payment: {
        originalAmount,
        usdcToPay: pointsCalc.usdcToPay,
        pointsUsed: pointsCalc.pointsToUse,
        pointsValue: pointsCalc.pointsValue,
      },
      feeBreakdown: {
        platformFeeRate,
        inviterFeeRate,
        // Based on original amount
        providerAmount: originalAmount * (1 - platformFeeRate/10000 - inviterFeeRate/10000),
        platformFee: originalAmount * platformFeeRate/10000,
        inviterFee: originalAmount * inviterFeeRate/10000,
      },
      expiresAt: new Date(authResult.expiry * 1000).toISOString(),
    });
  } catch (error) {
    console.error("Create booking error:", error);
    return c.json({ error: error.message }, 500);
  }
});
```

### 5.4 Modified Event Monitor

**File: `/backend/src/event-monitor.js`** (MODIFICATIONS)

```javascript
import { debitPoints } from './services/points-service.js';

/**
 * Handle BookingCreatedAndPaid event
 * Debit points after successful payment
 */
async function handleBookingPaid(eventData) {
  const { bookingIdHash, transactionHash } = eventData;

  // Find booking by blockchain ID
  const { data: booking, error } = await supabaseAdmin
    .from("bookings")
    .select("*")
    .eq("blockchain_booking_id", bookingIdHash)
    .single();

  if (error || !booking) {
    console.error("Booking not found for blockchain ID:", bookingIdHash);
    return;
  }

  // Update booking status
  await supabaseAdmin
    .from("bookings")
    .update({
      status: "paid",
      blockchain_tx_hash: transactionHash,
      blockchain_confirmed_at: new Date().toISOString(),
      blockchain_data: eventData,
    })
    .eq("id", booking.id);

  // NEW: Debit points if used
  if (booking.points_used > 0) {
    try {
      await debitPoints({
        userId: booking.customer_id,
        amount: booking.points_used,
        type: "booking_debit",
        referenceType: "booking",
        referenceId: booking.id,
        description: `Points used for booking ${booking.id.slice(0, 8)}...`,
        metadata: {
          bookingId: booking.id,
          pointsValue: booking.points_value,
          originalAmount: booking.original_amount,
          usdcPaid: booking.usdc_paid,
        },
      });
      console.log(`✅ Debited ${booking.points_used} points for booking ${booking.id}`);
    } catch (pointsError) {
      console.error("Failed to debit points:", pointsError);
      // Don't fail the whole transaction - points can be reconciled later
    }
  }

  console.log(`✅ Booking ${booking.id} marked as paid`);
}
```

---

## 6. Frontend Implementation

### 6.1 Modified Blockchain Service

**File: `/src/lib/blockchain-service.ts`** (MODIFICATIONS)

```typescript
interface PaymentAuthorization {
  bookingId: string;
  customer: string;
  provider: string;
  inviter: string;
  amount: string;
  originalAmount: string;  // NEW
  platformFeeRate: string;
  inviterFeeRate: string;
  expiry: string;
  nonce: string;
}

// ABI updated to include originalAmount
const BOOKING_ESCROW_ABI = [
  {
    name: "createAndPayBooking",
    type: "function",
    inputs: [
      {
        name: "auth",
        type: "tuple",
        components: [
          { name: "bookingId", type: "bytes32" },
          { name: "customer", type: "address" },
          { name: "provider", type: "address" },
          { name: "inviter", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "originalAmount", type: "uint256" },  // NEW
          { name: "platformFeeRate", type: "uint256" },
          { name: "inviterFeeRate", type: "uint256" },
          { name: "expiry", type: "uint256" },
          { name: "nonce", type: "uint256" },
        ],
      },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
  // ... other functions
];
```

### 6.2 Points Display Components

**File: `/src/components/PointsBalance.tsx`** (NEW FILE)

```tsx
import { useEffect, useState } from "react";
import { usePrivyAuth } from "@/contexts/PrivyAuthContext";
import { ApiClient } from "@/lib/api-migration";
import { Coins } from "lucide-react";

export function PointsBalance() {
  const { user } = usePrivyAuth();
  const [points, setPoints] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      ApiClient.getUserPoints(user.id)
        .then((data) => setPoints(data.balance))
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [user?.id]);

  if (loading) return null;
  if (points === 0) return null;

  const pointsValue = (points / 100).toFixed(2);

  return (
    <div className="flex items-center gap-1.5 text-sm">
      <Coins className="w-4 h-4 text-amber-500" />
      <span className="font-medium">{points}</span>
      <span className="text-muted-foreground">(${pointsValue})</span>
    </div>
  );
}
```

### 6.3 Modified Booking Confirmation

**File: `/src/components/BookingConfirmation.tsx`** (MODIFICATIONS)

```tsx
interface PaymentBreakdown {
  originalAmount: number;
  usdcToPay: number;
  pointsUsed: number;
  pointsValue: number;
}

function PaymentSummary({ payment }: { payment: PaymentBreakdown }) {
  return (
    <div className="space-y-2 p-4 bg-muted rounded-lg">
      <div className="flex justify-between">
        <span>Service Total</span>
        <span>${payment.originalAmount.toFixed(2)}</span>
      </div>

      {payment.pointsUsed > 0 && (
        <div className="flex justify-between text-green-600">
          <span className="flex items-center gap-1">
            <Coins className="w-4 h-4" />
            Points Applied ({payment.pointsUsed} pts)
          </span>
          <span>-${payment.pointsValue.toFixed(2)}</span>
        </div>
      )}

      <div className="flex justify-between font-semibold border-t pt-2">
        <span>USDC to Pay</span>
        <span>${payment.usdcToPay.toFixed(2)}</span>
      </div>
    </div>
  );
}
```

---

## 7. API Endpoints

### 7.1 New Endpoints

```
GET  /api/points
     - Returns user's points balance and recent transactions

POST /api/points/calculate
     - Calculate points usage for a given amount
     - Body: { amount: number, usePoints: boolean }
     - Returns: { usdcToPay, pointsToUse, pointsValue }

POST /api/funding/webhook
     - Webhook from Privy/MoonPay when funding completes
     - Body: { userId, requestedAmount, receivedAmount, txHash }
     - Credits points to user

GET  /api/points/transactions
     - Returns paginated points transaction history
     - Query: { page, limit }
```

### 7.2 Modified Endpoints

```
POST /api/bookings
     - Added: use_points (boolean), usdc_balance (number)
     - Returns: payment breakdown including points

GET  /api/bookings/:id
     - Returns: includes points_used, points_value, usdc_paid
```

---

## 8. Migration Plan

### Phase 1: Database Migration
1. Create `user_points` table
2. Create `point_transactions` table
3. Create `funding_records` table
4. Alter `bookings` table (add columns)
5. Backfill `user_points` for existing users

### Phase 2: Smart Contract Deployment
1. Deploy new contract with `originalAmount` support
2. Update contract address in environment
3. Test with small amounts

### Phase 3: Backend Implementation
1. Add points service
2. Modify EIP-712 signer
3. Modify booking route
4. Modify event monitor
5. Add funding webhook

### Phase 4: Frontend Implementation
1. Update blockchain service
2. Add points display components
3. Modify booking flow
4. Add points to wallet view

### Phase 5: Testing & Rollout
1. Test funding → points credit
2. Test booking with points
3. Test cancellation refund
4. Gradual rollout to users

---

## 9. Testing Checklist

### Unit Tests
- [ ] Points service: credit, debit, calculate
- [ ] EIP-712 signing with originalAmount
- [ ] Smart contract: distribution calculation

### Integration Tests
- [ ] Full funding flow (mock Privy webhook)
- [ ] Full booking flow with points
- [ ] Cancellation with points refund

### E2E Tests
- [ ] User funds wallet → receives points
- [ ] User books service → points deducted
- [ ] Provider receives correct amount
- [ ] Platform receives reduced fee

### Edge Cases
- [ ] Booking when points exactly cover shortfall
- [ ] Booking when points partially cover shortfall
- [ ] Booking when no shortfall (full USDC balance)
- [ ] Cancellation returns points
- [ ] Multiple concurrent bookings

---

## 10. Monitoring & Alerts

### Metrics to Track
- Total points issued
- Total points redeemed
- Points-to-USDC conversion rate
- Platform fee after points deduction
- Failed points transactions

### Alerts
- Points balance goes negative (critical bug)
- Large points issuance (>1000 in single tx)
- Points debit without booking
- Platform fee becomes negative

---

## 11. Open Questions

1. **Points expiry?** - Currently no expiry. Should we add one?
2. **Points transferability?** - Currently non-transferable. Keep it this way?
3. **Max points per booking?** - Currently no limit. Should we cap at 50% of service price?
4. **Referral points?** - Should referrers also earn points?

---

## Appendix A: Contract Diff

```diff
// BookingAuthorization struct
struct BookingAuthorization {
    bytes32 bookingId;
    address customer;
    address provider;
    address inviter;
    uint256 amount;
+   uint256 originalAmount;
    uint256 platformFeeRate;
    uint256 inviterFeeRate;
    uint256 expiry;
    uint256 nonce;
}

// Booking storage struct
struct Booking {
    address customer;
    address provider;
    address inviter;
    uint256 amount;
+   uint256 originalAmount;
    uint256 platformFeeRate;
    uint256 inviterFeeRate;
    BookingStatus status;
}

// Type hash
- bytes32 public constant BOOKING_AUTHORIZATION_TYPEHASH = keccak256("BookingAuthorization(bytes32 bookingId,address customer,address provider,address inviter,uint256 amount,uint256 platformFeeRate,uint256 inviterFeeRate,uint256 expiry,uint256 nonce)");
+ bytes32 public constant BOOKING_AUTHORIZATION_TYPEHASH = keccak256("BookingAuthorization(bytes32 bookingId,address customer,address provider,address inviter,uint256 amount,uint256 originalAmount,uint256 platformFeeRate,uint256 inviterFeeRate,uint256 expiry,uint256 nonce)");

// completeService distribution
function completeService(bytes32 bookingId) external {
    // ...
-   uint256 providerAmount = (booking.amount * (10000 - booking.platformFeeRate - booking.inviterFeeRate)) / 10000;
-   uint256 inviterAmount = (booking.amount * booking.inviterFeeRate) / 10000;
-   uint256 platformAmount = (booking.amount * booking.platformFeeRate) / 10000;
+   uint256 providerAmount = (booking.originalAmount * (10000 - booking.platformFeeRate - booking.inviterFeeRate)) / 10000;
+   uint256 inviterAmount = (booking.originalAmount * booking.inviterFeeRate) / 10000;
+   uint256 platformAmount = booking.amount - providerAmount - inviterAmount;
    // ...
}
```

---

## Appendix B: Example Scenarios

### Scenario 1: Basic Points Usage
```
User funds: $100 via credit card
Fee: 1.5% = $1.50
User receives: $98.50 USDC + 150 points

Later, user books $50 service:
User USDC balance: $48.50 (spent some)
Points balance: 150 (= $1.50)
Shortfall: $50 - $48.50 = $1.50

Points calculation:
- Use 150 points ($1.50) to cover shortfall
- USDC to pay: $48.50
- Points to use: 150

Blockchain payment: $48.50 USDC
Provider receives: $45.00 (90% of $50)
Platform receives: $3.50 ($48.50 - $45)
Points consumed: 150

Platform net: $3.50 - $1.50 (points cost) = $2.00
Expected: $5.00 (10% of $50) - $1.50 (points) = $3.50
Wait, this doesn't match...

CORRECTION: Points should offset customer payment, not platform fee!
Platform still receives: $5.00 (10% of original $50)
But only $48.50 USDC came in, so:
- Provider: $45.00
- Platform: $3.50 from USDC
- Points cost: Platform "lost" $1.50 they would have received

This is the intended behavior - platform absorbs points cost.
```

### Scenario 2: No Points Needed
```
User USDC balance: $100
Points balance: 200 (= $2.00)
Service price: $50

Calculation:
- No shortfall (USDC >= price)
- Points not used
- USDC to pay: $50
- Points to use: 0

Result: Normal payment, points saved for later.
```

---

*Document End*

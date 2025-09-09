# 🎯 Frontend Blockchain UX Implementation Plan

## Overview
Implement seamless blockchain payment integration with clear user flows for booking creation, payment, cancellation, and completion.

## Core UX Flows

### 1. Create Booking Flow (/:username page)
**Steps:**
1. User clicks "Book Now" button
2. Call backend API `POST /api/bookings` to create booking
3. Backend responds with booking data + blockchain authorization
4. Frontend prompts user to commit blockchain transaction
5. Show "Processing..." status while waiting for confirmation
6. Backend monitors blockchain events and updates booking status
7. **Timeout Handling**: If no transaction within 3 minutes, booking remains in "pending_payment" status

**UI Components Needed:**
- Enhanced BookingModal with blockchain transaction handling
- TransactionStatusModal for showing progress
- Error handling for transaction failures

### 2. Payment Flow (My Bookings page)
**For bookings with status "pending_payment":**
1. Show "Pay Now" button instead of regular booking actions
2. Click "Pay Now" → Request payment authorization from backend
3. Prompt user to commit payment transaction
4. Monitor transaction status and update UI
5. Success → booking status becomes "paid"

**UI Components Needed:**
- PaymentButton component
- Transaction monitoring integration

### 3. Cancel Flow
**Steps:**
1. User clicks "Cancel Booking" button
2. Call backend API `POST /api/bookings/:id/initiate-cancel`
3. Backend sets status to "pending_cancellation" 
4. Frontend prompts user to commit cancel transaction
5. Monitor blockchain events for cancellation confirmation
6. Success → booking status becomes "cancelled"

**UI Components Needed:**
- CancelBookingButton with blockchain integration
- Cancellation confirmation modal

### 4. Complete Service Flow
**Steps:**
1. Provider clicks "Mark Complete" button  
2. Call backend API `POST /api/bookings/:id/initiate-complete`
3. Backend sets status to "pending_completion"
4. Frontend prompts user to commit completion transaction
5. Monitor blockchain events for completion confirmation
6. Success → booking status becomes "completed", funds distributed

**UI Components Needed:**
- CompleteServiceButton with blockchain integration
- Service completion confirmation modal

## Implementation Phases

### Phase 1: Core Infrastructure
- [ ] Create blockchain service client (`src/lib/blockchain-service.ts`)
- [ ] Create transaction status monitoring hooks
- [ ] Create reusable transaction modal components
- [ ] Add blockchain error handling utilities

### Phase 2: Booking Creation (/:username page)
- [ ] Update BookingModal with blockchain integration
- [ ] Add transaction prompting after booking creation
- [ ] Implement transaction status monitoring
- [ ] Handle 3-minute timeout scenarios

### Phase 3: My Bookings Page Enhancement
- [ ] Update CustomerBookings page with payment buttons
- [ ] Add PaymentButton component for pending payments
- [ ] Integrate transaction monitoring for payment flow
- [ ] Update booking status display with blockchain states

### Phase 4: Provider Actions
- [ ] Add CompleteServiceButton to provider order management
- [ ] Implement service completion blockchain flow
- [ ] Add provider-side transaction monitoring

### Phase 5: Cancellation System
- [ ] Add CancelBookingButton to both customer and provider views
- [ ] Implement cancellation blockchain flow
- [ ] Handle cancellation transaction monitoring

### Phase 6: Real-time Updates & Polish
- [ ] Implement WebSocket or polling for real-time status updates
- [ ] Add loading states and error recovery
- [ ] Test timeout scenarios and edge cases
- [ ] Add transaction history viewing

## Technical Requirements

### Environment Variables (Frontend)
```bash
VITE_CONTRACT_ADDRESS=0x1D59b8DD5b1f6bE31C48a7AB82eaA322752880C7
VITE_USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
VITE_CHAIN_ID=84532
VITE_BLOCKCHAIN_EXPLORER=https://sepolia.basescan.org
```

### Dependencies
```bash
npm install ethers@6
```

### Key Components Architecture

1. **BlockchainService** (`src/lib/blockchain-service.ts`)
   - Contract interaction wrapper
   - Transaction execution
   - Balance checking
   - Error handling

2. **Transaction Hooks** (`src/hooks/useTransaction.ts`)
   - Transaction status monitoring
   - Real-time updates
   - Error state management

3. **Transaction Modal** (`src/components/TransactionModal.tsx`)
   - Reusable transaction prompting
   - Progress indication
   - Error display

4. **Enhanced Booking Components**
   - BookingModal with blockchain integration
   - PaymentButton for pending payments
   - CancelBookingButton with blockchain
   - CompleteServiceButton with blockchain

## Success Criteria

- [ ] Users can create bookings and complete blockchain payment in one flow
- [ ] Pending payments show "Pay Now" button after 3-minute timeout
- [ ] All blockchain actions (pay, cancel, complete) work seamlessly
- [ ] Real-time status updates reflect blockchain events
- [ ] Error handling provides clear user feedback
- [ ] Transaction history is visible and trackable

## Testing Checklist

- [ ] Create booking → immediate payment flow
- [ ] Create booking → timeout → pay later flow
- [ ] Payment retry scenarios
- [ ] Cancellation by both customer and provider
- [ ] Service completion by customer
- [ ] Network error handling
- [ ] Insufficient balance scenarios
- [ ] Transaction rejection handling

---

*This plan ensures a seamless blockchain payment experience while maintaining fallback options and clear user feedback throughout the process.*
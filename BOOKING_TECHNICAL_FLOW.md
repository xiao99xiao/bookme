# BookMe - Technical Code Execution Flow

This document traces the exact technical implementation flow of the booking process, showing actual code execution, API requests/responses, and data transformations at each step.

## 🔄 **Step-by-Step Technical Flow**

---

## **STEP 1: Frontend Booking Initiation**

### **File**: `src/pages/Profile.tsx` (lines 280-333)

### **User Action**: Customer clicks "Book Service" button

### **Code Execution**:
```typescript
const handleBookService = async () => {
  setIsBooking(true);
  
  // Prepare booking data from form state
  const bookingData = {
    service_id: selectedService.id,           // UUID from service selection
    provider_id: profile.id,                 // UUID from profile data
    scheduled_at: selectedTimeSlot.toISOString(), // "2024-12-01T10:00:00.000Z"
    duration_minutes: selectedService.duration_minutes, // 60
    total_price: selectedService.price,      // 100
    customer_notes: customerNotes.trim() || undefined, // "Looking forward to session"
    location: selectedService.location,      // "Online"
    is_online: selectedService.is_online     // true
  };
```

### **Data Flow**:
- **Input**: Form state (selectedService, selectedTimeSlot, customerNotes)
- **Processing**: Convert Date to ISO string, extract service properties
- **Output**: Structured booking request payload

---

## **STEP 2: API Call to Backend**

### **Frontend Code**: `src/pages/Profile.tsx` (lines 294-305)

```typescript
const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/bookings`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${await getAccessToken()}` // Privy JWT token
  },
  body: JSON.stringify(bookingData)
});
```

### **Request Details**:
- **URL**: `https://backend-url.com/api/bookings`
- **Method**: `POST`
- **Headers**: 
  - `Content-Type: application/json`
  - `Authorization: Bearer eyJhbGciOiJIUzI1NiIs...` (Privy JWT)
- **Body**: JSON stringified booking data

---

## **STEP 3: Backend Request Processing**

### **File**: `backend/src/index.js` (lines 309-370)

### **Code Execution**:

#### **3.1 Authentication & Data Extraction**:
```javascript
app.post('/api/bookings', verifyPrivyAuth, async (c) => {
  const startTime = Date.now()
  const userId = c.get('userId')  // Extracted from JWT: "550e8400-e29b-41d4-a716-446655440001"
  const body = await c.req.json()
  const { 
    service_id: serviceId,      // "550e8400-e29b-41d4-a716-446655440002"
    scheduled_at: scheduledAt,  // "2024-12-01T10:00:00.000Z" 
    customer_notes: customerNotes, // "Looking forward to session"
    location, 
    is_online: isOnline 
  } = body
```

#### **3.2 Service Validation**:
```javascript
const { data: service, error: serviceError } = await supabaseAdmin
  .from('services')
  .select('*')
  .eq('id', serviceId)
  .single()

// service = {
//   id: "550e8400-e29b-41d4-a716-446655440002",
//   provider_id: "550e8400-e29b-41d4-a716-446655440003", 
//   title: "React Tutoring",
//   price: 100,
//   duration_minutes: 60,
//   location: "Online",
//   is_online: true
// }
```

#### **3.3 Conflict Check**:
```javascript
const bookingStart = new Date(scheduledAt)  // 2024-12-01T10:00:00.000Z
const bookingEnd = new Date(bookingStart.getTime() + service.duration_minutes * 60000) // 2024-12-01T11:00:00.000Z

const { data: conflictingBookings } = await supabaseAdmin
  .from('bookings')
  .select('id, scheduled_at, duration_minutes')
  .eq('service_id', serviceId)
  .in('status', ['pending', 'confirmed'])

// Check time overlap logic
const hasConflict = conflictingBookings?.some(booking => {
  const existingStart = new Date(booking.scheduled_at)
  const existingEnd = new Date(existingStart.getTime() + booking.duration_minutes * 60000)
  return (bookingStart < existingEnd && bookingEnd > existingStart)
})
```

#### **3.4 Booking Creation**:
```javascript
const serviceFee = service.price * 0.1  // 100 * 0.1 = 10

const bookingData = {
  service_id: serviceId,                  // "550e8400-e29b-41d4-a716-446655440002"
  customer_id: userId,                    // "550e8400-e29b-41d4-a716-446655440001"
  provider_id: service.provider_id,       // "550e8400-e29b-41d4-a716-446655440003"
  scheduled_at: scheduledAt,              // "2024-12-01T10:00:00.000Z"
  duration_minutes: service.duration_minutes, // 60
  total_price: service.price,             // 100
  service_fee: serviceFee,                // 10
  status: 'pending',                      // Initial status
  customer_notes: customerNotes,          // "Looking forward to session"
  location: location || service.location, // "Online"
  is_online: isOnline ?? service.is_online // true
}

const bookingResult = await supabaseAdmin
  .from('bookings')
  .insert(bookingData)
  .select()
  .single()

// bookingResult.data = {
//   id: "550e8400-e29b-41d4-a716-446655440010",
//   service_id: "550e8400-e29b-41d4-a716-446655440002",
//   customer_id: "550e8400-e29b-41d4-a716-446655440001",
//   provider_id: "550e8400-e29b-41d4-a716-446655440003",
//   scheduled_at: "2024-12-01T10:00:00.000Z",
//   duration_minutes: 60,
//   total_price: 100,
//   service_fee: 10,
//   status: "pending",
//   created_at: "2024-11-01T12:00:00.000Z",
//   ...
// }
```

---

## **STEP 4: Wallet Address Resolution**

### **File**: `backend/src/index.js` (lines 412-434)

#### **4.1 Get Privy User Details**:
```javascript
const privyUserId = c.get('privyUser').userId  // "clp123abc..." from JWT
console.log('🔍 Fetching wallet for Privy user:', privyUserId)

const privyUserDetails = await privyClient.getUser(privyUserId)
// privyUserDetails = {
//   id: "clp123abc...",
//   linkedAccounts: [
//     {
//       type: "smart_wallet",
//       address: "0x1d69ACE8C65C0DFd666bC281145F614d2f22133E"
//     },
//     {
//       type: "wallet", 
//       address: "0x86199F4c6456E564a1aEac0d49a1A876EdB3cAF1"
//     }
//   ]
// }
```

#### **4.2 Extract Wallet Address**:
```javascript
const smartWallet = privyUserDetails.linkedAccounts?.find(acc => acc.type === 'smart_wallet')
const embeddedWallet = privyUserDetails.linkedAccounts?.find(acc => acc.type === 'wallet')

// IMPORTANT: Prioritize smart wallet for blockchain transactions
const customerWallet = smartWallet?.address || embeddedWallet?.address || privyUserDetails.wallet?.address

console.log('💰 Using customer wallet:', customerWallet)
// Output: "0x1d69ACE8C65C0DFd666bC281145F614d2f22133E"
```

---

## **STEP 5: EIP-712 Signature Generation**

### **File**: `backend/src/index.js` (lines 456-482) + `backend/src/eip712-signer.js`

#### **5.1 Calculate Fees**:
```javascript
const hasInviter = false
const feeData = eip712Signer.calculateFees(booking.total_price, hasInviter)
// feeData = {
//   platformFeeRate: 1000,    // 10% in basis points
//   inviterFeeRate: 0,        // 0% in basis points  
//   platformFee: 10,          // 100 * 0.1
//   inviterFee: 0,            // No inviter
//   providerAmount: 90,       // 100 - 10 - 0
//   totalAmount: 100
// }
```

#### **5.2 Generate Blockchain Booking ID**:
```javascript
const blockchainBookingId = blockchainService.formatBookingId(booking.id)
// Converts UUID to bytes32: "0xabc123..." from "550e8400-e29b-41d4-a716-446655440010"
```

#### **5.3 Database Update**:
```javascript
await supabaseAdmin
  .from('bookings')
  .update({
    blockchain_booking_id: blockchainBookingId,  // "0xabc123..."
    status: 'pending_payment'                    // Status change: pending → pending_payment
  })
  .eq('id', booking.id)
```

#### **5.4 EIP-712 Signature Creation** (`backend/src/eip712-signer.js`):
```javascript
const authResult = await eip712Signer.signBookingAuthorization({
  bookingId: booking.id,                  // "550e8400-e29b-41d4-a716-446655440010"
  customer: customerWallet,               // "0x1d69ACE8C65C0DFd666bC281145F614d2f22133E"
  provider: providerWallet,               // "0x1d69ACE8C65C0DFd666bC281145F614d2f22133E" (demo)
  inviter: ethers.ZeroAddress,            // "0x0000000000000000000000000000000000000000"
  amount: booking.total_price,            // 100
  platformFeeRate: feeData.platformFeeRate, // 1000
  inviterFeeRate: feeData.inviterFeeRate, // 0
  expiryMinutes: 5                        // 5 minutes from now
})

// Inside eip712-signer.js signBookingAuthorization():
const expiry = Math.floor(Date.now() / 1000) + (5 * 60)  // Unix timestamp + 300 seconds
const nonce = Date.now() + Math.floor(Math.random() * 1000000)  // 1701428400123

const bookingIdBytes = ethers.keccak256(ethers.toUtf8Bytes(bookingId))  // Convert to bytes32
const amountWei = ethers.parseUnits(amount.toString(), 6)  // Convert to USDC wei (6 decimals)

const authorizationData = {
  bookingId: bookingIdBytes,              // "0xabc123..."
  customer: customerWallet,               // "0x1d69ACE8C65C0DFd666bC281145F614d2f22133E"
  provider: providerWallet,               // "0x1d69ACE8C65C0DFd666bC281145F614d2f22133E"
  inviter: ethers.ZeroAddress,            // "0x0000000000000000000000000000000000000000"
  amount: amountWei,                      // BigInt(100000000) - 100 USDC in wei
  platformFeeRate: 1000,                 // BigInt(1000)
  inviterFeeRate: 0,                      // BigInt(0)
  expiry: expiry,                         // BigInt(1701428700)
  nonce: nonce                            // BigInt(1701428400123)
}

const signature = await this.backendSigner.signTypedData(
  this.domain,  // { name: "BookMe Escrow", version: "1", chainId: 84532, verifyingContract: "0x1D59b8DD..." }
  { BookingAuthorization: this.types.BookingAuthorization },
  authorizationData
)
// signature = "0xdef456789abcdef..." (65 bytes hex string)
```

---

## **STEP 6: Backend Response**

### **File**: `backend/src/index.js` (lines 494-520)

#### **6.1 Data Serialization for JSON**:
```javascript
// Convert BigInt values to strings for JSON serialization
const serializableAuthorization = {
  ...authResult.authorization,
  bookingId: authResult.authorization.bookingId,     // Keep as hex string
  amount: authResult.authorization.amount.toString(), // "100000000"
  platformFeeRate: authResult.authorization.platformFeeRate.toString(), // "1000"
  inviterFeeRate: authResult.authorization.inviterFeeRate.toString(),   // "0"
  expiry: authResult.authorization.expiry.toString(),                    // "1701428700"
  nonce: authResult.authorization.nonce.toString()                       // "1701428400123"
}

return c.json({
  booking: { 
    ...booking, 
    status: 'pending_payment', 
    blockchain_booking_id: blockchainBookingId 
  },
  authorization: serializableAuthorization,
  signature: authResult.signature,
  contractAddress: process.env.CONTRACT_ADDRESS,
  usdcAddress: process.env.USDC_ADDRESS,
  chainId: process.env.CONTRACT_CHAIN_ID
})
```

### **Response Data**:
```json
{
  "booking": {
    "id": "550e8400-e29b-41d4-a716-446655440010",
    "service_id": "550e8400-e29b-41d4-a716-446655440002",
    "customer_id": "550e8400-e29b-41d4-a716-446655440001",
    "provider_id": "550e8400-e29b-41d4-a716-446655440003",
    "scheduled_at": "2024-12-01T10:00:00.000Z",
    "total_price": 100,
    "service_fee": 10,
    "status": "pending_payment",
    "blockchain_booking_id": "0xabc123...",
    "created_at": "2024-11-01T12:00:00.000Z"
  },
  "authorization": {
    "bookingId": "0xabc123...",
    "customer": "0x1d69ACE8C65C0DFd666bC281145F614d2f22133E",
    "provider": "0x1d69ACE8C65C0DFd666bC281145F614d2f22133E",
    "inviter": "0x0000000000000000000000000000000000000000",
    "amount": "100000000",
    "platformFeeRate": "1000",
    "inviterFeeRate": "0",
    "expiry": "1701428700",
    "nonce": "1701428400123"
  },
  "signature": "0xdef456789abcdef...",
  "contractAddress": "0x33ddEd6F8183aa4dAB04E2aE216a5a3f9871405a",
  "usdcAddress": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  "chainId": "84532"
}
```

---

## **STEP 7: Frontend Payment Execution**

### **File**: `src/pages/Profile.tsx` (lines 307-322)

#### **7.1 Extract Response Data**:
```typescript
const { authorization, signature } = await response.json();
console.log('Booking created, starting payment...', { authorization });

// authorization = {
//   bookingId: "0xabc123...",
//   customer: "0x1d69ACE8C65C0DFd666bC281145F614d2f22133E",
//   provider: "0x1d69ACE8C65C0DFd666bC281145F614d2f22133E",
//   inviter: "0x0000000000000000000000000000000000000000",
//   amount: "100000000",  // String representation of BigInt
//   expiry: "1701428700",
//   nonce: "1701428400123"
// }
```

#### **7.2 Initialize Blockchain Service**:
```typescript
await initializeService();
// This calls: blockchainService.setSmartWalletClient(smartWalletClient)
```

#### **7.3 Execute Payment Transaction**:
```typescript
await paymentTransaction.executePayment(async (onStatusChange) => {
  return await blockchainService.payForBooking(
    authorization,
    signature,
    onStatusChange
  );
});
```

---

## **STEP 8: Smart Contract Payment Processing**

### **File**: `src/lib/blockchain-service.ts` (lines 141-258)

#### **8.1 Status Update - Preparing**:
```typescript
onStatusChange?.({
  status: 'preparing',
  message: 'Preparing transaction...'
});
```

#### **8.2 Data Type Conversion**:
```typescript
const formattedAuthorization = {
  bookingId: authorization.bookingId,       // Already hex string: "0xabc123..."
  customer: authorization.customer as `0x${string}`,
  provider: authorization.provider as `0x${string}`,
  inviter: authorization.inviter as `0x${string}`,
  amount: BigInt(authorization.amount),     // "100000000" → BigInt(100000000)
  platformFeeRate: BigInt(authorization.platformFeeRate), // "1000" → BigInt(1000)
  inviterFeeRate: BigInt(authorization.inviterFeeRate),   // "0" → BigInt(0)
  expiry: BigInt(authorization.expiry),     // "1701428700" → BigInt(1701428700)
  nonce: BigInt(authorization.nonce)        // "1701428400123" → BigInt(1701428400123)
}
```

#### **8.3 Transaction Data Encoding**:
```typescript
// Encode smart contract function call
const txData = encodeFunctionData({
  abi: contractABI,
  functionName: 'createAndPayBooking',
  args: [formattedAuthorization, signature]
})

// Encode USDC approval
const approvalData = encodeFunctionData({
  abi: [/* USDC approve function ABI */],
  functionName: 'approve',
  args: [CONTRACT_ADDRESS as `0x${string}`, BigInt(authorization.amount)]
})
```

#### **8.4 Batched Transaction Execution**:
```typescript
onStatusChange?.({
  status: 'prompting',
  message: 'Please confirm the payment transaction...'
});

const txHash = await this.smartWalletClient.sendTransaction({
  calls: [
    // First: Approve USDC spending
    {
      to: USDC_ADDRESS,                    // "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
      data: approvalData,                  // Encoded approve(contractAddress, amount)
      value: 0
    },
    // Second: Execute booking payment
    {
      to: CONTRACT_ADDRESS,                // "0x33ddEd6F8183aa4dAB04E2aE216a5a3f9871405a"
      data: txData,                        // Encoded createAndPayBooking(authorization, signature)
      value: 0
    }
  ]
}, {
  uiOptions: {
    title: 'Complete Booking Payment',
    description: `Pay ${ethers.formatUnits(authorization.amount, 6)} USDC for your booking`,
    buttonText: 'Confirm Payment'
  }
})

// txHash = "0x9ceb8b7de0493838924862f36a2440d0d4875780b673136cacac9a0daf2f9759"
```

#### **8.5 Transaction Confirmation**:
```typescript
onStatusChange?.({
  status: 'pending',
  message: 'Transaction submitted. Waiting for confirmation...',
  txHash: txHash
});

// Privy smart wallets auto-confirm transactions
onStatusChange?.({
  status: 'success',
  message: 'Payment successful! Booking confirmed.',
  txHash: txHash
});

return txHash;  // "0x9ceb8b7de0493838924862f36a2440d0d4875780b673136cacac9a0daf2f9759"
```

---

## **STEP 9: Smart Contract Execution**

### **File**: `contracts/src/BookingEscrow.sol`

#### **9.1 Contract Function Called**:
```solidity
function createAndPayBooking(
    BookingAuthorization calldata auth,
    bytes calldata signature
) external nonReentrant whenNotPaused {
    // auth = {
    //   bookingId: 0xabc123...,
    //   customer: 0x1d69ACE8C65C0DFd666bC281145F614d2f22133E,
    //   provider: 0x1d69ACE8C65C0DFd666bC281145F614d2f22133E,
    //   inviter: 0x0000000000000000000000000000000000000000,
    //   amount: 100000000,  // 100 USDC in wei
    //   platformFeeRate: 1000,
    //   inviterFeeRate: 0,
    //   expiry: 1701428700,
    //   nonce: 1701428400123
    // }
    // signature = 0xdef456789abcdef...
```

#### **9.2 Signature Validation**:
```solidity
// Verify signature is from authorized backend signer
bytes32 structHash = keccak256(abi.encode(BOOKING_AUTHORIZATION_TYPEHASH, auth));
bytes32 hash = _hashTypedDataV4(structHash);
address signer = ECDSA.recover(hash, signature);
require(signer == authorizedSigner, "Invalid signature");

// Check expiry and nonce
require(block.timestamp <= auth.expiry, "Authorization expired");
require(!usedNonces[auth.nonce], "Nonce already used");
usedNonces[auth.nonce] = true;
```

#### **9.3 USDC Transfer**:
```solidity
// Transfer USDC from customer to contract escrow
bool success = IERC20(USDC_TOKEN).transferFrom(
    auth.customer,      // 0x1d69ACE8C65C0DFd666bC281145F614d2f22133E
    address(this),      // Contract address for escrow
    auth.amount         // 100000000 (100 USDC)
);
require(success, "USDC transfer failed");
```

#### **9.4 Booking Storage & Event Emission**:
```solidity
// Store booking in contract state
bookings[auth.bookingId] = Booking({
    id: auth.bookingId,
    customer: auth.customer,
    provider: auth.provider,  
    inviter: auth.inviter,
    amount: auth.amount,
    platformFeeRate: auth.platformFeeRate,
    inviterFeeRate: auth.inviterFeeRate,
    status: BookingStatus.Paid,
    createdAt: block.timestamp
});

// Emit event for off-chain monitoring
emit BookingCreatedAndPaid(
    auth.bookingId,        // 0xabc123...
    auth.customer,         // 0x1d69ACE8C65C0DFd666bC281145F614d2f22133E
    auth.provider,         // 0x1d69ACE8C65C0DFd666bC281145F614d2f22133E
    auth.inviter,          // 0x0000000000000000000000000000000000000000
    auth.amount,           // 100000000
    auth.platformFeeRate,  // 1000
    auth.inviterFeeRate    // 0
);
```

---

## **STEP 10: Event Detection & Processing**

### **File**: `backend/src/event-monitor.js` (lines 111-132)

#### **10.1 WebSocket Event Detection**:
```javascript
// Event listener catches the emitted event
this.contract.on("BookingCreatedAndPaid", async (
  bookingId, customer, provider, inviter, amount, platformFeeRate, inviterFeeRate, event
) => {
  console.log('🔍 Raw event object:', event);
  console.log('🔍 Transaction hash:', event.transactionHash);
  
  // event = {
  //   transactionHash: "0x9ceb8b7de0493838924862f36a2440d0d4875780b673136cacac9a0daf2f9759",
  //   blockNumber: 5234567,
  //   logIndex: 0,
  //   args: [bookingId, customer, provider, inviter, amount, platformFeeRate, inviterFeeRate]
  // }
  
  await this.queueEvent({
    type: 'BookingCreatedAndPaid',
    bookingId,                              // 0xabc123...
    customer,                               // 0x1d69ACE8C65C0DFd666bC281145F614d2f22133E
    provider,                               // 0x1d69ACE8C65C0DFd666bC281145F614d2f22133E
    inviter,                                // 0x0000000000000000000000000000000000000000
    amount: amount.toString(),              // "100000000"
    platformFeeRate: platformFeeRate.toString(), // "1000"
    inviterFeeRate: inviterFeeRate.toString(),   // "0"
    transactionHash: event.transactionHash || event.log?.transactionHash,
    blockNumber: event.blockNumber || event.log?.blockNumber,
    logIndex: event.logIndex || event.log?.logIndex,
    timestamp: Date.now()                   // 1701428500000
  });
});
```

#### **10.2 Redis Queue Processing**:
```javascript
// Queue event in Redis for reliable processing
await this.redis.lpush(this.eventQueue, JSON.stringify(eventData));

// Event processor picks up from queue
const eventJson = await this.redis.brpop(this.eventQueue, 1);
const eventData = JSON.parse(eventJson[1]);

await this.processEvent(eventData);
```

#### **10.3 Database Update** (`processEvent` → `handleBookingPaid`):
```javascript
// Find booking by blockchain_booking_id  
const { data: booking, error } = await this.supabaseAdmin
  .from('bookings')
  .select()
  .eq('blockchain_booking_id', eventData.bookingId)  // 0xabc123...
  .single()

// booking = {
//   id: "550e8400-e29b-41d4-a716-446655440010",
//   blockchain_booking_id: "0xabc123...",
//   status: "pending_payment",
//   total_price: 100,
//   service_fee: 10,
//   customer_id: "550e8400-e29b-41d4-a716-446655440001",
//   provider_id: "550e8400-e29b-41d4-a716-446655440003",
//   created_at: "2024-11-01T12:00:00.000Z"
// }

// Update booking status: pending_payment → paid
const { error: updateError } = await this.supabaseAdmin
  .from('bookings')
  .update({
    status: 'paid',                                    // Status change!
    blockchain_tx_hash: eventData.transactionHash,    // "0x9ceb8b7de0493838924862f36a2440d0d4875780b673136cacac9a0daf2f9759"
    blockchain_confirmed_at: new Date().toISOString(), // "2024-11-01T12:05:00.000Z"
    blockchain_data: {
      amount: eventData.amount,                        // "100000000"
      platformFeeRate: eventData.platformFeeRate,     // "1000"
      inviterFeeRate: eventData.inviterFeeRate,       // "0"
      customer: eventData.customer,                    // "0x1d69ACE8C65C0DFd666bC281145F614d2f22133E"
      provider: eventData.provider,                    // "0x1d69ACE8C65C0DFd666bC281145F614d2f22133E"
      inviter: eventData.inviter                       // "0x0000000000000000000000000000000000000000"
    }
  })
  .eq('id', booking.id)
  
console.log('💰 Updated booking payment status:', booking.id);
```

---

## **STEP 11: Frontend Status Update**

### **User sees booking status change from "Payment Required" to "Pending Provider's Confirmation"**

#### **Frontend Booking Display** (`src/pages/customer/CustomerBookings.tsx`):
```typescript
// Database polling or real-time subscription detects status change
// booking.status changed from "pending_payment" to "paid"

// UI displays updated status
{booking.status === 'paid' && 'Pending Provider\'s Confirmation'}
```

---

## **Data Flow Summary**

### **Request Data Transformations**:
1. **Form Data** → **Booking Request** (Frontend)
2. **Booking Request** → **Database Record** (Backend) 
3. **Database Record** → **EIP-712 Authorization** (Backend)
4. **EIP-712 Authorization** → **Smart Contract Call** (Frontend)
5. **Smart Contract Call** → **Blockchain Event** (Smart Contract)
6. **Blockchain Event** → **Database Update** (Event Monitor)

### **Response Data Usage**:
1. **Booking Creation Response** → **Payment Authorization** (Backend → Frontend)
2. **Payment Authorization** → **Transaction Parameters** (Frontend → Smart Contract)
3. **Transaction Hash** → **User Confirmation** (Smart Contract → Frontend)
4. **Blockchain Event** → **Status Update** (Event Monitor → Database → Frontend)

This technical flow shows exactly how data flows through each component, how it's transformed at each step, and how the responses from one step become the inputs to the next step in the booking process.
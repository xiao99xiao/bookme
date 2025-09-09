# BookMe Smart Contracts - Product Requirements Document

## 📋 Executive Summary

The BookMe smart contract system provides a decentralized escrow solution for service bookings on the Base blockchain. It ensures secure payment handling, fair fund distribution, and dispute resolution while maintaining flexibility for future enhancements.

## 🎯 Objectives

- **Security**: Protect all parties with battle-tested escrow mechanisms
- **Flexibility**: Support configurable fee structures and service types  
- **Expandability**: Architecture ready for future features (disputes, multi-token, etc.)
- **Simplicity**: Clear state transitions and minimal complexity
- **Transparency**: Full on-chain audit trail for all transactions

## 👥 Stakeholders & Roles

### 1. **Smart Contract** 
- **Role**: Autonomous escrow and fund distribution
- **Responsibilities**: Hold USDC, execute distributions, enforce rules
- **Trust Level**: Trustless (governed by immutable code)

### 2. **Backend Server**
- **Role**: Trusted orchestrator and bridge to off-chain data
- **Responsibilities**: Create bookings, provide fee rates, mark service status
- **Trust Level**: Trusted (controlled by platform)

### 3. **Customer (Wallet)**
- **Role**: Service purchaser and payment initiator  
- **Responsibilities**: Pay for services, confirm completion
- **Trust Level**: Self-interested party

### 4. **Provider (Wallet)**
- **Role**: Service provider and earnings recipient
- **Responsibilities**: Deliver services, handle cancellations
- **Trust Level**: Self-interested party

### 5. **Provider's Inviter (Wallet)** - *Optional*
- **Role**: Referral partner earning commissions (when applicable)
- **Responsibilities**: Refer providers to platform
- **Trust Level**: Self-interested party
- **Note**: Not all providers have inviters; this role is optional

### 6. **Platform Fee Wallet**
- **Role**: Platform revenue collection
- **Responsibilities**: Receive platform fees
- **Trust Level**: Platform-controlled

## 💰 Core Payment Flow

### Happy Path: Service Completion
```
1. Backend signs booking authorization with service details
2. Customer creates booking + pays in ONE transaction using signed data → Smart Contract (ESCROWED)
3. Provider delivers service off-chain
4. Customer marks service as completed → Smart Contract distributes:
   - Provider: 70-90% (configurable)
   - Platform: 5-20% (configurable)
   - Inviter: 0-10% (configurable, only if inviter exists)
```

### Cancellation Paths

#### Provider Cancellation (Backend-Signed)
```
1. Backend creates CancellationAuthorization with distribution amounts
2. Provider calls cancelBookingAsProvider() with backend signature and auth data
3. Smart Contract verifies backend signature and distributes USDC according to auth:
   - Example A: 100% to Customer (early cancellation)
   - Example B: 50% Customer, 50% Provider (late cancellation with penalty)
   - Example C: 90% Provider, 5% Platform, 5% Inviter (provider emergency with partial fees)
4. Platform + inviter fees limited to max 20% of total amount
```

#### Customer Cancellation (Backend-Signed)
```
1. Backend creates CancellationAuthorization with distribution amounts
2. Customer calls cancelBookingAsCustomer() with backend signature and auth data
3. Smart Contract verifies backend signature and distributes USDC according to auth:
   - Example A: 80% to Customer, 20% to Provider (early customer cancellation)
   - Example B: 60% Customer, 30% Provider, 10% Platform (late customer cancellation)
4. Platform + inviter fees limited to max 20% of total amount
```

#### Backend Emergency Cancellation
```
1. Backend detects issue (fraud, compliance, error)
2. Backend cancels booking with reason code
3. Smart Contract returns 100% of USDC to Customer
4. Event emitted with cancellation reason for transparency
```

## 🏗️ Smart Contract Architecture

### Core Contract: `BookingEscrow.sol`

#### State Variables
```solidity
struct Booking {
    bytes32 id;              // Unique booking identifier
    address customer;        // Customer wallet address
    address provider;        // Provider wallet address  
    address inviter;         // Inviter wallet (address(0) if no inviter)
    uint256 amount;          // USDC amount in wei
    uint256 platformFeeRate; // Platform fee rate for this booking (basis points)
    uint256 inviterFeeRate;  // Inviter fee rate for this booking (basis points)
    BookingStatus status;    // Current booking state
    uint256 createdAt;      // Block timestamp when booking was created
    // Note: No expiry field needed - authorization expiry is only for signature validation
}

struct BookingAuthorization {
    bytes32 bookingId;
    address customer;
    address provider;
    address inviter;
    uint256 amount;
    uint256 platformFeeRate;
    uint256 inviterFeeRate;
    uint256 expiry;          // Signature expiry timestamp - must be > block.timestamp
    uint256 nonce;           // Global nonce from backend to prevent replay attacks
}

struct CancellationAuthorization {
    bytes32 bookingId;
    uint256 customerAmount;  // Amount to send to customer (wei)
    uint256 providerAmount;  // Amount to send to provider (wei)
    uint256 platformAmount;  // Amount to send to platform (wei)
    uint256 inviterAmount;   // Amount to send to inviter (wei)
    string reason;           // Cancellation reason code
    uint256 expiry;          // Signature expiry timestamp - must be > block.timestamp
    uint256 nonce;           // Global nonce from backend to prevent replay attacks
}

enum BookingStatus {
    Paid,        // Customer paid, funds escrowed (initial state)
    Completed,   // Service done, funds distributed
    Cancelled,   // Provider cancelled, funds returned
    Disputed     // Future: under dispute resolution
}

// Nonce management for replay protection
mapping(uint256 => bool) public usedNonces;  // Track used nonces globally
uint256 public currentNonce;                 // Current backend nonce counter

// Access control
address public owner;                        // Contract owner (can set critical parameters)
address public backendSigner;               // Authorized backend signer address
address public platformFeeWallet;           // Receives platform fees
bool public paused;                          // Emergency pause state
```

#### Key Functions

**For Backend (Off-chain Signing)**
```solidity
// Backend signs BookingAuthorization struct off-chain using EIP-712
// No on-chain function needed - just signature generation
```

**For Customers**
```solidity
// Create booking and pay in ONE transaction with backend signature
function createAndPayBooking(
    BookingAuthorization calldata auth,
    bytes calldata signature
) external {
    // Verify signature not expired and nonce not used
    require(auth.expiry > block.timestamp, "Authorization expired");
    require(!usedNonces[auth.nonce], "Nonce already used");
    
    // Validate fee rates don't exceed limits
    require(auth.platformFeeRate <= MAX_PLATFORM_FEE, "Platform fee too high");
    require(auth.inviterFeeRate <= MAX_INVITER_FEE, "Inviter fee too high");
    require(
        auth.platformFeeRate + auth.inviterFeeRate <= MAX_TOTAL_FEE,
        "Combined fees exceed maximum"
    );
    
    // Verify backend signature using EIP-712 (must be from backendSigner address)
    _verifyBackendSignature(auth, signature);
    
    // Create booking with authorized data
    // Transfer USDC from customer
    // Mark nonce as used
    usedNonces[auth.nonce] = true;
    
    // Mark as PAID status
}

function completeService(bytes32 bookingId) external
```

**For Customers**
```solidity
// Customer cancellation requires backend signature for distribution
function cancelBookingAsCustomer(
    bytes32 bookingId,
    CancellationAuthorization calldata auth,
    bytes calldata signature
) external
```

**For Providers** 
```solidity
// Provider cancellation requires backend signature for distribution
function cancelBookingAsProvider(
    bytes32 bookingId,
    CancellationAuthorization calldata auth,
    bytes calldata signature
) external
```

**For Backend (Emergency Actions)**
```solidity
// Backend can cancel bookings in emergency situations
function emergencyCancelBooking(
    bytes32 bookingId,
    string calldata reason
) external onlyBackend
```

**For Platform Owner**
```solidity
// Critical parameter updates (requires owner)
function setPlatformFeeWallet(address newWallet) external onlyOwner {
    require(newWallet != address(0), "Invalid wallet address");
    platformFeeWallet = newWallet;
}

function setBackendSigner(address newSigner) external onlyOwner {
    require(newSigner != address(0), "Invalid signer address");
    backendSigner = newSigner;
}

// Emergency controls
function pause() external onlyOwner {
    paused = true;
}

function unpause() external onlyOwner {
    paused = false;
}

// Ownership transfer (2-step for safety)
function transferOwnership(address newOwner) external onlyOwner {
    require(newOwner != address(0), "Invalid owner address");
    // Implementation would use 2-step transfer pattern
}

// View functions
function getContractInfo() external view returns (
    address currentOwner,
    address currentBackendSigner,
    address currentPlatformWallet,
    bool isPaused
) {
    return (owner, backendSigner, platformFeeWallet, paused);
}
```

**Internal Helper Functions**
```solidity
function _verifyBackendSignature(
    BookingAuthorization calldata auth,
    bytes calldata signature
) internal view {
    // Recover signer from EIP-712 signature
    address recoveredSigner = _recoverSigner(auth, signature);
    require(recoveredSigner == backendSigner, "Invalid backend signature");
}

modifier onlyOwner() {
    require(msg.sender == owner, "Not the owner");
    _;
}

modifier whenNotPaused() {
    require(!paused, "Contract is paused");
    _;
}
```

#### Events
```solidity
event BookingCreatedAndPaid(
    bytes32 indexed bookingId, 
    address customer, 
    address provider, 
    address inviter,
    uint256 amount, 
    uint256 platformFeeRate, 
    uint256 inviterFeeRate
);

event ServiceCompleted(
    bytes32 indexed bookingId, 
    uint256 providerAmount, 
    uint256 platformFee, 
    uint256 inviterFee
);

event BookingCancelled(
    bytes32 indexed bookingId, 
    address cancelledBy,     // Who initiated the cancellation
    uint256 customerAmount, 
    uint256 providerAmount, 
    uint256 platformAmount, 
    uint256 inviterAmount, 
    string reason
);

// Administrative events
event BackendSignerUpdated(address indexed oldSigner, address indexed newSigner);
event PlatformFeeWalletUpdated(address indexed oldWallet, address indexed newWallet);
event ContractPaused(address indexed by);
event ContractUnpaused(address indexed by);
event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
```

## 🔐 Signature-Based Authorization Flow

### Overview
We use **EIP-712 typed data signing** for secure backend-authorized operations:

#### Booking Creation Flow
1. **Backend Creates BookingAuthorization**
   - Backend server prepares `BookingAuthorization` struct with all booking details
   - Signs the data using backend's private key (EIP-712 standard)
   - Sends signature + data to frontend

2. **Frontend/Customer Executes**
   - Customer reviews booking details in wallet
   - Calls `createAndPayBooking()` with authorization + signature
   - Contract verifies signature is from authorized backend
   - Creates booking and transfers USDC in single transaction

#### Cancellation Flows (Provider & Customer)
1. **Backend Creates CancellationAuthorization**
   - Backend determines appropriate fund distribution based on cancellation timing/reason and initiator
   - Prepares `CancellationAuthorization` struct with specific amounts for each party
   - Signs the data using backend's private key (EIP-712 standard)
   - Sends signature + data to frontend

2. **Frontend/User Executes**
   - Provider calls `cancelBookingAsProvider()` OR Customer calls `cancelBookingAsCustomer()`
   - User reviews cancellation terms in wallet
   - Contract verifies signature is from authorized backend
   - Contract validates nonce not used and signature not expired
   - Distributes funds according to backend-specified amounts (max 20% to platform+inviter)

### Benefits
- **One Transaction**: Better UX, lower total gas cost for bookings
- **Atomic Operations**: Booking creation/payment and cancellations can't be separated
- **Backend Control**: Only backend-signed operations are accepted
- **Flexible Cancellation**: Different distribution rules based on circumstances
- **Expiry Protection**: Signatures expire to prevent stale operations
- **Replay Protection**: Global nonce system prevents signature reuse

### Nonce Management System
Backend maintains a sequential nonce counter and tracks used nonces:
```solidity
// Backend generates increasing nonces: 1, 2, 3, 4...
// Contract tracks used nonces to prevent replay attacks
function _validateNonce(uint256 nonce) internal {
    require(!usedNonces[nonce], "Nonce already used");
    usedNonces[nonce] = true;
}
```

**Benefits**:
- **Global Scope**: One nonce system for all operations (booking, cancellation)
- **Sequential**: Backend can use simple incrementing counter  
- **Efficient**: Single mapping lookup for validation
- **Permanent**: Once used, nonce cannot be reused (prevents replay attacks)

### EIP-712 Domain
```solidity
EIP712Domain({
    name: "BookMe Escrow",
    version: "1",
    chainId: 84532,  // Base Sepolia (or 8453 for Base mainnet)
    verifyingContract: address(this)
})
```

## 🔒 Security Considerations

### 1. **Access Control**
- **Owner-Only Functions**: Critical parameters (backend signer, fee wallet) only changeable by owner
- **Backend Signature Verification**: Only authorized backend signer can create valid authorizations
- **2-Step Ownership Transfer**: Prevents accidental ownership transfer
- **Emergency Pause**: Owner can pause all operations in emergencies
- **EIP-712 Standard**: Type-safe signature verification prevents manipulation

### 2. **Reentrancy Protection**
- **ReentrancyGuard**: Prevent recursive calls during fund transfers
- **Checks-Effects-Interactions**: Proper ordering of state changes and external calls

### 3. **Input Validation**
- **Address Validation**: Ensure non-zero addresses for all parties
- **Amount Validation**: Verify positive amounts and sufficient balances
- **State Validation**: Enforce proper booking state transitions

### 4. **Emergency Controls**
- **Pausable**: Emergency stop functionality for critical issues
- **Upgradeable Proxy**: Allow bug fixes without losing escrowed funds
- **Time Locks**: Delayed execution for critical parameter changes

### 5. **Economic Security**
- **Fee Bounds**: Platform and inviter fees capped at reasonable maximums
- **Overflow Protection**: Use OpenZeppelin SafeMath or Solidity 0.8+ built-ins
- **Front-Running Protection**: Minimize MEV opportunities

## 📊 Fee Structure & Distribution

### Dynamic Fee Rates Per Booking
Each booking can have its own fee rates, allowing for:
- **Promotional Rates**: Reduced fees for new providers or special campaigns
- **Premium Services**: Higher platform fees for premium service categories
- **Volume Discounts**: Lower fees for high-volume providers
- **Special Partnerships**: Custom fee structures for strategic partners

### Fee Rate Limits
```solidity
uint256 public constant MAX_PLATFORM_FEE = 2000; // 20% maximum
uint256 public constant MAX_INVITER_FEE = 1000;  // 10% maximum
uint256 public constant MAX_TOTAL_FEE = 3000;    // 30% maximum combined

// Cancellation distribution limits
uint256 public constant MAX_CANCELLATION_NON_PARTIES = 2000; // 20% max to platform+inviter on cancellations
```

### Distribution Logic
```solidity
function _distributeFunds(bytes32 bookingId) internal {
    Booking storage booking = bookings[bookingId];
    uint256 totalAmount = booking.amount;
    
    // Use booking-specific fee rates (set during booking creation)
    uint256 platformFee = (totalAmount * booking.platformFeeRate) / 10000;
    
    // Only calculate inviter fee if inviter exists
    uint256 inviterFee = 0;
    if (booking.inviter != address(0)) {
        inviterFee = (totalAmount * booking.inviterFeeRate) / 10000;
    }
    
    uint256 providerAmount = totalAmount - platformFee - inviterFee;
    
    // Transfer funds
    USDC.transfer(booking.provider, providerAmount);
    USDC.transfer(platformFeeWallet, platformFee);
    
    // Only transfer to inviter if they exist and have a fee
    if (inviterFee > 0 && booking.inviter != address(0)) {
        USDC.transfer(booking.inviter, inviterFee);
    }
}

function _distributeCancellationFunds(
    bytes32 bookingId,
    CancellationAuthorization calldata auth
) internal {
    Booking storage booking = bookings[bookingId];
    
    // Validate total distribution equals escrowed amount
    uint256 totalDistribution = auth.customerAmount + auth.providerAmount + 
                               auth.platformAmount + auth.inviterAmount;
    require(totalDistribution == booking.amount, "Invalid distribution amounts");
    
    // Validate cancellation limits: platform + inviter cannot exceed 20% of total
    uint256 nonPartiesAmount = auth.platformAmount + auth.inviterAmount;
    require(
        nonPartiesAmount <= (booking.amount * MAX_CANCELLATION_NON_PARTIES) / 10000,
        "Cancellation fees exceed 20% limit"
    );
    
    // Transfer funds according to backend authorization
    if (auth.customerAmount > 0) {
        USDC.transfer(booking.customer, auth.customerAmount);
    }
    if (auth.providerAmount > 0) {
        USDC.transfer(booking.provider, auth.providerAmount);
    }
    if (auth.platformAmount > 0) {
        USDC.transfer(platformFeeWallet, auth.platformAmount);
    }
    if (auth.inviterAmount > 0 && booking.inviter != address(0)) {
        USDC.transfer(booking.inviter, auth.inviterAmount);
    }
}
```

## 🔄 State Transition Diagram

```
    [Backend Signs Authorization]
        ↓ 
    [Customer: createAndPayBooking()]
        ↓
    Paid ←→ Cancelled [cancelBookingAsProvider() or cancelBookingAsCustomer() with backend signature]
        ↓ completeService() [Customer]
    Completed

Future: Paid → Disputed → Resolved
```

Note: No "Created" state needed - booking goes directly to "Paid" status

## 🛡️ Error Handling & Edge Cases

### 1. **Invalid State Transitions**
- **Prevention**: Strict state validation in all functions
- **Response**: Revert with clear error messages

### 2. **Insufficient Balances** 
- **Detection**: Check customer USDC balance before payment
- **Response**: Revert with balance requirement message

### 3. **Dynamic Fee Rates Per Booking**
- **Solution**: Each booking stores its own fee rates at creation time
- **Benefit**: Flexibility for promotions, volume discounts, premium services
- **Guarantee**: Fee rates locked at booking creation, no surprises mid-service

### 4. **Zero Address Handling**
- **Validation**: Require non-zero addresses for customer/provider
- **Flexibility**: Allow zero inviter address (no referral for that provider)
- **Logic**: Skip inviter fee calculation and distribution when inviter is address(0)

### 5. **Contract Upgrade Scenarios**
- **Approach**: Transparent proxy pattern with timelock
- **Safety**: Preserve escrowed funds during upgrades

## 🚀 Future Enhancements

### Phase 2: Dispute Resolution
```solidity
enum DisputeStatus { None, Raised, UnderReview, Resolved }

struct Dispute {
    bytes32 bookingId;
    address initiator;    // Customer or provider
    string reason;        // IPFS hash of dispute details
    DisputeStatus status;
    address arbitrator;   // Assigned dispute resolver
}
```

### Phase 3: Multi-Token Support
- Support for multiple ERC20 tokens (USDC, USDT, DAI)
- Dynamic token pricing via oracle integration
- Token-specific fee structures

### Phase 4: Advanced Features
- **Partial Payments**: Split bookings into milestones
- **Recurring Services**: Subscription-based bookings
- **Insurance Integration**: Optional service insurance
- **Reputation System**: On-chain provider ratings

### Phase 5: Cross-Chain Expansion
- **Polygon Support**: Lower fees for small transactions
- **Ethereum Mainnet**: High-value service bookings
- **Cross-Chain Bridges**: Seamless multi-chain experience

## 📋 Implementation Phases

### Phase 1: Core MVP (Current)
- [x] Basic escrow functionality
- [x] Payment and distribution logic
- [x] Cancellation handling
- [x] Role-based access control
- [x] Event emission for transparency

### Phase 2: Enhanced Security
- [ ] Multi-signature wallet integration
- [ ] Time-locked parameter updates
- [ ] Advanced testing and auditing
- [ ] Mainnet deployment preparation

### Phase 3: Advanced Features
- [ ] Dispute resolution system
- [ ] Multi-token support
- [ ] Partial payment milestones
- [ ] Reputation integration

## 🔍 Testing Strategy

### Unit Tests
- State transition validation
- Access control enforcement
- Fee calculation accuracy
- Error condition handling

### Integration Tests  
- End-to-end booking flows
- Backend server interaction
- Multi-party payment scenarios
- Edge case validation

### Security Audits
- Professional smart contract audit
- Formal verification of critical functions
- Economic attack vector analysis
- Gas optimization review

## 📈 Success Metrics

### Technical Metrics
- **Zero Critical Bugs**: No funds lost to smart contract vulnerabilities
- **High Uptime**: 99.9%+ availability on Base network
- **Gas Efficiency**: Optimize for Base's low-cost environment

### Business Metrics  
- **Transaction Volume**: Total USDC processed through escrow
- **User Adoption**: Number of unique booking participants
- **Platform Revenue**: Fees collected via smart contract

### Security Metrics
- **Audit Score**: Clean reports from reputable auditors  
- **Bug Bounty**: Active program with zero critical findings
- **Upgrade Safety**: Successful proxy upgrades without fund loss

## 🎯 Conclusion

The BookMe smart contract system provides a robust, secure, and flexible foundation for decentralized service booking escrow. With careful attention to security, clear state management, and extensible architecture, it will serve as the trustless backbone for the BookMe platform's growth and evolution.

The phased implementation approach ensures we can deliver value quickly while building towards a comprehensive feature set that supports the platform's long-term vision of becoming the premier decentralized marketplace for professional services.
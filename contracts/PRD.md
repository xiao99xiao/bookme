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
1. Backend creates booking with service details
2. Customer pays exact USDC amount → Smart Contract (ESCROWED)
3. Provider delivers service off-chain
4. Customer marks service as completed → Smart Contract distributes:
   - Provider: 70-90% (configurable)
   - Platform: 5-20% (configurable)
   - Inviter: 0-10% (configurable, only if inviter exists)
```

### Cancellation Path: Provider Cancels
```
1. Provider cancels booking before service delivery
2. Smart Contract returns 100% of USDC to Customer
3. No fees charged to anyone
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
    uint256 createdAt;      // Block timestamp
}

enum BookingStatus {
    Created,     // Initial state
    Paid,        // Customer paid, funds escrowed
    Completed,   // Service done, funds distributed
    Cancelled,   // Provider cancelled, funds returned
    Disputed     // Future: under dispute resolution
}
```

#### Key Functions

**For Backend (Trusted Role)**
```solidity
function createBooking(
    bytes32 bookingId,
    address customer,
    address provider, 
    address inviter,         // Can be address(0) if no inviter
    uint256 amount,
    uint256 platformFeeRate, // Dynamic fee rate for this booking
    uint256 inviterFeeRate   // Dynamic fee rate for this booking
) external onlyBackend
```

**For Customers**
```solidity
function payForBooking(bytes32 bookingId) external
function completeService(bytes32 bookingId) external
```

**For Providers** 
```solidity
function cancelBooking(bytes32 bookingId) external
```

**For Platform Owner**
```solidity
function setPlatformFeeWallet(address newWallet) external onlyOwner
function pause() external onlyOwner  
function unpause() external onlyOwner
```

#### Events
```solidity
event BookingCreated(
    bytes32 indexed bookingId, 
    address customer, 
    address provider, 
    uint256 amount, 
    uint256 platformFeeRate, 
    uint256 inviterFeeRate
);
event BookingPaid(bytes32 indexed bookingId, uint256 amount);
event ServiceCompleted(bytes32 indexed bookingId, uint256 providerAmount, uint256 platformFee, uint256 inviterFee);
event BookingCancelled(bytes32 indexed bookingId, uint256 refundAmount);
```

## 🔒 Security Considerations

### 1. **Access Control**
- **Role-Based Access**: Only authorized addresses can perform specific actions
- **Multi-Signature**: Platform owner functions require multi-sig for production
- **Backend Authentication**: Backend server has special trusted role

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
```

## 🔄 State Transition Diagram

```
    [Backend]
        ↓ createBooking()
    Created
        ↓ payForBooking() [Customer]
    Paid ←→ Cancelled [cancelBooking() by Provider]
        ↓ completeService() [Customer]
    Completed

Future: Paid → Disputed → Resolved
```

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
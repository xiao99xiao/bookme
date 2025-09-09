# BookMe Smart Contract Implementation Plan

## 📋 Overview
This document outlines the detailed implementation plan for the BookMe escrow smart contract system based on the PRD specifications. The implementation follows a test-driven development (TDD) approach.

## 🎯 Implementation Phases

### Phase 1: Core Contract Structure
**Timeline**: 1-2 hours
**Deliverables**:
1. Basic contract structure with imports
2. State variables and structs
3. Events definition
4. Access control modifiers
5. Constructor and initialization

**Files to Create**:
- `src/BookingEscrow.sol` - Main escrow contract
- `test/BookingEscrow.t.sol` - Test suite
- `script/Deploy.s.sol` - Deployment script

### Phase 2: EIP-712 Signature System
**Timeline**: 2-3 hours
**Deliverables**:
1. EIP-712 domain setup
2. Signature verification functions
3. Hash generation for structs
4. Signature recovery logic

**Key Functions**:
- `_verifyBookingAuthorization()`
- `_verifyCancellationAuthorization()`
- `_recoverSigner()`

### Phase 3: Core Booking Functions
**Timeline**: 2-3 hours
**Deliverables**:
1. `createAndPayBooking()` - Main booking creation
2. `completeService()` - Service completion
3. Fund distribution logic
4. Nonce management

**Key Functions**:
- `createAndPayBooking()`
- `completeService()`
- `_distributeFunds()`
- `_validateNonce()`

### Phase 4: Cancellation System
**Timeline**: 2-3 hours
**Deliverables**:
1. Provider cancellation function
2. Customer cancellation function
3. Backend emergency cancellation
4. Flexible fund distribution

**Key Functions**:
- `cancelBookingAsProvider()`
- `cancelBookingAsCustomer()`
- `emergencyCancelBooking()`
- `_distributeCancellationFunds()`

### Phase 5: Administrative Functions
**Timeline**: 1-2 hours
**Deliverables**:
1. Owner management functions
2. Platform configuration
3. Emergency controls
4. View functions

**Key Functions**:
- `setPlatformFeeWallet()`
- `setBackendSigner()`
- `pause()` / `unpause()`
- `getContractInfo()`

### Phase 6: Comprehensive Testing
**Timeline**: 3-4 hours
**Deliverables**:
1. Unit tests for all functions
2. Integration tests for complete flows
3. Edge case testing
4. Security vulnerability testing

## 🔧 Technical Implementation Details

### Contract Dependencies
```solidity
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
```

### Key Constants
```solidity
uint256 public constant MAX_PLATFORM_FEE = 2000; // 20%
uint256 public constant MAX_INVITER_FEE = 1000;  // 10%
uint256 public constant MAX_TOTAL_FEE = 3000;    // 30%
uint256 public constant MAX_CANCELLATION_NON_PARTIES = 2000; // 20%
```

### State Variables Structure
```solidity
// Core state
IERC20 public immutable USDC;
mapping(bytes32 => Booking) public bookings;
mapping(uint256 => bool) public usedNonces;

// Access control
address public owner;
address public backendSigner;
address public platformFeeWallet;
bool public paused;
```

### EIP-712 Type Hashes
```solidity
bytes32 private constant BOOKING_AUTHORIZATION_TYPEHASH = keccak256(
    "BookingAuthorization(bytes32 bookingId,address customer,address provider,address inviter,uint256 amount,uint256 platformFeeRate,uint256 inviterFeeRate,uint256 expiry,uint256 nonce)"
);

bytes32 private constant CANCELLATION_AUTHORIZATION_TYPEHASH = keccak256(
    "CancellationAuthorization(bytes32 bookingId,uint256 customerAmount,uint256 providerAmount,uint256 platformAmount,uint256 inviterAmount,string reason,uint256 expiry,uint256 nonce)"
);
```

## 🧪 Test Strategy

### Test Categories
1. **Unit Tests** - Individual function testing
2. **Integration Tests** - End-to-end flows
3. **Security Tests** - Attack vectors and edge cases
4. **Gas Optimization Tests** - Gas usage analysis

### Test Scenarios

#### Booking Creation Tests
- ✅ Valid booking creation with all parameters
- ✅ Invalid signature rejection
- ✅ Expired authorization rejection
- ✅ Used nonce rejection
- ✅ Excessive fee rates rejection
- ✅ Zero address validation
- ✅ Insufficient USDC balance handling

#### Service Completion Tests
- ✅ Valid service completion by customer
- ✅ Unauthorized completion attempts
- ✅ Already completed booking rejection
- ✅ Correct fund distribution
- ✅ Inviter fee handling (with/without inviter)

#### Cancellation Tests
- ✅ Provider cancellation with valid auth
- ✅ Customer cancellation with valid auth
- ✅ Backend emergency cancellation
- ✅ Cancellation fee limits (max 20%)
- ✅ Invalid cancellation attempts
- ✅ Cancellation after completion rejection

#### Administrative Tests
- ✅ Owner-only function restrictions
- ✅ Backend signer updates
- ✅ Platform fee wallet updates
- ✅ Pause/unpause functionality
- ✅ Ownership transfer

#### Security Tests
- ✅ Reentrancy attack prevention
- ✅ Signature replay attack prevention
- ✅ Front-running protection
- ✅ Integer overflow/underflow
- ✅ Access control bypass attempts

## 📂 File Structure
```
contracts/
├── src/
│   └── BookingEscrow.sol          # Main contract
├── test/
│   ├── BookingEscrow.t.sol        # Main test suite
│   ├── utils/
│   │   ├── TestUtils.sol          # Test helper functions
│   │   └── SignatureUtils.sol     # EIP-712 signature helpers
│   └── mocks/
│       └── MockUSDC.sol           # Mock USDC for testing
├── script/
│   ├── Deploy.s.sol               # Deployment script
│   └── SetupTestnet.s.sol         # Testnet setup script
├── PRD.md                         # Product requirements
├── IMPLEMENTATION_PLAN.md         # This document
└── foundry.toml                   # Foundry configuration
```

## 🚀 Deployment Strategy

### Testnet Deployment (Base Sepolia)
1. Deploy mock USDC token
2. Deploy BookingEscrow contract
3. Set initial backend signer
4. Set platform fee wallet
5. Test complete booking flows

### Mainnet Deployment (Base)
1. Use real USDC token address
2. Deploy with multi-sig owner
3. Set production backend signer
4. Set production fee wallet
5. Comprehensive testing before public launch

## 🔍 Quality Assurance

### Code Quality Checks
- [ ] Solidity static analysis (Slither)
- [ ] Gas optimization analysis
- [ ] Code coverage >95%
- [ ] Function documentation
- [ ] NatSpec comments

### Security Audits
- [ ] Internal security review
- [ ] External audit (recommended for mainnet)
- [ ] Bug bounty program consideration

### Performance Benchmarks
- [ ] Gas usage per function
- [ ] Transaction cost analysis
- [ ] Optimization opportunities

## 📊 Success Criteria

### Functional Requirements
- ✅ All booking flows work correctly
- ✅ All cancellation flows work correctly  
- ✅ Proper fund distribution
- ✅ Access control enforcement
- ✅ Event emission accuracy

### Non-Functional Requirements
- ✅ Gas costs under 200k per transaction
- ✅ Zero critical security vulnerabilities
- ✅ 100% test coverage on core functions
- ✅ Clean external audit (if applicable)

## 🔄 TDD Implementation Approach

### Red-Green-Refactor Cycle
1. **Red**: Write failing tests first
2. **Green**: Implement minimal code to pass tests
3. **Refactor**: Optimize and clean up code
4. **Repeat**: Continue for each function

### Test-First Development Order
1. Write test for `createAndPayBooking()`
2. Implement function to pass test
3. Write test for `completeService()`
4. Implement function to pass test
5. Continue for all functions...

This approach ensures:
- ✅ All code is tested
- ✅ Requirements are met
- ✅ Edge cases are covered
- ✅ Refactoring is safe

## 🎯 Next Steps
1. Set up Foundry project structure
2. Create initial test files
3. Begin Phase 1 implementation
4. Follow TDD approach throughout
5. Iterate based on test feedback

---

**Estimated Total Time**: 12-16 hours
**Priority**: High (Core platform functionality)
**Risk Level**: Medium (Financial transactions, requires thorough testing)
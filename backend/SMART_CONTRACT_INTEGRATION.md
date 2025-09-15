# 🔗 Smart Contract Integration Guide

## Quick Integration Info

### Contract Address (Base Sepolia)
```
0x33ddEd6F8183aa4dAB04E2aE216a5a3f9871405a
```

### Required Environment Variables
Add to your backend `.env`:
```bash
# Smart Contract
CONTRACT_ADDRESS=0x33ddEd6F8183aa4dAB04E2aE216a5a3f9871405a
CONTRACT_CHAIN_ID=84532
BASE_SEPOLIA_RPC=https://sepolia.base.org

# Backend Signer (SECURE - DO NOT COMMIT!)
BACKEND_SIGNER_PRIVATE_KEY=your_private_key_here
BACKEND_SIGNER_ADDRESS=0x941bcd9063550a584348BC0366E93Dcb08FEcC5d

# USDC Token
USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
```

## Implementation Checklist

### Phase 1: Basic Integration
- [ ] Install ethers.js or web3.js for blockchain interaction
- [ ] Set up RPC connection to Base Sepolia
- [ ] Import contract ABI and create contract instance
- [ ] Implement EIP-712 signature generation for booking authorizations

### Phase 2: Core Functions
- [ ] `createBookingAuthorization()` - Generate signed booking permissions
- [ ] `completeService()` - Mark service as completed (triggers payments)
- [ ] `emergencyCancelBooking()` - Backend emergency cancellation
- [ ] Event listeners for contract events

### Phase 3: Advanced Features
- [ ] Gas estimation and optimization
- [ ] Transaction retry logic with exponential backoff
- [ ] Real-time event monitoring and webhook notifications
- [ ] Fee calculation utilities

## EIP-712 Signature Implementation

```javascript
const ethers = require('ethers');

// Contract configuration
const CONTRACT_ADDRESS = "0x33ddEd6F8183aa4dAB04E2aE216a5a3f9871405a";
const CHAIN_ID = 84532;

// EIP-712 Domain
const domain = {
  name: "BookingEscrow",
  version: "1", 
  chainId: CHAIN_ID,
  verifyingContract: CONTRACT_ADDRESS
};

// EIP-712 Types
const types = {
  BookingAuthorization: [
    { name: "bookingId", type: "bytes32" },
    { name: "customer", type: "address" },
    { name: "provider", type: "address" },
    { name: "inviter", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "platformFeeRate", type: "uint256" },
    { name: "inviterFeeRate", type: "uint256" }
  ]
};

// Generate booking authorization signature
async function signBookingAuthorization(signer, bookingData) {
  const signature = await signer.signTypedData(domain, types, {
    bookingId: ethers.keccak256(ethers.toUtf8Bytes(bookingData.bookingId)),
    customer: bookingData.customer,
    provider: bookingData.provider, 
    inviter: bookingData.inviter || ethers.ZeroAddress,
    amount: ethers.parseUnits(bookingData.amount.toString(), 6), // USDC has 6 decimals
    platformFeeRate: bookingData.platformFeeRate || 1500, // 15% default
    inviterFeeRate: bookingData.inviterFeeRate || 500    // 5% default
  });
  
  return signature;
}
```

## Integration Examples

### 1. Create Booking Authorization
```javascript
app.post('/api/bookings/authorize', async (req, res) => {
  try {
    const { bookingId, customer, provider, inviter, amount } = req.body;
    
    // Validate booking request
    const isValid = await validateBookingRequest(bookingId, customer, provider);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid booking request' });
    }
    
    // Generate signature
    const signature = await signBookingAuthorization(backendSigner, {
      bookingId,
      customer,
      provider,
      inviter,
      amount,
      platformFeeRate: 1500, // 15%
      inviterFeeRate: inviter ? 500 : 0 // 5% if inviter exists
    });
    
    res.json({ 
      signature,
      contractAddress: CONTRACT_ADDRESS,
      expires: Date.now() + 300000 // 5 minutes
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### 2. Complete Service (Backend Triggered)
```javascript
async function completeBookingService(bookingId) {
  try {
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, backendSigner);
    
    const tx = await contract.completeService(
      ethers.keccak256(ethers.toUtf8Bytes(bookingId))
    );
    
    await tx.wait();
    console.log(`Service completed for booking ${bookingId}`);
    
    return { success: true, txHash: tx.hash };
  } catch (error) {
    console.error('Failed to complete service:', error);
    throw error;
  }
}
```

### 3. Event Monitoring
```javascript
// Listen for contract events
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

contract.on("BookingCreatedAndPaid", (bookingId, customer, provider, inviter, amount, platformFeeRate, inviterFeeRate) => {
  console.log("New booking created:", {
    bookingId: ethers.toUtf8String(bookingId),
    customer,
    provider,
    amount: ethers.formatUnits(amount, 6) // USDC formatting
  });
  
  // Update database, send notifications, etc.
  updateBookingStatus(bookingId, 'PAID');
});

contract.on("ServiceCompleted", (bookingId, customer, provider, providerAmount, platformFee, inviterFee) => {
  console.log("Service completed:", {
    bookingId: ethers.toUtf8String(bookingId),
    providerEarnings: ethers.formatUnits(providerAmount, 6)
  });
  
  updateBookingStatus(bookingId, 'COMPLETED');
});
```

## Security Best Practices

### Backend Signer Security
1. **Environment Variables:** Never hardcode private keys
2. **Access Control:** Restrict who can trigger backend functions
3. **Monitoring:** Log all signature generations and contract interactions
4. **Rate Limiting:** Prevent signature farming attacks

### Transaction Handling
1. **Gas Estimation:** Always estimate gas before sending transactions
2. **Retry Logic:** Implement exponential backoff for failed transactions  
3. **Nonce Management:** Handle nonce conflicts in high-throughput scenarios
4. **Error Handling:** Gracefully handle blockchain connectivity issues

## Testing

### Test Wallet Setup
```bash
# Get test ETH for Base Sepolia
curl -X POST https://sepolia.base.org/faucet \
  -H "Content-Type: application/json" \
  -d '{"address":"YOUR_ADDRESS"}'

# Get test USDC (use Base Sepolia faucets or DEX)
```

### Integration Tests
```javascript
describe('Smart Contract Integration', () => {
  it('should create and pay booking', async () => {
    const signature = await signBookingAuthorization(signer, testBookingData);
    // Test signature with contract call
  });
  
  it('should complete service successfully', async () => {
    // Test service completion flow
  });
  
  it('should handle cancellations correctly', async () => {
    // Test various cancellation scenarios
  });
});
```

## Production Deployment Notes

### Environment Differences
```bash
# Testnet (Base Sepolia)
CONTRACT_ADDRESS=0x33ddEd6F8183aa4dAB04E2aE216a5a3f9871405a
CHAIN_ID=84532
RPC_URL=https://sepolia.base.org
USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e

# Mainnet (Base) - TBD after security fixes
CONTRACT_ADDRESS=TBD
CHAIN_ID=8453  
RPC_URL=https://mainnet.base.org
USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
```

### Monitoring & Alerts
- Set up transaction failure alerts
- Monitor gas price fluctuations
- Track contract event anomalies
- Emergency pause procedures

---

For full contract details, see: `/contracts/DEPLOYMENT_INFO.md`
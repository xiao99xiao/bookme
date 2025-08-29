# Balance Page Implementation Plan

## Overview
Implement a new Balance page in the Dashboard that displays the user's USDT balance on their Ethereum wallet. The system will automatically create smart wallets for users and handle both embedded and external wallet scenarios.

## Key Requirements

### 1. Wallet Management
- **Smart Wallet Creation**: Automatically create smart wallets for users
- **Embedded Wallet**: Generate for users who don't have an external wallet
- **External Wallet**: Use existing external Ethereum wallet if connected
- **Server-side Trigger**: Wallet generation must be triggered server-side, not client-side

### 2. Balance Display
- Show USDT balance on user's Ethereum wallet
- Support both mainnet (production) and testnet (development)
- Real-time balance updates

### 3. Network Configuration
- **Production**: Base (Ethereum L2)
- **Development**: Base Sepolia testnet
- Smart wallet support on both networks

## Technical Architecture

### Dependencies Required
```json
{
  "permissionless": "^latest",
  "viem": "^latest",
  "@privy-io/react-auth": "^latest"
}
```

### Component Structure
```
src/
├── pages/
│   └── dashboard/
│       └── DashboardBalance.tsx    # Main balance page component
├── contexts/
│   └── SmartWalletContext.tsx      # Smart wallet provider wrapper
├── hooks/
│   └── useWalletBalance.ts         # Custom hook for balance fetching
└── lib/
    └── wallet-utils.ts              # Wallet utility functions
```

## Implementation Steps

### Phase 1: Smart Wallet Setup
1. **Configure Privy Dashboard**
   - Enable smart wallets in Privy Dashboard
   - Configure Base and Base Sepolia networks
   - Set up paymaster for gas sponsorship (optional)
   - Configure smart wallet provider (Safe/Kernel/etc.)

2. **Install Dependencies**
   ```bash
   npm install permissionless viem
   ```

3. **Update PrivyAuthContext**
   - Add SmartWalletsProvider wrapper
   - Configure network settings for Base/Base Sepolia
   - Handle automatic wallet creation on login

### Phase 2: Balance Page Development
1. **Create DashboardBalance Component**
   - Display wallet address
   - Show USDT balance
   - Handle loading states
   - Error handling for failed balance fetches

2. **Implement Balance Fetching**
   - Use viem to fetch ERC20 balances
   - USDT contract addresses:
     - Base Mainnet: `0x833589fcd6edb6e08f4c7c32d4f71b54bda02913` (USDC as USDT not available)
     - Base Sepolia: Use test token address
   - Implement polling for real-time updates

3. **Smart Wallet Creation Logic**
   - Check if user has embedded wallet on login
   - Create smart wallet if needed
   - Handle external wallet connections
   - Ensure server-side wallet creation

### Phase 3: UI Integration
1. **Add Navigation Item**
   - Add "Balance" to dashboard sidebar
   - Update navigation routing

2. **Create Route**
   - Add route in App.tsx
   - Protected route with authentication

## Code Structure

### DashboardBalance.tsx
```typescript
interface WalletInfo {
  address: string;
  type: 'smart_wallet' | 'external' | 'embedded';
  chainId: number;
}

interface TokenBalance {
  symbol: string;
  balance: bigint;
  decimals: number;
  formatted: string;
}
```

### Key Functions
1. `createSmartWallet()` - Trigger smart wallet creation
2. `fetchUSDTBalance()` - Get USDT balance from chain
3. `getWalletInfo()` - Get current wallet details
4. `formatBalance()` - Format balance for display

## Environment Variables
```env
# Base Configuration
VITE_BASE_RPC_URL=https://mainnet.base.org
VITE_BASE_SEPOLIA_RPC_URL=https://sepolia.base.org

# USDT/USDC Contract Addresses
VITE_USDC_ADDRESS_BASE=0x833589fcd6edb6e08f4c7c32d4f71b54bda02913
VITE_USDT_ADDRESS_BASE_SEPOLIA=<test_token_address>

# Network Config
VITE_DEFAULT_CHAIN=base-sepolia  # for development
```

## Security Considerations
1. **No Private Keys on Client**: All wallet creation happens through Privy's secure infrastructure
2. **Server-Side Validation**: Wallet creation triggered server-side only
3. **Read-Only Balance**: Balance page only reads data, no transactions
4. **Network Validation**: Ensure correct network for environment

## Testing Plan
1. **New User Flow**
   - User signs up → Embedded wallet created → Smart wallet created → Balance displayed

2. **Existing User with External Wallet**
   - User connects external wallet → No new wallet created → Balance from external wallet

3. **Network Switching**
   - Test on Base Sepolia (development)
   - Verify Base mainnet configuration

## UI/UX Considerations
1. **Loading States**
   - Show skeleton while fetching balance
   - Indicate wallet creation in progress

2. **Error States**
   - Network connection issues
   - Failed balance fetches
   - Wallet creation failures

3. **Success States**
   - Display formatted balance
   - Show wallet address with copy button
   - Network indicator

## Future Enhancements
1. Multi-token balance display
2. Transaction history
3. Send/Receive functionality
4. Fiat on/off ramp integration
5. Balance charts and analytics

## Timeline
- Phase 1: 1-2 hours (Setup and configuration)
- Phase 2: 2-3 hours (Core development)
- Phase 3: 1 hour (UI integration)
- Testing: 1 hour

Total estimated time: 5-7 hours

## Notes
- USDT is not available on Base, using USDC as a proxy
- Smart wallets provide better UX with gas sponsorship
- Privy handles all wallet security and key management
- Balance updates can be real-time with polling or webhooks
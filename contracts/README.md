# Nook Smart Contracts

This directory contains the smart contracts for the Nook platform, built with Foundry and deployed on Base blockchain.

## 🏗️ Setup

1. **Install Foundry** (if not already installed):
   ```bash
   curl -L https://foundry.paradigm.xyz | bash
   foundryup
   ```

2. **Install dependencies**:
   ```bash
   make install
   # or
   forge install
   ```

3. **Create environment file**:
   ```bash
   cp .env.example .env
   # Edit .env with your private key and API keys
   ```

## 🚀 Development

### Build
```bash
make build
# or
forge build
```

### Test
```bash
make test
# or
forge test -vvv
```

### Deploy to Base Sepolia (Testnet)
```bash
make deploy-base-sepolia
```

### Deploy to Base Mainnet
```bash
make deploy-base
```

## 🌐 Networks

- **Base Sepolia (Testnet)**: Chain ID 84532
  - RPC: `https://sepolia.base.org`
  - USDC: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`

- **Base Mainnet**: Chain ID 8453  
  - RPC: `https://mainnet.base.org`
  - USDC: `0x833589fcd6edb6e08f4c7c32d4f71b54bda02913`

## 📁 Structure

```
contracts/
├── src/           # Smart contract source code
├── test/          # Test files
├── script/        # Deployment scripts
├── lib/           # Dependencies (git submodules)
├── foundry.toml   # Foundry configuration
└── Makefile       # Convenient commands
```

## 🔧 Tools Used

- **Foundry**: Modern Ethereum toolkit for smart contract development
- **Solidity 0.8.27**: Latest stable Solidity version
- **Base**: L2 blockchain for deployment
- **OpenZeppelin**: Battle-tested smart contract libraries

## 🔒 Security

- Never commit private keys to version control
- Use `.env` files for sensitive data
- All contracts should be thoroughly tested
- Consider auditing before mainnet deployment

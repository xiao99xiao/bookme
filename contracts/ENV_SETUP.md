# 🔧 Environment Setup Guide

## Quick Start

1. **Copy the example file:**
   ```bash
   cp .env.example .env
   ```

2. **Generate wallets:**
   ```bash
   # Generate deployer wallet
   cast wallet new
   # Copy Address and Private Key

   # Generate backend signer wallet  
   cast wallet new
   # Copy Address only (keep private key for backend)

   # Use existing wallet for platform fees, or generate another
   ```

3. **Fill in your `.env` file:**
   ```bash
   PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
   BACKEND_SIGNER=0x70997970C51812dc3A010C7d01b50e0d17dc79C8
   PLATFORM_FEE_WALLET=0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
   ETHERSCAN_API_KEY=ABC123DEF456GHI789JKL012MNO345PQR
   ```

4. **Test your configuration:**
   ```bash
   forge script script/Deploy.s.sol:DeployBookingEscrow --sig "run()" -vv
   ```

5. **Deploy to testnet:**
   ```bash
   forge script script/Deploy.s.sol:DeployBookingEscrow \
       --rpc-url base_sepolia \
       --broadcast \
       --verify
   ```

## Important Notes

- ✅ **DO:** Keep `.env` in `.gitignore`
- ✅ **DO:** Use different wallets for testnet/mainnet
- ✅ **DO:** Back up all private keys securely
- ❌ **DON'T:** Commit `.env` to git
- ❌ **DON'T:** Share private keys via chat/email
- ❌ **DON'T:** Use test wallets in production

## Get API Keys

- **Etherscan API:** https://etherscan.io/apis or https://basescan.org/apis (V2 compatible)
- **Base Sepolia Faucet:** https://www.alchemy.com/faucets/base-sepolia

## Wallet Purposes

| Wallet | Purpose | Security Level |
|--------|---------|----------------|
| **Deployer** | Deploy contract, becomes owner | 🔴 Critical |
| **Backend Signer** | Sign booking authorizations | 🔴 Critical |
| **Platform Fee** | Receive platform fees | 🟡 Important |

## Need Help?

- Check `DEPLOYMENT_CHECKLIST.md` for full deployment guide
- Review `PROFESSIONAL_AUDIT_REPORT.md` for security details
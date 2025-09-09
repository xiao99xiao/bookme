# 🎨 Frontend Blockchain Integration Guide

## Overview
This guide covers the complete frontend integration for blockchain payments in BookMe.

---

## 📦 Required Dependencies

```bash
npm install ethers@6
```

---

## 🔧 Core Integration Files

### 1. Smart Contract Service (`src/lib/blockchain-service.ts`)

```typescript
import { ethers } from 'ethers'
import { usePrivy } from '@privy-io/react-auth'
import contractABI from './contract-abi.json'

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || '0x1D59b8DD5b1f6bE31C48a7AB82eaA322752880C7'
const USDC_ADDRESS = import.meta.env.VITE_USDC_ADDRESS || '0x036CbD53842c5426634e7929541eC2318f3dCF7e'
const CHAIN_ID = 84532 // Base Sepolia

// Minimal USDC ABI for approval and balance
const USDC_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)"
]

export class BlockchainService {
  private contract: ethers.Contract | null = null
  private usdcContract: ethers.Contract | null = null
  private signer: ethers.Signer | null = null
  
  async initialize(wallet: any) {
    if (!wallet?.provider) {
      throw new Error('No wallet provider available')
    }
    
    const provider = new ethers.BrowserProvider(wallet.provider)
    this.signer = await provider.getSigner()
    
    // Initialize contracts
    this.contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, this.signer)
    this.usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, this.signer)
  }
  
  async checkAndApproveUSDC(amount: string): Promise<boolean> {
    if (!this.signer || !this.usdcContract) throw new Error('Not initialized')
    
    const amountWei = ethers.parseUnits(amount, 6) // USDC has 6 decimals
    const userAddress = await this.signer.getAddress()
    
    // Check current allowance
    const allowance = await this.usdcContract.allowance(userAddress, CONTRACT_ADDRESS)
    
    if (allowance >= amountWei) {
      return true // Already approved
    }
    
    // Request approval
    const approveTx = await this.usdcContract.approve(CONTRACT_ADDRESS, amountWei)
    await approveTx.wait()
    
    return true
  }
  
  async getUSDCBalance(): Promise<string> {
    if (!this.signer || !this.usdcContract) throw new Error('Not initialized')
    
    const userAddress = await this.signer.getAddress()
    const balance = await this.usdcContract.balanceOf(userAddress)
    
    return ethers.formatUnits(balance, 6)
  }
  
  async payForBooking(
    authorization: any,
    signature: string,
    onStatusChange?: (status: string) => void
  ): Promise<string> {
    if (!this.contract || !this.signer) throw new Error('Not initialized')
    
    try {
      onStatusChange?.('Checking USDC balance...')
      
      // Check balance
      const balance = await this.getUSDCBalance()
      const requiredAmount = ethers.formatUnits(authorization.amount, 6)
      
      if (parseFloat(balance) < parseFloat(requiredAmount)) {
        throw new Error(`Insufficient USDC balance. Need ${requiredAmount} USDC, have ${balance} USDC`)
      }
      
      onStatusChange?.('Approving USDC if needed...')
      await this.checkAndApproveUSDC(requiredAmount)
      
      onStatusChange?.('Sending payment transaction...')
      
      // Execute payment
      const tx = await this.contract.createAndPayBooking(authorization, signature)
      
      onStatusChange?.('Waiting for confirmation...')
      const receipt = await tx.wait()
      
      return receipt.hash
    } catch (error: any) {
      console.error('Payment error:', error)
      throw new Error(error.reason || error.message || 'Payment failed')
    }
  }
  
  async completeService(bookingId: string): Promise<string> {
    if (!this.contract) throw new Error('Not initialized')
    
    const bookingIdBytes = ethers.keccak256(ethers.toUtf8Bytes(bookingId))
    const tx = await this.contract.completeService(bookingIdBytes)
    const receipt = await tx.wait()
    
    return receipt.hash
  }
}

export const blockchainService = new BlockchainService()
```

---

## 🎯 Component Integration

### 2. Payment Button Component (`src/components/PaymentButton.tsx`)

```typescript
import { useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { blockchainService } from '@/lib/blockchain-service'
import { ApiClient } from '@/lib/api-migration'
import { Button } from '@/components/ui/button'
import { Loader2, CreditCard } from 'lucide-react'
import { toast } from 'sonner'

interface PaymentButtonProps {
  bookingId: string
  amount: number
  onSuccess?: (txHash: string) => void
  onError?: (error: Error) => void
}

export function PaymentButton({ bookingId, amount, onSuccess, onError }: PaymentButtonProps) {
  const { user, wallet } = usePrivy()
  const [isProcessing, setIsProcessing] = useState(false)
  const [status, setStatus] = useState<string>('')
  
  const handlePayment = async () => {
    if (!user || !wallet) {
      toast.error('Please connect your wallet first')
      return
    }
    
    setIsProcessing(true)
    setStatus('Initializing...')
    
    try {
      // Initialize blockchain service with wallet
      await blockchainService.initialize(wallet)
      
      // Get payment authorization from backend
      setStatus('Getting payment authorization...')
      const response = await fetch(`/api/bookings/${bookingId}/authorize-payment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await user.getAccessToken()}`
        }
      })
      
      if (!response.ok) {
        throw new Error('Failed to get payment authorization')
      }
      
      const { authorization, signature } = await response.json()
      
      // Execute blockchain payment
      const txHash = await blockchainService.payForBooking(
        authorization,
        signature,
        setStatus
      )
      
      toast.success('Payment successful!')
      onSuccess?.(txHash)
      
    } catch (error: any) {
      console.error('Payment failed:', error)
      toast.error(error.message || 'Payment failed')
      onError?.(error)
    } finally {
      setIsProcessing(false)
      setStatus('')
    }
  }
  
  return (
    <div className="space-y-2">
      <Button 
        onClick={handlePayment}
        disabled={isProcessing}
        className="w-full"
      >
        {isProcessing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <CreditCard className="mr-2 h-4 w-4" />
            Pay {amount} USDC
          </>
        )}
      </Button>
      
      {status && (
        <p className="text-sm text-muted-foreground text-center">
          {status}
        </p>
      )}
    </div>
  )
}
```

### 3. Service Completion Component (`src/components/CompleteServiceButton.tsx`)

```typescript
import { useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { blockchainService } from '@/lib/blockchain-service'
import { Button } from '@/components/ui/button'
import { CheckCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface CompleteServiceButtonProps {
  bookingId: string
  blockchainBookingId?: string
  onSuccess?: (txHash: string) => void
}

export function CompleteServiceButton({ 
  bookingId, 
  blockchainBookingId,
  onSuccess 
}: CompleteServiceButtonProps) {
  const { user, wallet } = usePrivy()
  const [isProcessing, setIsProcessing] = useState(false)
  
  const handleComplete = async () => {
    if (!user || !wallet || !blockchainBookingId) {
      toast.error('Service not ready for completion')
      return
    }
    
    setIsProcessing(true)
    
    try {
      // First, notify backend
      const response = await fetch(`/api/bookings/${bookingId}/complete`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await user.getAccessToken()}`
        }
      })
      
      if (!response.ok) {
        throw new Error('Failed to prepare completion')
      }
      
      // Initialize blockchain service
      await blockchainService.initialize(wallet)
      
      // Execute blockchain completion
      const txHash = await blockchainService.completeService(bookingId)
      
      toast.success('Service completed! Funds have been distributed.')
      onSuccess?.(txHash)
      
    } catch (error: any) {
      console.error('Completion failed:', error)
      toast.error(error.message || 'Failed to complete service')
    } finally {
      setIsProcessing(false)
    }
  }
  
  return (
    <Button 
      onClick={handleComplete}
      disabled={isProcessing || !blockchainBookingId}
      variant="success"
      className="w-full"
    >
      {isProcessing ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Completing...
        </>
      ) : (
        <>
          <CheckCircle className="mr-2 h-4 w-4" />
          Complete Service
        </>
      )}
    </Button>
  )
}
```

### 4. Enhanced Booking Status Badge (`src/components/BookingStatusBadge.tsx`)

```typescript
import { Badge } from '@/components/ui/badge'
import { ExternalLink } from 'lucide-react'

interface BookingStatusBadgeProps {
  status: string
  txHash?: string
  completionTxHash?: string
  cancellationTxHash?: string
}

export function BookingStatusBadge({ 
  status, 
  txHash, 
  completionTxHash,
  cancellationTxHash 
}: BookingStatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'pending':
        return { label: 'Pending', variant: 'secondary' }
      case 'pending_payment':
        return { label: 'Awaiting Payment', variant: 'warning' }
      case 'paid':
        return { label: 'Paid', variant: 'success' }
      case 'pending_completion':
        return { label: 'Ready to Complete', variant: 'warning' }
      case 'completed':
        return { label: 'Completed', variant: 'success' }
      case 'cancelled':
        return { label: 'Cancelled', variant: 'destructive' }
      case 'failed':
        return { label: 'Failed', variant: 'destructive' }
      default:
        return { label: status, variant: 'outline' }
    }
  }
  
  const config = getStatusConfig()
  const relevantTxHash = completionTxHash || cancellationTxHash || txHash
  
  return (
    <div className="flex items-center gap-2">
      <Badge variant={config.variant as any}>
        {config.label}
      </Badge>
      
      {relevantTxHash && (
        <a
          href={`https://sepolia.basescan.org/tx/${relevantTxHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      )}
    </div>
  )
}
```

---

## 🔄 Integration in Existing Components

### Update Customer Bookings Page

```typescript
// In src/pages/customer/CustomerBookings.tsx
import { PaymentButton } from '@/components/PaymentButton'
import { CompleteServiceButton } from '@/components/CompleteServiceButton'
import { BookingStatusBadge } from '@/components/BookingStatusBadge'

// In your booking card component:
<div className="booking-card">
  {/* ... existing booking details ... */}
  
  {/* Status Badge */}
  <BookingStatusBadge 
    status={booking.status}
    txHash={booking.blockchain_tx_hash}
    completionTxHash={booking.completion_tx_hash}
    cancellationTxHash={booking.cancellation_tx_hash}
  />
  
  {/* Payment Button - show when pending_payment */}
  {booking.status === 'pending_payment' && (
    <PaymentButton
      bookingId={booking.id}
      amount={booking.total_price}
      onSuccess={(txHash) => {
        // Refresh bookings or update local state
        refetchBookings()
      }}
    />
  )}
  
  {/* Complete Button - show when paid */}
  {booking.status === 'paid' && isCustomer && (
    <CompleteServiceButton
      bookingId={booking.id}
      blockchainBookingId={booking.blockchain_booking_id}
      onSuccess={(txHash) => {
        // Refresh bookings
        refetchBookings()
      }}
    />
  )}
</div>
```

---

## 🌐 Environment Variables

Add to your frontend `.env.local`:

```bash
# Blockchain Configuration
VITE_CONTRACT_ADDRESS=0x1D59b8DD5b1f6bE31C48a7AB82eaA322752880C7
VITE_USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
VITE_CHAIN_ID=84532
VITE_CHAIN_NAME=Base Sepolia
```

---

## 🧪 Testing Checklist

1. **Payment Flow**:
   - [ ] User can see USDC balance
   - [ ] Payment button appears for pending bookings
   - [ ] USDC approval works if needed
   - [ ] Payment transaction succeeds
   - [ ] Status updates to 'paid' after confirmation
   - [ ] Transaction link works

2. **Completion Flow**:
   - [ ] Complete button appears for paid bookings
   - [ ] Only customer can complete
   - [ ] Completion transaction succeeds
   - [ ] Funds are distributed correctly
   - [ ] Status updates to 'completed'

3. **Error Handling**:
   - [ ] Insufficient balance error shows
   - [ ] Network errors are handled
   - [ ] Transaction failures show proper messages

---

## 📱 Mobile Considerations

- Privy smart wallets work on mobile
- Ensure buttons are touch-friendly
- Show clear loading states
- Handle network switching gracefully

---

## 🚀 Next Steps

1. Add cancellation flow UI
2. Implement transaction history view
3. Add gas estimation display
4. Create admin dashboard for monitoring
5. Add email notifications for blockchain events

---

*This guide provides the complete frontend integration needed for blockchain payments in BookMe.*
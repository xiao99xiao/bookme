import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2, CheckCircle, XCircle, ExternalLink, CreditCard, AlertTriangle } from 'lucide-react'
import { TransactionStatus } from '@/lib/blockchain-service'
import { cn } from '@/lib/utils'

export interface TransactionModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  description: string
  status: TransactionStatus
  onRetry?: () => void
  showRetryButton?: boolean
  explorerBaseUrl?: string
}

export function TransactionModal({
  isOpen,
  onClose,
  title,
  description,
  status,
  onRetry,
  showRetryButton = false,
  explorerBaseUrl = 'https://sepolia.basescan.org'
}: TransactionModalProps) {
  const [autoCloseTimer, setAutoCloseTimer] = useState<NodeJS.Timeout | null>(null)

  // Auto-close on success after 3 seconds
  useEffect(() => {
    if (status.status === 'success' && isOpen) {
      const timer = setTimeout(() => {
        onClose()
      }, 3000)
      setAutoCloseTimer(timer)
      
      return () => {
        if (timer) clearTimeout(timer)
      }
    }
    
    if (autoCloseTimer && status.status !== 'success') {
      clearTimeout(autoCloseTimer)
      setAutoCloseTimer(null)
    }
  }, [status.status, isOpen, onClose, autoCloseTimer])

  const getStatusIcon = () => {
    switch (status.status) {
      case 'preparing':
        return <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      case 'prompting':
        return <CreditCard className="h-8 w-8 text-orange-500 animate-pulse" />
      case 'pending':
        return <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      case 'success':
        return <CheckCircle className="h-8 w-8 text-green-500" />
      case 'error':
        return <XCircle className="h-8 w-8 text-red-500" />
      default:
        return <AlertTriangle className="h-8 w-8 text-yellow-500" />
    }
  }

  const getStatusColor = () => {
    switch (status.status) {
      case 'preparing':
      case 'pending':
        return 'text-blue-600'
      case 'prompting':
        return 'text-orange-600'
      case 'success':
        return 'text-green-600'
      case 'error':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  const isProcessing = ['preparing', 'prompting', 'pending'].includes(status.status)
  const canClose = !isProcessing
  const showExplorerLink = status.txHash && explorerBaseUrl

  return (
    <Dialog open={isOpen} onOpenChange={canClose ? onClose : undefined}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => {
        if (isProcessing) e.preventDefault()
      }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getStatusIcon()}
            {title}
          </DialogTitle>
          <DialogDescription>
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status Message */}
          <div className={cn("text-center py-4", getStatusColor())}>
            <p className="font-medium">{status.message}</p>
          </div>

          {/* Transaction Hash */}
          {status.txHash && (
            <div className="bg-gray-50 rounded-lg p-3 space-y-2">
              <p className="text-sm font-medium text-gray-700">Transaction Hash:</p>
              <p className="text-xs font-mono bg-white px-2 py-1 rounded border break-all">
                {status.txHash}
              </p>
              {showExplorerLink && (
                <a
                  href={`${explorerBaseUrl}/tx/${status.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                >
                  <ExternalLink className="h-4 w-4" />
                  View on Explorer
                </a>
              )}
            </div>
          )}

          {/* Error Details */}
          {status.status === 'error' && status.error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm font-medium text-red-800 mb-1">Error Details:</p>
              <p className="text-sm text-red-700">{status.error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 justify-end">
            {status.status === 'error' && showRetryButton && onRetry && (
              <Button
                onClick={onRetry}
                variant="outline"
                size="sm"
              >
                Try Again
              </Button>
            )}
            
            {status.status === 'success' && autoCloseTimer && (
              <p className="text-xs text-gray-500 flex items-center">
                Closing automatically...
              </p>
            )}
            
            {canClose && (
              <Button
                onClick={onClose}
                variant={status.status === 'success' ? 'default' : 'outline'}
                size="sm"
              >
                {status.status === 'success' ? 'Done' : 'Cancel'}
              </Button>
            )}
          </div>

          {/* Processing Note */}
          {isProcessing && (
            <p className="text-xs text-center text-gray-500">
              {status.status === 'prompting' 
                ? 'Please check your wallet to confirm the transaction'
                : 'Please wait while the transaction is being processed...'
              }
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  amount: number
  currency?: string
  status: TransactionStatus
  onRetry?: () => void
}

export function PaymentModal({
  isOpen,
  onClose,
  amount,
  currency = 'USDC',
  status,
  onRetry
}: PaymentModalProps) {
  return (
    <TransactionModal
      isOpen={isOpen}
      onClose={onClose}
      title="Payment Processing"
      description={`Processing payment of ${amount} ${currency}`}
      status={status}
      onRetry={onRetry}
      showRetryButton={true}
    />
  )
}

export interface CancellationModalProps {
  isOpen: boolean
  onClose: () => void
  status: TransactionStatus
  onRetry?: () => void
}

export function CancellationModal({
  isOpen,
  onClose,
  status,
  onRetry
}: CancellationModalProps) {
  return (
    <TransactionModal
      isOpen={isOpen}
      onClose={onClose}
      title="Cancelling Booking"
      description="Processing booking cancellation and refund"
      status={status}
      onRetry={onRetry}
      showRetryButton={true}
    />
  )
}

export interface CompletionModalProps {
  isOpen: boolean
  onClose: () => void
  status: TransactionStatus
  onRetry?: () => void
}

export function CompletionModal({
  isOpen,
  onClose,
  status,
  onRetry
}: CompletionModalProps) {
  return (
    <TransactionModal
      isOpen={isOpen}
      onClose={onClose}
      title="Completing Service"
      description="Processing service completion and fund distribution"
      status={status}
      onRetry={onRetry}
      showRetryButton={true}
    />
  )
}

export interface BalanceDisplayProps {
  balance: string
  currency?: string
  isLoading?: boolean
  className?: string
}

export function BalanceDisplay({
  balance,
  currency = 'USDC',
  isLoading = false,
  className
}: BalanceDisplayProps) {
  return (
    <div className={cn("flex items-center gap-2 text-sm", className)}>
      <span className="text-gray-600">Balance:</span>
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <span className="font-medium">
          {parseFloat(balance).toFixed(2)} {currency}
        </span>
      )}
    </div>
  )
}
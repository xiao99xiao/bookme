import { useState, useEffect } from "react";
import { Button as UIButton } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, AlertCircle, DollarSign, Clock, User } from "lucide-react";
import { toast } from "sonner";
import { Button as DSButton } from '@/design-system';
import { Card as DSCard, Stack } from '@/design-system/components/Layout';
import { Heading, Text } from '@/design-system/components/Typography';
import { useAuth } from "@/contexts/PrivyAuthContext";
import { ApiClient } from "@/lib/api-migration";
import { useBlockchainService } from "@/lib/blockchain-service";
import { usePaymentTransaction } from "@/hooks/useTransaction";
import { TransactionModal } from "@/components/TransactionModal";

interface CancellationPolicy {
  id: string;
  reason_key: string;
  reason_title: string;
  reason_description: string;
  customer_refund_percentage: number;
  provider_earnings_percentage: number;
  platform_fee_percentage: number;
  requires_explanation: boolean;
  minutesUntilStart: number;
  userRole: 'provider' | 'customer';
}

interface RefundBreakdown {
  policyId: string;
  policyTitle: string;
  policyDescription: string;
  requiresExplanation: boolean;
  totalAmount: number;
  originalServiceFee: number;
  breakdown: {
    customerRefund: number;
    providerEarnings: number;
    platformFee: number;
  };
  percentages: {
    customerRefundPercentage: number;
    providerEarningsPercentage: number;
    platformFeePercentage: number;
  };
}

interface Booking {
  id: string;
  service?: {
    title: string;
  };
  customer?: {
    display_name: string;
  };
  total_price: number;
  scheduled_at: string;
  status: string;
}

interface EnhancedCancelBookingModalProps {
  booking: Booking | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (result: any) => void;
}

export const EnhancedCancelBookingModal = ({ 
  booking, 
  isOpen, 
  onClose, 
  onConfirm 
}: EnhancedCancelBookingModalProps) => {
  const { authenticated, user } = useAuth();
  const { blockchainService, initializeService, isWalletConnected } = useBlockchainService();
  const [policies, setPolicies] = useState<CancellationPolicy[]>([]);
  const [selectedPolicyId, setSelectedPolicyId] = useState<string>('');
  const [explanation, setExplanation] = useState<string>('');
  const [refundBreakdown, setRefundBreakdown] = useState<RefundBreakdown | null>(null);
  const [loadingPolicies, setLoadingPolicies] = useState(false);
  const [loadingBreakdown, setLoadingBreakdown] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [authData, setAuthData] = useState<any>(null);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  
  const {
    status: txStatus,
    message: txMessage,
    txHash,
    error: txError,
    isLoading: txIsLoading,
    isSuccess: txIsSuccess,
    isError: txIsError,
    executePayment,
    reset: resetTransaction
  } = usePaymentTransaction({
    onSuccess: (txHash) => {
      toast.success('Booking cancelled successfully!');
      onConfirm({ txHash, refundBreakdown, policy: selectedPolicy });
      handleClose();
    },
    onError: (error) => {
      toast.error(`Cancellation failed: ${error}`);
    }
  });

  // Load available cancellation policies
  useEffect(() => {
    if (booking && isOpen) {
      loadCancellationPolicies();
    }
  }, [booking, isOpen]);

  // Calculate refund breakdown when policy is selected
  useEffect(() => {
    if (selectedPolicyId && booking) {
      calculateRefundBreakdown();
    } else {
      setRefundBreakdown(null);
    }
  }, [selectedPolicyId, booking]);

  const loadCancellationPolicies = async () => {
    if (!booking) return;
    
    setLoadingPolicies(true);
    try {
      const policiesData = await ApiClient.getCancellationPolicies(booking.id);
      setPolicies(policiesData);

      // Auto-select first policy if only one is available
      if (policiesData.length === 1) {
        setSelectedPolicyId(policiesData[0].id);
      }
    } catch (error) {
      console.error('Error loading policies:', error);
      toast.error('Failed to load cancellation options');
    } finally {
      setLoadingPolicies(false);
    }
  };

  const calculateRefundBreakdown = async () => {
    if (!booking || !selectedPolicyId) return;
    
    setLoadingBreakdown(true);
    try {
      const breakdown = await ApiClient.calculateRefundBreakdown(booking.id, selectedPolicyId);
      setRefundBreakdown(breakdown);
    } catch (error) {
      console.error('Error calculating breakdown:', error);
      toast.error('Failed to calculate refund breakdown');
    } finally {
      setLoadingBreakdown(false);
    }
  };

  const handleConfirm = async () => {
    if (!booking || !selectedPolicyId) return;

    const selectedPolicy = policies.find(p => p.id === selectedPolicyId);
    if (selectedPolicy?.requires_explanation && !explanation.trim()) {
      toast.error('Please provide an explanation for this cancellation');
      return;
    }

    setCancelling(true);
    try {
      // Step 1: Get cancellation authorization from backend
      console.log('🔐 Getting cancellation authorization from backend...');
      const authResult = await ApiClient.authorizeCancellation(
        booking.id,
        selectedPolicyId,
        explanation.trim() || null
      );

      console.log('✅ Got cancellation authorization:', authResult);
      setAuthData(authResult);
      setShowTransactionModal(true);

      // Step 2: Initialize blockchain service (always needed to set smart wallet client)
      await initializeService();

      // Step 3: Execute blockchain transaction
      const isCustomer = selectedPolicy?.userRole === 'customer';
      await executePayment(async (onStatusChange) => {
        if (isCustomer) {
          return await blockchainService.cancelBookingAsCustomer(
            authResult.authorization,
            authResult.signature,
            onStatusChange
          );
        } else {
          return await blockchainService.cancelBookingAsProvider(
            authResult.authorization,
            authResult.signature,
            onStatusChange
          );
        }
      });

    } catch (error) {
      console.error('Error cancelling booking:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to cancel booking');
      setShowTransactionModal(false);
    } finally {
      setCancelling(false);
    }
  };

  const handleClose = () => {
    setSelectedPolicyId('');
    setExplanation('');
    setRefundBreakdown(null);
    setPolicies([]);
    setAuthData(null);
    setShowTransactionModal(false);
    resetTransaction();
    onClose();
  };

  const selectedPolicy = policies.find(p => p.id === selectedPolicyId);

  if (!booking) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-orange-500" />
            Cancel Booking
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Booking Info */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-900">{booking.service?.title || 'Service'}</h4>
            <p className="text-sm text-gray-600 mt-1">
              with {booking.customer?.display_name || 'Customer'}
            </p>
            <p className="text-sm text-gray-600">
              Total: ${booking.total_price}
            </p>
          </div>

          {/* Loading State */}
          {loadingPolicies && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="ml-2 text-sm text-gray-600">Loading cancellation options...</span>
            </div>
          )}

          {/* No policies available */}
          {!loadingPolicies && policies.length === 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No cancellation options are available for this booking at this time.
              </AlertDescription>
            </Alert>
          )}

          {/* Policy Selection */}
          {policies.length > 0 && (
            <div className="space-y-4">
              <Label className="text-base font-medium">Reason for Cancellation</Label>
              <RadioGroup value={selectedPolicyId} onValueChange={setSelectedPolicyId}>
                {policies.map((policy) => (
                  <div key={policy.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                    <RadioGroupItem value={policy.id} id={policy.id} className="mt-1" />
                    <Label htmlFor={policy.id} className="flex-1 cursor-pointer">
                      <div className="font-medium text-gray-900">{policy.reason_title}</div>
                      <div className="text-sm text-gray-600 mt-1">{policy.reason_description}</div>
                      {policy.minutesUntilStart !== undefined && (
                        <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {policy.minutesUntilStart > 0 
                            ? `${Math.floor(policy.minutesUntilStart / 60)}h ${policy.minutesUntilStart % 60}m until start`
                            : 'Session has started'
                          }
                        </div>
                      )}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          )}

          {/* Refund Breakdown */}
          {refundBreakdown && (
            <DSCard>
              <Stack direction="column" spacing="md">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  <Heading level={4} className="m-0">Refund Breakdown</Heading>
                </div>
                
                <Stack direction="column" spacing="sm">
                  <div className="flex justify-between items-center">
                    <Text variant="regular" color="secondary">Original Amount:</Text>
                    <Text variant="regular" weight="medium">${refundBreakdown.totalAmount.toFixed(2)}</Text>
                  </div>
                  
                  <div className="border-t pt-3 mt-3">
                    <Stack direction="column" spacing="xs">
                      <div className="flex justify-between items-center">
                        <Text variant="regular" className="text-green-600">
                          Customer Refund ({refundBreakdown.percentages.customerRefundPercentage}%):
                        </Text>
                        <Text variant="regular" weight="medium" className="text-green-600">
                          ${refundBreakdown.breakdown.customerRefund.toFixed(2)}
                        </Text>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <Text variant="regular" className="text-blue-600">
                          Provider Earnings ({refundBreakdown.percentages.providerEarningsPercentage}%):
                        </Text>
                        <Text variant="regular" weight="medium" className="text-blue-600">
                          ${refundBreakdown.breakdown.providerEarnings.toFixed(2)}
                        </Text>
                      </div>
                      
                      {refundBreakdown.breakdown.platformFee > 0 && (
                        <div className="flex justify-between items-center">
                          <Text variant="regular" color="tertiary">
                            Platform Fee ({refundBreakdown.percentages.platformFeePercentage}%):
                          </Text>
                          <Text variant="regular" weight="medium" color="tertiary">
                            ${refundBreakdown.breakdown.platformFee.toFixed(2)}
                          </Text>
                        </div>
                      )}
                    </Stack>
                  </div>
                </Stack>
              </Stack>
            </DSCard>
          )}

          {/* Explanation Field */}
          {selectedPolicy?.requires_explanation && (
            <div className="space-y-2">
              <Label htmlFor="explanation">
                Explanation {selectedPolicy.requires_explanation && <span className="text-red-500">*</span>}
              </Label>
              <Textarea
                id="explanation"
                placeholder="Please provide an explanation for this cancellation..."
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                className="min-h-[80px]"
              />
              {selectedPolicy.requires_explanation && (
                <p className="text-xs text-gray-600">
                  An explanation is required for this type of cancellation.
                </p>
              )}
            </div>
          )}

          {/* Loading Breakdown */}
          {loadingBreakdown && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="ml-2 text-sm text-gray-600">Calculating refund...</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <DSButton
              variant="outline"
              onClick={handleClose}
              disabled={cancelling}
              fullWidth
            >
              Keep Booking
            </DSButton>
            <DSButton
              variant="danger"
              onClick={handleConfirm}
              disabled={!selectedPolicyId || cancelling || loadingBreakdown}
              fullWidth
            >
              {cancelling ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Cancelling...
                </>
              ) : (
                'Confirm Cancellation'
              )}
            </DSButton>
          </div>
        </div>
      </DialogContent>
      
      {/* Transaction Modal */}
      <TransactionModal
        isOpen={showTransactionModal}
        onClose={() => setShowTransactionModal(false)}
        status={txStatus}
        message={txMessage}
        txHash={txHash}
        error={txError}
        title="Processing Cancellation"
        description="Cancelling your booking and processing refund according to the selected policy."
        explorerUrl={txHash ? blockchainService.getTransactionUrl(txHash) : undefined}
      />
    </Dialog>
  );
};
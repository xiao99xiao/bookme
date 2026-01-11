import { useState } from 'react';
import { Button } from '@/design-system';
import { Clock, Check, X, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO, formatDistanceToNow, isPast } from 'date-fns';
import { t } from '@/lib/i18n';
import { ApiClient } from '@/lib/api-migration';
import { RescheduleRequest } from '@/lib/backend-api';

interface PendingRescheduleCardProps {
  request: RescheduleRequest;
  userRole: 'host' | 'visitor';
  isRequester: boolean;
  currentUserId: string;
  onUpdated: () => void;
}

export default function PendingRescheduleCard({
  request,
  userRole,
  isRequester,
  currentUserId,
  onUpdated
}: PendingRescheduleCardProps) {
  const [isResponding, setIsResponding] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const proposedTime = request.proposed_scheduled_at
    ? format(parseISO(request.proposed_scheduled_at), 'EEEE, MMM d \'at\' h:mm a')
    : '';

  const expiresAt = request.expires_at ? parseISO(request.expires_at) : null;
  const isExpired = expiresAt ? isPast(expiresAt) : false;
  const expiresIn = expiresAt && !isExpired
    ? formatDistanceToNow(expiresAt, { addSuffix: false })
    : null;

  const requesterName = request.requester?.display_name ||
    (request.requester_role === 'host' ? 'Host' : 'Visitor');

  const handleApprove = async () => {
    setIsResponding(true);
    try {
      await ApiClient.respondToRescheduleRequest(request.id, {
        action: 'approve'
      });
      toast.success(t.reschedule.requestApproved);
      onUpdated();
    } catch (error: any) {
      console.error('Error approving reschedule:', error);
      toast.error(error.message || 'Failed to approve reschedule');
    } finally {
      setIsResponding(false);
    }
  };

  const handleReject = async () => {
    setIsResponding(true);
    try {
      await ApiClient.respondToRescheduleRequest(request.id, {
        action: 'reject'
      });
      toast.success(t.reschedule.requestRejected);
      onUpdated();
    } catch (error: any) {
      console.error('Error rejecting reschedule:', error);
      toast.error(error.message || 'Failed to reject reschedule');
    } finally {
      setIsResponding(false);
    }
  };

  const handleWithdraw = async () => {
    setIsWithdrawing(true);
    try {
      await ApiClient.withdrawRescheduleRequest(request.id);
      toast.success(t.reschedule.requestWithdrawn);
      onUpdated();
    } catch (error: any) {
      console.error('Error withdrawing reschedule:', error);
      toast.error(error.message || 'Failed to withdraw request');
    } finally {
      setIsWithdrawing(false);
    }
  };

  // Handle expired requests
  if (isExpired && request.status === 'pending') {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="flex items-center gap-2 text-gray-500">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm font-medium">{t.reschedule.requestExpired}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-600" />
          <span className="font-medium text-amber-800">
            {t.reschedule.pendingRequest}
          </span>
        </div>
        {expiresIn && (
          <span className="text-xs text-amber-600 bg-amber-100 px-2 py-1 rounded">
            {t.reschedule.expiresIn.replace('{{time}}', expiresIn)}
          </span>
        )}
      </div>

      {/* Request info */}
      <div className="space-y-2">
        <p className="text-sm text-amber-800">
          {isRequester
            ? t.reschedule.youRequested
            : t.reschedule.requestedBy.replace('{{name}}', requesterName)
          }
        </p>

        {/* Proposed time */}
        <div className="bg-white/50 rounded p-2">
          <p className="text-xs text-amber-600 uppercase font-medium">
            {t.reschedule.proposedTime}
          </p>
          <p className="text-sm font-medium text-amber-900">
            {proposedTime}
          </p>
        </div>

        {/* Reason if provided */}
        {request.reason && (
          <div className="bg-white/50 rounded p-2">
            <p className="text-xs text-amber-600 uppercase font-medium">
              {t.reschedule.reason.replace(' (optional)', '')}
            </p>
            <p className="text-sm text-amber-800">
              {request.reason}
            </p>
          </div>
        )}

        {/* Waiting message */}
        {isRequester && (
          <p className="text-xs text-amber-600 italic">
            {t.reschedule.waitingForResponse}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        {isRequester ? (
          // Requester can withdraw
          <Button
            variant="outline"
            size="sm"
            onClick={handleWithdraw}
            disabled={isWithdrawing}
            className="flex items-center gap-1"
          >
            {isWithdrawing ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <X className="w-3 h-3" />
            )}
            {t.reschedule.withdraw}
          </Button>
        ) : (
          // Responder can approve or reject
          <>
            <Button
              variant="primary"
              size="sm"
              onClick={handleApprove}
              disabled={isResponding}
              className="flex items-center gap-1"
            >
              {isResponding ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Check className="w-3 h-3" />
              )}
              {t.reschedule.accept}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReject}
              disabled={isResponding}
              className="flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              {t.reschedule.reject}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

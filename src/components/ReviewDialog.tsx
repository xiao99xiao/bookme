import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/design-system/components/Input';
import { toast } from 'sonner';
import StarRating from './StarRating';
import { t } from '@/lib/i18n';

interface ReviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  booking: {
    id: string;
    service_id: string;
    provider_id: string;
    scheduled_at: string;
    duration_minutes: number;
    services?: {
      title: string;
    };
    provider?: {
      display_name: string;
    };
    customer?: {
      display_name: string;
    };
  };
  existingReview?: {
    rating: number;
    comment: string;
  } | null;
  onSubmit: (rating: number, comment: string) => Promise<void>;
  forceReadOnly?: boolean; // For providers viewing customer reviews
}

export default function ReviewDialog({ 
  isOpen, 
  onClose, 
  booking, 
  existingReview,
  onSubmit,
  forceReadOnly = false
}: ReviewDialogProps) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check if review can be edited (within 7 days of booking end time)
  const canEditReview = (): boolean => {
    const now = new Date();
    const bookingEndTime = new Date(booking.scheduled_at);
    bookingEndTime.setMinutes(bookingEndTime.getMinutes() + booking.duration_minutes);
    
    const sevenDaysAfterBooking = new Date(bookingEndTime);
    sevenDaysAfterBooking.setDate(sevenDaysAfterBooking.getDate() + 7);
    
    return now <= sevenDaysAfterBooking;
  };

  const isReadOnly = forceReadOnly || (existingReview && !canEditReview());

  // Load existing review data when dialog opens
  useEffect(() => {
    if (isOpen && existingReview) {
      setRating(existingReview.rating);
      setComment(existingReview.comment || '');
    } else if (isOpen && !existingReview) {
      // Reset to defaults for new review
      setRating(5);
      setComment('');
    }
  }, [isOpen, existingReview]);
  
  const maxCommentLength = 2000;
  const remainingChars = maxCommentLength - comment.length;

  const handleSubmit = async () => {
    if (rating < 1 || rating > 5) {
      toast.error(t.validation.selectRating);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(rating, comment.trim());
      toast.success(existingReview ? t.toast.success.noteUpdated : t.toast.success.noteSubmitted);
      onClose();
      // Reset form
      setRating(5);
      setComment('');
    } catch (error) {
      console.error('Failed to submit review:', error);
      toast.error(existingReview ? t.toast.error.failedToUpdateNote : t.toast.error.failedToSubmitNote);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    onClose();
    // Reset form
    setRating(5);
    setComment('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {forceReadOnly
              ? t.note.visitorNote
              : (isReadOnly
                  ? t.note.yourNote
                  : (existingReview ? t.note.updateNote : 'How was your experience?')
                )
            }
          </DialogTitle>
          <DialogDescription>
            {forceReadOnly
              ? `Note from ${booking.customer?.display_name || 'visitor'} for ${booking.services?.title || 'this Talk'}`
              : (isReadOnly
                  ? `Your note for ${booking.provider?.display_name || 'the host'} - ${booking.services?.title || 'this Talk'}`
                  : (existingReview
                      ? `Update your note for ${booking.provider?.display_name || 'the host'} - ${booking.services?.title || 'this Talk'}`
                      : `Rate your experience with ${booking.provider?.display_name || 'the host'} for ${booking.services?.title || 'this Talk'}`
                    )
                )
            }
          </DialogDescription>
          {isReadOnly && !forceReadOnly && (
            <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
              <p className="text-sm text-amber-800">
                ⏰ {t.note.editWindow}
              </p>
            </div>
          )}
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Star Rating */}
          <div className="flex flex-col items-center space-y-2">
            <p className="text-sm text-muted-foreground">
              {forceReadOnly
                ? t.note.visitorRating
                : (isReadOnly ? t.note.yourRating : t.note.rateExperience)
              }
            </p>
            <StarRating 
              value={rating} 
              onChange={isReadOnly ? undefined : setRating} 
              readonly={isReadOnly}
              size="lg"
            />
            <p className="text-sm font-medium">
              {rating === 1 && t.note.ratingLabels.poor}
              {rating === 2 && t.note.ratingLabels.fair}
              {rating === 3 && t.note.ratingLabels.good}
              {rating === 4 && t.note.ratingLabels.veryGood}
              {rating === 5 && t.note.ratingLabels.excellent}
            </p>
          </div>

          {/* Comment */}
          <div className="space-y-2">
            <label htmlFor="comment" className="text-sm font-medium">
              {forceReadOnly
                ? t.note.visitorComments
                : (isReadOnly ? t.note.yourComments : t.note.shareExperience)
              }
            </label>
            <Textarea
              fullWidth
              rows={4}
              id="comment"
              placeholder={isReadOnly ? t.note.noComments : t.note.placeholder}
              value={comment}
              onChange={isReadOnly ? undefined : (e) => setComment(e.target.value)}
              maxLength={maxCommentLength}
              className="resize-none"
              readOnly={isReadOnly}
            />
            {!isReadOnly && (
              <p className={`text-xs text-right ${remainingChars < 100 ? 'text-destructive' : 'text-muted-foreground'}`}>
                {remainingChars} characters remaining
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          {isReadOnly ? (
            <Button onClick={handleSkip}>
              {t.common.close}
            </Button>
          ) : (
            <>
              <Button
                variant="ghost"
                onClick={handleSkip}
                disabled={isSubmitting}
              >
                {t.common.skip}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? (existingReview ? 'Updating...' : 'Submitting...')
                  : (existingReview ? t.note.updateNote : t.note.submitNote)
                }
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
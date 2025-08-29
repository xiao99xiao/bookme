import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import StarRating from './StarRating';

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
      toast.error('Please select a rating');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(rating, comment.trim());
      toast.success(existingReview ? 'Review updated successfully!' : 'Thank you for your review!');
      onClose();
      // Reset form
      setRating(5);
      setComment('');
    } catch (error) {
      console.error('Failed to submit review:', error);
      toast.error(`Failed to ${existingReview ? 'update' : 'submit'} review. Please try again.`);
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
              ? 'Customer Review' 
              : (isReadOnly 
                  ? 'Your review' 
                  : (existingReview ? 'Update your review' : 'How was your experience?')
                )
            }
          </DialogTitle>
          <DialogDescription>
            {forceReadOnly
              ? `Review from ${booking.customer?.display_name || 'customer'} for ${booking.services?.title || 'this service'}`
              : (isReadOnly 
                  ? `Your review for ${booking.provider?.display_name || 'the provider'} - ${booking.services?.title || 'this service'}`
                  : (existingReview 
                      ? `Update your review for ${booking.provider?.display_name || 'the provider'} - ${booking.services?.title || 'this service'}`
                      : `Rate your experience with ${booking.provider?.display_name || 'the provider'} for ${booking.services?.title || 'this service'}`
                    )
                )
            }
          </DialogDescription>
          {isReadOnly && !forceReadOnly && (
            <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
              <p className="text-sm text-amber-800">
                ⏰ Reviews can only be edited within 7 days of the service completion. You can view your review below.
              </p>
            </div>
          )}
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Star Rating */}
          <div className="flex flex-col items-center space-y-2">
            <p className="text-sm text-muted-foreground">
              {forceReadOnly 
                ? 'Customer rating' 
                : (isReadOnly ? 'Your rating' : 'Rate your experience')
              }
            </p>
            <StarRating 
              value={rating} 
              onChange={isReadOnly ? undefined : setRating} 
              readonly={isReadOnly}
              size="lg"
            />
            <p className="text-sm font-medium">
              {rating === 1 && 'Poor'}
              {rating === 2 && 'Fair'}
              {rating === 3 && 'Good'}
              {rating === 4 && 'Very Good'}
              {rating === 5 && 'Excellent'}
            </p>
          </div>

          {/* Comment */}
          <div className="space-y-2">
            <label htmlFor="comment" className="text-sm font-medium">
              {forceReadOnly 
                ? 'Customer comments' 
                : (isReadOnly ? 'Your comments' : 'Share your experience (optional)')
              }
            </label>
            <Textarea
              id="comment"
              placeholder={isReadOnly ? 'No comments provided' : 'Tell us about your experience with this service...'}
              value={comment}
              onChange={isReadOnly ? undefined : (e) => setComment(e.target.value)}
              maxLength={maxCommentLength}
              rows={4}
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
              Close
            </Button>
          ) : (
            <>
              <Button
                variant="ghost"
                onClick={handleSkip}
                disabled={isSubmitting}
              >
                Skip
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting 
                  ? (existingReview ? 'Updating...' : 'Submitting...') 
                  : (existingReview ? 'Update Review' : 'Submit Review')
                }
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
import { useState } from 'react';
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
    services?: {
      title: string;
    };
    provider?: {
      display_name: string;
    };
  };
  onSubmit: (rating: number, comment: string) => Promise<void>;
}

export default function ReviewDialog({ 
  isOpen, 
  onClose, 
  booking, 
  onSubmit 
}: ReviewDialogProps) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
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
      toast.success('Thank you for your review!');
      onClose();
      // Reset form
      setRating(5);
      setComment('');
    } catch (error) {
      console.error('Failed to submit review:', error);
      toast.error('Failed to submit review. Please try again.');
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
          <DialogTitle>How was your experience?</DialogTitle>
          <DialogDescription>
            Rate your experience with {booking.provider?.display_name || 'the provider'} 
            for {booking.services?.title || 'this service'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Star Rating */}
          <div className="flex flex-col items-center space-y-2">
            <p className="text-sm text-muted-foreground">Rate your experience</p>
            <StarRating 
              value={rating} 
              onChange={setRating} 
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
              Share your experience (optional)
            </label>
            <Textarea
              id="comment"
              placeholder="Tell us about your experience with this service..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={maxCommentLength}
              rows={4}
              className="resize-none"
            />
            <p className={`text-xs text-right ${remainingChars < 100 ? 'text-destructive' : 'text-muted-foreground'}`}>
              {remainingChars} characters remaining
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between gap-3">
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
            {isSubmitting ? 'Submitting...' : 'Submit Review'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { H3, Text, Description } from '@/design-system';
import StarRating from "@/components/StarRating";

interface Review {
  id: string;
  booking_id: string;
  reviewer_id: string;
  reviewee_id: string;
  service_id: string;
  rating: number;
  comment: string;
  is_public: boolean;
  created_at: string;
  services?: {
    title: string;
  };
  reviewer?: {
    display_name: string;
    avatar: string;
  };
}

interface ReviewCommentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  review: Review;
}

export const ReviewCommentDialog: React.FC<ReviewCommentDialogProps> = ({
  isOpen,
  onClose,
  review
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={review.reviewer?.avatar} />
                <AvatarFallback>
                  {review.reviewer?.display_name?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <H3 className="mb-1">
                  {review.reviewer?.display_name || 'Anonymous'}
                </H3>
                <Text variant="small" color="secondary">
                  {review.services?.title}
                </Text>
              </div>
              <div className="text-right">
                <StarRating value={review.rating} readonly size="sm" />
                <Text variant="small" color="tertiary" className="mt-1">
                  {new Date(review.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </Text>
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <div className="mt-6">
          {review.comment ? (
            <div className="prose prose-sm max-w-none">
              <Text variant="regular" className="leading-relaxed whitespace-pre-wrap">
                {review.comment}
              </Text>
            </div>
          ) : (
            <Text variant="regular" color="secondary" className="italic">
              No comment provided
            </Text>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReviewCommentDialog;
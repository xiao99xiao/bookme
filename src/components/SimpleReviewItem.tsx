import { Star } from "lucide-react";
import { Text } from '@/design-system';
import { Button } from "@/components/ui/button";

interface Review {
  id: string;
  rating: number;
  comment: string;
  services?: {
    title: string;
  };
  reviewer?: {
    display_name: string;
    avatar: string;
  };
}

interface SimpleReviewItemProps {
  review: Review;
  onRevealComment?: () => void;
  isCommentTruncated?: boolean;
}

export function SimpleReviewItem({ review, onRevealComment, isCommentTruncated }: SimpleReviewItemProps) {
  return (
    <div className="flex gap-6 items-start w-full">
      {/* Review Text */}
      <div className="flex-1">
        <Text className="font-['Baloo_2'] text-[16px] font-normal text-[#666666] leading-[1.5]">
          "{review.comment}"
        </Text>
        {isCommentTruncated && onRevealComment && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRevealComment}
            className="mt-1 h-auto p-0 text-blue-600 hover:text-blue-700 hover:bg-transparent text-sm"
          >
            Reveal full comment
          </Button>
        )}
      </div>
      
      {/* Rating */}
      <div className="bg-[#fcf9f4] flex gap-1 items-center px-2 py-[5px] rounded-[12px] shrink-0 h-8">
        {/* Stars */}
        <div className="flex items-center">
          {Array.from({ length: 5 }).map((_, index) => (
            <Star 
              key={index} 
              className="h-5 w-5 text-[#ffd43c] fill-current" 
            />
          ))}
        </div>
        
        {/* Rating Text */}
        <Text className="font-['Baloo_2'] text-[14px] font-medium text-black leading-[1.5] whitespace-nowrap">
          {review.rating}/5
        </Text>
      </div>
    </div>
  );
}
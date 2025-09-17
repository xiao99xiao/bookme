import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MapPin, Star } from "lucide-react";
import { H1, Text } from '@/design-system';

interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  bio: string | null;
  location: string | null;
  avatar: string | null;
  rating: number;
  review_count: number;
}

interface ProfileHeaderProps {
  profile: UserProfile;
}

export function ProfileHeader({ profile }: ProfileHeaderProps) {
  return (
    <div className="flex gap-10 items-center w-full">
      {/* Avatar */}
      <div className="shrink-0">
        <Avatar className="h-[120px] w-[120px] rounded-[40px]">
          <AvatarImage 
            src={profile.avatar || ""} 
            alt={profile.display_name || "User"} 
            className="rounded-[40px]"
          />
          <AvatarFallback className="text-2xl bg-muted text-foreground rounded-[40px]">
            {profile.display_name?.charAt(0) || profile.email?.charAt(0) || "U"}
          </AvatarFallback>
        </Avatar>
      </div>
      
      {/* Name and Info */}
      <div className="flex-1 flex flex-col gap-6 min-w-0">
        {/* Name */}
        <H1 className="font-['Raleway'] text-[24px] font-bold text-black leading-[1.4]">
          {profile.display_name || profile.email?.split('@')[0] || 'User'}
        </H1>
        
        {/* Location and Rating */}
        <div className="flex gap-2 items-start">
          {profile.location && (
            <div className="bg-[#fcf9f4] flex gap-1 items-center px-4 py-3 rounded-[12px]">
              <MapPin className="h-5 w-5 text-[#666666]" />
              <Text className="font-['Baloo_2'] text-[16px] font-normal text-[#666666] leading-[1.5] whitespace-nowrap">
                {profile.location}
              </Text>
            </div>
          )}
          
          <div className="bg-[#fcf9f4] flex gap-1 items-center px-4 py-3 rounded-[12px]">
            <Star className="h-5 w-5 text-[#666666] fill-current" />
            <Text className="font-['Baloo_2'] text-[16px] font-normal text-[#666666] leading-[1.5] whitespace-nowrap">
              {profile.rating.toFixed(1)} ({profile.review_count} reviews)
            </Text>
          </div>
        </div>
      </div>
    </div>
  );
}
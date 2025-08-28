'use client';

import { Star, MapPin, Heart, Target } from 'lucide-react';

interface UserProfileCardProps {
  profile: {
    id: string;
    display_name: string | null;
    bio: string | null;
    location: string | null;
    avatar: string | null;
    rating: number;
    review_count: number;
    created_at: string;
  } | null;
  servicesCount?: number;
  isOwnProfile?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showFullBio?: boolean;
}

export default function UserProfileCard({ profile, servicesCount = 0, isOwnProfile = false, size = 'md', showFullBio = false }: UserProfileCardProps) {
  const sizeClasses = {
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6'
  };

  const avatarSizes = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16'
  };

  const textSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  };

  return (
    <div className={`bg-white rounded-xl border border-gray-200 ${sizeClasses[size]}`}>
      <div className="flex items-start space-x-3">
        <img
          src={profile?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.display_name || 'User')}&background=3b82f6&color=fff`}
          alt={profile?.display_name || 'User'}
          className={`${avatarSizes[size]} rounded-full border-2 border-gray-200 flex-shrink-0`}
        />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className={`font-semibold text-gray-900 truncate ${textSizes[size]}`}>
              {profile?.display_name || 'User'}
            </h3>
            {profile && profile.review_count > 0 && (
              <div className="flex items-center text-sm text-gray-500 flex-shrink-0 ml-2">
                <Star className="w-3 h-3 text-yellow-400 mr-1" />
                <span className="font-medium">{profile.rating.toFixed(1)}</span>
                <span className="text-gray-400 ml-1">({profile.review_count})</span>
              </div>
            )}
          </div>

          {profile?.location && (
            <div className="flex items-center text-sm text-gray-500 mt-1">
              <MapPin className="w-3 h-3 mr-1 flex-shrink-0" />
              <span className="truncate">{profile.location}</span>
            </div>
          )}

          {profile?.bio && (
            <p className={`text-gray-600 mt-2 ${
              showFullBio ? '' : 'line-clamp-2'
            } ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
              {profile.bio}
            </p>
          )}

          {servicesCount !== undefined && (
            <div className="mt-3 grid grid-cols-2 gap-4 pt-3 border-t border-gray-200">
              <div className="text-center">
                <p className="text-lg font-semibold">{servicesCount}</p>
                <p className="text-xs text-gray-500">Services</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold">{profile?.review_count || 0}</p>
                <p className="text-xs text-gray-500">Reviews</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
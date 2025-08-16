'use client';

import { Star, MapPin, Heart, Target } from 'lucide-react';

interface UserProfileCardProps {
  user: {
    id: string;
    displayName: string;
    bio?: string;
    location?: string;
    hobbies?: string[];
    interests?: string[];
    avatar?: string;
    rating: number;
    reviewCount: number;
  };
  size?: 'sm' | 'md' | 'lg';
  showFullBio?: boolean;
}

export default function UserProfileCard({ user, size = 'md', showFullBio = false }: UserProfileCardProps) {
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
          src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName)}&background=3b82f6&color=fff`}
          alt={user.displayName}
          className={`${avatarSizes[size]} rounded-full border-2 border-gray-200 flex-shrink-0`}
        />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className={`font-semibold text-gray-900 truncate ${textSizes[size]}`}>
              {user.displayName}
            </h3>
            {user.reviewCount > 0 && (
              <div className="flex items-center text-sm text-gray-500 flex-shrink-0 ml-2">
                <Star className="w-3 h-3 text-yellow-400 mr-1" />
                <span className="font-medium">{user.rating.toFixed(1)}</span>
                <span className="text-gray-400 ml-1">({user.reviewCount})</span>
              </div>
            )}
          </div>

          {user.location && (
            <div className="flex items-center text-sm text-gray-500 mt-1">
              <MapPin className="w-3 h-3 mr-1 flex-shrink-0" />
              <span className="truncate">{user.location}</span>
            </div>
          )}

          {user.bio && (
            <p className={`text-gray-600 mt-2 ${
              showFullBio ? '' : 'line-clamp-2'
            } ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
              {user.bio}
            </p>
          )}

          {(user.hobbies?.length || user.interests?.length) && size !== 'sm' && (
            <div className="mt-3 space-y-2">
              {user.hobbies && user.hobbies.length > 0 && (
                <div>
                  <div className="flex items-center text-xs font-medium text-gray-500 mb-1">
                    <Heart className="w-3 h-3 mr-1" />
                    Hobbies
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {user.hobbies.slice(0, 3).map((hobby) => (
                      <span
                        key={hobby}
                        className="px-2 py-1 text-xs bg-pink-100 text-pink-700 rounded-full"
                      >
                        {hobby}
                      </span>
                    ))}
                    {user.hobbies.length > 3 && (
                      <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
                        +{user.hobbies.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              {user.interests && user.interests.length > 0 && (
                <div>
                  <div className="flex items-center text-xs font-medium text-gray-500 mb-1">
                    <Target className="w-3 h-3 mr-1" />
                    Interests
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {user.interests.slice(0, 3).map((interest) => (
                      <span
                        key={interest}
                        className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full"
                      >
                        {interest}
                      </span>
                    ))}
                    {user.interests.length > 3 && (
                      <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
                        +{user.interests.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
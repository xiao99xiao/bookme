import { Video, ExternalLink, Copy, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GoogleMeetIcon, ZoomIcon, TeamsIcon } from '@/components/icons/MeetingPlatformIcons';
import { toast } from 'sonner';

interface MeetingLinkDisplayProps {
  meetingLink?: string;
  meetingPlatform?: string;
  scheduledAt?: string;
  className?: string;
}

const platformIcons = {
  google_meet: GoogleMeetIcon,
  zoom: ZoomIcon,
  teams: TeamsIcon,
};

const platformLabels = {
  google_meet: 'Google Meet',
  zoom: 'Zoom',
  teams: 'Microsoft Teams',
};

export default function MeetingLinkDisplay({ 
  meetingLink, 
  meetingPlatform, 
  scheduledAt,
  className = '' 
}: MeetingLinkDisplayProps) {
  if (!meetingLink || !meetingPlatform) {
    return null;
  }

  const IconComponent = platformIcons[meetingPlatform as keyof typeof platformIcons];
  const platformLabel = platformLabels[meetingPlatform as keyof typeof platformLabels];
  
  // Check if meeting is happening soon (within 15 minutes) or is live
  const meetingTime = scheduledAt ? new Date(scheduledAt) : null;
  const now = new Date();
  const minutesUntilMeeting = meetingTime ? Math.floor((meetingTime.getTime() - now.getTime()) / (1000 * 60)) : null;
  const isLive = minutesUntilMeeting !== null && minutesUntilMeeting <= 0 && minutesUntilMeeting > -60; // Live for 1 hour
  const isStartingSoon = minutesUntilMeeting !== null && minutesUntilMeeting > 0 && minutesUntilMeeting <= 15;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(meetingLink);
      toast.success('Meeting link copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy meeting link');
    }
  };

  const handleJoinMeeting = () => {
    window.open(meetingLink, '_blank');
  };

  return (
    <div className={`border rounded-lg p-4 bg-blue-50 border-blue-200 ${className}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3">
          {IconComponent && <IconComponent className="w-5 h-5" />}
          <div>
            <div className="flex items-center space-x-2">
              <h4 className="font-medium text-gray-900">Meeting Link</h4>
              {isLive && (
                <Badge variant="destructive" className="text-xs">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse mr-1" />
                  LIVE
                </Badge>
              )}
              {isStartingSoon && (
                <Badge variant="default" className="text-xs">
                  <Clock className="w-3 h-3 mr-1" />
                  Starting soon
                </Badge>
              )}
            </div>
            <p className="text-sm text-gray-600 mt-1">
              {platformLabel} • Ready when you are
            </p>
          </div>
        </div>
        
        <div className="flex space-x-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopyLink}
            className="text-xs"
          >
            <Copy className="w-3 h-3 mr-1" />
            Copy
          </Button>
          <Button
            size="sm"
            onClick={handleJoinMeeting}
            className={`text-xs ${
              isLive 
                ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse' 
                : isStartingSoon
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            <ExternalLink className="w-3 h-3 mr-1" />
            {isLive ? 'Join Now' : isStartingSoon ? 'Join Meeting' : 'Join Meeting'}
          </Button>
        </div>
      </div>
      
      {meetingTime && (
        <div className="mt-3 text-xs text-gray-500">
          {minutesUntilMeeting !== null && minutesUntilMeeting > 0 && (
            <span>Meeting starts in {minutesUntilMeeting} minute{minutesUntilMeeting !== 1 ? 's' : ''}</span>
          )}
          {isLive && (
            <span>Meeting is live now</span>
          )}
          {minutesUntilMeeting !== null && minutesUntilMeeting < -60 && (
            <span>Meeting ended</span>
          )}
        </div>
      )}
    </div>
  );
}
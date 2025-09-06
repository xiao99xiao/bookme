import React from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import { Button } from './Button';
import { Text } from './Typography';

interface IntegrationCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  status?: 'connected' | 'not_connected' | 'coming_soon';
  connectionEmail?: string;
  connectionDate?: string;
  onConnect?: () => void;
  onDisconnect?: () => void;
  isLoading?: boolean;
  comingSoonText?: string;
}

export const IntegrationCard: React.FC<IntegrationCardProps> = ({
  icon,
  title,
  description,
  status = 'not_connected',
  connectionEmail,
  connectionDate,
  onConnect,
  onDisconnect,
  isLoading = false,
  comingSoonText = "Coming soon! We're working on integrating with this platform."
}) => {
  const isConnected = status === 'connected';
  const isComingSoon = status === 'coming_soon';

  return (
    <div className="bg-white rounded-2xl border border-[#eeeeee] p-6 transition-all hover:shadow-sm">
      <div className="flex items-start justify-between mb-4">
        {/* Left side with icon and text */}
        <div className="flex items-start gap-4 flex-1">
          {/* Icon */}
          <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center">
            {icon}
          </div>
          
          {/* Text content */}
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-black mb-1">{title}</h3>
            <Text variant="regular" color="secondary" className="text-sm">
              {description}
            </Text>
          </div>
        </div>

        {/* Action button */}
        <div className="flex-shrink-0 ml-4">
          {isComingSoon ? (
            <Button
              variant="secondary"
              size="small"
              disabled
            >
              Coming Soon
            </Button>
          ) : isConnected ? (
            <Button
              variant="outline"
              size="small"
              onClick={onDisconnect}
              disabled={isLoading}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              Disconnect
            </Button>
          ) : (
            <Button
              variant="primary"
              size="small"
              onClick={onConnect}
              disabled={isLoading}
            >
              Connect
            </Button>
          )}
        </div>
      </div>

      {/* Status section */}
      <div className="ml-16">
        {isComingSoon ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            {comingSoonText}
          </div>
        ) : isConnected ? (
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                <span className="text-green-600">Connected</span>
                {connectionEmail && (
                  <>
                    <span className="text-gray-400">•</span>
                    <span className="text-gray-900">{connectionEmail}</span>
                  </>
                )}
              </div>
              {connectionDate && (
                <Text variant="small" color="tertiary" className="mt-0.5">
                  Connected {connectionDate}
                </Text>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm">
            <XCircle className="w-5 h-5 text-gray-400" />
            <span className="text-gray-500">Not Connected</span>
            <span className="text-gray-500 ml-2">We now support {title}!</span>
          </div>
        )}
      </div>
    </div>
  );
};
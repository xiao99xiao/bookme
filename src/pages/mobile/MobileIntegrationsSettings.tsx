import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ArrowLeft, Loader2, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/PrivyAuthContext';
import { ApiClient } from '@/lib/api-migration';
import { GoogleAuth } from '@/lib/google-auth';
import { GoogleMeetIcon, ZoomIcon, TeamsIcon } from '@/components/icons/MeetingPlatformIcons';
import { H2, H3, Text, Description } from '@/design-system';

interface MeetingIntegration {
  id: string;
  user_id: string;
  platform: 'google_meet' | 'zoom' | 'teams';
  platform_user_email: string;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  is_valid?: boolean;
}

const PLATFORM_INFO = {
  google_meet: {
    name: 'Google Meet',
    description: 'Automatically create Google Meet links for your online services',
    icon: GoogleMeetIcon,
    color: 'bg-green-50 border-green-200',
    connectUrl: '/api/auth/google-meet/connect'
  },
  zoom: {
    name: 'Zoom',
    description: 'Create Zoom meetings for your online services',
    icon: ZoomIcon,
    color: 'bg-blue-50 border-blue-200',
    connectUrl: '/api/auth/zoom/connect',
    comingSoon: true
  },
  teams: {
    name: 'Microsoft Teams',
    description: 'Generate Teams meeting links automatically',
    icon: TeamsIcon,
    color: 'bg-purple-50 border-purple-200',
    connectUrl: '/api/auth/teams/connect',
    comingSoon: true
  }
};

export default function MobileIntegrationsSettings() {
  const { userId } = useAuth();
  const navigate = useNavigate();
  const [integrations, setIntegrations] = useState<MeetingIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);

  useEffect(() => {
    if (userId) {
      loadIntegrations();
    }
  }, [userId]);

  const loadIntegrations = async () => {
    try {
      setLoading(true);
      const data = await ApiClient.getMeetingIntegrations(userId || undefined);
      setIntegrations(data);
    } catch (error) {
      console.error('Failed to load integrations:', error);
      toast.error('Failed to load meeting integrations');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (platform: string) => {
    if (PLATFORM_INFO[platform as keyof typeof PLATFORM_INFO].comingSoon) {
      toast.info(`${PLATFORM_INFO[platform as keyof typeof PLATFORM_INFO].name} integration coming soon!`);
      return;
    }

    if (platform === 'google_meet') {
      setConnectingPlatform(platform);
      try {
        await GoogleAuth.authorize();
        await loadIntegrations();
        toast.success('Google Meet connected successfully!');
      } catch (error: any) {
        console.error('Failed to connect Google Meet:', error);
        if (error?.message?.includes('popup_blocked')) {
          toast.error('Popup blocked. Please allow popups and try again.');
        } else {
          toast.error('Failed to connect Google Meet. Please try again.');
        }
      } finally {
        setConnectingPlatform(null);
      }
    }
  };

  const handleDisconnect = async (integrationId: string, platform: string) => {
    try {
      await ApiClient.disconnectMeetingIntegration(integrationId);
      await loadIntegrations();
      toast.success(`${PLATFORM_INFO[platform as keyof typeof PLATFORM_INFO].name} disconnected successfully!`);
    } catch (error) {
      console.error('Failed to disconnect integration:', error);
      toast.error('Failed to disconnect integration');
    }
  };

  const getIntegrationForPlatform = (platform: string) => {
    return integrations.find(int => int.platform === platform && int.is_active);
  };

  const isExpiringSoon = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    const expiryDate = new Date(expiresAt);
    const now = new Date();
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
    return daysUntilExpiry <= 7;
  };

  if (loading) {
    return (
      <div className="lg:hidden min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <Text variant="small" color="secondary">Loading integrations...</Text>
        </div>
      </div>
    );
  }

  return (
    <div className="lg:hidden min-h-screen bg-gray-50 pb-20">
      <div className="px-4 py-6">
        {/* Header with back button */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate('/me')}
            className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <H2>Integrations</H2>
        </div>

        {/* Description */}
        <div className="bg-white rounded-2xl border border-[#eeeeee] p-4 mb-6">
          <Text variant="small" className="text-[#666666]">
            Connect your meeting platforms to automatically generate meeting links when customers book your online services.
          </Text>
        </div>

        {/* Integration Cards */}
        <div className="space-y-4">
          {Object.entries(PLATFORM_INFO).map(([platform, info]) => {
            const integration = getIntegrationForPlatform(platform);
            const isConnected = !!integration;
            const isExpiring = integration && isExpiringSoon(integration.expires_at);
            const isConnecting = connectingPlatform === platform;

            return (
              <div key={platform} className="bg-white rounded-2xl border border-[#eeeeee] p-4">
                <div className="flex items-start gap-4">
                  {/* Platform Icon */}
                  <div className={`w-12 h-12 rounded-lg ${info.color} flex items-center justify-center flex-shrink-0`}>
                    <info.icon className="w-6 h-6" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <H3 className="text-base">{info.name}</H3>
                      {info.comingSoon && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          Coming Soon
                        </span>
                      )}
                    </div>

                    <Text variant="small" className="text-[#666666] mb-3">
                      {info.description}
                    </Text>

                    {/* Connection Status */}
                    {isConnected ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <Text variant="small" className="text-green-600 font-medium">
                            Connected as {integration.platform_user_email}
                          </Text>
                        </div>

                        {integration.expires_at && (
                          <div className={`flex items-center gap-2 ${isExpiring ? 'text-orange-600' : 'text-[#666666]'}`}>
                            {isExpiring && <AlertCircle className="w-4 h-4" />}
                            <Text variant="small">
                              Expires {format(new Date(integration.expires_at), 'MMM d, yyyy')}
                            </Text>
                          </div>
                        )}

                        <div className="flex gap-2 pt-2">
                          {isExpiring && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleConnect(platform)}
                              disabled={isConnecting}
                              className="flex-1"
                            >
                              {isConnecting ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Reconnecting...
                                </>
                              ) : (
                                'Reconnect'
                              )}
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDisconnect(integration.id, platform)}
                            className={isExpiring ? 'flex-1' : 'w-full'}
                          >
                            Disconnect
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        onClick={() => handleConnect(platform)}
                        disabled={isConnecting || info.comingSoon}
                        size="sm"
                        className="w-full"
                      >
                        {isConnecting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Connecting...
                          </>
                        ) : (
                          <>
                            Connect {info.name}
                            <ExternalLink className="ml-2 h-4 w-4" />
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Help Info */}
        <div className="bg-blue-50 rounded-2xl border border-blue-200 p-4 mt-6">
          <Text variant="small" className="text-blue-800">
            <strong>How it works:</strong> When a customer books an online service, we'll automatically create a meeting link using your connected platform and include it in the booking confirmation.
          </Text>
        </div>
      </div>
    </div>
  );
}
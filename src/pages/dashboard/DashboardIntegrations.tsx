import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Settings, ExternalLink, Trash2, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/PrivyAuthContext';
import { ApiClient } from '@/lib/api';
import { GoogleAuth } from '@/lib/google-auth';
import { GoogleMeetIcon, ZoomIcon, TeamsIcon } from '@/components/icons/MeetingPlatformIcons';

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

export default function DashboardIntegrations() {
  const { userId } = useAuth();
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
      console.log('Loaded integrations:', data);
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

    setConnectingPlatform(platform);
    
    try {
      if (platform === 'google_meet') {
        // Use client-side Google OAuth
        GoogleAuth.initiateOAuth();
      } else {
        // For other platforms, use API (when implemented)
        const response = await ApiClient.getMeetingOAuthUrl(platform);
        window.location.href = response.authUrl;
      }
    } catch (error) {
      console.error('Failed to initiate OAuth:', error);
      toast.error('Failed to connect platform');
      setConnectingPlatform(null);
    }
  };

  const handleDisconnect = async (integrationId: string, platform: string) => {
    if (!confirm(`Are you sure you want to disconnect ${PLATFORM_INFO[platform as keyof typeof PLATFORM_INFO].name}?`)) {
      return;
    }

    try {
      await ApiClient.deleteMeetingIntegration(integrationId);
      toast.success('Integration disconnected successfully');
      loadIntegrations();
    } catch (error) {
      console.error('Failed to disconnect integration:', error);
      toast.error('Failed to disconnect integration');
    }
  };

  const getConnectionStatus = (platform: string) => {
    const integration = integrations.find(i => i.platform === platform && i.is_active);
    
    if (!integration) {
      return { connected: false, status: 'not_connected' };
    }

    // Only check expiration if there's an expires_at date (no refresh token)
    const isExpired = integration.expires_at && new Date(integration.expires_at) < new Date();
    
    if (isExpired) {
      return { connected: true, status: 'expired', integration };
    }

    return { connected: true, status: 'connected', integration };
  };

  const renderIntegrationCard = (platformKey: string) => {
    const platform = PLATFORM_INFO[platformKey as keyof typeof PLATFORM_INFO];
    const connectionStatus = getConnectionStatus(platformKey);
    const { connected, status, integration } = connectionStatus;
    const IconComponent = platform.icon;

    return (
      <Card key={platformKey} className={`${platform.color} transition-colors hover:shadow-md`}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <IconComponent className="w-8 h-8" />
              </div>
              <div>
                <CardTitle className="text-lg">{platform.name}</CardTitle>
                <CardDescription className="text-sm">
                  {platform.description}
                </CardDescription>
              </div>
            </div>
            
            {connected ? (
              <Badge variant={status === 'connected' ? 'default' : 'destructive'}>
                {status === 'connected' ? (
                  <>
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Connected
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Expired
                  </>
                )}
              </Badge>
            ) : (
              <Badge variant="outline">Not Connected</Badge>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {connected && integration ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <p className="font-medium text-gray-900">{integration.platform_user_email}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Connected {format(new Date(integration.created_at), 'MMM dd, yyyy')}
                  </p>
                </div>
                {status === 'expired' && (
                  <Badge variant="destructive" className="text-xs">
                    Needs Reconnection
                  </Badge>
                )}
              </div>
              
              <div className="flex space-x-2">
                {status === 'expired' ? (
                  <Button
                    size="sm"
                    onClick={() => handleConnect(platformKey)}
                    disabled={connectingPlatform === platformKey}
                  >
                    {connectingPlatform === platformKey ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-1" />
                    ) : (
                      <ExternalLink className="w-4 h-4 mr-1" />
                    )}
                    Reconnect
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDisconnect(integration.id, platformKey)}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Disconnect
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {platform.comingSoon ? (
                <div className="text-sm text-gray-500">
                  Coming soon! We're working on integrating with {platform.name}.
                </div>
              ) : (
                <div className="text-sm text-gray-600">
                  Connect your {platform.name} account to automatically generate meeting links for your online services.
                </div>
              )}
              
              <Button
                size="sm"
                onClick={() => handleConnect(platformKey)}
                disabled={connectingPlatform === platformKey || platform.comingSoon}
                variant={platform.comingSoon ? "outline" : "default"}
              >
                {connectingPlatform === platformKey ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <ExternalLink className="w-4 h-4 mr-1" />
                )}
                {platform.comingSoon ? 'Coming Soon' : `Connect ${platform.name}`}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Meeting Integrations</h1>
        <p className="text-gray-600">
          Connect your meeting platforms to automatically generate meeting links for online services.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Integration Cards */}
          <div className="grid gap-6">
            {Object.keys(PLATFORM_INFO).map(renderIntegrationCard)}
          </div>

          {/* Help Section */}
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <Settings className="w-5 h-5 mr-2" />
                How it works
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="space-y-2">
                <p><strong>1. Connect your accounts:</strong> Authorize Timee to create meetings on your behalf</p>
                <p><strong>2. Create online services:</strong> When creating services, select your preferred meeting platform</p>
                <p><strong>3. Automatic meeting creation:</strong> When bookings are confirmed, meeting links are automatically generated</p>
                <p><strong>4. Share with customers:</strong> Meeting links appear in booking confirmations and customer dashboards</p>
              </div>
              
              <div className="mt-4 p-3 bg-white rounded border border-blue-200">
                <p className="text-xs text-gray-600">
                  <strong>Note:</strong> Your account credentials are securely stored and only used to create meetings for your confirmed bookings.
                  You can disconnect any platform at any time.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
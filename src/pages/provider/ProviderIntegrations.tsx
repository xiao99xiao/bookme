import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Settings, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader, IntegrationCard, Loading } from '@/design-system';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/PrivyAuthContext';
import { ApiClient } from '@/lib/api-migration';
import { GoogleAuth } from '@/lib/google-auth';
import { GoogleMeetIcon, ZoomIcon, TeamsIcon } from '@/components/icons/MeetingPlatformIcons';
import { APP_NAME } from '@/lib/constants';

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

export default function ProviderIntegrations() {
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


  const renderIntegrationCards = () => {
    return Object.keys(PLATFORM_INFO).map((platformKey) => {
      const platform = PLATFORM_INFO[platformKey as keyof typeof PLATFORM_INFO];
      const connectionStatus = getConnectionStatus(platformKey);
      const { connected, status, integration } = connectionStatus;
      const IconComponent = platform.icon;

      return (
        <IntegrationCard
          key={platformKey}
          icon={<IconComponent className="w-12 h-12" />}
          title={platform.name}
          description={platform.description}
          status={
            platform.comingSoon ? 'coming_soon' : 
            connected ? 'connected' : 'not_connected'
          }
          connectionEmail={integration?.platform_user_email}
          connectionDate={integration ? format(new Date(integration.created_at), 'MMM dd, yyyy') : undefined}
          onConnect={() => handleConnect(platformKey)}
          onDisconnect={() => integration && handleDisconnect(integration.id, platformKey)}
          isLoading={connectingPlatform === platformKey}
          comingSoonText={platform.comingSoon ? `Coming soon! We're working on integrating with ${platform.name}.` : undefined}
        />
      );
    });
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Page Header */}
      <PageHeader
        title="Meeting Integrations"
        description="Connect your meeting platforms to automatically generate meeting links for online services."
      />

      {loading ? (
        <Loading />
      ) : (
        <div className="space-y-6">
          {/* Integration Cards */}
          <div className="space-y-4">
            {renderIntegrationCards()}
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
                <p><strong>1. Connect your accounts:</strong> Authorize {APP_NAME} to create meetings on your behalf</p>
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
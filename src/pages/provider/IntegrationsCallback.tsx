import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button as DSButton } from '@/design-system';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { ApiClient } from '@/lib/api-migration';

export default function IntegrationsCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const code = searchParams.get('code');
        const error = searchParams.get('error');
        const state = searchParams.get('state');

        if (error) {
          setStatus('error');
          setMessage(`Authorization failed: ${error}`);
          toast.error('Integration failed');
          return;
        }

        if (!code) {
          setStatus('error');
          setMessage('No authorization code received');
          toast.error('Integration failed');
          return;
        }

        // Exchange the authorization code for tokens
        // This would typically be done on the backend for security
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            code,
            client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
            client_secret: import.meta.env.VITE_GOOGLE_CLIENT_SECRET,
            redirect_uri: `${window.location.origin}/provider/integrations/callback`,
            grant_type: 'authorization_code',
          }),
        });

        const tokenData = await tokenResponse.json();

        if (tokenData.error) {
          setStatus('error');
          setMessage(`Token exchange failed: ${tokenData.error_description || tokenData.error}`);
          toast.error('Integration failed');
          return;
        }

        // Get user info from Google
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
          },
        });

        const userInfo = await userInfoResponse.json();

        // Save the integration
        await ApiClient.saveIntegration({
          platform: 'google_meet',
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
          scope: tokenData.scope?.split(' ') || [],
          platform_user_id: userInfo.id,
          platform_user_email: userInfo.email,
        });

        setStatus('success');
        setMessage('Google Meet integration connected successfully!');
        toast.success('Google Meet connected successfully!');

      } catch (error) {
        console.error('Integration callback error:', error);
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'An unexpected error occurred');
        toast.error('Integration failed');
      }
    };

    handleCallback();
  }, [searchParams]);

  const handleGoBack = () => {
    navigate('/provider/integrations');
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card>
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {status === 'loading' && <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />}
            {status === 'success' && <CheckCircle className="w-12 h-12 text-green-500" />}
            {status === 'error' && <XCircle className="w-12 h-12 text-red-500" />}
          </div>
          
          <CardTitle>
            {status === 'loading' && 'Connecting Integration...'}
            {status === 'success' && 'Integration Successful!'}
            {status === 'error' && 'Integration Failed'}
          </CardTitle>
          
          <CardDescription>
            {message || 'Please wait while we connect your integration...'}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="text-center">
          {(status === 'success' || status === 'error') && (
            <DSButton onClick={handleGoBack} className="mt-4" variant="primary">
              Go Back to Integrations
            </DSButton>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
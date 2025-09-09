import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button as DSButton } from '@/design-system';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { usePrivy } from '@privy-io/react-auth';

export default function IntegrationsCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { getAccessToken } = usePrivy();
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

        // Get the redirect URI that was used for this request
        const redirectUri = `${window.location.origin}/provider/integrations/callback`;
        
        // Send the authorization code to our secure backend
        const accessToken = await getAccessToken();
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/oauth/google-callback`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            code,
            redirectUri
          }),
        });

        const result = await response.json();

        if (!response.ok || result.error) {
          setStatus('error');
          setMessage(result.error || 'Failed to connect Google integration');
          toast.error('Integration failed');
          return;
        }

        setStatus('success');
        setMessage(result.message || 'Google Meet integration connected successfully!');
        toast.success(`Google Meet connected: ${result.userEmail}`);

      } catch (error) {
        console.error('Integration callback error:', error);
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'An unexpected error occurred');
        toast.error('Integration failed');
      }
    };

    handleCallback();
  }, [searchParams, getAccessToken]);

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
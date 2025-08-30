import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { GoogleAuth } from '@/lib/google-auth';
import { useAuth } from '@/contexts/PrivyAuthContext';
import ApiClient from '@/lib/api-migration';

export default function IntegrationsCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { userId } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processing OAuth callback...');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error');

        if (error) {
          throw new Error(`OAuth error: ${error}`);
        }

        if (!code || !state) {
          throw new Error('Missing authorization code or state');
        }

        if (!userId) {
          throw new Error('User not authenticated');
        }

        setMessage('Exchanging authorization code for tokens...');

        // Handle the OAuth callback
        const authResult = await GoogleAuth.handleCallback(code, state);

        console.log('OAuth auth result:', authResult);
        console.log('Refresh token received:', !!authResult.refresh_token);
        console.log('Access token expires in:', authResult.expires_in, 'seconds');

        setMessage('Saving integration to database...');

        // For Google OAuth, we should always get a refresh token with offline access
        // If we don't get one, the integration will expire when the access token expires
        const expiresAt = authResult.refresh_token 
          ? null // Integration doesn't expire with refresh token
          : authResult.expires_in 
            ? new Date(Date.now() + (parseInt(authResult.expires_in) * 1000)).toISOString()
            : new Date(Date.now() + (60 * 60 * 1000)).toISOString(); // 1 hour fallback
        
        console.log('Integration expiration:', expiresAt || 'Never (has refresh token)');

        // Save the integration via backend API
        await ApiClient.saveIntegration({
          platform: 'google_meet',
          access_token: authResult.access_token,
          refresh_token: authResult.refresh_token || null,
          expires_at: expiresAt,
          scope: authResult.scope ? authResult.scope.split(' ') : [],
          platform_user_id: authResult.userInfo.id,
          platform_user_email: authResult.userInfo.email,
        });

        setStatus('success');
        setMessage('Google Meet integration successful!');
        toast.success('Google Meet connected successfully');
        
        // Redirect after a short delay
        setTimeout(() => {
          navigate('/dashboard/integrations');
        }, 2000);

      } catch (error) {
        console.error('OAuth callback error:', error);
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'Failed to complete integration');
        toast.error('Failed to connect Google Meet');
        
        // Redirect back to integrations page after error
        setTimeout(() => {
          navigate('/dashboard/integrations');
        }, 3000);
      }
    };

    handleCallback();
  }, [searchParams, userId, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
        <div className="mb-6">
          {status === 'loading' && (
            <div className="flex flex-col items-center">
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Connecting Google Meet
              </h2>
            </div>
          )}
          
          {status === 'success' && (
            <div className="flex flex-col items-center">
              <CheckCircle className="w-12 h-12 text-green-600 mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Connection Successful!
              </h2>
            </div>
          )}
          
          {status === 'error' && (
            <div className="flex flex-col items-center">
              <AlertCircle className="w-12 h-12 text-red-600 mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Connection Failed
              </h2>
            </div>
          )}
        </div>
        
        <p className="text-gray-600 mb-6">{message}</p>
        
        {status === 'success' && (
          <p className="text-sm text-gray-500">
            Redirecting to integrations page...
          </p>
        )}
        
        {status === 'error' && (
          <p className="text-sm text-gray-500">
            You will be redirected back to the integrations page shortly.
          </p>
        )}
      </div>
    </div>
  );
}
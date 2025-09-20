import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/PrivyAuthContext";
import { Loader2 } from "lucide-react";

const AuthCallback = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        console.log('=== AUTH CALLBACK START ===');
        console.log('URL:', window.location.href);
        console.log('Search params:', window.location.search);
        console.log('Hash:', window.location.hash);

        // Check for PKCE flow (code in query params)
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');

        // Check for implicit flow (tokens in hash) or errors
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const errorParam = hashParams.get('error');
        const errorDescription = hashParams.get('error_description');
        const errorCode = hashParams.get('error_code');

        console.log('Found code:', !!code);
        console.log('Found access_token:', !!accessToken);
        console.log('Found error:', !!errorParam);
        console.log('Error description:', errorDescription);

        // Prepare data for backend call
        const authData: any = {};

        if (code) authData.code = code;
        if (accessToken) authData.access_token = accessToken;
        if (refreshToken) authData.refresh_token = refreshToken;
        if (errorParam) authData.error = errorParam;
        if (errorDescription) authData.error_description = errorDescription;
        if (errorCode) authData.error_code = errorCode;

        // Get backend URL from environment
        const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4001';

        console.log('Calling backend auth callback endpoint...');

        // Call backend auth callback endpoint
        const response = await fetch(`${backendUrl}/api/auth/callback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(authData),
        });

        const result = await response.json();

        console.log('Backend response:', result);

        if (!response.ok || !result.success) {
          // Handle error from backend
          const errorMessage = result.error || 'Authentication failed. Please try again.';
          setError(errorMessage);
          setTimeout(() => navigate('/auth'), 5000);
          return;
        }

        // Success! Backend handled the OAuth flow
        console.log('Authentication successful, redirecting...');

        // Navigate to the redirect URL provided by backend, or default to discover
        const redirectTo = result.redirectTo || '/discover';

        // Small delay to allow any backend processing to complete
        setTimeout(() => {
          navigate(redirectTo);
        }, 1000);

      } catch (err) {
        console.error('Auth callback error:', err);
        setError('An unexpected error occurred during authentication.');
        setTimeout(() => navigate('/auth'), 3000);
      } finally {
        setLoading(false);
      }
    };

    handleAuthCallback();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Authenticating...</h2>
          <p className="text-muted-foreground">Please wait while we sign you in.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-6xl mb-4">❌</div>
          <h2 className="text-xl font-semibold mb-2">Authentication Failed</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <p className="text-sm text-muted-foreground">
            Redirecting to sign in page in a few seconds...
          </p>
        </div>
      </div>
    );
  }

  return null;
};

export default AuthCallback;
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
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
        
        // Handle error cases first
        if (errorParam) {
          console.log('Authentication error detected:', errorParam);
          let userFriendlyMessage = 'Authentication failed. Please try again.';
          
          if (errorCode === 'otp_expired') {
            userFriendlyMessage = 'The magic link has expired. Please request a new one.';
          } else if (errorParam === 'access_denied') {
            userFriendlyMessage = 'Authentication was denied or cancelled.';
          } else if (errorDescription) {
            // Use the error description from Supabase, decoded from URL
            userFriendlyMessage = decodeURIComponent(errorDescription.replace(/\+/g, ' '));
          }
          
          setError(userFriendlyMessage);
          setTimeout(() => navigate('/auth'), 5000); // Give user time to read the error
          return;
        }
        
        if (code) {
          console.log('Using PKCE flow with code exchange');
          // Exchange the code for a session
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          
          if (error) {
            setError(`Authentication failed: ${error.message}`);
            setTimeout(() => navigate('/auth'), 3000);
            return;
          }
        } else if (accessToken) {
          console.log('Using implicit flow - tokens already in URL');
          console.log('MANUALLY processing tokens with setSession');
          
          try {
            // Manually set the session since auto-detection isn't working
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || ''
            });
            
            console.log('Manual setSession result:', { data: !!data, error });
            
            if (error) {
              console.error('Failed to set session:', error);
              setError(`Authentication failed: ${error.message}`);
              setTimeout(() => navigate('/auth'), 3000);
              return;
            }
            
            if (data.session) {
              console.log('Session manually established, navigating to dashboard');
              navigate('/dashboard');
              return;
            } else {
              console.error('No session returned from setSession');
            }
          } catch (setSessionError) {
            console.error('setSession threw error:', setSessionError);
          }
          
          // Fallback navigation
          setTimeout(() => {
            console.log('Fallback navigation after error');
            navigate('/dashboard');
          }, 2000);
          
          return;
        } else {
          console.log('No code or tokens found in URL');
        }

        // Check if we have a valid session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          setError(`Session error: ${sessionError.message}`);
          setTimeout(() => navigate('/auth'), 3000);
          return;
        }

        if (session) {
          // Success! Give the auth context time to create/fetch the profile
          setTimeout(() => {
            navigate('/dashboard');
          }, 1000); // Small delay to allow profile creation
        } else {
          setError('No session found. Please try signing in again.');
          setTimeout(() => navigate('/auth'), 3000);
        }
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
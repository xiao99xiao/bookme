import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/PrivyAuthContext';

export const OnboardingNavigator = () => {
  const { authenticated, profile, loading, needsOnboarding } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Handle onboarding redirect after profile is loaded
  useEffect(() => {
    // Skip if still loading or doesn't need onboarding
    if (loading || !needsOnboarding) {
      return;
    }

    // Skip if not authenticated or no profile
    if (!authenticated || !profile) {
      return;
    }

    // Skip if already on onboarding page
    if (location.pathname === '/onboarding') {
      return;
    }

    // Skip onboarding redirect for auth-related pages
    const authPaths = ['/auth', '/auth/callback'];
    if (authPaths.includes(location.pathname)) {
      return;
    }

    // Redirect to onboarding (PageEditor in onboarding mode)
    console.log('User needs onboarding, redirecting to /onboarding');
    navigate('/onboarding', { replace: true });
  }, [loading, needsOnboarding, authenticated, profile, location.pathname, navigate]);

  return null; // This component doesn't render anything
};

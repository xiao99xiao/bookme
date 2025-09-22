import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/PrivyAuthContext';

export const OnboardingNavigator = () => {
  const { authenticated, profile, loading, needsOnboarding } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Handle onboarding redirect after profile is loaded
  useEffect(() => {
    console.log('=== ONBOARDING NAVIGATOR DEBUG ===');
    console.log('loading:', loading);
    console.log('needsOnboarding:', needsOnboarding);
    console.log('authenticated:', authenticated);
    console.log('profile:', profile);
    console.log('location.pathname:', location.pathname);
    console.log('===================================');

    if (loading || !needsOnboarding) {
      console.log('Skipping onboarding redirect: loading:', loading, 'needsOnboarding:', needsOnboarding);
      return;
    }
    if (!authenticated || !profile || location.pathname === '/onboarding') {
      console.log('Skipping onboarding redirect: authenticated:', authenticated, 'profile:', !!profile, 'isOnboardingPage:', location.pathname === '/onboarding');
      return;
    }

    // Skip onboarding redirect for auth-related pages
    const authPaths = ['/auth', '/auth/callback'];
    if (authPaths.includes(location.pathname)) {
      console.log('Skipping onboarding redirect: on auth page:', location.pathname);
      return;
    }

    if (needsOnboarding) {
      console.log('User needs onboarding, redirecting...');
      const params = new URLSearchParams();
      
      // Preserve current context for redirect after onboarding
      if (location.pathname !== '/' && location.pathname !== '/onboarding') {
        params.set('returnTo', location.pathname + location.search);
      }
      
      // Parse current URL for profile context
      const profileMatch = location.pathname.match(/^\/profile\/(.+)$/);
      if (profileMatch) {
        params.set('fromProfile', profileMatch[1]);
        const urlParams = new URLSearchParams(location.search);
        const serviceId = urlParams.get('service');
        if (serviceId) {
          params.set('serviceId', serviceId);
        }
      }

      const onboardingUrl = `/onboarding${params.toString() ? '?' + params.toString() : ''}`;
      navigate(onboardingUrl, { replace: true });
    }
  }, [loading, needsOnboarding, authenticated, profile, location.pathname, location.search, navigate]);

  return null; // This component doesn't render anything
};
import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/PrivyAuthContext';
import { Loading } from '@/design-system';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAuth?: boolean;
  requireOnboarding?: boolean; // Default true - require onboarding to be completed
}

const ProtectedRoute = ({ children, requireAuth = true, requireOnboarding = true }: ProtectedRouteProps) => {
  const { ready, authenticated, loading, needsOnboarding, profile } = useAuth();
  const location = useLocation();

  // Pages that should be accessible without completing onboarding
  const onboardingExemptPaths = ['/onboarding', '/host/onboarding', '/settings/profile'];

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading variant="spinner" size="lg" text="Loading..." />
      </div>
    );
  }

  if (requireAuth && !authenticated) {
    // Redirect to auth page but remember where they wanted to go
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (!requireAuth && authenticated && location.pathname === '/auth') {
    // If user is logged in but trying to access auth page, redirect to discover
    return <Navigate to="/discover" replace />;
  }

  // If authenticated but still loading profile, show loading
  if (requireAuth && authenticated && loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading variant="spinner" size="lg" text="Loading your profile..." />
      </div>
    );
  }

  // If authenticated but profile failed to load (null after loading complete), show error
  if (requireAuth && authenticated && !loading && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">Failed to load your profile. Please try again.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  // If onboarding is required and user needs it, redirect to onboarding
  // (unless they're already on an exempt page)
  if (requireAuth && requireOnboarding && authenticated && profile && needsOnboarding) {
    if (!onboardingExemptPaths.includes(location.pathname)) {
      const returnTo = location.pathname !== '/' ? `?returnTo=${encodeURIComponent(location.pathname + location.search)}` : '';
      return <Navigate to={`/onboarding${returnTo}`} replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
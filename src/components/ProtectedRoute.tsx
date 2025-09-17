import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/PrivyAuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAuth?: boolean;
}

const ProtectedRoute = ({ children, requireAuth = true }: ProtectedRouteProps) => {
  const { ready, authenticated } = useAuth();
  const location = useLocation();

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
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

  return <>{children}</>;
};

export default ProtectedRoute;
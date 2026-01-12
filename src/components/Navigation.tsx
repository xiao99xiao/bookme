import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  User,
  Calendar,
  MessageCircle,
  ClipboardList,
  Settings,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/PrivyAuthContext";

const STORAGE_KEY = 'nook_user_mode';

type UserMode = 'visitor' | 'host' | null;

/**
 * Navigation component - Now only handles:
 * 1. Mobile Tab Bar (iOS 26 style)
 * 2. Auto-redirect logic for landing page
 * 3. Bottom padding for tab bar
 *
 * Desktop/Mobile header is handled by AppHeader component
 */
const Navigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, ready, authenticated, loading, needsOnboarding } = useAuth();
  const [userMode, setUserMode] = useState<UserMode>(null);

  const isLoggedIn = authenticated;
  const isAuthPage = location.pathname === "/auth";
  const isOnboardingPage = location.pathname === "/onboarding";

  // Initialize user mode on login/profile change
  useEffect(() => {
    if (isLoggedIn && profile && ready) {
      const storedMode = localStorage.getItem(STORAGE_KEY) as UserMode;

      // Handle legacy values
      if (storedMode === 'customer' as any) {
        localStorage.setItem(STORAGE_KEY, 'visitor');
        setUserMode('visitor');
      } else if (storedMode === 'provider' as any) {
        localStorage.setItem(STORAGE_KEY, 'host');
        setUserMode('host');
      } else if (storedMode === 'visitor' || storedMode === 'host') {
        setUserMode(storedMode);
      } else {
        const defaultMode = profile.is_provider ? 'host' : 'visitor';
        setUserMode(defaultMode);
        localStorage.setItem(STORAGE_KEY, defaultMode);
      }
    } else if (!isLoggedIn) {
      setUserMode(null);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [isLoggedIn, profile, ready]);

  // Listen for localStorage changes to sync user mode across components
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        const newMode = e.newValue as UserMode;
        if (newMode === 'visitor' || newMode === 'host') {
          setUserMode(newMode);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Check for changes periodically (fallback for same-window changes)
    const interval = setInterval(() => {
      const storedMode = localStorage.getItem(STORAGE_KEY) as UserMode;
      if (storedMode !== userMode && (storedMode === 'visitor' || storedMode === 'host')) {
        setUserMode(storedMode);
      }
    }, 100);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [userMode]);

  // Handle default landing logic based on user mode
  useEffect(() => {
    if (loading || needsOnboarding) {
      return;
    }
    if (isLoggedIn && userMode && location.pathname === '/' && ready && profile) {
      if (userMode === 'host') {
        navigate('/host/bookings');
      } else {
        navigate('/bookings');
      }
    }
  }, [isLoggedIn, userMode, location.pathname, navigate, ready, loading, needsOnboarding, profile]);

  // Don't render on auth/onboarding pages
  if (isAuthPage || isOnboardingPage) {
    return null;
  }

  // Don't render tab bar if not logged in
  if (!isLoggedIn || !ready || !userMode) {
    return null;
  }

  // Hide tab bar when in mobile chat view
  const isInMobileChat = location.pathname.includes('/messages/');
  if (isInMobileChat) {
    return null;
  }

  const tabItems = userMode === 'visitor' ? [
    { to: '/bookings', icon: Calendar, label: 'Bookings' },
    { to: '/messages', icon: MessageCircle, label: 'Messages' },
    { to: '/me', icon: User, label: 'Me' },
  ] : [
    { to: '/host/bookings', icon: ClipboardList, label: 'Bookings' },
    { to: '/host/talks', icon: Settings, label: 'Talks' },
    { to: '/host/messages', icon: MessageCircle, label: 'Messages' },
    { to: '/me', icon: User, label: 'Me' },
  ];

  return (
    <>
      {/* iOS 26 Floating Glass Tab Bar - Mobile Only */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 pointer-events-none pb-[env(safe-area-inset-bottom)]">
        <div className="flex justify-center px-4 pb-4">
          <div
            className="pointer-events-auto flex items-center gap-1 px-2 py-2 rounded-[22px] shadow-lg"
            style={{
              background: 'rgba(255, 255, 255, 0.72)',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              border: '1px solid rgba(255, 255, 255, 0.4)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08)',
            }}
          >
            {tabItems.map(({ to, icon: Icon, label }) => {
              const isActive = location.pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  className={`
                    flex flex-col items-center justify-center px-4 py-2 rounded-2xl
                    transition-all duration-200 ease-out min-w-[64px]
                    ${isActive
                      ? 'bg-gray-900/90 text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900 active:scale-95'
                    }
                  `}
                >
                  <Icon className="w-5 h-5 mb-0.5" strokeWidth={isActive ? 2.5 : 2} />
                  <span className={`text-[10px] font-medium ${isActive ? 'opacity-100' : 'opacity-80'}`}>
                    {label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom padding for floating mobile tab bar */}
      <div className="md:hidden h-24" />
    </>
  );
};

export default Navigation;

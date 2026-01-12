import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  ChevronDown,
  LogOut,
  Wallet,
  Briefcase,
  User,
  Calendar,
  MessageCircle,
  ClipboardList,
  Settings,
  Plug,
  DollarSign,
  BarChart3,
  Users
} from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/PrivyAuthContext";
import { ApiClient } from "@/lib/api-migration";
import BecomeHostDialog from "./BecomeHostDialog";
import { toast } from "sonner";

const STORAGE_KEY = 'nook_user_mode';

type UserMode = 'visitor' | 'host' | null;

const Navigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, ready, authenticated, logout, login, userId, refreshProfile, loading, needsOnboarding } = useAuth();
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [userMode, setUserMode] = useState<UserMode>(null);
  const [showBecomeHostDialog, setShowBecomeHostDialog] = useState(false);
  const [isBecomingHost, setIsBecomingHost] = useState(false);

  const isLoggedIn = authenticated;
  const isAuthPage = location.pathname === "/auth";
  const isOnboardingPage = location.pathname === "/onboarding" || location.pathname === "/host/onboarding";
  const userName = profile?.display_name || "User";

  // Initialize user mode on login/profile change
  useEffect(() => {
    if (isLoggedIn && profile && ready) {
      // Check localStorage for existing mode
      const storedMode = localStorage.getItem(STORAGE_KEY) as UserMode;

      // Handle legacy values
      if (storedMode === 'customer' as any) {
        localStorage.setItem(STORAGE_KEY, 'visitor');
        setUserMode('visitor');
      } else if (storedMode === 'provider' as any) {
        localStorage.setItem(STORAGE_KEY, 'host');
        setUserMode('host');
      } else if (storedMode === 'visitor' || storedMode === 'host') {
        // Use stored mode if valid
        setUserMode(storedMode);
      } else {
        // Default to user's host status
        const defaultMode = profile.is_provider ? 'host' : 'visitor';
        setUserMode(defaultMode);
        localStorage.setItem(STORAGE_KEY, defaultMode);
      }
    } else if (!isLoggedIn) {
      // Clear mode when logged out
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

    // Listen for storage events from other windows/tabs
    window.addEventListener('storage', handleStorageChange);

    // Also listen for manual localStorage changes within the same window
    const handleManualStorageChange = () => {
      const storedMode = localStorage.getItem(STORAGE_KEY) as UserMode;
      if (storedMode !== userMode && (storedMode === 'visitor' || storedMode === 'host')) {
        setUserMode(storedMode);
      }
    };

    // Check for changes periodically (fallback for same-window changes)
    const interval = setInterval(handleManualStorageChange, 100);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [userMode]);

  // Handle scroll visibility - disabled for desktop, only for mobile
  useEffect(() => {
    const controlNavbar = () => {
      if (typeof window !== 'undefined') {
        // Only apply auto-hide on mobile (screens smaller than lg breakpoint)
        if (window.innerWidth < 1024) {
          if (window.scrollY > lastScrollY && window.scrollY > 100) {
            setIsVisible(false);
          } else {
            setIsVisible(true);
          }
        } else {
          // Always visible on desktop
          setIsVisible(true);
        }
        setLastScrollY(window.scrollY);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('scroll', controlNavbar);
      window.addEventListener('resize', controlNavbar);
      return () => {
        window.removeEventListener('scroll', controlNavbar);
        window.removeEventListener('resize', controlNavbar);
      };
    }
  }, [lastScrollY]);

  // Handle default landing logic based on user mode
  useEffect(() => {
    // Don't redirect if still loading or needs onboarding
    if (loading || needsOnboarding) {
      return;
    }
    if (isLoggedIn && userMode && location.pathname === '/' && ready && profile) {
      // Redirect based on user mode
      if (userMode === 'host') {
        navigate('/host/bookings');
      } else {
        navigate('/bookings');
      }
    }
  }, [isLoggedIn, userMode, location.pathname, navigate, ready, loading, needsOnboarding, profile]);

  // Handle mode switching
  const handleModeSwitch = () => {
    if (!userMode) return;

    const newMode: UserMode = userMode === 'visitor' ? 'host' : 'visitor';

    // Update state
    setUserMode(newMode);

    // Save to localStorage
    localStorage.setItem(STORAGE_KEY, newMode);

    // Navigate to appropriate landing
    if (newMode === 'host') {
      navigate('/host/talks');
    } else {
      navigate('/bookings');
    }
  };

  // Handle becoming a host
  const handleBecomeHost = () => {
    if (profile?.is_provider) {
      // Already a host, just switch mode
      handleModeSwitch();
    } else {
      // Show dialog to become host
      setShowBecomeHostDialog(true);
    }
  };

  // Confirm becoming a host
  const handleConfirmBecomeHost = async () => {
    if (!userId || !profile) return;

    setIsBecomingHost(true);
    try {
      // Update user to be a host
      await ApiClient.updateProfile({ is_provider: true }, userId);

      // Refresh profile to get updated is_provider status
      await refreshProfile();

      // Switch to host mode
      setUserMode('host');
      localStorage.setItem(STORAGE_KEY, 'host');

      // Close dialog
      setShowBecomeHostDialog(false);

      // Navigate to talks page
      navigate('/host/talks');

      toast.success('Welcome to host mode! You can now create Talks.');
    } catch (error) {
      console.error('Failed to become host:', error);
      toast.error('Failed to enable host mode. Please try again.');
    } finally {
      setIsBecomingHost(false);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    // Clear stored mode
    localStorage.removeItem(STORAGE_KEY);
    setUserMode(null);
    // Call original logout
    await logout();
  };

  const renderCenterContent = () => {
    if (!isLoggedIn || !ready || !userMode) {
      return null;
    }

    // Navigation items based on user mode
    if (userMode === 'visitor') {
      return (
        <div className="hidden md:flex items-center space-x-8">
          <Link
            to="/bookings"
            className={`text-sm transition-colors ${
              location.pathname === '/bookings'
                ? 'font-bold text-gray-900'
                : 'font-medium text-gray-600 hover:text-gray-900'
            }`}
          >
            Bookings
          </Link>
          <Link
            to="/messages"
            className={`text-sm transition-colors ${
              location.pathname === '/messages'
                ? 'font-bold text-gray-900'
                : 'font-medium text-gray-600 hover:text-gray-900'
            }`}
          >
            Messages
          </Link>
        </div>
      );
    }

    // Host navigation items
    if (userMode === 'host') {
      return (
        <div className="hidden md:flex items-center space-x-8">
          <Link
            to="/host/bookings"
            className={`text-sm transition-colors ${
              location.pathname === '/host/bookings'
                ? 'font-bold text-gray-900'
                : 'font-medium text-gray-600 hover:text-gray-900'
            }`}
          >
            Bookings
          </Link>
          <Link
            to="/host/talks"
            className={`text-sm transition-colors ${
              location.pathname === '/host/talks'
                ? 'font-bold text-gray-900'
                : 'font-medium text-gray-600 hover:text-gray-900'
            }`}
          >
            Talks
          </Link>
          <Link
            to="/host/messages"
            className={`text-sm transition-colors ${
              location.pathname === '/host/messages'
                ? 'font-bold text-gray-900'
                : 'font-medium text-gray-600 hover:text-gray-900'
            }`}
          >
            Messages
          </Link>
          <Link
            to="/host/earnings"
            className={`text-sm transition-colors ${
              location.pathname === '/host/earnings'
                ? 'font-bold text-gray-900'
                : 'font-medium text-gray-600 hover:text-gray-900'
            }`}
          >
            Earnings
          </Link>
        </div>
      );
    }

    return null;
  };

  const renderMobileTabBar = () => {
    if (!isLoggedIn || !ready || !userMode) {
      return null;
    }

    // Hide tab bar when in mobile chat view (has conversationId in path)
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
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
        <div className={`grid ${userMode === 'visitor' ? 'grid-cols-3' : 'grid-cols-4'}`}>
          {tabItems.map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center justify-center py-3 px-2 text-xs font-medium transition-colors ${
                location.pathname === to
                  ? 'text-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon className="w-5 h-5 mb-1" />
              <span>{label}</span>
            </Link>
          ))}
        </div>
      </div>
    );
  };

  const renderRightContent = () => {
    if (isAuthPage) {
      return null;
    }

    if (!ready) {
      return (
        <div className="w-8 h-8 bg-muted rounded-full animate-pulse" />
      );
    }

    if (isLoggedIn && userMode) {
      return (
        <div className="flex items-center gap-3">
          {/* Become Host / My Nook button - only show in visitor mode */}
          {userMode === 'visitor' && (
            !profile?.is_provider ? (
              <button
                onClick={handleBecomeHost}
                className="hidden md:block text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Become a Host
              </button>
            ) : (
              <Link
                to="/host/talks"
                className={`hidden md:block text-sm transition-colors ${
                  location.pathname === '/host/talks'
                    ? 'font-bold text-gray-900'
                    : 'font-medium text-gray-600 hover:text-gray-900'
                }`}
              >
                My Nook
              </Link>
            )
          )}

          {/* Account dropdown menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="nav"
                className="flex items-center gap-2 h-auto p-2">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={profile?.avatar} alt={userName} />
                  <AvatarFallback className="text-xs">
                    {userName.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium hidden md:block">{userName}</span>
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem asChild>
              <Link to="/settings/profile" className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/balance" className="flex items-center gap-2">
                <Wallet className="w-4 h-4" />
                Balance
              </Link>
            </DropdownMenuItem>
            {userMode === 'host' && (
              <>
                <DropdownMenuItem asChild>
                  <Link to="/host/referrals" className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Referrals
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/host/integrations" className="flex items-center gap-2">
                    <Plug className="w-4 h-4" />
                    Integrations
                  </Link>
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            {userMode === 'visitor' ? (
              !profile?.is_provider ? (
                <DropdownMenuItem
                  onClick={handleBecomeHost}
                  className="flex flex-col items-start gap-1 cursor-pointer py-3"
                >
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4" />
                    Become a Host
                  </div>
                  <span className="text-xs text-muted-foreground ml-6">
                    Start earning by offering Talks
                  </span>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onClick={handleModeSwitch}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Briefcase className="w-4 h-4" />
                  Switch to Host Mode
                </DropdownMenuItem>
              )
            ) : (
              <DropdownMenuItem
                onClick={handleModeSwitch}
                className="flex items-center gap-2 cursor-pointer"
              >
                <User className="w-4 h-4" />
                Switch to Visitor Mode
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="flex items-center gap-2 text-destructive cursor-pointer"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      );
    }

    return (
      <Button onClick={login} size="sm">
        Get Started
      </Button>
    );
  };

  // Don't render navigation on onboarding pages
  if (isOnboardingPage) {
    return null;
  }

  return (
    <>
      <nav className={`hidden md:block fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ${
        isVisible ? 'translate-y-0' : '-translate-y-full'
      } ${isAuthPage ? 'bg-transparent' : 'bg-white/95 backdrop-blur-sm border-b border-gray-200'}`}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-3 items-center h-16">
            {/* Left Section - Logo and Brand */}
            <div className="flex justify-start">
              <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                <img
                  src="/images/logo.svg"
alt="Nook logo"
                  className="w-8 h-8"
                />
<span className="text-2xl font-bold font-heading text-foreground">Nook</span>
              </Link>
            </div>

            {/* Center Section - Navigation */}
            <div className="flex justify-center">
              {renderCenterContent()}
            </div>

            {/* Right Section - Account */}
            <div className="flex justify-end">
              {renderRightContent()}
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Tab Bar */}
      {renderMobileTabBar()}

      {/* Add top padding for fixed navigation on desktop only */}
      <div className="hidden md:block h-16" />
      {/* Add bottom padding for mobile tab bar */}
      {isLoggedIn && userMode && !location.pathname.includes('/messages/') && (
        <div className="md:hidden h-16" />
      )}

      {/* Become Host Dialog */}
      <BecomeHostDialog
        open={showBecomeHostDialog}
        onOpenChange={setShowBecomeHostDialog}
        onConfirm={handleConfirmBecomeHost}
        isLoading={isBecomingHost}
      />
    </>
  );
};

export default Navigation;

import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Settings,
  LogOut,
  Wallet,
  Calendar,
  MessageCircle,
  ClipboardList,
  Plug,
  DollarSign,
  Users,
  ArrowLeftRight,
  Briefcase,
  Mic,
  User,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/contexts/PrivyAuthContext';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { ApiClient } from '@/lib/api-migration';
import BecomeHostDialog from './BecomeHostDialog';
import { toast } from 'sonner';

const STORAGE_KEY = 'nook_user_mode';
type UserMode = 'visitor' | 'host' | null;

interface AppHeaderProps {
  showBackButton?: boolean;
  onBack?: () => void;
}

export default function AppHeader({ showBackButton, onBack }: AppHeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, ready, authenticated, logout, login, userId, refreshProfile } = useAuth();
  const { title, subtitle } = usePageTitle();

  const [userMode, setUserMode] = useState<UserMode>(null);
  const [showBecomeHostDialog, setShowBecomeHostDialog] = useState(false);
  const [isBecomingHost, setIsBecomingHost] = useState(false);

  const isLoggedIn = authenticated;
  const isAuthPage = location.pathname === '/auth';
  const isOnboardingPage = location.pathname === '/onboarding';
  const userName = profile?.display_name || 'User';

  // Initialize user mode
  useEffect(() => {
    if (isLoggedIn && profile && ready) {
      const storedMode = localStorage.getItem(STORAGE_KEY) as UserMode;
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

  // Sync mode across tabs
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
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Handle mode switching
  const handleModeSwitch = () => {
    if (!userMode) return;
    const newMode: UserMode = userMode === 'visitor' ? 'host' : 'visitor';
    setUserMode(newMode);
    localStorage.setItem(STORAGE_KEY, newMode);
    navigate(newMode === 'host' ? '/host/bookings' : '/bookings');
  };

  // Handle becoming a host
  const handleBecomeHost = () => {
    if (profile?.is_provider) {
      handleModeSwitch();
    } else {
      setShowBecomeHostDialog(true);
    }
  };

  const handleConfirmBecomeHost = async () => {
    if (!userId || !profile) return;
    setIsBecomingHost(true);
    try {
      await ApiClient.updateProfile({ is_provider: true }, userId);
      await refreshProfile();
      setUserMode('host');
      localStorage.setItem(STORAGE_KEY, 'host');
      setShowBecomeHostDialog(false);
      navigate('/host/talks');
      toast.success('Welcome to host mode! You can now create Talks.');
    } catch (error) {
      console.error('Failed to become host:', error);
      toast.error('Failed to enable host mode. Please try again.');
    } finally {
      setIsBecomingHost(false);
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem(STORAGE_KEY);
    setUserMode(null);
    await logout();
  };

  // Don't render on auth/onboarding pages
  if (isAuthPage || isOnboardingPage) {
    return null;
  }

  // Navigation items for dropdown
  const visitorNavItems = [
    { to: '/bookings', icon: Calendar, label: 'Bookings' },
    { to: '/messages', icon: MessageCircle, label: 'Messages' },
  ];

  const hostNavItems = [
    { to: '/host/bookings', icon: ClipboardList, label: 'Bookings' },
    { to: '/host/talks', icon: Mic, label: 'Talks' },
    { to: '/host/messages', icon: MessageCircle, label: 'Messages' },
    { to: '/host/earnings', icon: DollarSign, label: 'Earnings' },
  ];

  const navItems = userMode === 'host' ? hostNavItems : visitorNavItems;

  return (
    <>
      {/* Unified Header - Same structure for Mobile and Desktop */}
      <header
        className="fixed top-0 left-0 right-0 z-50 h-14"
        style={{
          background: 'rgba(255, 255, 255, 0.72)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
        }}
      >
        <div className="h-full max-w-7xl mx-auto px-4 flex items-center justify-between">
          {/* Left Section - Logo */}
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity flex-shrink-0">
              <img src="/images/logo.svg" alt="Nook" className="w-7 h-7" />
              <span className="text-lg font-bold font-heading text-foreground hidden sm:block">
                Nook
              </span>
            </Link>
          </div>

          {/* Center Section - Page Title (Desktop Only) */}
          {title && (
            <div className="hidden md:block absolute left-1/2 transform -translate-x-1/2 text-center">
              <h1 className="text-base font-semibold text-gray-900 truncate">{title}</h1>
              {subtitle && (
                <p className="text-xs text-gray-500 truncate">{subtitle}</p>
              )}
            </div>
          )}

          {/* Right Section - Settings & User Menu */}
          <div className="flex items-center gap-2">
            {!ready ? (
              <div className="w-8 h-8 bg-muted rounded-full animate-pulse" />
            ) : isLoggedIn && userMode ? (
              <>
                {/* Page Editor Button */}
                <Link
                  to="/host/page"
                  className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                >
                  <Settings className="w-5 h-5 text-gray-600" />
                </Link>

                {/* User Avatar Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-1 p-1 rounded-full hover:bg-gray-100 transition-colors">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={profile?.avatar} alt={userName} />
                        <AvatarFallback className="text-xs bg-gray-200">
                          {userName.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    {/* User Info */}
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium">{userName}</p>
                        {profile?.username && (
                          <p className="text-xs text-muted-foreground">@{profile.username}</p>
                        )}
                        <p className="text-xs text-muted-foreground capitalize">
                          {userMode} Mode
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />

                    {/* Navigation Items */}
                    {navItems.map(({ to, icon: Icon, label }) => (
                      <DropdownMenuItem key={to} asChild>
                        <Link to={to} className="flex items-center gap-2 cursor-pointer">
                          <Icon className="w-4 h-4" />
                          {label}
                        </Link>
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />

                    {/* My Page - Host Only */}
                    {userMode === 'host' && profile?.username && (
                      <>
                        <DropdownMenuItem asChild>
                          <Link to={`/${profile.username}`} className="flex items-center gap-2 cursor-pointer">
                            <User className="w-4 h-4" />
                            My Page
                            <ExternalLink className="w-3 h-3 ml-auto text-muted-foreground" />
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}

                    {/* Utility Items */}
                    <DropdownMenuItem asChild>
                      <Link to="/host/page" className="flex items-center gap-2 cursor-pointer">
                        <Settings className="w-4 h-4" />
                        Edit Page
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/balance" className="flex items-center gap-2 cursor-pointer">
                        <Wallet className="w-4 h-4" />
                        Balance
                      </Link>
                    </DropdownMenuItem>
                    {userMode === 'host' && (
                      <>
                        <DropdownMenuItem asChild>
                          <Link to="/host/integrations" className="flex items-center gap-2 cursor-pointer">
                            <Plug className="w-4 h-4" />
                            Integrations
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to="/host/referrals" className="flex items-center gap-2 cursor-pointer">
                            <Users className="w-4 h-4" />
                            Referrals
                          </Link>
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />

                    {/* Mode Switch */}
                    {userMode === 'visitor' ? (
                      !profile?.is_provider ? (
                        <DropdownMenuItem
                          onClick={handleBecomeHost}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <Briefcase className="w-4 h-4" />
                          Become a Host
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={handleModeSwitch}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <ArrowLeftRight className="w-4 h-4" />
                          Switch to Host
                        </DropdownMenuItem>
                      )
                    ) : (
                      <DropdownMenuItem
                        onClick={handleModeSwitch}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <ArrowLeftRight className="w-4 h-4" />
                        Switch to Visitor
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />

                    {/* Logout */}
                    <DropdownMenuItem
                      onClick={handleLogout}
                      className="flex items-center gap-2 text-destructive cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      Log out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <Button onClick={login} size="sm">
                Get Started
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Spacer for fixed header */}
      <div className="h-14" />

      {/* Become Host Dialog */}
      <BecomeHostDialog
        open={showBecomeHostDialog}
        onOpenChange={setShowBecomeHostDialog}
        onConfirm={handleConfirmBecomeHost}
        isLoading={isBecomingHost}
      />
    </>
  );
}

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
  BarChart3
} from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/PrivyAuthContext";
import { ApiClient } from "@/lib/api-migration";
import BecomeProviderDialog from "./BecomeProviderDialog";
import { toast } from "sonner";

const STORAGE_KEY = 'bookme_user_mode';

type UserMode = 'customer' | 'provider' | null;

const NewNavigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, ready, authenticated, logout, userId, refreshProfile } = useAuth();
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [userMode, setUserMode] = useState<UserMode>(null);
  const [showBecomeProviderDialog, setShowBecomeProviderDialog] = useState(false);
  const [isBecomingProvider, setIsBecomingProvider] = useState(false);
  
  const isLoggedIn = authenticated;
  const isAuthPage = location.pathname === "/auth";
  const userName = profile?.display_name || "User";
  
  // Initialize user mode on login/profile change
  useEffect(() => {
    if (isLoggedIn && profile && ready) {
      // Check localStorage for existing mode
      const storedMode = localStorage.getItem(STORAGE_KEY) as UserMode;
      
      if (storedMode === 'customer' || storedMode === 'provider') {
        // Use stored mode if valid
        setUserMode(storedMode);
      } else {
        // Default to user's provider status
        const defaultMode = profile.is_provider ? 'provider' : 'customer';
        setUserMode(defaultMode);
        localStorage.setItem(STORAGE_KEY, defaultMode);
      }
    } else if (!isLoggedIn) {
      // Clear mode when logged out
      setUserMode(null);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [isLoggedIn, profile, ready]);
  
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
    if (isLoggedIn && userMode && location.pathname === '/' && ready) {
      // Redirect based on user mode
      if (userMode === 'provider') {
        navigate('/provider/orders');
      } else {
        navigate('/customer/bookings');
      }
    }
  }, [isLoggedIn, userMode, location.pathname, navigate, ready]);

  // Handle mode switching
  const handleModeSwitch = () => {
    if (!userMode) return;

    const newMode: UserMode = userMode === 'customer' ? 'provider' : 'customer';

    // Update state
    setUserMode(newMode);

    // Save to localStorage
    localStorage.setItem(STORAGE_KEY, newMode);

    // Navigate to appropriate landing
    if (newMode === 'provider') {
      navigate('/provider/services');
    } else {
      navigate('/customer/bookings');
    }
  };

  // Handle becoming a provider
  const handleBecomeProvider = () => {
    if (profile?.is_provider) {
      // Already a provider, just switch mode
      handleModeSwitch();
    } else {
      // Show dialog to become provider
      setShowBecomeProviderDialog(true);
    }
  };

  // Confirm becoming a provider
  const handleConfirmBecomeProvider = async () => {
    if (!userId || !profile) return;

    setIsBecomingProvider(true);
    try {
      // Update user to be a provider
      await ApiClient.updateProfile({ is_provider: true }, userId);

      // Refresh profile to get updated is_provider status
      await refreshProfile();

      // Switch to provider mode
      setUserMode('provider');
      localStorage.setItem(STORAGE_KEY, 'provider');

      // Close dialog
      setShowBecomeProviderDialog(false);

      // Navigate to services page
      navigate('/provider/services');

      toast.success('Welcome to provider mode! You can now create services.');
    } catch (error) {
      console.error('Failed to become provider:', error);
      toast.error('Failed to enable provider mode. Please try again.');
    } finally {
      setIsBecomingProvider(false);
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
    if (userMode === 'customer') {
      return (
        <div className="hidden md:flex items-center space-x-8">
          <Link 
            to="/customer/bookings" 
            className={`text-sm transition-colors ${
              location.pathname === '/customer/bookings' 
                ? 'font-bold text-gray-900' 
                : 'font-medium text-gray-600 hover:text-gray-900'
            }`}
          >
            Bookings
          </Link>
          <Link 
            to="/customer/messages" 
            className={`text-sm transition-colors ${
              location.pathname === '/customer/messages' 
                ? 'font-bold text-gray-900' 
                : 'font-medium text-gray-600 hover:text-gray-900'
            }`}
          >
            Messages
          </Link>
        </div>
      );
    }

    // Provider navigation items
    if (userMode === 'provider') {
      return (
        <div className="hidden md:flex items-center space-x-8">
          <Link 
            to="/provider/orders" 
            className={`text-sm transition-colors ${
              location.pathname === '/provider/orders' 
                ? 'font-bold text-gray-900' 
                : 'font-medium text-gray-600 hover:text-gray-900'
            }`}
          >
            Orders
          </Link>
          <Link 
            to="/provider/services" 
            className={`text-sm transition-colors ${
              location.pathname === '/provider/services' 
                ? 'font-bold text-gray-900' 
                : 'font-medium text-gray-600 hover:text-gray-900'
            }`}
          >
            Services
          </Link>
          <Link 
            to="/provider/messages" 
            className={`text-sm transition-colors ${
              location.pathname === '/provider/messages' 
                ? 'font-bold text-gray-900' 
                : 'font-medium text-gray-600 hover:text-gray-900'
            }`}
          >
            Messages
          </Link>
          <Link 
            to="/provider/integrations" 
            className={`text-sm transition-colors ${
              location.pathname === '/provider/integrations' 
                ? 'font-bold text-gray-900' 
                : 'font-medium text-gray-600 hover:text-gray-900'
            }`}
          >
            Integrations
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

    const tabItems = userMode === 'customer' ? [
      { to: '/customer/bookings', icon: Calendar, label: 'Bookings' },
      { to: '/customer/messages', icon: MessageCircle, label: 'Messages' },
      { to: '/me', icon: User, label: 'Me' },
    ] : [
      { to: '/provider/orders', icon: ClipboardList, label: 'Orders' },
      { to: '/provider/services', icon: Settings, label: 'Services' },
      { to: '/provider/messages', icon: MessageCircle, label: 'Messages' },
      { to: '/me', icon: User, label: 'Me' },
    ];

    return (
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
        <div className={`grid ${userMode === 'customer' ? 'grid-cols-3' : 'grid-cols-4'}`}>
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
          {/* Become Provider / Provider Dashboard button - only show in customer mode */}
          {userMode === 'customer' && (
            !profile?.is_provider ? (
              <button
                onClick={handleBecomeProvider}
                className="hidden md:block text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Become Provider
              </button>
            ) : (
              <Link
                to="/provider/services"
                className={`hidden md:block text-sm transition-colors ${
                  location.pathname === '/provider/services'
                    ? 'font-bold text-gray-900'
                    : 'font-medium text-gray-600 hover:text-gray-900'
                }`}
              >
                Provider Dashboard
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
            <DropdownMenuItem asChild>
              <Link to="/provider/income" className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Income
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {userMode === 'customer' ? (
              !profile?.is_provider ? (
                <DropdownMenuItem
                  onClick={handleBecomeProvider}
                  className="flex flex-col items-start gap-1 cursor-pointer py-3"
                >
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4" />
                    Become Provider
                  </div>
                  <span className="text-xs text-muted-foreground ml-6">
                    Start earning by offering services
                  </span>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onClick={handleModeSwitch}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Briefcase className="w-4 h-4" />
                  Provider Mode
                </DropdownMenuItem>
              )
            ) : (
              <DropdownMenuItem
                onClick={handleModeSwitch}
                className="flex items-center gap-2 cursor-pointer"
              >
                <User className="w-4 h-4" />
                Customer Mode
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
      <Button asChild size="sm">
        <Link to="/auth">Get Started</Link>
      </Button>
    );
  };

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
alt="Timee logo"
                  className="w-8 h-8"
                />
<span className="text-2xl font-bold font-heading text-foreground">Timee</span>
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

      {/* Become Provider Dialog */}
      <BecomeProviderDialog
        open={showBecomeProviderDialog}
        onOpenChange={setShowBecomeProviderDialog}
        onConfirm={handleConfirmBecomeProvider}
        isLoading={isBecomingProvider}
      />
    </>
  );
};

export default NewNavigation;
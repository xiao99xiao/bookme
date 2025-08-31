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
  Plug
} from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/PrivyAuthContext";
import timeeLogo from "@/assets/timee-logo.jpg";

const NewNavigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, ready, authenticated, logout, userId } = useAuth();
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  
  const isLoggedIn = authenticated;
  const isAuthPage = location.pathname === "/auth";
  const userName = profile?.display_name || "User";
  
  // Check current section
  const isCustomerSection = location.pathname.startsWith('/customer');
  const isProviderSection = location.pathname.startsWith('/provider');
  
  useEffect(() => {
    const controlNavbar = () => {
      if (typeof window !== 'undefined') {
        if (window.scrollY > lastScrollY && window.scrollY > 100) {
          // Hide navbar when scrolling down
          setIsVisible(false);
        } else {
          // Show navbar when scrolling up
          setIsVisible(true);
        }
        setLastScrollY(window.scrollY);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('scroll', controlNavbar);
      return () => {
        window.removeEventListener('scroll', controlNavbar);
      };
    }
  }, [lastScrollY]);

  // Handle default landing logic
  useEffect(() => {
    if (isLoggedIn && profile && location.pathname === '/' && ready) {
      // Redirect based on user's provider status
      if (profile.is_provider) {
        navigate('/provider/orders');
      } else {
        navigate('/customer/bookings');
      }
    }
  }, [isLoggedIn, profile, location.pathname, navigate, ready]);

  const renderCenterContent = () => {
    if (!isLoggedIn || !ready) {
      return null;
    }

    // Customer navigation items
    if (isCustomerSection) {
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
          <Link 
            to="/customer/profile" 
            className={`text-sm transition-colors ${
              location.pathname === '/customer/profile' 
                ? 'font-bold text-gray-900' 
                : 'font-medium text-gray-600 hover:text-gray-900'
            }`}
          >
            Profile
          </Link>
        </div>
      );
    }

    // Provider navigation items
    if (isProviderSection) {
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
    if (!isLoggedIn || !ready || (!isCustomerSection && !isProviderSection)) {
      return null;
    }

    const tabItems = isCustomerSection ? [
      { to: '/customer/bookings', icon: Calendar, label: 'Bookings' },
      { to: '/customer/messages', icon: MessageCircle, label: 'Messages' },
      { to: '/customer/profile', icon: User, label: 'Profile' },
    ] : [
      { to: '/provider/orders', icon: ClipboardList, label: 'Orders' },
      { to: '/provider/services', icon: Settings, label: 'Services' },
      { to: '/provider/messages', icon: MessageCircle, label: 'Messages' },
      { to: '/provider/integrations', icon: Plug, label: 'Integrations' },
    ];

    return (
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
        <div className="grid grid-cols-3 md:grid-cols-4">
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
    
    if (isLoggedIn) {
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 h-auto p-2 focus-visible:ring-0 focus-visible:ring-offset-0">
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
              <Link to="/balance" className="flex items-center gap-2">
                <Wallet className="w-4 h-4" />
                Balance
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {isCustomerSection ? (
              <DropdownMenuItem asChild>
                <Link to="/provider/orders" className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4" />
                  Provider Mode
                </Link>
              </DropdownMenuItem>
            ) : isProviderSection ? (
              <DropdownMenuItem asChild>
                <Link to="/customer/bookings" className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Customer Mode
                </Link>
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              className="flex items-center gap-2 text-destructive cursor-pointer"
              onClick={logout}
            >
              <LogOut className="w-4 h-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ${
        isVisible ? 'translate-y-0' : '-translate-y-full'
      } ${isAuthPage ? 'bg-transparent' : 'bg-white/95 backdrop-blur-sm border-b border-gray-200'}`}>
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo and Brand */}
            <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <img 
                src={timeeLogo} 
                alt="Timee logo" 
                className="w-8 h-8 rounded-lg"
              />
              <span className="text-2xl font-bold font-heading text-foreground">Timee</span>
            </Link>

            {/* Center Content */}
            {renderCenterContent()}

            {/* Right Content */}
            {renderRightContent()}
          </div>
        </div>
      </nav>
      
      {/* Mobile Tab Bar */}
      {renderMobileTabBar()}
      
      {/* Add top padding for fixed navigation and bottom padding for mobile tab bar */}
      <div className="h-16" />
      {isLoggedIn && (isCustomerSection || isProviderSection) && (
        <div className="md:hidden h-16" />
      )}
    </>
  );
};

export default NewNavigation;
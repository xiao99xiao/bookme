import { Link, useLocation } from "react-router-dom";
import { ChevronDown, LayoutDashboard, LogOut } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/PrivyAuthContext";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button, Text, Stack, Container } from "@/design-system";

const RefactoredNavigation = () => {
  const location = useLocation();
  const { user, profile, ready, authenticated, logout, userId } = useAuth();
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  
  const isLoggedIn = authenticated;
  const isAuthPage = location.pathname === "/auth";
  const userName = profile?.display_name || "User";
  
  useEffect(() => {
    const controlNavbar = () => {
      if (typeof window !== 'undefined') {
        if (window.scrollY > lastScrollY && window.scrollY > 100) {
          setIsVisible(false);
        } else {
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

  const NavLink = ({ to, children, isActive }: { to: string; children: React.ReactNode; isActive?: boolean }) => (
    <Link to={to}>
      <Text 
        as="span"
        variant="small" 
        weight="medium"
        color={isActive ? "primary" : "secondary"}
        className="hover:text-textPrimary transition-colors"
      >
        {children}
      </Text>
    </Link>
  );

  const UserAvatar = () => (
    <div className="flex items-center gap-3 px-3 py-2 rounded-ds-md border border-neutralLightest">
      <Avatar className="w-6 h-6">
        <AvatarImage src="" alt={userName} />
        <AvatarFallback className="text-xs bg-textSecondary text-textAlternate">
          {userName.substring(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <Text variant="small" color="secondary">
        {userName.split(' ')[0]}
      </Text>
    </div>
  );

  const renderRightContent = () => {
    if (isAuthPage) return null;

    if (!ready) {
      return <div className="w-8 h-8 bg-brandLightGrey rounded-full animate-pulse" />;
    }
    
    if (isLoggedIn) {
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 p-2 hover:bg-brandBgGrey2 rounded-ds-md transition-colors focus:outline-none">
              <Avatar className="w-8 h-8">
                <AvatarImage src="" alt={userName} />
                <AvatarFallback className="text-xs bg-textSecondary text-textAlternate">
                  {userName.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <Text variant="small" weight="medium">{userName}</Text>
              <ChevronDown className="w-4 h-4 text-textSecondary" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem asChild>
              <Link to="/customer/profile" className="flex items-center gap-2">
                <LayoutDashboard className="w-4 h-4" />
                <Text variant="small">Profile</Text>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem 
              className="flex items-center gap-2 text-destructive cursor-pointer"
              onClick={logout}
            >
              <LogOut className="w-4 h-4" />
              <Text variant="small">Log out</Text>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }
    
    return (
      <Button as={Link} to="/auth" size="small">
        Get Started
      </Button>
    );
  };

  return (
    <nav 
      className={`fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ${
        isVisible ? 'translate-y-0' : '-translate-y-full'
      } ${isAuthPage ? 'bg-transparent' : 'bg-white border-b border-neutralLightest'}`}
    >
      <Container maxWidth="xl" padding="lg">
        <Stack direction="row" justify="between" align="center" spacing="lg">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <img
              src="/images/logo.svg"
alt="Timee logo"
              className="w-6 h-6"
            />
<Text as="h1" variant="medium" weight="bold" className="font-heading">
              Timee
            </Text>
          </Link>
          
          {/* Center Navigation */}
          {isLoggedIn && !isAuthPage && (
            <Stack direction="row" spacing="xl" align="center">
              <NavLink 
                to="/provider/orders" 
                isActive={location.pathname === '/provider/orders'}
              >
                Bookings
              </NavLink>
              <NavLink 
                to="/messages" 
                isActive={location.pathname === '/messages'}
              >
                Messages
              </NavLink>
            </Stack>
          )}
          
          {/* User Section */}
          <div className="flex items-center">
            {isLoggedIn && !isAuthPage ? <UserAvatar /> : renderRightContent()}
          </div>
        </Stack>
      </Container>
    </nav>
  );
};

export default RefactoredNavigation;
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChevronDown, User, Calendar, LogOut } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/PrivyAuthContext";
import timeeLogo from "@/assets/timee-logo.jpg";

const Navigation = () => {
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
                <AvatarImage src="" alt={userName} />
                <AvatarFallback className="text-xs">
                  {userName.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium">{userName}</span>
              <ChevronDown className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem asChild>
              <Link to="/dashboard" className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Dashboard
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/dashboard/bookings" className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                My Bookings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/dashboard/profile" className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Edit Profile
              </Link>
            </DropdownMenuItem>
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
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ${
      isVisible ? 'translate-y-0' : '-translate-y-full'
    } ${isAuthPage ? 'bg-transparent' : ''}`}>
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

          {/* Right Content */}
          {renderRightContent()}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
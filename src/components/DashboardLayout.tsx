import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { User, Settings, Package, ShoppingBag, Calendar, LogOut, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/PrivyAuthContext';
import { cn } from '@/lib/utils';

const sidebarItems = [
  {
    title: 'My Profile',
    href: '/dashboard/profile',
    icon: User,
  },
  {
    title: 'My Services',
    href: '/dashboard/services',
    icon: Settings,
  },
  {
    title: 'My Orders',
    href: '/dashboard/orders',
    icon: Package,
  },
  {
    title: 'My Bookings',
    href: '/dashboard/bookings',
    icon: Calendar,
  },
];

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, loading, logout } = useAuth();
  
  console.log('DashboardLayout state:', { user: !!user, profile: !!profile, loading });

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Don't block dashboard if profile is missing - show it anyway
  if (loading) {
    return (
      <div className="flex h-screen bg-background items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-64 border-r border-border bg-card">
        <div className="flex flex-col h-full">
          {/* User Section */}
          <div className="p-6">
            <div className="flex items-center space-x-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={profile?.avatar || ""} alt={profile?.display_name || "User"} />
                <AvatarFallback className="text-sm bg-muted text-foreground">
                  {profile?.display_name?.charAt(0) || profile?.email?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {profile?.display_name || profile?.name || user?.name || user?.email?.split('@')[0] || 'User'}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {profile?.email || user?.email}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Navigation Items */}
          <div className="flex-1 p-4">
            <nav className="space-y-2">
              {sidebarItems.map((item) => {
                const isActive = location.pathname === item.href;
                const Icon = item.icon;
                
                return (
                  <Button
                    key={item.href}
                    variant={isActive ? "secondary" : "ghost"}
                    className={cn(
                      "w-full justify-start h-10",
                      isActive && "bg-muted"
                    )}
                    onClick={() => navigate(item.href)}
                  >
                    <Icon className="mr-3 h-4 w-4" />
                    {item.title}
                  </Button>
                );
              })}
            </nav>
          </div>

          {/* Logout Button */}
          <div className="p-4">
            <Separator className="mb-4" />
            <Button
              variant="ghost"
              className="w-full justify-start h-10 text-muted-foreground hover:text-foreground"
              onClick={handleLogout}
            >
              <LogOut className="mr-3 h-4 w-4" />
              Log out
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
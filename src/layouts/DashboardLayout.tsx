import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { 
  User, 
  Briefcase, 
  ShoppingBag, 
  Calendar,
  Settings, 
  LogOut,
  Menu,
  X,
  ChevronRight,
  ExternalLink,
  Copy,
  Check,
  Wallet,
  MessageSquare
} from 'lucide-react';
import { useAuth } from '@/contexts/PrivyAuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const sidebarItems = [
  {
    label: 'Profile',
    icon: User,
    path: '/dashboard/profile',
    description: 'Manage your personal information'
  },
  {
    label: 'Services',
    icon: Briefcase,
    path: '/dashboard/services',
    description: 'Create and manage your services'
  },
  {
    label: 'Incoming Orders',
    icon: ShoppingBag,
    path: '/dashboard/orders',
    description: 'Bookings from customers'
  },
  {
    label: 'My Bookings',
    icon: Calendar,
    path: '/dashboard/bookings',
    description: 'Services you have booked'
  },
  {
    label: 'Messages',
    icon: MessageSquare,
    path: '/dashboard/messages',
    description: 'Chat with customers and providers'
  },
  {
    label: 'Balance',
    icon: Wallet,
    path: '/dashboard/balance',
    description: 'View your wallet balance'
  },
  {
    label: 'Integrations',
    icon: Settings,
    path: '/dashboard/integrations',
    description: 'Connect meeting platforms'
  }
];

export default function DashboardLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [profileLinkCopied, setProfileLinkCopied] = useState(false);
  const { user, logout, getUserDisplayName, getUserEmail, userId } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const profileUrl = `${window.location.origin}/profile/${userId}`;

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const currentItem = sidebarItems.find(item => location.pathname.startsWith(item.path));

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {isMobileSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-50 flex flex-col bg-white border-r border-gray-200 transition-all duration-300",
          isSidebarOpen ? "w-72" : "lg:w-20",
          isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className={cn("flex items-center space-x-3", !isSidebarOpen && "lg:justify-center")}>
            {/* Logo */}
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">T</span>
            </div>
            {(isSidebarOpen || isMobileSidebarOpen) && (
              <span className="font-bold text-xl text-gray-900">Timee</span>
            )}
          </div>
          
          {/* Desktop toggle */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="hidden lg:block p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Mobile close */}
          <button
            onClick={() => setIsMobileSidebarOpen(false)}
            className="lg:hidden p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Info */}
        <div className={cn(
          "px-6 py-4 border-b border-gray-200",
          !isSidebarOpen && "lg:px-3 lg:py-4"
        )}>
          <div className={cn(
            "flex items-center space-x-3",
            !isSidebarOpen && "lg:justify-center"
          )}>
            <Avatar className="h-10 w-10 flex-shrink-0">
              <AvatarImage src={user?.avatarUrl} />
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                {getUserDisplayName()?.charAt(0)?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            {(isSidebarOpen || isMobileSidebarOpen) && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {getUserDisplayName()}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {getUserEmail()}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Profile Link Section */}
        {(isSidebarOpen || isMobileSidebarOpen) && userId && (
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(profileUrl);
                  setProfileLinkCopied(true);
                  setTimeout(() => setProfileLinkCopied(false), 2000);
                }}
                className="flex-1 flex items-center justify-center space-x-1.5 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-sm"
              >
                {profileLinkCopied ? (
                  <><Check className="w-4 h-4 text-green-600" /><span className="text-green-600">Copied!</span></>
                ) : (
                  <><Copy className="w-4 h-4 text-gray-600" /><span className="text-gray-700">Copy Profile Link</span></>
                )}
              </button>
              <button
                onClick={() => window.open(profileUrl, '_blank')}
                className="p-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                title="View Profile"
              >
                <ExternalLink className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);
            
            return (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path);
                  setIsMobileSidebarOpen(false);
                }}
                className={cn(
                  "w-full flex items-center px-3 py-3 rounded-lg transition-all group relative",
                  isActive 
                    ? "bg-blue-50 text-blue-600" 
                    : "text-gray-700 hover:bg-gray-100",
                  !isSidebarOpen && "lg:justify-center"
                )}
              >
                <Icon className={cn(
                  "flex-shrink-0",
                  isActive ? "w-5 h-5" : "w-5 h-5 text-gray-400 group-hover:text-gray-600"
                )} />
                
                {(isSidebarOpen || isMobileSidebarOpen) && (
                  <>
                    <span className={cn(
                      "ml-3 flex-1 text-left",
                      isActive ? "font-medium" : ""
                    )}>
                      {item.label}
                    </span>
                    {isActive && <ChevronRight className="w-4 h-4" />}
                  </>
                )}

                {/* Tooltip for collapsed sidebar */}
                {!isSidebarOpen && !isMobileSidebarOpen && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-sm rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 hidden lg:block">
                    {item.label}
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Logout Button */}
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className={cn(
              "w-full flex items-center px-3 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors",
              !isSidebarOpen && "lg:justify-center"
            )}
          >
            <LogOut className="w-5 h-5" />
            {(isSidebarOpen || isMobileSidebarOpen) && (
              <span className="ml-3">Logout</span>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden flex items-center justify-between p-4 bg-white border-b border-gray-200">
          <button
            onClick={() => setIsMobileSidebarOpen(true)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="font-semibold text-gray-900">
            {currentItem?.label || 'Dashboard'}
          </div>
          <div className="w-9" /> {/* Spacer for centering */}
        </header>

        {/* Page Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 hidden lg:block">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                {currentItem?.label || 'Dashboard'}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                {currentItem?.description}
              </p>
            </div>
          </div>
        </div>

        {/* Page Content */}
        <div className="flex-1 overflow-auto bg-gray-50">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
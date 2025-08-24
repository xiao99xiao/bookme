import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User, Settings, Package, Calendar, TrendingUp, Users } from 'lucide-react';
import { useAuth } from '@/contexts/PrivyAuthContext';

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  // Redirect to profile if this is the first time or they haven't set up their profile
  useEffect(() => {
    if (profile && !profile.display_name) {
      navigate('/dashboard/profile');
    }
  }, [profile, navigate]);

  const dashboardCards = [
    {
      title: 'My Profile',
      description: 'Update your personal information and preferences',
      icon: User,
      href: '/dashboard/profile',
      color: 'text-blue-600',
    },
    {
      title: 'My Services',
      description: 'Manage the services you offer to others',
      icon: Settings,
      href: '/dashboard/services',
      color: 'text-green-600',
    },
    {
      title: 'My Orders',
      description: 'View and manage service requests from customers',
      icon: Package,
      href: '/dashboard/orders',
      color: 'text-purple-600',
    },
    {
      title: 'My Bookings',
      description: 'See your upcoming and past service bookings',
      icon: Calendar,
      href: '/dashboard/bookings',
      color: 'text-orange-600',
    },
  ];

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Welcome back, {profile?.display_name || 'User'}!
            </h1>
            <p className="text-muted-foreground">
              Here's what's happening with your account today.
            </p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Services</CardTitle>
                <Settings className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">0</div>
                <p className="text-xs text-muted-foreground">Services you offer</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Orders</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">0</div>
                <p className="text-xs text-muted-foreground">Orders to fulfill</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Upcoming Bookings</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">0</div>
                <p className="text-xs text-muted-foreground">Services you've booked</p>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {dashboardCards.map((card) => {
              const Icon = card.icon;
              return (
                <Card key={card.href} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Icon className={`h-5 w-5 ${card.color}`} />
                      <span className="text-lg">{card.title}</span>
                    </CardTitle>
                    <CardDescription className="text-sm">
                      {card.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => navigate(card.href)}
                    >
                      Go to {card.title}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Additional Content */}
          <div className="mt-8">
            <Card>
              <CardHeader>
                <CardTitle>Getting Started</CardTitle>
                <CardDescription>
                  Complete these steps to make the most of your account
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium">Complete your profile</h4>
                    <p className="text-sm text-muted-foreground">Add your bio, location, and contact information</p>
                  </div>
                  <Button variant="outline" onClick={() => navigate('/dashboard/profile')}>
                    Update Profile
                  </Button>
                </div>
                
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium">Create your first service</h4>
                    <p className="text-sm text-muted-foreground">Start offering services to other users</p>
                  </div>
                  <Button variant="outline" onClick={() => navigate('/dashboard/services')}>
                    Add Service
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
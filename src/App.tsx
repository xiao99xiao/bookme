import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { PrivyAuthProvider } from "./contexts/PrivyAuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Index from "./pages/Index";
import Discover from "./pages/Discover";
import BookServices from "./pages/BookServices";
import Profile from "./pages/Profile";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import Onboarding from "./pages/Onboarding";
import NotFound from "./pages/NotFound";
import NewNavigation from "./components/NewNavigation";
import { OnboardingNavigator } from "./components/OnboardingNavigator";

// Customer pages
import CustomerBookings from "./pages/customer/CustomerBookings";
import CustomerProfile from "./pages/customer/CustomerProfile";
import CustomerMessages from "./pages/customer/CustomerMessages";

// Provider pages
import ProviderOrders from "./pages/provider/ProviderOrders";
import ProviderServices from "./pages/provider/ProviderServices";
import ProviderMessages from "./pages/provider/ProviderMessages";
import ProviderIntegrations from "./pages/provider/ProviderIntegrations";

// Balance page
import Balance from "./pages/Balance";

// Dashboard imports (keep for backward compatibility during transition)
import DashboardLayout from "./layouts/DashboardLayout";
import DashboardProfile from "./pages/dashboard/DashboardProfile";
import DashboardServices from "./pages/dashboard/DashboardServices";
import DashboardOrders from "./pages/dashboard/DashboardOrders";
import DashboardBookings from "./pages/dashboard/DashboardBookings";
import DashboardMessages from "./pages/dashboard/DashboardMessages";
import DashboardBalance from "./pages/dashboard/DashboardBalance";
import DashboardIntegrations from "./pages/dashboard/DashboardIntegrations";
import IntegrationsCallback from "./pages/dashboard/IntegrationsCallback";

const queryClient = new QueryClient();

// Component to conditionally render navigation
function AppContent() {
  const location = useLocation();
  const isDashboard = location.pathname.startsWith('/dashboard');

  return (
    <>
      <OnboardingNavigator />
      {!isDashboard && <NewNavigation />}
      <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/discover" element={<Discover />} />
            <Route 
              path="/book-services" 
              element={
                <ProtectedRoute>
                  <BookServices />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/profile" 
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/profile/:userId" 
              element={<Profile />} 
            />
            <Route 
              path="/auth" 
              element={
                <ProtectedRoute requireAuth={false}>
                  <Auth />
                </ProtectedRoute>
              } 
            />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route 
              path="/onboarding" 
              element={
                <ProtectedRoute>
                  <Onboarding />
                </ProtectedRoute>
              } 
            />

            {/* Balance Route */}
            <Route 
              path="/balance" 
              element={
                <ProtectedRoute>
                  <Balance />
                </ProtectedRoute>
              } 
            />
            
            {/* Customer Routes */}
            <Route 
              path="/customer/bookings" 
              element={
                <ProtectedRoute>
                  <CustomerBookings />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/customer/profile" 
              element={
                <ProtectedRoute>
                  <CustomerProfile />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/customer/messages" 
              element={
                <ProtectedRoute>
                  <CustomerMessages />
                </ProtectedRoute>
              } 
            />
            
            {/* Provider Routes */}
            <Route 
              path="/provider/orders" 
              element={
                <ProtectedRoute>
                  <ProviderOrders />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/provider/services" 
              element={
                <ProtectedRoute>
                  <ProviderServices />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/provider/messages" 
              element={
                <ProtectedRoute>
                  <ProviderMessages />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/provider/integrations" 
              element={
                <ProtectedRoute>
                  <ProviderIntegrations />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/provider/integrations/callback" 
              element={
                <ProtectedRoute>
                  <IntegrationsCallback />
                </ProtectedRoute>
              } 
            />
            
            {/* Dashboard Routes (kept for backward compatibility) */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardProfile />} />
              <Route path="profile" element={<DashboardProfile />} />
              <Route path="services" element={<DashboardServices />} />
              <Route path="orders" element={<DashboardOrders />} />
              <Route path="bookings" element={<DashboardBookings />} />
              <Route path="messages" element={<DashboardMessages />} />
              <Route path="balance" element={<DashboardBalance />} />
              <Route path="integrations" element={<DashboardIntegrations />} />
              <Route path="integrations/callback" element={<IntegrationsCallback />} />
            </Route>
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <PrivyAuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </PrivyAuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

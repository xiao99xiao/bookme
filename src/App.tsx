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
import Navigation from "./components/Navigation";
import { OnboardingNavigator } from "./components/OnboardingNavigator";

// Dashboard imports
import DashboardLayout from "./layouts/DashboardLayout";
import DashboardProfile from "./pages/dashboard/DashboardProfile";
import DashboardServices from "./pages/dashboard/DashboardServices";
import DashboardOrders from "./pages/dashboard/DashboardOrders";
import DashboardBookings from "./pages/dashboard/DashboardBookings";
import DashboardBalance from "./pages/dashboard/DashboardBalance";
import DashboardIntegrations from "./pages/dashboard/DashboardIntegrations";
import IntegrationsCallback from "./pages/dashboard/IntegrationsCallback";
import DashboardTest from "./pages/dashboard/DashboardTest";
import DashboardBackendTest from "./pages/dashboard/DashboardBackendTest";
import DashboardDebug from "./pages/dashboard/DashboardDebug";
import { DevTokenHelper } from "./components/DevTokenHelper";

const queryClient = new QueryClient();

// Component to conditionally render navigation
function AppContent() {
  const location = useLocation();
  const isDashboard = location.pathname.startsWith('/dashboard');

  return (
    <>
      <OnboardingNavigator />
      {!isDashboard && <Navigation />}
      {/* Dev helper - remove in production */}
      {process.env.NODE_ENV === 'development' && <DevTokenHelper />}
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
            
            {/* Dashboard Routes */}
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
              <Route path="balance" element={<DashboardBalance />} />
              <Route path="integrations" element={<DashboardIntegrations />} />
              <Route path="integrations/callback" element={<IntegrationsCallback />} />
              <Route path="test" element={<DashboardTest />} />
              <Route path="backend-test" element={<DashboardBackendTest />} />
              <Route path="debug" element={<DashboardDebug />} />
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

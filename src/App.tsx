import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
import Profile from "./pages/settings/Profile";
import CustomerMessages from "./pages/customer/CustomerMessages";
import CustomerMobileChat from "./pages/customer/CustomerMobileChat";

// Settings pages
import Customize from "./pages/settings/Customize";
import Timezone from "./pages/settings/Timezone";

// Provider pages
import ProviderOrders from "./pages/provider/ProviderOrders";
import ProviderServices from "./pages/provider/ProviderServices";
import ProviderMessages from "./pages/provider/ProviderMessages";
import ProviderMobileChat from "./pages/provider/ProviderMobileChat";
import ProviderIntegrations from "./pages/provider/ProviderIntegrations";
import IntegrationsCallback from "./pages/provider/IntegrationsCallback";

// Balance page
import Balance from "./pages/Balance";


const queryClient = new QueryClient();

// Component to conditionally render navigation
function AppContent() {
  return (
    <>
      <OnboardingNavigator />
      <NewNavigation />
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
              path="/settings/profile" 
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/settings/customize" 
              element={
                <ProtectedRoute>
                  <Customize />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/settings/timezone" 
              element={
                <ProtectedRoute>
                  <Timezone />
                </ProtectedRoute>
              } 
            />
            {/* Username-based user page - must be last to avoid conflicts */}
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
              path="/customer/messages" 
              element={
                <ProtectedRoute>
                  <CustomerMessages />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/customer/messages/:conversationId" 
              element={
                <ProtectedRoute>
                  <CustomerMobileChat />
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
              path="/provider/messages/:conversationId" 
              element={
                <ProtectedRoute>
                  <ProviderMobileChat />
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
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            {/* Username-based user page - must be at the bottom to avoid conflicts */}
            <Route 
              path="/:username" 
              element={<Profile />} 
            />
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

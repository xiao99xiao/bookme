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
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import Onboarding from "./pages/Onboarding";
import NotFound from "./pages/NotFound";
import NewNavigation from "./components/NewNavigation";
import RefactoredNavigation from "./components/RefactoredNavigation";
import { OnboardingNavigator } from "./components/OnboardingNavigator";

// Customer pages
import CustomerBookings from "./pages/customer/CustomerBookings";
import SettingsProfile from "./pages/settings/Profile";
import CustomerMessages from "./pages/customer/CustomerMessages";

// Public Profile page
import Profile from "./pages/Profile";
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
import Income from "./pages/provider/Income";
import ProviderReferrals from "./pages/provider/ProviderReferrals";

// Balance page
import Balance from "./pages/Balance";

// Mobile pages
import MobileMePage from "./pages/mobile/MobileMePage";
import MobileUsernameSettings from "./pages/mobile/MobileUsernameSettings";
import MobileTimezoneSettings from "./pages/mobile/MobileTimezoneSettings";
import MobileProfileSettings from "./pages/mobile/MobileProfileSettings";
import MobileIntegrationsSettings from "./pages/mobile/MobileIntegrationsSettings";

// Demo page
import DesignSystemDemo from "./pages/DesignSystemDemo";


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
            <Route path="/design-system-demo" element={<DesignSystemDemo />} />
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
                  <SettingsProfile />
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
            <Route
              path="/provider/income"
              element={
                <ProtectedRoute>
                  <Income />
                </ProtectedRoute>
              }
            />
            <Route
              path="/provider/referrals"
              element={
                <ProtectedRoute>
                  <ProviderReferrals />
                </ProtectedRoute>
              }
            />

            {/* Mobile Me Page - must be before username route to avoid conflicts */}
            <Route
              path="/me"
              element={
                <ProtectedRoute requireAuth={false}>
                  <MobileMePage />
                </ProtectedRoute>
              }
            />

            {/* Mobile Settings Pages */}
            <Route
              path="/mobile/profile"
              element={
                <ProtectedRoute>
                  <MobileProfileSettings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/mobile/username"
              element={
                <ProtectedRoute>
                  <MobileUsernameSettings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/mobile/timezone"
              element={
                <ProtectedRoute>
                  <MobileTimezoneSettings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/mobile/integrations"
              element={
                <ProtectedRoute>
                  <MobileIntegrationsSettings />
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

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { PrivyAuthProvider } from "./contexts/PrivyAuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Index from "./pages/Index";
import { HomePage } from "./pages/home";
import Discover from "./pages/Discover";
import BookServices from "./pages/BookServices";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import Onboarding from "./pages/Onboarding";
import NotFound from "./pages/NotFound";
import Navigation from "./components/Navigation";
import { OnboardingNavigator } from "./components/OnboardingNavigator";

// Visitor pages (formerly Customer)
import CustomerBookings from "./pages/customer/CustomerBookings";
import SettingsProfile from "./pages/settings/Profile";
import CustomerMessages from "./pages/customer/CustomerMessages";

// Public Profile page (Nook - with theme support)
import { PublicProfile } from "./pages/public-profile";
import CustomerMobileChat from "./pages/customer/CustomerMobileChat";

// Settings pages
import Customize from "./pages/settings/Customize";
import ProfileTheme from "./pages/settings/ProfileTheme";

// Host pages (formerly Provider)
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
      <Navigation />
      <Routes>
            <Route path="/" element={<HomePage />} />
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
              path="/settings/profile-theme"
              element={
                <ProtectedRoute>
                  <ProfileTheme />
                </ProtectedRoute>
              }
            />
            {/* Auth routes */}
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

            {/* Visitor Routes (new paths) */}
            <Route
              path="/bookings"
              element={
                <ProtectedRoute>
                  <CustomerBookings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/messages"
              element={
                <ProtectedRoute>
                  <CustomerMessages />
                </ProtectedRoute>
              }
            />
            <Route
              path="/messages/:conversationId"
              element={
                <ProtectedRoute>
                  <CustomerMobileChat />
                </ProtectedRoute>
              }
            />

            {/* Legacy Visitor Routes (redirect to new paths) */}
            <Route path="/customer/bookings" element={<Navigate to="/bookings" replace />} />
            <Route path="/customer/messages" element={<Navigate to="/messages" replace />} />
            <Route path="/customer/messages/:conversationId" element={<Navigate to="/messages/:conversationId" replace />} />

            {/* Host Routes (new paths - formerly Provider) */}
            <Route
              path="/host/bookings"
              element={
                <ProtectedRoute>
                  <ProviderOrders />
                </ProtectedRoute>
              }
            />
            <Route
              path="/host/talks"
              element={
                <ProtectedRoute>
                  <ProviderServices />
                </ProtectedRoute>
              }
            />
            <Route
              path="/host/messages"
              element={
                <ProtectedRoute>
                  <ProviderMessages />
                </ProtectedRoute>
              }
            />
            <Route
              path="/host/messages/:conversationId"
              element={
                <ProtectedRoute>
                  <ProviderMobileChat />
                </ProtectedRoute>
              }
            />
            <Route
              path="/host/integrations"
              element={
                <ProtectedRoute>
                  <ProviderIntegrations />
                </ProtectedRoute>
              }
            />
            <Route
              path="/host/integrations/callback"
              element={
                <ProtectedRoute>
                  <IntegrationsCallback />
                </ProtectedRoute>
              }
            />
            <Route
              path="/host/earnings"
              element={
                <ProtectedRoute>
                  <Income />
                </ProtectedRoute>
              }
            />
            <Route
              path="/host/referrals"
              element={
                <ProtectedRoute>
                  <ProviderReferrals />
                </ProtectedRoute>
              }
            />

            {/* Legacy Host Routes (redirect to new paths) */}
            <Route path="/provider/orders" element={<Navigate to="/host/bookings" replace />} />
            <Route path="/provider/services" element={<Navigate to="/host/talks" replace />} />
            <Route path="/provider/messages" element={<Navigate to="/host/messages" replace />} />
            <Route path="/provider/messages/:conversationId" element={<Navigate to="/host/messages/:conversationId" replace />} />
            <Route path="/provider/integrations" element={<Navigate to="/host/integrations" replace />} />
            <Route path="/provider/integrations/callback" element={<Navigate to="/host/integrations/callback" replace />} />
            <Route path="/provider/income" element={<Navigate to="/host/earnings" replace />} />
            <Route path="/provider/referrals" element={<Navigate to="/host/referrals" replace />} />

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
              path="/mobile/integrations"
              element={
                <ProtectedRoute>
                  <MobileIntegrationsSettings />
                </ProtectedRoute>
              }
            />

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            {/* Username-based Nook page - must be at the bottom to avoid conflicts */}
            {/* Uses PublicProfile with theme support for complete style isolation */}
            <Route
              path="/:username"
              element={<PublicProfile />}
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

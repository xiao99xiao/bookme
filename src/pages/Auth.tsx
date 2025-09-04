import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/PrivyAuthContext";
import authHero from "@/assets/auth-hero.jpg";
import { H1, H2, Text, Button as DSButton } from "@/design-system";

const Auth = () => {
  const { login, ready } = useAuth();

  if (!ready) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <Text color="secondary">Loading...</Text>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex relative">
      {/* Left Side - Auth Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-6">
          <div className="flex items-center gap-2 mb-8">
            <DSButton 
              variant="tertiary" 
              size="small" 
              as={Link} 
              to="/"
              icon={<ArrowLeft className="h-4 w-4" />}
            >
              Back
            </DSButton>
          </div>

          <div className="text-center space-y-2">
            <H1>Welcome</H1>
            <Text color="secondary">
              Enter your email to get started
            </Text>
          </div>

          <div className="space-y-4">
            <DSButton 
              onClick={login}
              fullWidth
              variant="primary"
            >
              Sign In / Sign Up
            </DSButton>
            
            <Text variant="small" color="secondary" className="text-center">
                By continuing, you agree to our Terms of Service and Privacy Policy
            </Text>
          </div>
        </div>
      </div>

      {/* Right Side - Hero Image */}
      <div className="hidden lg:flex flex-1 relative h-screen">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/20 z-10" />
        <img 
          src={authHero}
          alt="Modern workspace with laptop and coffee"
          className="object-cover w-full h-full"
        />
        <div className="absolute bottom-8 left-8 right-8 z-20 text-white">
          <H2 className="mb-2">Join thousands of professionals</H2>
          <p className="text-white/90">
            Connect with service providers and manage your appointments seamlessly.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
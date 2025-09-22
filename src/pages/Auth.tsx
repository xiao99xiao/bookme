import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/PrivyAuthContext";
import { Loading } from "@/design-system";

const Auth = () => {
  const { login, ready, authenticated } = useAuth();
  const navigate = useNavigate();

  // Redirect authenticated users
  useEffect(() => {
    if (ready && authenticated) {
      navigate('/discover');
    }
  }, [ready, authenticated, navigate]);

  // Auto-trigger login for unauthenticated users
  useEffect(() => {
    if (ready && !authenticated) {
      // Small delay to allow page to render, then trigger login
      const timer = setTimeout(() => {
        login();
        // After triggering login, redirect to home
        navigate('/');
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [ready, authenticated, login, navigate]);

  if (!ready) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loading variant="spinner" size="lg" text="Loading..." />
      </div>
    );
  }

  return (
    <div className="h-screen flex items-center justify-center">
      <Loading variant="spinner" size="lg" text="Redirecting..." />
    </div>
  );
};

export default Auth;
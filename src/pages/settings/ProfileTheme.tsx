/**
 * Profile Theme Settings Page
 *
 * This page now redirects to the unified Page Editor at /host/page.
 * The theme and button customization has been consolidated into the PageEditor component.
 */

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loading } from "@/design-system";

const ProfileTheme = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to the unified Page Editor
    navigate("/host/page", { replace: true });
  }, [navigate]);

  // Show loading state while redirecting
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loading variant="spinner" size="lg" text="Redirecting to Page Editor..." />
    </div>
  );
};

export default ProfileTheme;

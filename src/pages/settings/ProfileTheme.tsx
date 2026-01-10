/**
 * Profile Theme Settings Page
 *
 * Allows users to customize their public profile page appearance.
 */

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/PrivyAuthContext";
import { ApiClient } from "@/lib/api-migration";
import { toast } from "sonner";
import { Check, Palette, Code, Eye, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageLayout from "@/components/PageLayout";
import { H1, H2, Text, Loading } from "@/design-system";

// Theme imports
import {
  getAllThemes,
  getTheme,
  themeToCSSVars,
  getCSSIssues,
  ThemeConfig,
  THEME_CLASS_PREFIX,
} from "@/lib/themes";

// Import preview styles
import "../public-profile/styles/public-profile.css";

const ProfileTheme = () => {
  const { userId, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Theme state
  const [selectedTheme, setSelectedTheme] = useState("default");
  const [customCSS, setCustomCSS] = useState("");
  const [cssErrors, setCssErrors] = useState<string[]>([]);

  // All available themes
  const themes = useMemo(() => getAllThemes(), []);

  // Current theme config for preview
  const currentThemeConfig = useMemo(() => getTheme(selectedTheme), [selectedTheme]);

  // Load user's theme settings
  useEffect(() => {
    const loadTheme = async () => {
      if (!userId) return;

      try {
        setLoading(true);
        const data = await ApiClient.getUserTheme(userId);
        setSelectedTheme(data.theme || "default");
        setCustomCSS(data.custom_css || "");
      } catch (error) {
        console.error("Failed to load theme:", error);
      } finally {
        setLoading(false);
      }
    };

    loadTheme();
  }, [userId]);

  // Validate CSS on change
  useEffect(() => {
    const issues = getCSSIssues(customCSS);
    setCssErrors(issues);
  }, [customCSS]);

  // Save theme settings
  const handleSave = async () => {
    if (!userId) return;

    if (cssErrors.length > 0) {
      toast.error("Please fix CSS issues before saving");
      return;
    }

    try {
      setSaving(true);
      await ApiClient.updateUserTheme({
        theme: selectedTheme,
        custom_css: customCSS || null,
      });
      toast.success("Theme saved successfully!");
    } catch (error) {
      console.error("Failed to save theme:", error);
      toast.error("Failed to save theme");
    } finally {
      setSaving(false);
    }
  };

  // Open profile in new tab
  const openPreview = () => {
    if (profile?.username) {
      window.open(`/${profile.username}`, "_blank");
    } else {
      toast.error("You need a username to preview your public page");
    }
  };

  if (loading) {
    return (
      <PageLayout title="Profile Theme">
        <div className="flex items-center justify-center py-20">
          <Loading variant="spinner" size="lg" text="Loading theme settings..." />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Profile Theme">
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="flex justify-between items-start mb-8">
          <div>
            <H1>Profile Theme</H1>
            <Text color="secondary" className="mt-2">
              Customize how your public profile looks to visitors
            </Text>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={openPreview}>
              <Eye className="w-4 h-4 mr-2" />
              Preview
            </Button>
            <Button onClick={handleSave} disabled={saving || cssErrors.length > 0}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="themes" className="space-y-6">
          <TabsList>
            <TabsTrigger value="themes" className="gap-2">
              <Palette className="w-4 h-4" />
              Themes
            </TabsTrigger>
            <TabsTrigger value="custom" className="gap-2">
              <Code className="w-4 h-4" />
              Custom CSS
            </TabsTrigger>
          </TabsList>

          {/* Theme Selection */}
          <TabsContent value="themes" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {themes.map((theme) => (
                <ThemeCard
                  key={theme.id}
                  theme={theme}
                  selected={selectedTheme === theme.id}
                  onSelect={() => setSelectedTheme(theme.id)}
                />
              ))}
            </div>
          </TabsContent>

          {/* Custom CSS */}
          <TabsContent value="custom" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Custom CSS</CardTitle>
                <CardDescription>
                  Add your own CSS to further customize your profile. All selectors are automatically
                  scoped to your profile page.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {cssErrors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-800 font-medium mb-2">CSS Issues Found:</p>
                    <ul className="list-disc list-inside text-red-700 text-sm">
                      {cssErrors.map((error, i) => (
                        <li key={i}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <Textarea
                  value={customCSS}
                  onChange={(e) => setCustomCSS(e.target.value)}
                  placeholder={`/* Example: Change heading color */
.pp-name {
  color: #6366f1;
}

/* Example: Add shadow to cards */
.pp-service-card {
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}`}
                  className="font-mono text-sm min-h-[300px]"
                />

                <div className="text-sm text-muted-foreground space-y-2">
                  <p>
                    <strong>Available CSS classes:</strong>
                  </p>
                  <ul className="list-disc list-inside grid grid-cols-2 gap-1">
                    <li><code>.pp-container</code> - Main container</li>
                    <li><code>.pp-header</code> - Profile header</li>
                    <li><code>.pp-avatar</code> - Avatar image</li>
                    <li><code>.pp-name</code> - Display name</li>
                    <li><code>.pp-badge</code> - Info badges</li>
                    <li><code>.pp-bio</code> - Bio section</li>
                    <li><code>.pp-service-card</code> - Service cards</li>
                    <li><code>.pp-review-item</code> - Review items</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Live Preview */}
        <div className="mt-12">
          <H2 className="mb-6">Preview</H2>
          <div className="border rounded-lg overflow-hidden bg-gray-100">
            <ThemePreview theme={currentThemeConfig} profile={profile} />
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

// =====================================================
// Theme Card Component
// =====================================================

interface ThemeCardProps {
  theme: ThemeConfig;
  selected: boolean;
  onSelect: () => void;
}

const ThemeCard = ({ theme, selected, onSelect }: ThemeCardProps) => {
  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md ${
        selected ? "ring-2 ring-primary" : ""
      }`}
      onClick={onSelect}
    >
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="font-semibold text-lg">{theme.name}</h3>
            <p className="text-sm text-muted-foreground">{theme.description}</p>
          </div>
          {selected && (
            <div className="bg-primary text-primary-foreground rounded-full p-1">
              <Check className="w-4 h-4" />
            </div>
          )}
        </div>

        {/* Color Swatches */}
        <div className="flex gap-1 mt-4">
          <div
            className="w-8 h-8 rounded-full border"
            style={{ backgroundColor: theme.colors.background }}
            title="Background"
          />
          <div
            className="w-8 h-8 rounded-full border"
            style={{ backgroundColor: theme.colors.textPrimary }}
            title="Text"
          />
          <div
            className="w-8 h-8 rounded-full border"
            style={{ backgroundColor: theme.colors.accent }}
            title="Accent"
          />
          <div
            className="w-8 h-8 rounded-full border"
            style={{ backgroundColor: theme.colors.cardBackground }}
            title="Card"
          />
          <div
            className="w-8 h-8 rounded-full border"
            style={{ backgroundColor: theme.colors.badgeBackground }}
            title="Badge"
          />
        </div>
      </CardContent>
    </Card>
  );
};

// =====================================================
// Theme Preview Component
// =====================================================

interface ThemePreviewProps {
  theme: ThemeConfig;
  profile: any;
}

const ThemePreview = ({ theme, profile }: ThemePreviewProps) => {
  return (
    <div
      className={`${THEME_CLASS_PREFIX}-container`}
      style={{
        ...themeToCSSVars(theme),
        minHeight: "400px",
        padding: "24px",
      }}
    >
      <div className={`${THEME_CLASS_PREFIX}-content`} style={{ maxWidth: "100%" }}>
        {/* Header Preview */}
        <div className={`${THEME_CLASS_PREFIX}-header`} style={{ marginBottom: "24px" }}>
          <div className={`${THEME_CLASS_PREFIX}-avatar`} style={{ width: 80, height: 80 }}>
            {profile?.avatar ? (
              <img src={profile.avatar} alt="Avatar" />
            ) : (
              <div className={`${THEME_CLASS_PREFIX}-avatar-fallback`}>
                {profile?.display_name?.charAt(0) || "U"}
              </div>
            )}
          </div>
          <div className={`${THEME_CLASS_PREFIX}-header-info`}>
            <h1 className={`${THEME_CLASS_PREFIX}-name`} style={{ fontSize: 20 }}>
              {profile?.display_name || "Your Name"}
            </h1>
            <div className={`${THEME_CLASS_PREFIX}-badges`}>
              <span className={`${THEME_CLASS_PREFIX}-badge`} style={{ padding: "8px 12px" }}>
                Location Badge
              </span>
              <span className={`${THEME_CLASS_PREFIX}-badge`} style={{ padding: "8px 12px" }}>
                ★ 5.0 (10 reviews)
              </span>
            </div>
          </div>
        </div>

        {/* Service Card Preview */}
        <div className={`${THEME_CLASS_PREFIX}-services`}>
          <div className={`${THEME_CLASS_PREFIX}-service-card`}>
            <div className={`${THEME_CLASS_PREFIX}-service-header`}>
              <div>
                <h3 className={`${THEME_CLASS_PREFIX}-service-title`}>Sample Service</h3>
                <p className={`${THEME_CLASS_PREFIX}-service-description`}>
                  This is how your service cards will look with this theme.
                </p>
              </div>
            </div>
            <div className={`${THEME_CLASS_PREFIX}-service-meta`}>
              <span className={`${THEME_CLASS_PREFIX}-service-price`}>$50</span>
              <span className={`${THEME_CLASS_PREFIX}-service-duration`}>• 60 min</span>
              <span className={`${THEME_CLASS_PREFIX}-service-location-badge`}>Online</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileTheme;

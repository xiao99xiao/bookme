/**
 * Profile Theme Settings Page
 *
 * Allows users to customize their public profile page appearance.
 */

import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/PrivyAuthContext";
import { ApiClient } from "@/lib/api-migration";
import { toast } from "sonner";
import { Check, Palette, Code, Eye, ExternalLink, Link2, Plus, Trash2, GripVertical, Twitter, Instagram, Youtube, Github, Linkedin, Globe, Mail, MessageCircle, Users, Settings, Link as LinkIcon, Sliders } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { H2, Text, Loading } from "@/design-system";

// Theme imports
import {
  getAllThemes,
  getTheme,
  themeToCSSVars,
  getThemeVersionAttribute,
  getCSSIssues,
  mergeThemeWithSettings,
  ThemeConfig,
  ThemeSettings,
  ProfileButton,
  THEME_CLASS_PREFIX,
} from "@/lib/themes";

// Icon options for buttons
const ICON_OPTIONS = [
  { value: "link", label: "Link", icon: ExternalLink },
  { value: "twitter", label: "Twitter/X", icon: Twitter },
  { value: "instagram", label: "Instagram", icon: Instagram },
  { value: "youtube", label: "YouTube", icon: Youtube },
  { value: "github", label: "GitHub", icon: Github },
  { value: "linkedin", label: "LinkedIn", icon: Linkedin },
  { value: "website", label: "Website", icon: Globe },
  { value: "email", label: "Email", icon: Mail },
  { value: "telegram", label: "Telegram", icon: MessageCircle },
] as const;

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
  const [themeSettingsJson, setThemeSettingsJson] = useState("{}");
  const [themeSettingsError, setThemeSettingsError] = useState<string | null>(null);

  // Profile buttons state
  const [profileButtons, setProfileButtons] = useState<ProfileButton[]>([]);

  // All available themes
  const themes = useMemo(() => getAllThemes(), []);

  // Parse theme settings for preview
  const parsedThemeSettings = useMemo((): ThemeSettings => {
    if (!themeSettingsJson.trim() || themeSettingsJson.trim() === "{}") {
      return {};
    }
    try {
      return JSON.parse(themeSettingsJson) as ThemeSettings;
    } catch {
      return {};
    }
  }, [themeSettingsJson]);

  // Current theme config for preview (merged with user settings)
  const currentThemeConfig = useMemo(() => {
    const baseTheme = getTheme(selectedTheme);
    return mergeThemeWithSettings(baseTheme, parsedThemeSettings);
  }, [selectedTheme, parsedThemeSettings]);

  // Load user's theme settings and buttons
  useEffect(() => {
    const loadData = async () => {
      if (!userId) return;

      try {
        setLoading(true);
        const [themeData, buttonsData] = await Promise.all([
          ApiClient.getUserTheme(userId),
          ApiClient.getUserButtons(userId),
        ]);
        setSelectedTheme(themeData.theme || "default");
        setCustomCSS(themeData.custom_css || "");
        setThemeSettingsJson(
          themeData.settings && Object.keys(themeData.settings).length > 0
            ? JSON.stringify(themeData.settings, null, 2)
            : "{}"
        );
        setProfileButtons(buttonsData.buttons || []);
      } catch (error) {
        console.error("Failed to load data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [userId]);

  // Validate CSS on change
  useEffect(() => {
    const issues = getCSSIssues(customCSS);
    setCssErrors(issues);
  }, [customCSS]);

  // Validate theme settings JSON on change
  useEffect(() => {
    if (!themeSettingsJson.trim() || themeSettingsJson.trim() === "{}") {
      setThemeSettingsError(null);
      return;
    }
    try {
      JSON.parse(themeSettingsJson);
      setThemeSettingsError(null);
    } catch (e) {
      setThemeSettingsError(e instanceof Error ? e.message : "Invalid JSON");
    }
  }, [themeSettingsJson]);

  // Save theme settings and buttons
  const handleSave = async () => {
    if (!userId) return;

    if (cssErrors.length > 0) {
      toast.error("Please fix CSS issues before saving");
      return;
    }

    if (themeSettingsError) {
      toast.error("Please fix theme settings JSON before saving");
      return;
    }

    // Parse theme settings JSON
    let parsedSettings = {};
    if (themeSettingsJson.trim() && themeSettingsJson.trim() !== "{}") {
      try {
        parsedSettings = JSON.parse(themeSettingsJson);
      } catch {
        toast.error("Invalid theme settings JSON");
        return;
      }
    }

    // Validate buttons
    for (const button of profileButtons) {
      if (!button.label.trim()) {
        toast.error("All buttons must have a label");
        return;
      }
      if (!button.url.trim()) {
        toast.error("All buttons must have a URL");
        return;
      }
      try {
        new URL(button.url);
      } catch {
        toast.error(`Invalid URL: ${button.url}`);
        return;
      }
    }

    try {
      setSaving(true);
      await Promise.all([
        ApiClient.updateUserTheme({
          theme: selectedTheme,
          custom_css: customCSS || null,
          settings: parsedSettings,
        }),
        ApiClient.updateUserButtons(profileButtons),
      ]);
      toast.success("Settings saved successfully!");
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  // Button management handlers
  const addButton = () => {
    const newButton: ProfileButton = {
      id: crypto.randomUUID(),
      label: "",
      url: "",
      icon: "link",
      order: profileButtons.length,
    };
    setProfileButtons([...profileButtons, newButton]);
  };

  const removeButton = (id: string) => {
    setProfileButtons(profileButtons.filter((b) => b.id !== id));
  };

  const updateButton = (id: string, updates: Partial<ProfileButton>) => {
    setProfileButtons(
      profileButtons.map((b) => (b.id === id ? { ...b, ...updates } : b))
    );
  };

  const moveButton = (id: string, direction: "up" | "down") => {
    const index = profileButtons.findIndex((b) => b.id === id);
    if (index === -1) return;

    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= profileButtons.length) return;

    const newButtons = [...profileButtons];
    [newButtons[index], newButtons[newIndex]] = [newButtons[newIndex], newButtons[index]];
    // Update order values
    newButtons.forEach((b, i) => (b.order = i));
    setProfileButtons(newButtons);
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
      <div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
          <div className="flex items-center justify-center py-20">
            <Loading variant="spinner" size="lg" text="Loading theme settings..." />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {/* Desktop Layout */}
        <div className="hidden lg:flex gap-8">
          {/* Left Sidebar - Desktop Only */}
          <div className="w-64 flex-shrink-0">
            <div className="fixed w-64 h-screen">
              <div className="bg-neutral-50 box-border content-stretch flex flex-col gap-6 h-full items-start justify-start overflow-clip px-8 py-10 relative shrink-0 w-64 rounded-2xl">
                <div className="content-stretch flex flex-col gap-0.5 items-start justify-start leading-[0] relative shrink-0 w-full">
                  <H2 className="leading-[1.4]">Settings</H2>
                  <div className="font-body text-xs text-tertiary w-full">
                    <p className="leading-[1.5] text-tertiary">Customize your public page</p>
                  </div>
                </div>
                <div className="basis-0 content-stretch flex flex-col grow items-start justify-start min-h-px min-w-px relative shrink-0 w-full">
                  <Link to="/settings/profile" className="box-border content-stretch flex gap-2 items-center justify-start px-2 py-3 relative rounded-[12px] shrink-0 w-full hover:bg-[#f3f3f3] transition-colors">
                    <div className="overflow-clip relative shrink-0 size-5">
                      <Users className="w-5 h-5 text-[#666666]" />
                    </div>
                    <div className="basis-0 font-body font-normal grow leading-[0] min-h-px min-w-px relative shrink-0 text-[#666666] text-[16px] hover:text-black transition-colors">
                      <p className="leading-[1.5]">Profile</p>
                    </div>
                  </Link>
                  <Link to="/settings/customize" className="box-border content-stretch flex gap-2 items-center justify-start px-2 py-3 relative rounded-[12px] shrink-0 w-full hover:bg-[#f3f3f3] transition-colors">
                    <div className="overflow-clip relative shrink-0 size-5">
                      <Settings className="w-5 h-5 text-[#666666]" />
                    </div>
                    <div className="basis-0 font-body font-normal grow leading-[0] min-h-px min-w-px relative shrink-0 text-[#666666] text-[16px] hover:text-black transition-colors">
                      <p className="leading-[1.5]">Customize</p>
                    </div>
                  </Link>
                  <div className="bg-[#f3f3f3] box-border content-stretch flex gap-2 items-center justify-start px-2 py-3 relative rounded-[12px] shrink-0 w-full">
                    <div className="overflow-clip relative shrink-0 size-5">
                      <LinkIcon className="w-5 h-5 text-black" />
                    </div>
                    <div className="basis-0 font-body font-medium grow leading-[0] min-h-px min-w-px relative shrink-0 text-[16px] text-black">
                      <p className="leading-[1.5]">Theme & Buttons</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Area - Desktop */}
          <div className="flex-1">
            <div className="bg-neutral-50 box-border content-stretch flex flex-col gap-6 h-full items-start justify-start min-h-px min-w-px py-0 relative shrink-0 rounded-2xl">
              <div className="box-border content-stretch flex flex-col gap-10 items-start justify-start p-[40px] relative rounded-[16px] shrink-0 w-full">
                <div className="content-stretch flex flex-col gap-8 items-start justify-start relative shrink-0 w-full">
                  {/* Header */}
                  <div className="flex justify-between items-start w-full">
                    <div className="content-stretch flex flex-col gap-0.5 items-start justify-start leading-[0] relative shrink-0">
                      <H2 className="leading-[1.4]">Theme & Buttons</H2>
                      <div className="font-body font-normal relative shrink-0 text-[#aaaaaa] text-[12px]">
                        <p className="leading-[1.5]">Customize how your public profile looks</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <Button variant="outline" onClick={openPreview}>
                        <Eye className="w-4 h-4 mr-2" />
                        Preview
                      </Button>
                      <Button onClick={handleSave} disabled={saving || cssErrors.length > 0 || !!themeSettingsError}>
                        {saving ? "Saving..." : "Save Changes"}
                      </Button>
                    </div>
                  </div>

                  {/* Tabs */}
                  <Tabs defaultValue="themes" className="space-y-6 w-full">
                    <TabsList>
                      <TabsTrigger value="themes" className="gap-2">
                        <Palette className="w-4 h-4" />
                        Themes
                      </TabsTrigger>
                      <TabsTrigger value="buttons" className="gap-2">
                        <Link2 className="w-4 h-4" />
                        Buttons
                      </TabsTrigger>
                      <TabsTrigger value="settings" className="gap-2">
                        <Sliders className="w-4 h-4" />
                        Settings
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

                    {/* Profile Buttons */}
                    <TabsContent value="buttons" className="space-y-6">
                      <Card>
                        <CardHeader>
                          <CardTitle>Profile Link Buttons</CardTitle>
                          <CardDescription>
                            Add buttons to your profile that link to your social media, website, or other pages.
                            Buttons appear above your services.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {profileButtons.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                              <Link2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                              <p>No buttons yet. Add your first button!</p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {profileButtons.map((button, index) => {
                                const IconOption = ICON_OPTIONS.find((o) => o.value === button.icon);
                                const IconComponent = IconOption?.icon || ExternalLink;
                                return (
                                  <div
                                    key={button.id}
                                    className="flex items-center gap-3 p-4 bg-secondary/30 rounded-lg"
                                  >
                                    {/* Drag handle / order controls */}
                                    <div className="flex flex-col gap-1">
                                      <button
                                        type="button"
                                        className="p-1 hover:bg-secondary rounded disabled:opacity-30"
                                        onClick={() => moveButton(button.id, "up")}
                                        disabled={index === 0}
                                      >
                                        <GripVertical className="w-4 h-4 rotate-180" />
                                      </button>
                                      <button
                                        type="button"
                                        className="p-1 hover:bg-secondary rounded disabled:opacity-30"
                                        onClick={() => moveButton(button.id, "down")}
                                        disabled={index === profileButtons.length - 1}
                                      >
                                        <GripVertical className="w-4 h-4" />
                                      </button>
                                    </div>

                                    {/* Icon selector */}
                                    <Select
                                      value={button.icon || "link"}
                                      onValueChange={(value) => updateButton(button.id, { icon: value })}
                                    >
                                      <SelectTrigger className="w-[130px]">
                                        <SelectValue>
                                          <div className="flex items-center gap-2">
                                            <IconComponent className="w-4 h-4" />
                                            <span>{IconOption?.label || "Link"}</span>
                                          </div>
                                        </SelectValue>
                                      </SelectTrigger>
                                      <SelectContent>
                                        {ICON_OPTIONS.map((option) => (
                                          <SelectItem key={option.value} value={option.value}>
                                            <div className="flex items-center gap-2">
                                              <option.icon className="w-4 h-4" />
                                              <span>{option.label}</span>
                                            </div>
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>

                                    {/* Label input */}
                                    <Input
                                      value={button.label}
                                      onChange={(e) => updateButton(button.id, { label: e.target.value })}
                                      placeholder="Button label"
                                      className="flex-1"
                                      maxLength={50}
                                    />

                                    {/* URL input */}
                                    <Input
                                      value={button.url}
                                      onChange={(e) => updateButton(button.id, { url: e.target.value })}
                                      placeholder="https://..."
                                      className="flex-1"
                                      type="url"
                                    />

                                    {/* Delete button */}
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => removeButton(button.id)}
                                      className="text-destructive hover:text-destructive"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          <Button
                            variant="outline"
                            onClick={addButton}
                            className="w-full"
                            disabled={profileButtons.length >= 10}
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Add Button
                          </Button>

                          {profileButtons.length >= 10 && (
                            <p className="text-sm text-muted-foreground text-center">
                              Maximum 10 buttons allowed
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    </TabsContent>

                    {/* Theme Settings JSON */}
                    <TabsContent value="settings" className="space-y-6">
                      <Card>
                        <CardHeader>
                          <CardTitle>Theme Settings (Advanced)</CardTitle>
                          <CardDescription>
                            Override specific theme values using JSON. This allows fine-grained control over colors, typography, and spacing.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {themeSettingsError && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                              <p className="text-red-800 font-medium mb-2">JSON Error:</p>
                              <p className="text-red-700 text-sm">{themeSettingsError}</p>
                            </div>
                          )}

                          <Textarea
                            value={themeSettingsJson}
                            onChange={(e) => setThemeSettingsJson(e.target.value)}
                            placeholder={`{
  "colors": {
    "accent": "#6366f1",
    "textPrimary": "#1a1a1a"
  },
  "typography": {
    "fontHeading": "\\"Playfair Display\\", serif"
  },
  "spacing": {
    "cardRadius": "20px"
  }
}`}
                            className="font-mono text-sm min-h-[300px]"
                          />

                          <div className="text-sm text-muted-foreground space-y-2">
                            <p><strong>Available settings:</strong></p>
                            <details className="cursor-pointer">
                              <summary className="font-medium">colors</summary>
                              <ul className="list-disc list-inside ml-4 mt-1 text-xs grid grid-cols-2 gap-x-4">
                                <li>background</li>
                                <li>backgroundSecondary</li>
                                <li>textPrimary</li>
                                <li>textSecondary</li>
                                <li>textMuted</li>
                                <li>cardBackground</li>
                                <li>cardBorder</li>
                                <li>cardHover</li>
                                <li>accent</li>
                                <li>accentLight</li>
                                <li>badgeBackground</li>
                                <li>badgeText</li>
                                <li>buttonPrimary</li>
                                <li>buttonPrimaryText</li>
                                <li>buttonSecondary</li>
                                <li>buttonSecondaryText</li>
                                <li>linkButtonBackground</li>
                                <li>linkButtonText</li>
                                <li>linkButtonBorder</li>
                                <li>linkButtonHoverBackground</li>
                                <li>starColor</li>
                                <li>divider</li>
                              </ul>
                            </details>
                            <details className="cursor-pointer">
                              <summary className="font-medium">typography</summary>
                              <ul className="list-disc list-inside ml-4 mt-1 text-xs">
                                <li>fontHeading - e.g., "Raleway, sans-serif"</li>
                                <li>fontBody - e.g., "Inter, sans-serif"</li>
                                <li>baseFontSize - e.g., "16px"</li>
                                <li>headingWeight - e.g., "700"</li>
                                <li>bodyWeight - e.g., "400"</li>
                              </ul>
                            </details>
                            <details className="cursor-pointer">
                              <summary className="font-medium">spacing</summary>
                              <ul className="list-disc list-inside ml-4 mt-1 text-xs">
                                <li>cardPadding - e.g., "24px"</li>
                                <li>sectionGap - e.g., "32px"</li>
                                <li>borderRadius - e.g., "12px"</li>
                                <li>cardRadius - e.g., "16px"</li>
                                <li>avatarRadius - e.g., "40px"</li>
                                <li>badgeRadius - e.g., "12px"</li>
                                <li>borderWidth - e.g., "1px"</li>
                              </ul>
                            </details>
                          </div>
                        </CardContent>
                      </Card>
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
                  <div className="w-full">
                    <H2 className="mb-6">Preview</H2>
                    <div className="border rounded-lg overflow-hidden bg-gray-100">
                      <ThemePreview theme={currentThemeConfig} profile={profile} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Layout */}
        <div className="lg:hidden pb-20">
          {/* Top Header with Title and Tabs */}
          <div className="mb-6">
            {/* Title Section */}
            <div className="mb-4">
              <H2 className="mb-1">Settings</H2>
              <p className="text-sm text-gray-500 font-body">Customize your public page</p>
            </div>

            {/* Horizontal Tab Navigation */}
            <div className="flex gap-1 p-1 bg-gray-100 rounded-lg overflow-x-auto">
              <Link
                to="/settings/profile"
                className="flex-1 min-w-fit px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap font-body text-gray-600 hover:text-black"
              >
                Profile
              </Link>
              <Link
                to="/settings/customize"
                className="flex-1 min-w-fit px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap font-body text-gray-600 hover:text-black"
              >
                Customize
              </Link>
              <div className="flex-1 min-w-fit px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap font-body bg-white text-black shadow-sm">
                Theme
              </div>
            </div>
          </div>

          {/* Mobile Content Area */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-[#eeeeee] p-4 sm:p-6">
              {/* Header */}
              <div className="flex flex-col gap-4 mb-6">
                <div>
                  <H2 className="leading-[1.4]">Theme & Buttons</H2>
                  <Text color="secondary" className="mt-1">
                    Customize how your public profile looks
                  </Text>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={openPreview} size="sm" className="flex-1">
                    <Eye className="w-4 h-4 mr-2" />
                    Preview
                  </Button>
                  <Button onClick={handleSave} disabled={saving || cssErrors.length > 0 || !!themeSettingsError} size="sm" className="flex-1">
                    {saving ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>

              {/* Tabs */}
              <Tabs defaultValue="themes" className="space-y-6 w-full">
                <TabsList className="w-full">
                  <TabsTrigger value="themes" className="flex-1 gap-1 text-xs">
                    <Palette className="w-3 h-3" />
                    Themes
                  </TabsTrigger>
                  <TabsTrigger value="buttons" className="flex-1 gap-1 text-xs">
                    <Link2 className="w-3 h-3" />
                    Buttons
                  </TabsTrigger>
                  <TabsTrigger value="settings" className="flex-1 gap-1 text-xs">
                    <Sliders className="w-3 h-3" />
                    Settings
                  </TabsTrigger>
                  <TabsTrigger value="custom" className="flex-1 gap-1 text-xs">
                    <Code className="w-3 h-3" />
                    CSS
                  </TabsTrigger>
                </TabsList>

                {/* Theme Selection */}
                <TabsContent value="themes" className="space-y-4">
                  <div className="grid grid-cols-1 gap-3">
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

                {/* Profile Buttons - Mobile */}
                <TabsContent value="buttons" className="space-y-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Profile Link Buttons</CardTitle>
                      <CardDescription className="text-sm">
                        Add buttons that link to your social media or website.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {profileButtons.length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground">
                          <Link2 className="w-10 h-10 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No buttons yet</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {profileButtons.map((button, index) => {
                            const IconOption = ICON_OPTIONS.find((o) => o.value === button.icon);
                            const IconComponent = IconOption?.icon || ExternalLink;
                            return (
                              <div
                                key={button.id}
                                className="flex flex-col gap-2 p-3 bg-secondary/30 rounded-lg"
                              >
                                <div className="flex items-center gap-2">
                                  {/* Order controls */}
                                  <div className="flex gap-1">
                                    <button
                                      type="button"
                                      className="p-1 hover:bg-secondary rounded disabled:opacity-30"
                                      onClick={() => moveButton(button.id, "up")}
                                      disabled={index === 0}
                                    >
                                      <GripVertical className="w-4 h-4 rotate-180" />
                                    </button>
                                    <button
                                      type="button"
                                      className="p-1 hover:bg-secondary rounded disabled:opacity-30"
                                      onClick={() => moveButton(button.id, "down")}
                                      disabled={index === profileButtons.length - 1}
                                    >
                                      <GripVertical className="w-4 h-4" />
                                    </button>
                                  </div>

                                  {/* Icon selector */}
                                  <Select
                                    value={button.icon || "link"}
                                    onValueChange={(value) => updateButton(button.id, { icon: value })}
                                  >
                                    <SelectTrigger className="w-[100px]">
                                      <SelectValue>
                                        <div className="flex items-center gap-1">
                                          <IconComponent className="w-3 h-3" />
                                          <span className="text-xs">{IconOption?.label || "Link"}</span>
                                        </div>
                                      </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                      {ICON_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                          <div className="flex items-center gap-2">
                                            <option.icon className="w-4 h-4" />
                                            <span>{option.label}</span>
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>

                                  {/* Delete button */}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeButton(button.id)}
                                    className="text-destructive hover:text-destructive ml-auto"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>

                                {/* Label and URL inputs */}
                                <Input
                                  value={button.label}
                                  onChange={(e) => updateButton(button.id, { label: e.target.value })}
                                  placeholder="Button label"
                                  className="text-sm"
                                  maxLength={50}
                                />
                                <Input
                                  value={button.url}
                                  onChange={(e) => updateButton(button.id, { url: e.target.value })}
                                  placeholder="https://..."
                                  className="text-sm"
                                  type="url"
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <Button
                        variant="outline"
                        onClick={addButton}
                        className="w-full"
                        disabled={profileButtons.length >= 10}
                        size="sm"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Button
                      </Button>

                      {profileButtons.length >= 10 && (
                        <p className="text-xs text-muted-foreground text-center">
                          Maximum 10 buttons allowed
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Theme Settings JSON - Mobile */}
                <TabsContent value="settings" className="space-y-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Theme Settings</CardTitle>
                      <CardDescription className="text-sm">
                        Override theme values using JSON.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {themeSettingsError && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                          <p className="text-red-800 font-medium mb-1 text-sm">JSON Error:</p>
                          <p className="text-red-700 text-xs">{themeSettingsError}</p>
                        </div>
                      )}

                      <Textarea
                        value={themeSettingsJson}
                        onChange={(e) => setThemeSettingsJson(e.target.value)}
                        placeholder={`{
  "colors": {
    "accent": "#6366f1"
  }
}`}
                        className="font-mono text-xs min-h-[200px]"
                      />

                      <details className="text-xs text-muted-foreground cursor-pointer">
                        <summary className="font-medium">Available settings</summary>
                        <div className="mt-2 space-y-1">
                          <p><strong>colors:</strong> accent, background, textPrimary, cardBackground, etc.</p>
                          <p><strong>typography:</strong> fontHeading, fontBody, baseFontSize</p>
                          <p><strong>spacing:</strong> cardPadding, borderRadius, cardRadius</p>
                        </div>
                      </details>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Custom CSS - Mobile */}
                <TabsContent value="custom" className="space-y-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Custom CSS</CardTitle>
                      <CardDescription className="text-sm">
                        Add your own CSS to customize your profile.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {cssErrors.length > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                          <p className="text-red-800 font-medium mb-1 text-sm">CSS Issues:</p>
                          <ul className="list-disc list-inside text-red-700 text-xs">
                            {cssErrors.map((error, i) => (
                              <li key={i}>{error}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <Textarea
                        value={customCSS}
                        onChange={(e) => setCustomCSS(e.target.value)}
                        placeholder={`/* Example */
.pp-name {
  color: #6366f1;
}`}
                        className="font-mono text-xs min-h-[200px]"
                      />
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>

              {/* Preview - Mobile */}
              <div className="mt-6">
                <H2 className="mb-4 text-lg">Preview</H2>
                <div className="border rounded-lg overflow-hidden bg-gray-100">
                  <ThemePreview theme={currentThemeConfig} profile={profile} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
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
  const is2025Theme = theme.version === '2025';

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
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg">{theme.name}</h3>
              {is2025Theme && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
                  2025
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{theme.description}</p>
            {is2025Theme && (
              <p className="text-xs text-indigo-600 mt-1">
                Glass effects • Spring animations • Modern design
              </p>
            )}
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

        {/* Glass Effect Indicator for 2025 themes */}
        {is2025Theme && (
          <div className="mt-3 flex items-center gap-2">
            <div
              className="w-full h-8 rounded-lg border"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.1) 100%)',
                backdropFilter: 'blur(4px)',
                WebkitBackdropFilter: 'blur(4px)',
                borderColor: 'rgba(255,255,255,0.3)',
              }}
            />
          </div>
        )}
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
      data-theme-version={theme.version || '2024'}
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

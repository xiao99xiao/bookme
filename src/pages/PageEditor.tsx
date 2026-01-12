/**
 * PageEditor - Dual-mode page customization component
 *
 * Supports two modes:
 * - "onboarding": Step-by-step guided setup for new hosts
 * - "editor": Free-form editing with collapsible sections for returning users
 *
 * Features:
 * - Template selection (onboarding only)
 * - Profile basics (name, avatar, bio)
 * - Theme/style selection
 * - Profile link buttons
 * - Talks management
 * - Live preview panel
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Check,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Loader2,
  Upload,
  Plus,
  Trash2,
  ExternalLink,
  Twitter,
  Instagram,
  Youtube,
  Github,
  Linkedin,
  Globe,
  Mail,
  Video,
  Clock,
  Sparkles,
  Palette,
  Link as LinkIcon,
  MessageSquare,
  Eye,
  Save,
  X,
  Edit3,
  User,
  AlertCircle,
  CheckCircle2,
  AtSign,
} from "lucide-react";

// UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// Design System
import { H2, H3 } from "@/design-system";

// Hooks & Context
import { useAuth } from "@/contexts/PrivyAuthContext";
import { ApiClient } from "@/lib/api-migration";
import { validateUsername, generateUsernameFromName } from "@/lib/username";

// Templates & Themes
import {
  ONBOARDING_TEMPLATES,
  TemplateButton,
  getTemplate,
  processTemplateButtons,
} from "@/lib/onboarding-templates";
import {
  getAllThemes,
  getTheme,
  themeToCSSVars,
  getThemeVersionAttribute,
} from "@/lib/themes";

// Time Slot Selector
import { TimeSlotSelector } from "@/components/TimeSlotSelector";

// Constants
import { APP_NAME } from "@/lib/constants";

// Import public profile styles for preview
import "./public-profile/styles/public-profile.css";

// Import page editor styles
import "./page-editor.css";

// =====================================================
// Types
// =====================================================

type EditorMode = "onboarding" | "editor";

interface PageEditorProps {
  mode?: EditorMode;
}

interface EditorState {
  // Template selection (onboarding only)
  templateId: string | null;

  // Profile basics
  displayName: string;
  avatar: string;
  bio: string;

  // Username (onboarding)
  username: string;

  // Theme
  themeId: string;

  // Profile buttons
  buttons: Array<{
    id?: string;
    label: string;
    url: string;
    icon: string;
    order: number;
  }>;

  // Existing services (for editor mode)
  services: Array<{
    id: string;
    title: string;
    description: string;
    duration_minutes: number;
    price: number;
    is_online: boolean;
    is_visible: boolean;
  }>;

  // New talk (for onboarding)
  newTalk: {
    title: string;
    description: string;
    duration: number;
    price: number;
    location: "online" | "phone" | "in-person";
    meeting_platform?: "google_meet" | "zoom" | "teams";
  };

  // Availability (for new talk in onboarding)
  timeSlots: { [key: string]: boolean };
}

type SectionId = "profile" | "handle" | "style" | "links" | "talks";

interface Section {
  id: SectionId;
  title: string;
  icon: React.ElementType;
  description: string;
}

// =====================================================
// Constants
// =====================================================

const SECTIONS: Section[] = [
  {
    id: "profile",
    title: "Profile",
    icon: User,
    description: "Name, photo & bio",
  },
  {
    id: "handle",
    title: "Page Link",
    icon: AtSign,
    description: "Your page URL",
  },
  {
    id: "style",
    title: "Page Style",
    icon: Palette,
    description: "Theme & colors",
  },
  {
    id: "links",
    title: "Links",
    icon: LinkIcon,
    description: "Social buttons",
  },
  {
    id: "talks",
    title: "Talks",
    icon: MessageSquare,
    description: "Your services",
  },
];

// Onboarding steps (includes template selection and username)
type OnboardingStepId = "template" | "profile" | "username" | "style" | "links" | "talks" | "availability";

// Username validation states
type UsernameStatus = "idle" | "checking" | "available" | "taken" | "invalid";

interface OnboardingStep {
  id: OnboardingStepId;
  title: string;
  icon: React.ElementType;
  description: string;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "template",
    title: "Choose Template",
    icon: Sparkles,
    description: "Pick a starting point",
  },
  {
    id: "profile",
    title: "Your Profile",
    icon: User,
    description: "Name, photo & bio",
  },
  {
    id: "username",
    title: "Your Username",
    icon: Globe,
    description: "Choose your page URL",
  },
  {
    id: "style",
    title: "Page Style",
    icon: Palette,
    description: "Choose your theme",
  },
  {
    id: "links",
    title: "Links",
    icon: LinkIcon,
    description: "Add social buttons",
  },
  {
    id: "talks",
    title: "First Talk",
    icon: MessageSquare,
    description: "Create your service",
  },
  {
    id: "availability",
    title: "Availability",
    icon: Clock,
    description: "Set your schedule",
  },
];

// =====================================================
// Icon helpers
// =====================================================

const getButtonIconComponent = (iconName?: string) => {
  const iconMap: Record<string, React.ElementType> = {
    twitter: Twitter,
    instagram: Instagram,
    youtube: Youtube,
    github: Github,
    linkedin: Linkedin,
    globe: Globe,
    website: Globe,
    email: Mail,
    mail: Mail,
    link: ExternalLink,
  };
  return iconMap[iconName?.toLowerCase() || "link"] || ExternalLink;
};

const AVAILABLE_ICONS = [
  { value: "twitter", label: "Twitter", icon: Twitter },
  { value: "instagram", label: "Instagram", icon: Instagram },
  { value: "youtube", label: "YouTube", icon: Youtube },
  { value: "github", label: "GitHub", icon: Github },
  { value: "linkedin", label: "LinkedIn", icon: Linkedin },
  { value: "globe", label: "Website", icon: Globe },
  { value: "email", label: "Email", icon: Mail },
  { value: "link", label: "Other", icon: ExternalLink },
];

// =====================================================
// Main Component
// =====================================================

const PageEditor = ({ mode = "editor" }: PageEditorProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { userId, profile, refreshProfile } = useAuth();

  const isOnboarding = mode === "onboarding";

  // Onboarding step management
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const currentStep = isOnboarding ? ONBOARDING_STEPS[currentStepIndex] : null;

  // Editor section management
  const [expandedSections, setExpandedSections] = useState<Set<SectionId>>(
    new Set(["profile"])
  );

  // Loading states
  const [isLoading, setIsLoading] = useState(!isOnboarding);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [savingSection, setSavingSection] = useState<SectionId | null>(null);

  // Track changes for editor mode
  const [hasChanges, setHasChanges] = useState<Record<SectionId, boolean>>({
    profile: false,
    handle: false,
    style: false,
    links: false,
    talks: false,
  });

  // Editor state
  const [state, setState] = useState<EditorState>({
    templateId: null,
    displayName: "",
    avatar: "",
    bio: "",
    username: "",
    themeId: "default",
    buttons: [],
    services: [],
    newTalk: {
      title: "",
      description: "",
      duration: 30,
      price: 50,
      location: "online",
      meeting_platform: "google_meet",
    },
    timeSlots: {},
  });

  // Username validation state (for onboarding)
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const [usernameError, setUsernameError] = useState<string>("");

  // Original state for change detection
  const [originalState, setOriginalState] = useState<EditorState | null>(null);

  // Track if user has Google Meet integration
  const [hasGoogleMeet, setHasGoogleMeet] = useState(false);

  // =====================================================
  // Data Loading (Editor Mode)
  // =====================================================

  useEffect(() => {
    if (!isOnboarding && userId) {
      loadExistingData();
    }
  }, [isOnboarding, userId]);

  const loadExistingData = async () => {
    if (!userId) return;

    try {
      setIsLoading(true);

      // Load all data in parallel
      const [themeData, buttonsData, servicesData] = await Promise.all([
        ApiClient.getUserTheme(userId).catch(() => null),
        ApiClient.getUserButtons(userId).catch(() => ({ buttons: [] })),
        ApiClient.getUserServices(userId).catch(() => []),
      ]);

      const newState: EditorState = {
        templateId: null,
        displayName: profile?.display_name || "",
        avatar: profile?.avatar || "",
        bio: profile?.bio || "",
        username: profile?.username || "",
        themeId: themeData?.theme || "default",
        buttons: buttonsData.buttons.map((btn: any, idx: number) => ({
          id: btn.id,
          label: btn.label,
          url: btn.url,
          icon: btn.icon || "link",
          order: btn.order ?? idx,
        })),
        services: servicesData,
        newTalk: {
          title: "",
          description: "",
          duration: 30,
          price: 50,
          location: "online",
          meeting_platform: "google_meet",
        },
        timeSlots: {},
      };

      setState(newState);
      setOriginalState(JSON.parse(JSON.stringify(newState)));
    } catch (error) {
      console.error("Failed to load data:", error);
      toast.error("Failed to load your page data");
    } finally {
      setIsLoading(false);
    }
  };

  // Sync profile data when it becomes available (only for initial load)
  const [profileSynced, setProfileSynced] = useState(false);

  useEffect(() => {
    if (profile && !profileSynced) {
      // Don't sync display_name if it looks like a Privy DID
      const profileDisplayName = profile.display_name?.startsWith("did:") ? "" : (profile.display_name || "");
      setState((prev) => ({
        ...prev,
        // Only sync if current value is empty (first load)
        displayName: prev.displayName || profileDisplayName,
        avatar: prev.avatar || profile.avatar || "",
        bio: prev.bio || profile.bio || "",
      }));
      setProfileSynced(true);
    }
  }, [profile, profileSynced]);

  // Load integrations
  useEffect(() => {
    if (userId) {
      ApiClient.getMeetingIntegrations(userId).then((integrations) => {
        const googleMeet = integrations.find(
          (i: any) => i.platform === "google_meet" && i.is_active
        );
        setHasGoogleMeet(!!googleMeet);
      });
    }
  }, [userId]);

  // Track changes
  useEffect(() => {
    if (!originalState || isOnboarding) return;

    setHasChanges({
      profile:
        state.displayName !== originalState.displayName ||
        state.avatar !== originalState.avatar ||
        state.bio !== originalState.bio,
      handle: state.username !== originalState.username,
      style: state.themeId !== originalState.themeId,
      links:
        JSON.stringify(state.buttons) !== JSON.stringify(originalState.buttons),
      talks:
        JSON.stringify(state.services) !==
        JSON.stringify(originalState.services),
    });
  }, [state, originalState, isOnboarding]);

  // Computed values
  const progress = isOnboarding
    ? ((currentStepIndex + 1) / ONBOARDING_STEPS.length) * 100
    : 0;
  const currentTheme = useMemo(() => getTheme(state.themeId), [state.themeId]);

  // =====================================================
  // Section Toggle (Editor Mode)
  // =====================================================

  const toggleSection = (sectionId: SectionId) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  // =====================================================
  // Save Handlers (Editor Mode)
  // =====================================================

  const handleSaveSection = async (sectionId: SectionId) => {
    if (!userId) return;

    setSavingSection(sectionId);

    try {
      switch (sectionId) {
        case "profile":
          await ApiClient.updateUserProfile(userId, {
            display_name: state.displayName,
            avatar: state.avatar,
            bio: state.bio,
          });
          await refreshProfile();
          break;

        case "handle":
          if (state.username && state.username !== originalState?.username) {
            await ApiClient.updateUsername(state.username);
            await refreshProfile();
          }
          break;

        case "style":
          await ApiClient.updateUserTheme({ theme: state.themeId });
          break;

        case "links":
          const buttonsToSave = state.buttons
            .filter((btn) => btn.label && btn.url)
            .map((btn, index) => ({
              id: btn.id || crypto.randomUUID(),
              label: btn.label,
              url: btn.url,
              icon: btn.icon,
              order: index,
            }));
          await ApiClient.updateUserButtons(buttonsToSave);
          break;

        case "talks":
          // Talks are saved individually, not in batch
          break;
      }

      // Update original state to reflect saved changes
      setOriginalState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          ...(sectionId === "profile" && {
            displayName: state.displayName,
            avatar: state.avatar,
            bio: state.bio,
          }),
          ...(sectionId === "handle" && { username: state.username }),
          ...(sectionId === "style" && { themeId: state.themeId }),
          ...(sectionId === "links" && { buttons: [...state.buttons] }),
        };
      });

      toast.success("Changes saved!");
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save changes");
    } finally {
      setSavingSection(null);
    }
  };

  // =====================================================
  // Common Handlers
  // =====================================================

  const handleTemplateSelect = (templateId: string) => {
    const template = getTemplate(templateId);
    if (!template) return;

    const username = profile?.username || "username";

    setState((prev) => ({
      ...prev,
      templateId,
      bio: template.bio,
      themeId: template.themeId,
      buttons: processTemplateButtons(template.buttons, { username }).map(
        (btn, idx) => ({
          ...btn,
          order: idx,
        })
      ),
      newTalk: { ...template.talk },
    }));
  };

  const handleAvatarUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file || !userId) return;

    try {
      setAvatarUploading(true);
      const uploadResult = await ApiClient.uploadFile(file, "avatar", userId);
      setState((prev) => ({ ...prev, avatar: uploadResult.url }));
      toast.success("Avatar uploaded successfully");
    } catch (error) {
      console.error("Avatar upload error:", error);
      toast.error("Failed to upload avatar");
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleAddButton = () => {
    if (state.buttons.length >= 6) {
      toast.error("Maximum 6 buttons allowed");
      return;
    }
    setState((prev) => ({
      ...prev,
      buttons: [
        ...prev.buttons,
        { label: "", url: "", icon: "link", order: prev.buttons.length },
      ],
    }));
  };

  const handleUpdateButton = (
    index: number,
    field: "label" | "url" | "icon",
    value: string
  ) => {
    setState((prev) => ({
      ...prev,
      buttons: prev.buttons.map((btn, i) =>
        i === index ? { ...btn, [field]: value } : btn
      ),
    }));
  };

  const handleRemoveButton = (index: number) => {
    setState((prev) => ({
      ...prev,
      buttons: prev.buttons.filter((_, i) => i !== index),
    }));
  };

  // =====================================================
  // Onboarding Navigation
  // =====================================================

  const handleNext = () => {
    console.log('[PageEditor] handleNext called, currentStepIndex:', currentStepIndex, 'canProceed:', canProceed());
    if (currentStepIndex < ONBOARDING_STEPS.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const canProceed = (): boolean => {
    if (!currentStep) return false;

    let result = false;
    switch (currentStep.id) {
      case "template":
        result = state.templateId !== null;
        break;
      case "profile":
        result = state.displayName.trim().length > 0;
        break;
      case "username":
        // Must have a valid, available username
        result = state.username.length >= 3 && usernameStatus === "available";
        break;
      case "style":
        result = true;
        break;
      case "links":
        // Allow proceeding if no buttons, or all buttons are complete
        result = state.buttons.length === 0 || state.buttons.every((btn) => btn.label.trim() && btn.url.trim());
        break;
      case "talks":
        result = (
          state.newTalk.title.trim().length >= 5 &&
          state.newTalk.description.trim().length >= 20
        );
        break;
      case "availability":
        result = Object.keys(state.timeSlots).length > 0;
        break;
      default:
        result = false;
    }

    console.log(`[PageEditor] canProceed for step "${currentStep.id}":`, result, {
      displayName: state.displayName,
      templateId: state.templateId,
      buttonsCount: state.buttons.length,
      username: state.username,
      usernameStatus: usernameStatus
    });

    return result;
  };

  const handleFinishOnboarding = async () => {
    if (!userId) {
      toast.error("User not authenticated");
      return;
    }

    try {
      setIsSubmitting(true);

      // 1. Update user profile
      await ApiClient.updateUserProfile(userId, {
        display_name: state.displayName,
        avatar: state.avatar,
        bio: state.bio,
        is_provider: true,
      });

      // 2. Save username
      if (state.username) {
        await ApiClient.updateUsername(state.username);
      }

      // 3. Update theme
      await ApiClient.updateUserTheme({ theme: state.themeId });

      // 4. Update profile buttons
      const buttonsToCreate = state.buttons
        .filter((btn) => btn.label && btn.url)
        .map((btn, index) => ({
          id: crypto.randomUUID(),
          label: btn.label,
          url: btn.url,
          icon: btn.icon,
          order: index,
        }));

      if (buttonsToCreate.length > 0) {
        await ApiClient.updateUserButtons(buttonsToCreate);
      }

      // 5. Create the Talk (service)
      await ApiClient.createService(userId, {
        title: state.newTalk.title,
        description: state.newTalk.description,
        duration_minutes: state.newTalk.duration,
        price: state.newTalk.price,
        is_online: state.newTalk.location === "online",
        location:
          state.newTalk.location === "in-person" ? "In Person" : undefined,
        meeting_platform:
          state.newTalk.location === "online"
            ? state.newTalk.meeting_platform
            : undefined,
        is_visible: true,
        timeSlots: state.timeSlots,
      });

      // 6. Mark onboarding as completed
      await ApiClient.completeOnboarding();

      await refreshProfile();
      toast.success(`Welcome to ${APP_NAME}! Your page is ready.`);

      // Navigate to the user's public profile using the newly set username
      navigate(`/${state.username}`);
    } catch (error) {
      console.error("Onboarding error:", error);
      toast.error("Failed to complete setup. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // =====================================================
  // Section Renderers
  // =====================================================

  const renderProfileSection = (showHeader: boolean = true) => (
    <div className="space-y-6">
      {showHeader && (
        <div>
          <H2 className="mb-2">
            {isOnboarding ? "Set up your profile" : "Profile"}
          </H2>
          <p className="text-muted-foreground">
            This is how visitors will see you on your page.
          </p>
        </div>
      )}

      <div className="space-y-6">
        {/* Avatar */}
        <div>
          <Label className="text-base font-medium">Profile Photo</Label>
          <div className="mt-3 flex items-center gap-4">
            <Avatar className="w-20 h-20">
              <AvatarImage src={state.avatar} alt="Profile" />
              <AvatarFallback className="text-xl">
                {state.displayName.charAt(0) || "?"}
              </AvatarFallback>
            </Avatar>
            <div>
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
                id="avatar-upload"
                disabled={avatarUploading}
              />
              <Button variant="outline" asChild disabled={avatarUploading}>
                <label htmlFor="avatar-upload" className="cursor-pointer">
                  {avatarUploading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  {avatarUploading ? "Uploading..." : "Upload Photo"}
                </label>
              </Button>
            </div>
          </div>
        </div>

        {/* Display Name */}
        <div>
          <Label htmlFor="displayName" className="text-base font-medium">
            Display Name *
          </Label>
          <Input
            id="displayName"
            value={state.displayName}
            onChange={(e) =>
              setState((prev) => ({ ...prev, displayName: e.target.value }))
            }
            placeholder="Your name"
            className="mt-2"
          />
        </div>

        {/* Bio */}
        <div>
          <Label htmlFor="bio" className="text-base font-medium">
            Bio
          </Label>
          <Textarea
            id="bio"
            value={state.bio}
            onChange={(e) =>
              setState((prev) => ({ ...prev, bio: e.target.value }))
            }
            placeholder="Tell visitors about yourself..."
            rows={6}
            className="mt-2 resize-none"
            maxLength={1000}
          />
          <p className="text-sm text-muted-foreground mt-1">
            {state.bio.length}/1000 characters
          </p>
        </div>
      </div>
    </div>
  );

  // Handle/Page Link section for editor mode
  const renderHandleSection = (showHeader: boolean = true) => {
    const baseUrl = window.location.origin;

    return (
      <div className="space-y-6">
        {showHeader && (
          <div>
            <H2 className="mb-2">Page Link</H2>
            <p className="text-muted-foreground">
              Customize your page URL to make it easy to share.
            </p>
          </div>
        )}

        <div className="space-y-4">
          {/* URL Preview */}
          <div className="p-4 rounded-xl bg-muted/50 border">
            <Label className="text-sm text-muted-foreground mb-2 block">
              Your page is available at:
            </Label>
            <div className="flex items-center gap-1 text-lg font-medium">
              <span className="text-muted-foreground">{baseUrl}/</span>
              <span className="text-foreground">
                {state.username || "your-handle"}
              </span>
            </div>
          </div>

          {/* Handle Input */}
          <div>
            <Label htmlFor="handle" className="text-base font-medium">
              Handle
            </Label>
            <div className="relative mt-2">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <AtSign className="h-4 w-4" />
              </div>
              <Input
                id="handle"
                value={state.username}
                onChange={(e) => {
                  const value = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "");
                  setState((prev) => ({ ...prev, username: value }));
                }}
                placeholder="your-handle"
                className={`pl-9 pr-10 ${
                  usernameStatus === "available"
                    ? "border-green-500 focus-visible:ring-green-500"
                    : usernameStatus === "taken" || usernameStatus === "invalid"
                    ? "border-red-500 focus-visible:ring-red-500"
                    : ""
                }`}
                maxLength={30}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {usernameStatus === "checking" && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
                {usernameStatus === "available" && (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                )}
                {(usernameStatus === "taken" || usernameStatus === "invalid") && (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                )}
              </div>
            </div>

            {/* Status Message */}
            {usernameError && (
              <p className="text-sm text-red-500 mt-1.5">{usernameError}</p>
            )}
            {usernameStatus === "available" && (
              <p className="text-sm text-green-600 mt-1.5">
                This handle is available!
              </p>
            )}

            {/* Handle Rules */}
            <p className="text-sm text-muted-foreground mt-2">
              3-30 characters. Letters, numbers, underscores, and dashes only.
            </p>
          </div>

          {/* Suggest Button */}
          {!state.username && state.displayName && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSuggestUsername}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Suggest from my name
            </Button>
          )}
        </div>
      </div>
    );
  };

  const renderStyleSection = (showHeader: boolean = true) => {
    const themes = getAllThemes();

    return (
      <div className="space-y-6">
        {showHeader && (
          <div>
            <H2 className="mb-2">
              {isOnboarding ? "Choose your page style" : "Page Style"}
            </H2>
            <p className="text-muted-foreground">
              Select a theme that matches your brand.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {themes.map((theme) => (
            <div
              key={theme.id}
              className={`theme-card ${
                state.themeId === theme.id ? "theme-card--selected" : ""
              }`}
              onClick={() =>
                setState((prev) => ({ ...prev, themeId: theme.id }))
              }
            >
              {/* Mini Preview */}
              <div
                className="theme-card__preview"
                style={{
                  backgroundColor: theme.colors.background,
                  borderBottom: `1px solid ${theme.colors.border || 'rgba(0,0,0,0.1)'}`
                }}
              >
                {/* Mini avatar */}
                <div
                  className="theme-card__preview-avatar"
                  style={{ backgroundColor: theme.colors.accent }}
                />
                {/* Mini text lines */}
                <div className="theme-card__preview-lines">
                  <div
                    className="theme-card__preview-line theme-card__preview-line--title"
                    style={{ backgroundColor: theme.colors.textPrimary }}
                  />
                  <div
                    className="theme-card__preview-line theme-card__preview-line--subtitle"
                    style={{ backgroundColor: theme.colors.textSecondary || 'rgba(0,0,0,0.3)' }}
                  />
                </div>
                {/* Mini buttons */}
                <div className="theme-card__preview-buttons">
                  <div
                    className="theme-card__preview-btn"
                    style={{ backgroundColor: theme.colors.buttonBackground || theme.colors.accent }}
                  />
                  <div
                    className="theme-card__preview-btn"
                    style={{ backgroundColor: theme.colors.buttonBackground || theme.colors.accent }}
                  />
                </div>
              </div>

              {/* 2025 Badge - positioned absolutely */}
              {theme.version === "2025" && (
                <span className="theme-card__badge">2025</span>
              )}

              {/* Theme Info */}
              <div className="theme-card__header">
                <h3 className="theme-card__name">{theme.name}</h3>
                {state.themeId === theme.id && (
                  <div className="theme-card__check">
                    <Check className="w-3 h-3" />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderLinksSection = (showHeader: boolean = true) => (
    <div className="space-y-6">
      {showHeader && (
        <div>
          <H2 className="mb-2">{isOnboarding ? "Add your links" : "Links"}</H2>
          <p className="text-muted-foreground">
            Add buttons to your profile page that link to your social media, website, or other platforms.
            {isOnboarding && " You can skip this step and add links later."}
          </p>
        </div>
      )}

      <div>
        {state.buttons.map((button, index) => {
          const IconComponent = getButtonIconComponent(button.icon);
          const iconClass = `link-card__icon link-card__icon--${button.icon}`;
          return (
            <div
              key={index}
              className="link-card"
            >
              <div className="link-card__header">
                <div className="link-card__title">
                  <div className={iconClass}>
                    <IconComponent className="w-5 h-5" />
                  </div>
                  <span className="link-card__number">Link {index + 1}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveButton(index)}
                  className="link-card__delete"
                  aria-label="Delete link"
                >
                  <Trash2 />
                </button>
              </div>

              <div className="link-card__fields">
                <div className="link-card__field">
                  <Label className="link-card__label">Platform</Label>
                  <select
                    value={button.icon}
                    onChange={(e) => handleUpdateButton(index, "icon", e.target.value)}
                  >
                    {AVAILABLE_ICONS.map((icon) => (
                      <option key={icon.value} value={icon.value}>
                        {icon.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="link-card__field">
                  <Label className="link-card__label">Button Text</Label>
                  <Input
                    value={button.label}
                    onChange={(e) =>
                      handleUpdateButton(index, "label", e.target.value)
                    }
                    placeholder="e.g., Follow me on Twitter"
                  />
                </div>

                <div className="link-card__field">
                  <Label className="link-card__label">URL</Label>
                  <Input
                    value={button.url}
                    onChange={(e) =>
                      handleUpdateButton(index, "url", e.target.value)
                    }
                    placeholder="https://twitter.com/yourname"
                  />
                </div>
              </div>
            </div>
          );
        })}

        {state.buttons.length < 6 && (
          <button
            type="button"
            onClick={handleAddButton}
            className="add-link-btn"
          >
            <Plus />
            Add Link
          </button>
        )}

        {state.buttons.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No links added yet. Click "Add Link" to get started.
          </p>
        )}
      </div>
    </div>
  );

  const renderTalksSection = (showHeader: boolean = true) => {
    // In editor mode, show existing services
    if (!isOnboarding) {
      return (
        <div className="space-y-6">
          {showHeader && (
            <div>
              <H2 className="mb-2">Talks</H2>
              <p className="text-muted-foreground">
                Manage your bookable services.
              </p>
            </div>
          )}

          {state.services.length > 0 ? (
            <div className="space-y-4">
              {state.services.map((service) => (
                <div
                  key={service.id}
                  className="p-4 border rounded-lg flex items-center justify-between"
                >
                  <div>
                    <h4 className="font-medium">{service.title}</h4>
                    <p className="text-sm text-muted-foreground">
                      ${service.price} · {service.duration_minutes} min
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate("/host/talks")}
                  >
                    <Edit3 className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                You haven't created any Talks yet.
              </p>
              <Button onClick={() => navigate("/host/talks")}>
                <Plus className="h-4 w-4 mr-2" />
                Create Talk
              </Button>
            </div>
          )}

          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate("/host/talks")}
          >
            Manage All Talks
          </Button>
        </div>
      );
    }

    // In onboarding mode, show new talk form
    return (
      <div className="space-y-6">
        {showHeader && (
          <div>
            <H2 className="mb-2">Create your first Talk</H2>
            <p className="text-muted-foreground">
              A Talk is a bookable service. Visitors can pay to book time with
              you.
            </p>
          </div>
        )}

        <div className="space-y-6">
          <div>
            <Label htmlFor="talkTitle" className="text-base font-medium">
              Talk Title *
            </Label>
            <Input
              id="talkTitle"
              value={state.newTalk.title}
              onChange={(e) =>
                setState((prev) => ({
                  ...prev,
                  newTalk: { ...prev.newTalk, title: e.target.value },
                }))
              }
              placeholder="e.g., 1-on-1 Video Chat"
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor="talkDescription" className="text-base font-medium">
              Description *
            </Label>
            <Textarea
              id="talkDescription"
              value={state.newTalk.description}
              onChange={(e) =>
                setState((prev) => ({
                  ...prev,
                  newTalk: { ...prev.newTalk, description: e.target.value },
                }))
              }
              placeholder="Describe what this session includes..."
              rows={5}
              className="mt-2 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-base font-medium">Duration</Label>
              <select
                value={state.newTalk.duration}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    newTalk: {
                      ...prev.newTalk,
                      duration: parseInt(e.target.value),
                    },
                  }))
                }
                className="w-full h-10 px-3 mt-2 border rounded-md bg-background"
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>1 hour</option>
                <option value={90}>1.5 hours</option>
                <option value={120}>2 hours</option>
              </select>
            </div>

            <div>
              <Label htmlFor="talkPrice" className="text-base font-medium">
                Price (USD)
              </Label>
              <Input
                id="talkPrice"
                type="number"
                value={state.newTalk.price}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    newTalk: {
                      ...prev.newTalk,
                      price: parseFloat(e.target.value) || 0,
                    },
                  }))
                }
                min={0}
                max={10000}
                className="mt-2"
              />
            </div>
          </div>

          <div className="meeting-notice">
            <div className="meeting-notice__icon">
              <Video />
            </div>
            <div className="meeting-notice__text">
              <span className="meeting-notice__title">
                Sessions will be held via Google Meet
              </span>
              {!hasGoogleMeet && (
                <span className="meeting-notice__subtitle">
                  You'll need to connect Google Meet in Settings
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderAvailabilitySection = () => (
    <div className="space-y-6">
      <div>
        <H2 className="mb-2">Set your availability</H2>
        <p className="text-muted-foreground">
          Choose the days and times when visitors can book sessions with you.
          Click and drag to select multiple slots.
        </p>
      </div>

      <div className="availability-container">
        <div className="availability-header">
          <span className="availability-header__title">
            <Clock className="h-4 w-4" />
            Weekly Schedule
          </span>
          <div className="availability-stats">
            <span className="availability-stats__item">
              <span className="availability-stats__count">
                {Object.keys(state.timeSlots).length}
              </span>
              slots selected
            </span>
          </div>
        </div>
        <div className="availability-body">
          <TimeSlotSelector
            value={state.timeSlots}
            onChange={(slots) =>
              setState((prev) => ({ ...prev, timeSlots: slots }))
            }
          />
        </div>
      </div>
    </div>
  );

  // Username validation with debounce
  const checkUsernameAvailability = useCallback(
    async (username: string) => {
      // First validate format locally
      const formatValidation = validateUsername(username);
      if (!formatValidation.isValid) {
        setUsernameStatus("invalid");
        setUsernameError(formatValidation.error || "Invalid username format");
        return;
      }

      // Then check availability on server
      setUsernameStatus("checking");
      setUsernameError("");

      try {
        const result = await ApiClient.checkUsernameAvailability(username);
        if (result.available) {
          setUsernameStatus("available");
          setUsernameError("");
        } else {
          setUsernameStatus("taken");
          setUsernameError("This username is already taken");
        }
      } catch (error) {
        console.error("Username check failed:", error);
        setUsernameStatus("invalid");
        setUsernameError("Failed to check username availability");
      }
    },
    []
  );

  // Debounced username check
  useEffect(() => {
    if (!state.username || state.username.length < 3) {
      setUsernameStatus("idle");
      setUsernameError("");
      return;
    }

    const timeoutId = setTimeout(() => {
      checkUsernameAvailability(state.username);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [state.username, checkUsernameAvailability]);

  // Auto-suggest username from display name
  const handleSuggestUsername = () => {
    if (!state.displayName) return;
    const suggested = generateUsernameFromName(state.displayName, userId);
    setState((prev) => ({ ...prev, username: suggested }));
  };

  const renderUsernameSection = () => {
    const baseUrl = window.location.origin;

    return (
      <div className="space-y-6">
        <div>
          <H2 className="mb-2">Choose your username</H2>
          <p className="text-muted-foreground">
            Your username creates your unique page URL. Choose something memorable and easy to share.
          </p>
        </div>

        <div className="space-y-4">
          {/* URL Preview */}
          <div className="p-4 rounded-xl bg-muted/50 border">
            <Label className="text-sm text-muted-foreground mb-2 block">
              Your page will be available at:
            </Label>
            <div className="flex items-center gap-1 text-lg font-medium">
              <span className="text-muted-foreground">{baseUrl}/</span>
              <span className="text-foreground">
                {state.username || "your-username"}
              </span>
            </div>
          </div>

          {/* Username Input */}
          <div>
            <Label htmlFor="username" className="text-base font-medium">
              Username *
            </Label>
            <div className="relative mt-2">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <AtSign className="h-4 w-4" />
              </div>
              <Input
                id="username"
                value={state.username}
                onChange={(e) => {
                  const value = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "");
                  setState((prev) => ({ ...prev, username: value }));
                }}
                placeholder="your-username"
                className={`pl-9 pr-10 ${
                  usernameStatus === "available"
                    ? "border-green-500 focus-visible:ring-green-500"
                    : usernameStatus === "taken" || usernameStatus === "invalid"
                    ? "border-red-500 focus-visible:ring-red-500"
                    : ""
                }`}
                maxLength={30}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {usernameStatus === "checking" && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
                {usernameStatus === "available" && (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                )}
                {(usernameStatus === "taken" || usernameStatus === "invalid") && (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                )}
              </div>
            </div>

            {/* Status Message */}
            {usernameError && (
              <p className="text-sm text-red-500 mt-1.5">{usernameError}</p>
            )}
            {usernameStatus === "available" && (
              <p className="text-sm text-green-600 mt-1.5">
                Username is available!
              </p>
            )}

            {/* Username Rules */}
            <p className="text-sm text-muted-foreground mt-2">
              3-30 characters. Letters, numbers, underscores, and dashes only.
            </p>
          </div>

          {/* Suggest Button */}
          {!state.username && state.displayName && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSuggestUsername}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Suggest from my name
            </Button>
          )}
        </div>
      </div>
    );
  };

  const renderTemplateSection = () => (
    <div className="space-y-8">
      <div className="page-editor-section-header">
        <h2 className="page-editor-section-title">Choose a template to get started</h2>
        <p className="page-editor-section-description">
          Pick a starting point that matches your style. You can customize
          everything later.
        </p>
      </div>

      <div className="template-grid">
        {ONBOARDING_TEMPLATES.map((template, index) => (
          <div
            key={template.id}
            className={`template-card fade-in stagger-${index + 1} ${
              state.templateId === template.id ? "template-card--selected" : ""
            }`}
            onClick={() => handleTemplateSelect(template.id)}
          >
            <div
              className="template-card__preview"
              style={{ background: template.previewGradient }}
            >
              {template.emoji}
            </div>

            <div className="template-card__content">
              <div className="template-card__header">
                <h3 className="template-card__title">{template.name}</h3>
                {state.templateId === template.id && (
                  <div className="template-card__check">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
              <p className="template-card__description">
                {template.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // =====================================================
  // Preview Panel
  // =====================================================

  const renderPreview = () => {
    const themeVars = themeToCSSVars(currentTheme);
    const themeVersion = getThemeVersionAttribute(currentTheme);

    // Check if displayName looks like a Privy DID (e.g., "did:privy:...")
    const isPrivyDid = state.displayName.startsWith("did:");
    const previewDisplayName = isPrivyDid ? "" : state.displayName;

    return (
      <div
        className="pp-container h-full overflow-auto"
        style={themeVars}
        data-theme-version={themeVersion}
      >
        <div className="pp-content">
          <div className="pp-header">
            <div className="pp-avatar">
              {state.avatar ? (
                <img
                  src={state.avatar}
                  alt={previewDisplayName || "Your Name"}
                />
              ) : (
                <div className="pp-avatar-fallback">
                  {previewDisplayName.charAt(0) || "?"}
                </div>
              )}
            </div>
            <div className="pp-header-info">
              <h1 className="pp-name">
                {previewDisplayName || "Your Name"}
              </h1>
            </div>
          </div>

          {state.bio && (
            <div className="pp-bio">
              <p>{state.bio}</p>
            </div>
          )}

          {state.buttons.length > 0 && (
            <div className="pp-link-buttons">
              {state.buttons
                .filter((btn) => btn.label && btn.url)
                .map((button, index) => {
                  const IconComponent = getButtonIconComponent(button.icon);
                  return (
                    <a
                      key={index}
                      href={button.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="pp-link-button"
                      onClick={(e) => e.preventDefault()}
                    >
                      <IconComponent className="pp-link-button-icon" />
                      <span>{button.label}</span>
                    </a>
                  );
                })}
            </div>
          )}

          {/* Show services in editor mode, new talk in onboarding */}
          {(state.services.length > 0 || state.newTalk.title) && (
            <>
              <h2 className="pp-section-title">Talks</h2>

              <div className="pp-services">
                {isOnboarding && state.newTalk.title && (
                  <div className="pp-service-card">
                    <div className="pp-service-header">
                      <h3 className="pp-service-title">{state.newTalk.title}</h3>
                      <span className="pp-service-price">
                        ${state.newTalk.price}
                      </span>
                    </div>
                    <p className="pp-service-description">
                      {state.newTalk.description.slice(0, 150)}
                      {state.newTalk.description.length > 150 && "..."}
                    </p>
                    <div className="pp-service-meta">
                      <span className="pp-service-duration">
                        <Clock className="w-4 h-4" />
                        {state.newTalk.duration} min
                      </span>
                      <span className="pp-service-location-badge">
                        <Video className="w-4 h-4" />
                        Online
                      </span>
                    </div>
                  </div>
                )}

                {!isOnboarding &&
                  state.services.slice(0, 3).map((service) => (
                    <div key={service.id} className="pp-service-card">
                      <div className="pp-service-header">
                        <h3 className="pp-service-title">{service.title}</h3>
                        <span className="pp-service-price">
                          ${service.price}
                        </span>
                      </div>
                      <div className="pp-service-meta">
                        <span className="pp-service-duration">
                          <Clock className="w-4 h-4" />
                          {service.duration_minutes} min
                        </span>
                        <span className="pp-service-location-badge">
                          <Video className="w-4 h-4" />
                          Online
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  // =====================================================
  // Onboarding Mode Render
  // =====================================================

  const renderOnboardingMode = () => {
    const renderCurrentStep = () => {
      if (!currentStep) return null;

      switch (currentStep.id) {
        case "template":
          return renderTemplateSection();
        case "profile":
          return renderProfileSection();
        case "username":
          return renderUsernameSection();
        case "style":
          return renderStyleSection();
        case "links":
          return renderLinksSection();
        case "talks":
          return renderTalksSection();
        case "availability":
          return renderAvailabilitySection();
        default:
          return null;
      }
    };

    return (
      <div className="page-editor min-h-screen flex no-tab-bar-page">
        {/* Left Panel - Steps */}
        <div className="flex-1 flex flex-col max-w-2xl border-r border-black/5">
          {/* Header */}
          <div className="page-editor-header">
            <div className="page-editor-header-top">
              <span className="page-editor-title">
                Setting up your page
              </span>
              <span className="page-editor-step">
                Step {currentStepIndex + 1} of {ONBOARDING_STEPS.length}
              </span>
            </div>

            {/* Enhanced Progress Bar */}
            <div className="page-editor-progress">
              <div
                className="page-editor-progress-bar"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Step indicators */}
            <div className="page-editor-steps">
              {ONBOARDING_STEPS.map((step, index) => {
                const StepIcon = step.icon;
                const isCompleted = index < currentStepIndex;
                const isCurrent = index === currentStepIndex;
                const isDisabled = index > currentStepIndex;

                return (
                  <button
                    key={step.id}
                    onClick={() =>
                      index <= currentStepIndex && setCurrentStepIndex(index)
                    }
                    className={`page-editor-step-tab ${
                      isCurrent
                        ? "page-editor-step-tab--active"
                        : isCompleted
                        ? "page-editor-step-tab--completed"
                        : "page-editor-step-tab--disabled"
                    }`}
                    disabled={isDisabled}
                  >
                    {isCompleted ? (
                      <div className="page-editor-step-tab__check">
                        <Check className="w-3 h-3" />
                      </div>
                    ) : (
                      <StepIcon className="page-editor-step-tab__icon" />
                    )}
                    <span className="hidden sm:inline">{step.title}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content */}
          <div className="page-editor-content">{renderCurrentStep()}</div>

          {/* Navigation */}
          <div className="page-editor-footer">
            <button
              className="page-editor-footer__back"
              onClick={handleBack}
              disabled={currentStepIndex === 0}
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>

            <div className="flex items-center gap-3">
              {!canProceed() && currentStep?.id === "profile" && (
                <span className="text-sm text-muted-foreground">
                  Enter your display name to continue
                </span>
              )}
              {!canProceed() && currentStep?.id === "username" && (
                <span className="text-sm text-muted-foreground">
                  {usernameStatus === "checking"
                    ? "Checking availability..."
                    : usernameStatus === "taken"
                    ? "Username is taken, try another"
                    : usernameStatus === "invalid"
                    ? "Enter a valid username"
                    : "Choose a username to continue"}
                </span>
              )}
              {currentStepIndex < ONBOARDING_STEPS.length - 1 ? (
                <button
                  className="page-editor-footer__next"
                  onClick={handleNext}
                  disabled={!canProceed()}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  className="page-editor-footer__next page-editor-footer__next--primary"
                  onClick={handleFinishOnboarding}
                  disabled={!canProceed() || isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Setting up...
                    </>
                  ) : (
                    <>
                      Finish Setup
                      <Check className="w-4 h-4" />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel - Live Preview */}
        <div className="live-preview-panel hidden lg:flex flex-1 flex-col">
          <div className="live-preview-header">
            <h3 className="live-preview-title">
              Live Preview
            </h3>
          </div>
          <div className="live-preview-body">
            <div className="live-preview-frame">
              {renderPreview()}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // =====================================================
  // Editor Mode Render
  // =====================================================

  const renderEditorMode = () => {
    if (isLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      );
    }

    return (
      <div className="min-h-screen flex">
        {/* Left Panel - Accordion Sections */}
        <div className="flex-1 flex flex-col max-w-2xl border-r">
          {/* Header */}
          <div className="p-6 border-b bg-gradient-to-b from-white to-gray-50/50">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-xl font-semibold">Page Editor</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Customize your public profile page
                </p>
              </div>
              {profile?.username && (
                <Button
                  variant="outline"
                  onClick={() => navigate(`/${profile.username}`)}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View Page
                </Button>
              )}
            </div>
            {/* Page URL Preview */}
            {profile?.username && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-white border border-gray-200 shadow-sm">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                  <Globe className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground font-medium">Your page is live at</p>
                  <p className="text-sm font-medium text-foreground truncate">
                    {window.location.host}/{profile.username}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-shrink-0"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/${profile.username}`);
                    toast.success("Link copied!");
                  }}
                >
                  <LinkIcon className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Sections */}
          <div className="flex-1 overflow-auto p-5 space-y-4">
            {SECTIONS.map((section) => {
              const isExpanded = expandedSections.has(section.id);
              const SectionIcon = section.icon;
              const sectionHasChanges = hasChanges[section.id];
              const isSaving = savingSection === section.id;

              // Generate section summary
              const getSectionSummary = () => {
                switch (section.id) {
                  case "profile":
                    return state.displayName || "Not set";
                  case "handle":
                    return state.username ? `@${state.username}` : "Not set";
                  case "style":
                    const theme = getTheme(state.themeId);
                    return theme?.name || "Classic";
                  case "links":
                    const linkCount = state.buttons.filter(b => b.label && b.url).length;
                    return linkCount > 0 ? `${linkCount} link${linkCount > 1 ? 's' : ''}` : "No links";
                  case "talks":
                    const serviceCount = state.services.length;
                    return serviceCount > 0 ? `${serviceCount} talk${serviceCount > 1 ? 's' : ''}` : "No talks";
                  default:
                    return "";
                }
              };

              return (
                <Collapsible
                  key={section.id}
                  open={isExpanded}
                  onOpenChange={() => toggleSection(section.id)}
                >
                  <div className={`rounded-2xl border bg-white overflow-hidden transition-all duration-200 ${isExpanded ? 'shadow-md border-gray-200' : 'border-gray-100 hover:border-gray-200 hover:shadow-sm'}`}>
                    <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${isExpanded ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-100 text-gray-500'}`}>
                          <SectionIcon className="w-5 h-5" />
                        </div>
                        <div className="text-left">
                          <h3 className="font-medium text-gray-900">{section.title}</h3>
                          {!isExpanded && (
                            <p className="text-sm text-gray-500 truncate max-w-[200px]">
                              {getSectionSummary()}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {sectionHasChanges && (
                          <span className="text-xs text-amber-600 font-medium px-2 py-0.5 bg-amber-50 rounded-full">
                            Unsaved
                          </span>
                        )}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isExpanded ? 'bg-gray-100' : 'bg-transparent'}`}>
                          <ChevronDown
                            className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
                              isExpanded ? "rotate-180" : ""
                            }`}
                          />
                        </div>
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="px-5 pb-5 pt-0 border-t border-gray-100 bg-gradient-to-b from-gray-50/50 to-white">
                        <div className="pt-4">
                          {section.id === "profile" &&
                            renderProfileSection(false)}
                          {section.id === "handle" && renderHandleSection(false)}
                          {section.id === "style" && renderStyleSection(false)}
                          {section.id === "links" && renderLinksSection(false)}
                          {section.id === "talks" && renderTalksSection(false)}

                          {/* Save button for non-talks sections */}
                          {section.id !== "talks" && (
                            <div className="mt-6 flex justify-end">
                              <Button
                                onClick={() => handleSaveSection(section.id)}
                                disabled={!sectionHasChanges || isSaving}
                              >
                                {isSaving ? (
                                  <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Saving...
                                  </>
                                ) : (
                                  <>
                                    <Save className="w-4 h-4 mr-2" />
                                    Save Changes
                                  </>
                                )}
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </div>
        </div>

        {/* Right Panel - Live Preview */}
        <div className="hidden lg:flex flex-1 flex-col bg-muted/30">
          <div className="p-4 border-b bg-background flex items-center justify-between">
            <h3 className="font-medium text-sm text-muted-foreground">
              Live Preview
            </h3>
            {profile?.username && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(`/${profile.username}`, "_blank")}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open in new tab
              </Button>
            )}
          </div>
          <div className="flex-1 p-4 overflow-hidden">
            <div className="h-full rounded-lg border shadow-sm overflow-hidden bg-background">
              {renderPreview()}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // =====================================================
  // Main Render
  // =====================================================

  return isOnboarding ? renderOnboardingMode() : renderEditorMode();
};

export default PageEditor;

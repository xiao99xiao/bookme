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

type SectionId = "profile" | "style" | "links" | "talks";

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

// Onboarding steps (includes template selection)
type OnboardingStepId = "template" | SectionId | "availability";

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
        ApiClient.getMyServices().catch(() => []),
      ]);

      const newState: EditorState = {
        templateId: null,
        displayName: profile?.display_name || "",
        avatar: profile?.avatar || "",
        bio: profile?.bio || "",
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

  // Sync profile data when it becomes available
  useEffect(() => {
    if (profile) {
      setState((prev) => ({
        ...prev,
        displayName: prev.displayName || profile.display_name || "",
        avatar: prev.avatar || profile.avatar || "",
        bio: prev.bio || profile.bio || "",
      }));
    }
  }, [profile]);

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

    switch (currentStep.id) {
      case "template":
        return state.templateId !== null;
      case "profile":
        return state.displayName.trim().length > 0;
      case "style":
        return true;
      case "links":
        return state.buttons.every((btn) => btn.label.trim() && btn.url.trim());
      case "talks":
        return (
          state.newTalk.title.trim().length >= 5 &&
          state.newTalk.description.trim().length >= 20
        );
      case "availability":
        return Object.keys(state.timeSlots).length > 0;
      default:
        return false;
    }
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

      // 2. Update theme
      await ApiClient.updateUserTheme({ theme: state.themeId });

      // 3. Update profile buttons
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

      // 4. Create the Talk (service)
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

      // 5. Mark onboarding as completed
      await ApiClient.completeOnboarding();

      await refreshProfile();
      toast.success(`Welcome to ${APP_NAME}! Your page is ready.`);

      // Navigate to the user's public profile
      if (profile?.username) {
        navigate(`/${profile.username}`);
      } else {
        navigate("/host/talks");
      }
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
            <Card
              key={theme.id}
              className={`cursor-pointer transition-all hover:shadow-md overflow-hidden ${
                state.themeId === theme.id
                  ? "ring-2 ring-primary shadow-md"
                  : "hover:border-muted-foreground/30"
              }`}
              onClick={() =>
                setState((prev) => ({ ...prev, themeId: theme.id }))
              }
            >
              <CardContent className="p-0">
                <div
                  className="h-16 flex items-stretch"
                  style={{ backgroundColor: theme.colors.background }}
                >
                  <div
                    className="w-1/3"
                    style={{ backgroundColor: theme.colors.accent }}
                  />
                  <div
                    className="w-1/3"
                    style={{ backgroundColor: theme.colors.cardBackground }}
                  />
                  <div
                    className="w-1/3"
                    style={{ backgroundColor: theme.colors.textPrimary }}
                  />
                </div>

                <div className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-sm">{theme.name}</h3>
                      {theme.version === "2025" && (
                        <span className="text-xs text-primary">2025</span>
                      )}
                    </div>
                    {state.themeId === theme.id && (
                      <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-3 h-3 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
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
            Help visitors find you on social media and other platforms.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {state.buttons.map((button, index) => (
          <div
            key={index}
            className="flex items-start gap-3 p-4 border rounded-lg bg-muted/30"
          >
            <select
              value={button.icon}
              onChange={(e) => handleUpdateButton(index, "icon", e.target.value)}
              className="h-10 px-3 border rounded-md bg-background"
            >
              {AVAILABLE_ICONS.map((icon) => (
                <option key={icon.value} value={icon.value}>
                  {icon.label}
                </option>
              ))}
            </select>

            <div className="flex-1 space-y-2">
              <Input
                value={button.label}
                onChange={(e) =>
                  handleUpdateButton(index, "label", e.target.value)
                }
                placeholder="Button label"
              />
              <Input
                value={button.url}
                onChange={(e) =>
                  handleUpdateButton(index, "url", e.target.value)
                }
                placeholder="https://..."
              />
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleRemoveButton(index)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}

        {state.buttons.length < 6 && (
          <Button
            variant="outline"
            onClick={handleAddButton}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Link
          </Button>
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

          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <Video className="h-4 w-4 text-muted-foreground" />
              <span>
                Sessions will be held via Google Meet
                {!hasGoogleMeet && (
                  <span className="text-amber-600 ml-1">
                    (You'll need to connect Google Meet in Settings)
                  </span>
                )}
              </span>
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

      <div className="border rounded-lg p-4 bg-muted/20">
        <TimeSlotSelector
          value={state.timeSlots}
          onChange={(slots) =>
            setState((prev) => ({ ...prev, timeSlots: slots }))
          }
        />
      </div>

      <p className="text-sm text-muted-foreground">
        {Object.keys(state.timeSlots).length} time slots selected
      </p>
    </div>
  );

  const renderTemplateSection = () => (
    <div className="space-y-6">
      <div>
        <H2 className="mb-2">Choose a template to get started</H2>
        <p className="text-muted-foreground">
          Pick a starting point that matches your style. You can customize
          everything later.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ONBOARDING_TEMPLATES.map((template) => (
          <Card
            key={template.id}
            className={`cursor-pointer transition-all hover:shadow-md ${
              state.templateId === template.id
                ? "ring-2 ring-primary shadow-md"
                : "hover:border-muted-foreground/30"
            }`}
            onClick={() => handleTemplateSelect(template.id)}
          >
            <CardContent className="p-0">
              <div
                className="h-24 rounded-t-lg flex items-center justify-center text-4xl"
                style={{ background: template.previewGradient }}
              >
                {template.emoji}
              </div>

              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-lg">{template.name}</h3>
                  {state.templateId === template.id && (
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-4 h-4 text-primary-foreground" />
                    </div>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {template.description}
                </p>
              </div>
            </CardContent>
          </Card>
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

    return (
      <div
        className="pp-container h-full overflow-auto"
        style={themeVars}
        data-theme-version={themeVersion}
      >
        <div className="pp-main-content p-6">
          <div className="pp-profile-header">
            <div className="pp-avatar-wrapper">
              {state.avatar ? (
                <img
                  src={state.avatar}
                  alt={state.displayName}
                  className="pp-avatar"
                />
              ) : (
                <div className="pp-avatar pp-avatar-fallback">
                  {state.displayName.charAt(0) || "?"}
                </div>
              )}
            </div>
            <h1 className="pp-display-name">
              {state.displayName || "Your Name"}
            </h1>
          </div>

          {state.bio && (
            <div className="pp-bio-section">
              <p className="pp-bio-text">{state.bio}</p>
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
              <div className="pp-divider">
                <span className="pp-divider-text">Talks</span>
              </div>

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
                      <span className="pp-service-location">
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
                        <span className="pp-service-location">
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
      <div className="min-h-screen flex">
        {/* Left Panel - Steps */}
        <div className="flex-1 flex flex-col max-w-2xl border-r">
          {/* Header */}
          <div className="p-6 border-b">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-muted-foreground">
                Setting up your page
              </span>
              <span className="text-sm text-muted-foreground">
                Step {currentStepIndex + 1} of {ONBOARDING_STEPS.length}
              </span>
            </div>
            <Progress value={progress} className="h-1.5" />

            {/* Step indicators */}
            <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
              {ONBOARDING_STEPS.map((step, index) => {
                const StepIcon = step.icon;
                const isCompleted = index < currentStepIndex;
                const isCurrent = index === currentStepIndex;

                return (
                  <button
                    key={step.id}
                    onClick={() =>
                      index <= currentStepIndex && setCurrentStepIndex(index)
                    }
                    className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm whitespace-nowrap transition-colors ${
                      isCurrent
                        ? "bg-primary text-primary-foreground"
                        : isCompleted
                        ? "bg-primary/10 text-primary cursor-pointer hover:bg-primary/20"
                        : "bg-muted text-muted-foreground"
                    }`}
                    disabled={index > currentStepIndex}
                  >
                    {isCompleted ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <StepIcon className="w-4 h-4" />
                    )}
                    <span className="hidden sm:inline">{step.title}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto p-6">{renderCurrentStep()}</div>

          {/* Navigation */}
          <div className="p-6 border-t flex justify-between">
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={currentStepIndex === 0}
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back
            </Button>

            {currentStepIndex < ONBOARDING_STEPS.length - 1 ? (
              <Button onClick={handleNext} disabled={!canProceed()}>
                Next
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleFinishOnboarding}
                disabled={!canProceed() || isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Setting up...
                  </>
                ) : (
                  <>
                    Finish Setup
                    <Check className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Right Panel - Live Preview */}
        <div className="hidden lg:flex flex-1 flex-col bg-muted/30">
          <div className="p-4 border-b bg-background">
            <h3 className="font-medium text-sm text-muted-foreground">
              Live Preview
            </h3>
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
          <div className="p-6 border-b">
            <div className="flex items-center justify-between">
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
          </div>

          {/* Sections */}
          <div className="flex-1 overflow-auto">
            {SECTIONS.map((section) => {
              const isExpanded = expandedSections.has(section.id);
              const SectionIcon = section.icon;
              const sectionHasChanges = hasChanges[section.id];
              const isSaving = savingSection === section.id;

              return (
                <Collapsible
                  key={section.id}
                  open={isExpanded}
                  onOpenChange={() => toggleSection(section.id)}
                >
                  <div className="border-b">
                    <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <SectionIcon className="w-5 h-5 text-muted-foreground" />
                        <div className="text-left">
                          <h3 className="font-medium">{section.title}</h3>
                          <p className="text-sm text-muted-foreground">
                            {section.description}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {sectionHasChanges && (
                          <span className="text-xs text-amber-600 font-medium">
                            Unsaved
                          </span>
                        )}
                        <ChevronDown
                          className={`w-5 h-5 text-muted-foreground transition-transform ${
                            isExpanded ? "rotate-180" : ""
                          }`}
                        />
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="p-6 pt-2 border-t bg-muted/20">
                        {section.id === "profile" &&
                          renderProfileSection(false)}
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

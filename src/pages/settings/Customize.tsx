import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle, XCircle, Settings, Copy, Check, Clock, Users } from 'lucide-react';
import { useAuth } from '@/contexts/PrivyAuthContext';
import { ApiClient } from '@/lib/api-migration';
import { validateUsername, getUserPageUrl } from '@/lib/username';
import { H2 } from '@/design-system';

const customizeSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').optional(),
});

type CustomizeFormData = z.infer<typeof customizeSchema>;

export default function Customize() {
  const { profile, refreshProfile, userId } = useAuth();
  const [loading, setLoading] = useState(false);
  const [profileLinkCopied, setProfileLinkCopied] = useState(false);
  
  // Username availability state
  const [usernameAvailability, setUsernameAvailability] = useState<{
    checking: boolean;
    available: boolean | null;
    error: string | null;
  }>({
    checking: false,
    available: null,
    error: null
  });
  
  const profileUrl = getUserPageUrl(profile);

  const form = useForm<CustomizeFormData>({
    resolver: zodResolver(customizeSchema),
    defaultValues: {
      username: '',
    },
  });

  // Throttled username availability checking
  const checkUsernameAvailability = useCallback(async (username: string) => {
    if (!username || username.length < 3) {
      setUsernameAvailability({ checking: false, available: null, error: null });
      return;
    }

    // Skip check if it's the user's current username
    if (profile?.username === username) {
      setUsernameAvailability({ checking: false, available: true, error: null });
      return;
    }

    // Validate format first
    const validation = validateUsername(username);
    if (!validation.isValid) {
      setUsernameAvailability({ checking: false, available: false, error: validation.error });
      return;
    }

    setUsernameAvailability({ checking: true, available: null, error: null });

    try {
      const availability = await ApiClient.checkUsernameAvailability(username);
      setUsernameAvailability({
        checking: false,
        available: availability.available,
        error: availability.available ? null : (availability.error || 'Username is already taken')
      });
    } catch (error) {
      setUsernameAvailability({
        checking: false,
        available: false,
        error: 'Failed to check availability'
      });
    }
  }, [profile?.username]);

  // Throttled version of username availability check
  const throttledCheckUsername = useCallback(
    (() => {
      let timeoutId: NodeJS.Timeout;
      return (username: string) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => checkUsernameAvailability(username), 500);
      };
    })(),
    [checkUsernameAvailability]
  );

  // Watch username changes for real-time availability checking
  const watchedUsername = form.watch('username');
  useEffect(() => {
    if (watchedUsername !== undefined) {
      throttledCheckUsername(watchedUsername);
    }
  }, [watchedUsername, throttledCheckUsername]);

  // Effect to populate form with profile data whenever profile changes or component mounts
  useEffect(() => {
    if (profile && userId) {
      const formData = {
        username: profile.username || '',
      };
      
      form.reset(formData);
    }
  }, [profile, userId, form]);

  const onSubmit = async (data: CustomizeFormData) => {
    try {
      setLoading(true);
      
      // Handle username update if changed
      const currentUsername = profile?.username;
      if (data.username && data.username !== currentUsername) {
        // Validate username format
        const validation = validateUsername(data.username);
        if (!validation.isValid) {
          toast.error(validation.error);
          return;
        }
        
        // Final availability check before submission (security measure)
        const availability = await ApiClient.checkUsernameAvailability(data.username);
        if (!availability.available) {
          toast.error(availability.error || 'Username is already taken');
          return;
        }
        
        // Update username
        await ApiClient.updateUsername(data.username, userId);
      }
      
      await refreshProfile();
      toast.success('Settings updated successfully');
    } catch (error) {
      console.error('Settings update error:', error);
      toast.error('Failed to update settings');
    } finally {
      setLoading(false);
    }
  };

  const renderUsernameStatus = () => {
    if (usernameAvailability.checking) {
      return (
        <div className="flex items-center gap-2 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-muted-foreground">Checking availability...</span>
        </div>
      );
    }

    if (usernameAvailability.available === true) {
      return (
        <div className="flex items-center gap-2 text-sm text-green-600">
          <CheckCircle className="w-4 h-4" />
          <span>Username is available</span>
        </div>
      );
    }

    if (usernameAvailability.available === false && usernameAvailability.error) {
      return (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <XCircle className="w-4 h-4" />
          <span>{usernameAvailability.error}</span>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {/* Desktop Layout */}
        <div className="hidden lg:flex gap-8">
          {/* Left Sidebar - Desktop Only */}
          <div className="w-64 flex-shrink-0">
            <div className="bg-neutral-50 box-border content-stretch flex flex-col gap-6 h-full items-start justify-start overflow-clip px-8 py-10 relative shrink-0 w-64 rounded-2xl">
              <div className="content-stretch flex flex-col gap-0.5 items-start justify-start leading-[0] relative shrink-0 w-full">
                <H2 className="leading-[1.4]">Settings</H2>
                <div className="font-body text-xs text-tertiary w-full">
                  <p className="leading-[1.5] text-tertiary">Customize your profile</p>
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
                <div className="bg-[#f3f3f3] box-border content-stretch flex gap-2 items-center justify-start px-2 py-3 relative rounded-[12px] shrink-0 w-full">
                  <div className="overflow-clip relative shrink-0 size-5">
                    <Settings className="w-5 h-5 text-black" />
                  </div>
                  <div className="basis-0 font-body font-medium grow leading-[0] min-h-px min-w-px relative shrink-0 text-[16px] text-black">
                    <p className="leading-[1.5]">Customize</p>
                  </div>
                </div>
                <Link to="/settings/timezone" className="box-border content-stretch flex gap-2 items-center justify-start px-2 py-3 relative rounded-[12px] shrink-0 w-full hover:bg-[#f3f3f3] transition-colors">
                  <div className="overflow-clip relative shrink-0 size-5">
                    <Clock className="w-5 h-5 text-[#666666]" />
                  </div>
                  <div className="basis-0 font-body font-normal grow leading-[0] min-h-px min-w-px relative shrink-0 text-[#666666] text-[16px] hover:text-black transition-colors">
                    <p className="leading-[1.5]">Timezone</p>
                  </div>
                </Link>
              </div>
            </div>
          </div>

          {/* Main Content Area - Desktop */}
          <div className="flex-1">
            <div className="bg-neutral-50 box-border content-stretch flex flex-col gap-6 h-full items-start justify-start min-h-px min-w-px px-10 py-0 relative shrink-0 rounded-2xl">
              <div className="box-border content-stretch flex flex-col gap-10 items-start justify-start p-[40px] relative rounded-[16px] shrink-0 w-full">
                <div className="content-stretch flex flex-col gap-8 items-start justify-start relative shrink-0 w-full">
                  {/* Username Section */}
                  <div className="content-stretch flex flex-col gap-0.5 items-start justify-start leading-[0] relative shrink-0 w-full">
                    <H2 className="leading-[1.4]">Username & Profile URL</H2>
                    <div className="font-body font-normal relative shrink-0 text-[#aaaaaa] text-[12px] w-full">
                      <p className="leading-[1.5]">Set your unique username for your public profile URL</p>
                    </div>
                  </div>
                  
                  <form onSubmit={form.handleSubmit(onSubmit)} className="content-stretch flex flex-col gap-6 items-start justify-start relative shrink-0 w-full">
                    {/* Username Input */}
                    <div className="content-stretch flex flex-col gap-2 items-start justify-start relative shrink-0 w-full">
                      <div className="font-body font-normal leading-[0] relative shrink-0 text-[#666666] text-[14px] w-full">
                        <Label htmlFor="username">Username</Label>
                      </div>
                      <div className={`bg-white box-border content-stretch flex gap-2 items-center justify-start p-[12px] relative rounded-[8px] shrink-0 w-full ${
                        usernameAvailability.available === true ? 'ring-2 ring-green-500' :
                        usernameAvailability.available === false ? 'ring-2 ring-red-500' : ''
                      }`}>
                        <div aria-hidden="true" className="absolute border border-[#eeeeee] border-solid inset-[-1px] pointer-events-none rounded-[9px]" />
                        <Input
                          id="username"
                          {...form.register('username')}
                          placeholder="your-username"
                          className="basis-0 font-body font-normal grow leading-[0] min-h-px min-w-px relative shrink-0 text-[16px] text-black border-0 focus:ring-0 p-0 bg-transparent placeholder:text-[#666666]"
                        />
                      </div>
                      
                      {/* Username Status */}
                      {renderUsernameStatus()}
                      
                      {/* Username Requirements */}
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p>Username requirements:</p>
                        <ul className="list-disc list-inside space-y-0.5 ml-2">
                          <li>3-30 characters</li>
                          <li>Letters, numbers, underscores (_) and dashes (-) only</li>
                          <li>No spaces or special characters</li>
                        </ul>
                      </div>
                      
                      {form.formState.errors.username && (
                        <p className="text-[#b42318] text-sm">{form.formState.errors.username.message}</p>
                      )}
                    </div>
                    
                    {/* Profile URL Preview */}
                    {profileUrl && (
                      <div className="content-stretch flex flex-col gap-2 items-start justify-start relative shrink-0 w-full">
                        <div className="font-body font-normal leading-[0] relative shrink-0 text-[#666666] text-[14px] w-full">
                          <Label>Your Profile URL</Label>
                        </div>
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3 w-full">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="font-mono text-sm text-green-800 break-all flex-1">
                              {profileUrl}
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                navigator.clipboard.writeText(profileUrl);
                                setProfileLinkCopied(true);
                                toast.success('Profile URL copied to clipboard!');
                                setTimeout(() => setProfileLinkCopied(false), 2000);
                              }}
                              className="shrink-0 h-8 w-8 p-0 bg-green-100 border-green-300 hover:bg-green-200"
                            >
                              {profileLinkCopied ? (
                                <Check className="w-4 h-4 text-green-700" />
                              ) : (
                                <Copy className="w-4 h-4 text-green-700" />
                              )}
                            </Button>
                          </div>
                          <div className="text-xs text-green-600">
                            This is your public profile URL that others can use to find and book your services
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Save Button */}
                    <div className="content-stretch flex gap-8 items-center justify-start relative shrink-0 w-full pt-6">
                      <div className="basis-0 grow min-h-px min-w-px"></div>
                      <Button
                        type="submit"
                        disabled={loading}
                        className="bg-black box-border content-stretch flex gap-2 items-center justify-center px-6 py-3 relative rounded-[40px] shrink-0 w-40 hover:bg-gray-900"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Saving...</span>
                          </>
                        ) : (
                          <span className="font-body font-semibold text-[16px] text-white">Save Changes</span>
                        )}
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Preview/Info - Desktop Only */}
          <div className="w-[400px] flex-shrink-0">
            <div className="content-stretch flex flex-col gap-6 h-full items-start justify-start relative shrink-0 border-l border-[#eeeeee] rounded-2xl">
              <div className="basis-0 box-border content-stretch flex flex-col gap-10 grow items-center justify-start min-h-px min-w-px p-[40px] relative shrink-0 w-full">
                <div className="content-stretch flex flex-col gap-8 items-center justify-start relative shrink-0 w-full">
                  <div className="content-stretch flex flex-col gap-0.5 items-start justify-start leading-[0] relative shrink-0 w-full">
                    <H2 className="leading-[1.4]">Public Profile</H2>
                    <div className="font-body font-normal relative shrink-0 text-[#aaaaaa] text-[12px] w-full">
                      <p className="leading-[1.5]">How others will find your profile</p>
                    </div>
                  </div>
                  
                  <div className="content-stretch flex flex-col gap-6 items-start justify-start relative shrink-0 w-full">
                    {profileUrl ? (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 w-full">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-sm font-medium text-blue-900">Profile URL Active</span>
                        </div>
                        <div className="font-mono text-sm text-blue-800 break-all mb-2">
                          {profileUrl}
                        </div>
                        <div className="text-xs text-blue-600">
                          Share this link so others can view your profile and book your services
                        </div>
                      </div>
                    ) : (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 w-full">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                          <span className="text-sm font-medium text-amber-900">No Profile URL</span>
                        </div>
                        <div className="text-xs text-amber-700">
                          Set a username to get your personalized profile URL
                        </div>
                      </div>
                    )}
                    
                    <div className="text-xs text-muted-foreground space-y-2">
                      <p className="font-medium">Why set a username?</p>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li>Get a memorable profile URL like timee.com/yourname</li>
                        <li>Make it easy for others to find and book your services</li>
                        <li>Build your personal brand on the platform</li>
                      </ul>
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
              <p className="text-sm text-gray-500 font-body">Customize your profile</p>
            </div>
            
            {/* Horizontal Tab Navigation */}
            <div className="flex gap-1 p-1 bg-gray-100 rounded-lg overflow-x-auto">
              <Link
                to="/settings/profile"
                className="flex-1 min-w-fit px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap font-body text-gray-600 hover:text-black"
              >
                Profile
              </Link>
              <div className="flex-1 min-w-fit px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap font-body bg-white text-black shadow-sm">
                Customize
              </div>
              <Link
                to="/settings/timezone"
                className="flex-1 min-w-fit px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap font-body text-gray-600 hover:text-black"
              >
                Timezone
              </Link>
            </div>
          </div>

          {/* Mobile Content Area */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-[#eeeeee] p-4 sm:p-6">
              {/* Username Section */}
              <div className="content-stretch flex flex-col gap-0.5 items-start justify-start leading-[0] relative shrink-0 w-full mb-6">
                <H2 className="leading-[1.4]">Username & Profile URL</H2>
                <div className="font-body font-normal relative shrink-0 text-[#aaaaaa] text-[12px] w-full">
                  <p className="leading-[1.5]">Set your unique username for your public profile URL</p>
                </div>
              </div>
              
              <form onSubmit={form.handleSubmit(onSubmit)} className="content-stretch flex flex-col gap-6 items-start justify-start relative shrink-0 w-full">
                {/* Username Input */}
                <div className="content-stretch flex flex-col gap-2 items-start justify-start relative shrink-0 w-full">
                  <div className="font-body font-normal leading-[0] relative shrink-0 text-[#666666] text-[14px] w-full">
                    <Label htmlFor="username">Username</Label>
                  </div>
                  <div className={`bg-white box-border content-stretch flex gap-2 items-center justify-start p-[12px] relative rounded-[8px] shrink-0 w-full border border-[#eeeeee] ${
                    usernameAvailability.available === true ? 'ring-2 ring-green-500' :
                    usernameAvailability.available === false ? 'ring-2 ring-red-500' : ''
                  }`}>
                    <Input
                      id="username"
                      {...form.register('username')}
                      placeholder="your-username"
                      className="basis-0 font-body font-normal grow leading-[0] min-h-px min-w-px relative shrink-0 text-[16px] text-black border-0 focus:ring-0 p-0 bg-transparent placeholder:text-[#666666]"
                    />
                  </div>
                  
                  {/* Username Status */}
                  {renderUsernameStatus()}
                  
                  {/* Username Requirements */}
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>Username requirements:</p>
                    <ul className="list-disc list-inside space-y-0.5 ml-2">
                      <li>3-30 characters</li>
                      <li>Letters, numbers, underscores (_) and dashes (-) only</li>
                      <li>No spaces or special characters</li>
                    </ul>
                  </div>
                  
                  {form.formState.errors.username && (
                    <p className="text-[#b42318] text-sm">{form.formState.errors.username.message}</p>
                  )}
                </div>
                
                {/* Profile URL Preview */}
                {profileUrl && (
                  <div className="content-stretch flex flex-col gap-2 items-start justify-start relative shrink-0 w-full">
                    <div className="font-body font-normal leading-[0] relative shrink-0 text-[#666666] text-[14px] w-full">
                      <Label>Your Profile URL</Label>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 w-full">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                        <div className="font-mono text-sm text-green-800 break-all flex-1">
                          {profileUrl}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            navigator.clipboard.writeText(profileUrl);
                            setProfileLinkCopied(true);
                            toast.success('Profile URL copied to clipboard!');
                            setTimeout(() => setProfileLinkCopied(false), 2000);
                          }}
                          className="shrink-0 h-8 w-full sm:w-8 p-0 bg-green-100 border-green-300 hover:bg-green-200 flex items-center justify-center gap-2 sm:gap-0"
                        >
                          {profileLinkCopied ? (
                            <>
                              <Check className="w-4 h-4 text-green-700" />
                              <span className="sm:hidden text-green-700">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4 text-green-700" />
                              <span className="sm:hidden text-green-700">Copy URL</span>
                            </>
                          )}
                        </Button>
                      </div>
                      <div className="text-xs text-green-600">
                        This is your public profile URL that others can use to find and book your services
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Save Button */}
                <div className="content-stretch flex gap-8 items-center justify-end relative shrink-0 w-full pt-6">
                  <Button
                    type="submit"
                    disabled={loading}
                    className="bg-black box-border content-stretch flex gap-2 items-center justify-center px-6 py-3 relative rounded-[40px] shrink-0 w-40 hover:bg-gray-900"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span className="font-body font-semibold text-[16px] text-white">Save Changes</span>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
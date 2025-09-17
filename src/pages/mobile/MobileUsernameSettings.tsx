import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/design-system/components/Input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle, XCircle, Copy, Check, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/PrivyAuthContext';
import { ApiClient } from '@/lib/api-migration';
import { validateUsername, getUserPageUrl } from '@/lib/username';
import { H2, H3, Text, Description } from '@/design-system';

const customizeSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').optional(),
});

type CustomizeFormData = z.infer<typeof customizeSchema>;

export default function MobileUsernameSettings() {
  const { profile, refreshProfile, userId } = useAuth();
  const navigate = useNavigate();
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

  // Initialize form with existing username
  useEffect(() => {
    if (profile) {
      form.setValue('username', profile.username || '');
    }
  }, [profile, form]);

  // Throttled username availability checking
  const checkUsernameAvailability = useCallback(async (username: string) => {
    if (!username || username.length < 3) {
      setUsernameAvailability({ checking: false, available: null, error: null });
      return;
    }

    if (username === profile?.username) {
      setUsernameAvailability({ checking: false, available: true, error: null });
      return;
    }

    setUsernameAvailability({ checking: true, available: null, error: null });

    try {
      const validation = await validateUsername(username);
      setUsernameAvailability({
        checking: false,
        available: validation.isValid,
        error: validation.isValid ? null : validation.message
      });
    } catch (error) {
      console.error('Username validation error:', error);
      setUsernameAvailability({
        checking: false,
        available: false,
        error: 'Failed to check username availability'
      });
    }
  }, [profile?.username]);

  // Debounce username checking
  useEffect(() => {
    const username = form.watch('username');
    if (!username) return;

    const timeoutId = setTimeout(() => {
      checkUsernameAvailability(username);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [form.watch('username'), checkUsernameAvailability]);

  const onSubmit = async (data: CustomizeFormData) => {
    if (!userId) {
      toast.error('User not found');
      return;
    }

    if (!data.username) {
      toast.error('Username is required');
      return;
    }

    // Final validation before submission
    if (data.username !== profile?.username) {
      try {
        const validation = await validateUsername(data.username);
        if (!validation.isValid) {
          toast.error(validation.message);
          return;
        }
      } catch (error) {
        toast.error('Failed to validate username');
        return;
      }
    }

    setLoading(true);
    try {
      await ApiClient.updateProfile({ username: data.username }, userId);
      await refreshProfile();
      toast.success('Username updated successfully!');

      // Go back to Me page after successful update
      navigate('/me');
    } catch (error: any) {
      console.error('Failed to update username:', error);
      toast.error(error.message || 'Failed to update username');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyProfileLink = () => {
    if (profileUrl) {
      navigator.clipboard.writeText(window.location.origin + profileUrl);
      setProfileLinkCopied(true);
      toast.success('Profile link copied to clipboard!');
      setTimeout(() => setProfileLinkCopied(false), 2000);
    } else {
      toast.error('Set a username first to get your profile link');
    }
  };

  const getInputClassName = () => {
    const baseClasses = "transition-colors duration-200";

    if (usernameAvailability.checking) {
      return `${baseClasses} border-blue-300 focus:border-blue-500`;
    }

    if (usernameAvailability.available === true) {
      return `${baseClasses} border-green-300 focus:border-green-500`;
    }

    if (usernameAvailability.available === false) {
      return `${baseClasses} border-red-300 focus:border-red-500`;
    }

    return baseClasses;
  };

  const getValidationIcon = () => {
    if (usernameAvailability.checking) {
      return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
    }

    if (usernameAvailability.available === true) {
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    }

    if (usernameAvailability.available === false) {
      return <XCircle className="h-5 w-5 text-red-500" />;
    }

    return null;
  };

  return (
    <div className="lg:hidden min-h-screen bg-gray-50 pb-20">
      <div className="px-4 py-6">
        {/* Header with back button */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate('/me')}
            className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <H2>Username</H2>
        </div>

        {/* Main content */}
        <div className="space-y-6">
          {/* Description */}
          <div className="bg-white rounded-2xl border border-[#eeeeee] p-4">
            <Text variant="small" className="text-[#666666]">
              Choose a unique username for your public profile. This will be used in your profile URL.
            </Text>
          </div>

          {/* Username form */}
          <div className="bg-white rounded-2xl border border-[#eeeeee] p-4">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-sm font-medium">
                  Username
                </Label>
                <div className="relative">
                  <Input
                    id="username"
                    type="text"
                    placeholder="Enter your username"
                    className={getInputClassName()}
                    {...form.register('username')}
                    fullWidth
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    {getValidationIcon()}
                  </div>
                </div>

                {/* Validation messages */}
                {form.formState.errors.username && (
                  <Text variant="small" className="text-red-500">
                    {form.formState.errors.username.message}
                  </Text>
                )}

                {usernameAvailability.error && (
                  <Text variant="small" className="text-red-500">
                    {usernameAvailability.error}
                  </Text>
                )}

                {usernameAvailability.available === true && form.watch('username') !== profile?.username && (
                  <Text variant="small" className="text-green-600">
                    Username is available!
                  </Text>
                )}
              </div>

              <Button
                type="submit"
                disabled={loading || usernameAvailability.checking || usernameAvailability.available === false}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update Username'
                )}
              </Button>
            </form>
          </div>

          {/* Profile URL section */}
          {profile?.username && (
            <div className="bg-white rounded-2xl border border-[#eeeeee] p-4">
              <div className="space-y-3">
                <H3 className="text-lg">Your Profile URL</H3>
                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                  <Text variant="small" className="flex-1 text-[#666666] font-mono">
                    {window.location.origin}{profileUrl}
                  </Text>
                  <button
                    onClick={handleCopyProfileLink}
                    className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-gray-200 transition-colors"
                  >
                    {profileLinkCopied ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-600" />
                    )}
                  </button>
                </div>
                <Text variant="small" className="text-[#999999]">
                  Share this link for others to view your profile and book your services
                </Text>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
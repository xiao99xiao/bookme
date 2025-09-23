import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Camera, ArrowLeft, User, Mail, Phone, MapPin, Globe } from 'lucide-react';
import { useAuth } from '@/contexts/PrivyAuthContext';
import { ApiClient } from '@/lib/api-migration';
import { getBrowserTimezone, getTimezoneOffset } from '@/lib/timezone';
import { H2, H3, Text, Description } from '@/design-system';

// Timezone data
const TIMEZONE_BASE_DATA = [
  { value: 'UTC', city: 'UTC (Coordinated Universal Time)' },
  { value: 'America/New_York', city: 'New York' },
  { value: 'America/Chicago', city: 'Chicago' },
  { value: 'America/Denver', city: 'Denver' },
  { value: 'America/Los_Angeles', city: 'Los Angeles' },
  { value: 'America/Phoenix', city: 'Phoenix' },
  { value: 'America/Anchorage', city: 'Anchorage' },
  { value: 'Pacific/Honolulu', city: 'Honolulu' },
  { value: 'America/Toronto', city: 'Toronto' },
  { value: 'America/Vancouver', city: 'Vancouver' },
  { value: 'Europe/London', city: 'London' },
  { value: 'Europe/Paris', city: 'Paris' },
  { value: 'Europe/Berlin', city: 'Berlin' },
  { value: 'Europe/Rome', city: 'Rome' },
  { value: 'Europe/Madrid', city: 'Madrid' },
  { value: 'Europe/Moscow', city: 'Moscow' },
  { value: 'Asia/Tokyo', city: 'Tokyo' },
  { value: 'Asia/Shanghai', city: 'Shanghai' },
  { value: 'Asia/Hong_Kong', city: 'Hong Kong' },
  { value: 'Asia/Singapore', city: 'Singapore' },
  { value: 'Asia/Dubai', city: 'Dubai' },
  { value: 'Asia/Kolkata', city: 'Mumbai' },
  { value: 'Australia/Sydney', city: 'Sydney' },
  { value: 'Australia/Melbourne', city: 'Melbourne' },
  { value: 'Australia/Perth', city: 'Perth' },
  { value: 'Pacific/Auckland', city: 'Auckland' },
];

export default function MobileProfileSettings() {
  const { user, profile, userId, getUserDisplayName } = useAuth();
  const navigate = useNavigate();

  // Form state - using simple controlled components
  const [formData, setFormData] = useState({
    display_name: '',
    bio: '',
    phone: '',
    location: '',
    timezone: '',
  });

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [isFormDirty, setIsFormDirty] = useState(false);
  const [timezoneOptions, setTimezoneOptions] = useState<Array<{
    value: string;
    city: string;
    offset: string;
    label: string;
  }>>([]);

  // Generate timezone options with current offsets
  useEffect(() => {
    const options = TIMEZONE_BASE_DATA.map(tz => {
      const offset = getTimezoneOffset(tz.value);
      return {
        ...tz,
        offset,
        label: `${tz.city} (${offset})`
      };
    });

    // Sort by offset for better UX
    options.sort((a, b) => {
      const aNum = parseFloat(a.offset.replace(/[^\d.-]/g, ''));
      const bNum = parseFloat(b.offset.replace(/[^\d.-]/g, ''));
      return aNum - bNum;
    });

    setTimezoneOptions(options);
  }, []);

  // Load profile data into form when profile is available
  useEffect(() => {
    if (profile) {
      setFormData({
        display_name: profile.display_name || '',
        bio: profile.bio || '',
        phone: profile.phone || '',
        location: profile.location || '',
        timezone: profile.timezone || getBrowserTimezone(),
      });
      setAvatarUrl(profile.avatar || '');
      setIsFormDirty(false);

      // Auto-resize bio textarea on load if there's existing content
      setTimeout(() => {
        const bioTextarea = document.querySelector('textarea[placeholder="Tell others about yourself..."]') as HTMLTextAreaElement;
        if (bioTextarea && profile.bio) {
          bioTextarea.style.height = 'auto';
          bioTextarea.style.height = Math.max(160, bioTextarea.scrollHeight) + 'px';
        }
      }, 100);
    }
  }, [profile?.id]);

  // Handle form input changes
  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setIsFormDirty(true);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userId) {
      toast.error('User not authenticated');
      return;
    }

    if (!isFormDirty) {
      toast.info('No changes to save');
      return;
    }

    setLoading(true);
    try {
      await ApiClient.updateProfile(formData, userId);
      setIsFormDirty(false);
      toast.success('Profile updated successfully!');

      // Navigate back to Me page
      navigate('/me');
    } catch (error: any) {
      console.error('Failed to update profile:', error);
      toast.error(error?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  // Handle avatar upload
  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !userId) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setUploading(true);
    try {
      const avatarPath = await ApiClient.uploadAvatar(file, userId);
      setAvatarUrl(avatarPath);
      setIsFormDirty(true);
      toast.success('Avatar updated successfully!');
    } catch (error: any) {
      console.error('Failed to upload avatar:', error);
      toast.error(error?.message || 'Failed to upload avatar');
    } finally {
      setUploading(false);
    }
  };

  const userEmail = user?.email?.address || '';

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
          <H2>Edit Profile</H2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Avatar Section */}
          <div className="flex justify-center py-6">
            <div className="relative">
              <Avatar className="w-24 h-24">
                <AvatarImage src={avatarUrl} alt="Profile" />
                <AvatarFallback className="bg-gradient-to-br from-blue-400 to-blue-600 text-white text-2xl font-semibold">
                  {getUserDisplayName()?.substring(0, 2).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>

              <label
                htmlFor="avatar-upload"
                className="absolute bottom-0 right-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center cursor-pointer hover:bg-blue-700 transition-colors"
              >
                {uploading ? (
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                ) : (
                  <Camera className="w-4 h-4 text-white" />
                )}
              </label>

              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
                disabled={uploading}
              />
            </div>
          </div>

          {/* Basic Info Section */}
          <div className="bg-white rounded-2xl border border-[#eeeeee] p-4 space-y-4">
            <H3 className="text-lg mb-3">Basic Information</H3>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <User className="w-4 h-4" />
                Display Name
              </label>
              <Input
                type="text"
                value={formData.display_name}
                onChange={(e) => handleInputChange('display_name', e.target.value)}
                placeholder="Enter your display name"
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Phone className="w-4 h-4" />
                Phone
              </label>
              <Input
                type="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                placeholder="Enter your phone number"
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <MapPin className="w-4 h-4" />
                Location
              </label>
              <Input
                type="text"
                value={formData.location}
                onChange={(e) => handleInputChange('location', e.target.value)}
                placeholder="Enter your location"
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Globe className="w-4 h-4" />
                Timezone
              </label>
              <Select
                value={formData.timezone}
                onValueChange={(value) => handleInputChange('timezone', value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose your timezone" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {timezoneOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Bio Section */}
          <div className="bg-white rounded-2xl border border-[#eeeeee] p-4 space-y-4">
            <H3 className="text-lg">About You</H3>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Bio
              </label>
              <Textarea
                value={formData.bio}
                onChange={(e) => {
                  handleInputChange('bio', e.target.value);
                  // Auto-resize textarea based on content
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.max(160, e.target.scrollHeight) + 'px';
                }}
                placeholder="Tell others about yourself..."
                className="w-full min-h-[160px] resize-none overflow-hidden"
                maxLength={500}
                style={{ height: 'auto' }}
                onInput={(e) => {
                  // Additional auto-resize on input
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = Math.max(160, target.scrollHeight) + 'px';
                }}
              />
              <Text variant="small" className="text-[#999999] text-right">
                {formData.bio.length}/500 characters
              </Text>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/me')}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !isFormDirty}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
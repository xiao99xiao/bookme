import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Camera, Users, Settings, Clock, MapPin, Link as LinkIcon, User, Globe } from 'lucide-react';
import { useAuth } from '@/contexts/PrivyAuthContext';
import { ApiClient } from '@/lib/api-migration';
import { getBrowserTimezone, getTimezoneOffset } from '@/lib/timezone';
import { H2 } from '@/design-system';

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

export default function Profile() {
  const { user, profile, userId, getUserDisplayName } = useAuth();
  
  // Form state - using simple controlled components instead of react-hook-form
  const [formData, setFormData] = useState({
    display_name: '',
    bio: '',
    phone: '',
    location: '',
    website: '',
    timezone: '',
  });

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [services, setServices] = useState<any[]>([]);
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
      console.log('🔥 Loading profile data into form:', profile);
      setFormData({
        display_name: profile.display_name || '',
        bio: profile.bio || '',
        phone: profile.phone || '',
        location: profile.location || '',
        website: profile.website || '',
        timezone: profile.timezone || getBrowserTimezone(),
      });
      setAvatarUrl(profile.avatar || '');
      setIsFormDirty(false);
    }
  }, [profile?.id]); // Only when profile ID changes

  // Load services
  useEffect(() => {
    if (userId) {
      loadServices();
    }
  }, [userId]);

  const loadServices = async () => {
    try {
      const servicesData = await ApiClient.getUserServices(userId!);
      setServices(servicesData);
    } catch (error) {
      console.error('Failed to load services:', error);
    }
  };

  // Handle form input changes
  const handleInputChange = (field: keyof typeof formData, value: string) => {
    console.log('🔥 Form input changed:', { field, value });
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

    try {
      setLoading(true);
      console.log('🔥 Submitting form with data:', formData);
      
      // Validate required fields
      if (!formData.display_name.trim()) {
        toast.error('Display name is required');
        return;
      }

      // Prepare update data
      const updateData = {
        ...formData,
        website: formData.website || undefined,
      };
      
      console.log('🔥 Sending update request:', updateData);
      await ApiClient.updateProfile(updateData, userId);
      
      console.log('🔥 Profile updated successfully');
      toast.success('Profile updated successfully');
      setIsFormDirty(false);
      
    } catch (error) {
      console.error('Profile update error:', error);
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const uploadedFile = await ApiClient.uploadFile(file, 'avatar', userId);
      setAvatarUrl(uploadedFile.url);
      
      // Update profile with new avatar
      await ApiClient.updateProfile({
        avatar: uploadedFile.url,
      }, userId);
      
      toast.success('Avatar updated successfully');
    } catch (error) {
      console.error('Avatar upload error:', error);
      toast.error('Failed to upload avatar');
    } finally {
      setUploading(false);
    }
  };

  const getLocationIcon = (isOnline: boolean, hasLocation: boolean) => {
    if (isOnline) return <div className="h-3.5 w-3.5 bg-blue-500 rounded" />;
    if (hasLocation) return <Users className="h-3.5 w-3.5" />;
    return <div className="h-3.5 w-3.5 bg-green-500 rounded" />;
  };

  const getLocationText = (isOnline: boolean, hasLocation: boolean) => {
    if (isOnline) return "Online";
    if (hasLocation) return "In Person";
    return "Phone Call";
  };

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
                  <p className="leading-[1.5] text-tertiary">Update your profile picture</p>
                </div>
              </div>
              <div className="basis-0 content-stretch flex flex-col grow items-start justify-start min-h-px min-w-px relative shrink-0 w-full">
                <div className="bg-[#f3f3f3] box-border content-stretch flex gap-2 items-center justify-start px-2 py-3 relative rounded-[12px] shrink-0 w-full">
                  <div className="overflow-clip relative shrink-0 size-5">
                    <Users className="w-5 h-5 text-black" />
                  </div>
                  <div className="basis-0 font-body font-medium grow leading-[0] min-h-px min-w-px relative shrink-0 text-[16px] text-black">
                    <p className="leading-[1.5]">Profile</p>
                  </div>
                </div>
                <Link to="/settings/customize" className="box-border content-stretch flex gap-2 items-center justify-start px-2 py-3 relative rounded-[12px] shrink-0 w-full hover:bg-[#f3f3f3] transition-colors">
                  <div className="overflow-clip relative shrink-0 size-5">
                    <Settings className="w-5 h-5 text-[#666666]" />
                  </div>
                  <div className="basis-0 font-body font-normal grow leading-[0] min-h-px min-w-px relative shrink-0 text-[#666666] text-[16px] hover:text-black transition-colors">
                    <p className="leading-[1.5]">Customize</p>
                  </div>
                </Link>
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
          </div>

          {/* Main Content Area - Desktop */}
          <div className="flex-1">
            <form onSubmit={handleSubmit} className="bg-neutral-50 box-border content-stretch flex flex-col gap-6 h-full items-start justify-start min-h-px min-w-px py-0 relative shrink-0 rounded-2xl">
              <div className="box-border content-stretch flex flex-col gap-10 items-start justify-start p-[40px] relative rounded-[16px] shrink-0 w-full">
                <div className="content-stretch flex flex-col gap-8 items-start justify-start relative shrink-0 w-full">
                  {/* Profile Picture Section */}
                  <div className="content-stretch flex flex-col gap-0.5 items-start justify-start leading-[0] relative shrink-0 w-full">
                    <H2 className="leading-[1.4]">Profile Picture</H2>
                    <div className="font-body font-normal relative shrink-0 text-[#aaaaaa] text-[12px] w-full">
                      <p className="leading-[1.5]">Update your profile picture</p>
                    </div>
                  </div>
                  <div className="content-stretch flex gap-6 items-center justify-start relative shrink-0 w-full">
                    <div className="relative rounded-[40px] shrink-0 size-20">
                      <Avatar className="w-20 h-20">
                        <AvatarImage src={avatarUrl} />
                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-2xl">
                          {getUserDisplayName()?.charAt(0)?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <label 
                        htmlFor="avatar-upload" 
                        className="absolute bg-white bottom-[-8px] box-border content-stretch flex gap-1 items-center justify-start p-[10px] right-[-8px] rounded-[80px] shadow-[0px_4px_8px_-2px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.06)] size-10 cursor-pointer hover:bg-gray-50 transition-colors"
                      >
                        {uploading ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Camera className="h-5 w-5" />
                        )}
                        <input 
                          id="avatar-upload" 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={handleAvatarUpload}
                          disabled={uploading}
                        />
                      </label>
                    </div>
                  </div>

                  {/* Display Name */}
                  <div className="content-stretch flex flex-col gap-2 items-start justify-start relative shrink-0 w-full">
                    <div className="font-body font-semibold leading-[0] relative shrink-0 text-[16px] text-black w-full">
                      <p className="leading-[1.5]">Display Name</p>
                    </div>
                    <Input
                      placeholder="Enter your display name"
                      value={formData.display_name}
                      onChange={(e) => handleInputChange('display_name', e.target.value)}
                      className="text-[16px] text-black placeholder:text-[#666666]"
                    />
                  </div>

                  {/* Bio */}
                  <div className="content-stretch flex flex-col gap-2 items-start justify-start relative shrink-0 w-full">
                    <div className="font-body font-semibold leading-[0] relative shrink-0 text-[16px] text-black w-full">
                      <p className="leading-[1.5]">Bio</p>
                    </div>
                    <Textarea
                      placeholder="Tell us about yourself..."
                      value={formData.bio}
                      onChange={(e) => handleInputChange('bio', e.target.value)}
                      className="text-[16px] text-black placeholder:text-[#666666] min-h-[120px]"
                    />
                  </div>

                  {/* Contact Info */}
                  <div className="content-stretch flex gap-4 items-start justify-start relative shrink-0 w-full">
                    <div className="basis-0 content-stretch flex flex-col gap-2 grow items-start justify-start min-h-px min-w-px relative shrink-0">
                      <div className="font-body font-semibold leading-[0] relative shrink-0 text-[16px] text-black w-full">
                        <p className="leading-[1.5]">Phone</p>
                      </div>
                      <Input
                        placeholder="+1 (555) 000-0000"
                        value={formData.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        className="text-[16px] text-black placeholder:text-[#666666]"
                      />
                    </div>
                    <div className="basis-0 content-stretch flex flex-col gap-2 grow items-start justify-start min-h-px min-w-px relative shrink-0">
                      <div className="font-body font-semibold leading-[0] relative shrink-0 text-[16px] text-black w-full">
                        <p className="leading-[1.5]">Location</p>
                      </div>
                      <Input
                        placeholder="New York, NY"
                        value={formData.location}
                        onChange={(e) => handleInputChange('location', e.target.value)}
                        className="text-[16px] text-black placeholder:text-[#666666]"
                      />
                    </div>
                  </div>

                  {/* Website */}
                  <div className="content-stretch flex flex-col gap-2 items-start justify-start relative shrink-0 w-full">
                    <div className="font-body font-semibold leading-[0] relative shrink-0 text-[16px] text-black w-full">
                      <p className="leading-[1.5]">Website</p>
                    </div>
                    <Input
                      placeholder="https://example.com"
                      value={formData.website}
                      onChange={(e) => handleInputChange('website', e.target.value)}
                      className="text-[16px] text-black placeholder:text-[#666666]"
                    />
                  </div>
                </div>

                {/* Save Button */}
                <div className="content-stretch flex items-start justify-start relative shrink-0 w-full">
                  <Button
                    type="submit"
                    disabled={loading || !isFormDirty}
                    className="bg-[#3b9ef9] hover:bg-[#2b8ce8] text-white font-semibold px-6 py-3 rounded-[12px] transition-colors disabled:opacity-50"
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
              </div>
            </form>
          </div>

          {/* Right Column - Profile Preview - Desktop Only */}
          <div className="w-[400px] flex-shrink-0">
            <div className="fixed w-[400px] h-screen">
              <div className="content-stretch flex flex-col gap-6 h-full items-start justify-start relative shrink-0 border-l border-[#eeeeee] rounded-2xl">
                <div className="basis-0 box-border content-stretch flex flex-col gap-10 grow items-center justify-start min-h-px min-w-px p-[40px] relative shrink-0 w-full">
                  <div className="content-stretch flex flex-col gap-8 items-center justify-start relative shrink-0 w-full">
                    <div className="content-stretch flex flex-col gap-0.5 items-start justify-start leading-[0] relative shrink-0 w-full">
                      <H2 className="leading-[1.4]">Profile Preview</H2>
                      <div className="font-body font-normal relative shrink-0 text-[#aaaaaa] text-[12px] w-full">
                        <p className="leading-[1.5]">How your profile appears to others</p>
                      </div>
                    </div>

                    <div className="content-stretch flex flex-col gap-6 items-start justify-start relative shrink-0 w-full">
                      {/* Profile Card Preview */}
                      <div className="bg-white border border-gray-200 rounded-lg p-6 w-full shadow-sm">
                        <div className="flex flex-col items-center gap-4">
                          {/* Avatar Preview */}
                          <div className="relative">
                            <Avatar className="w-16 h-16">
                              <AvatarImage src={avatarUrl} />
                              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xl">
                                {formData.display_name?.charAt(0)?.toUpperCase() || 'U'}
                              </AvatarFallback>
                            </Avatar>
                          </div>

                          {/* Name and Details */}
                          <div className="text-center">
                            <h3 className="font-semibold text-lg text-gray-900">
                              {formData.display_name || 'Your Name'}
                            </h3>
                            {formData.bio && (
                              <p className="text-sm text-gray-600 mt-1 max-w-xs">
                                {formData.bio}
                              </p>
                            )}
                            <div className="flex flex-col gap-1 mt-3 text-xs text-gray-500">
                              {formData.location && (
                                <div className="flex items-center justify-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  <span>{formData.location}</span>
                                </div>
                              )}
                              {formData.website && (
                                <div className="flex items-center justify-center gap-1">
                                  <LinkIcon className="w-3 h-3" />
                                  <span className="truncate max-w-[200px]">{formData.website}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Profile Tips */}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 w-full">
                        <div className="flex items-center gap-2 mb-2">
                          <User className="w-4 h-4 text-blue-600" />
                          <span className="text-sm font-medium text-blue-900">Profile Tips</span>
                        </div>
                        <div className="text-xs text-blue-700">
                          <ul className="list-disc list-inside space-y-1 ml-2">
                            <li>Add a clear profile picture to build trust</li>
                            <li>Write a compelling bio that showcases your expertise</li>
                            <li>Include your location to help customers find local services</li>
                            <li>Add your website to drive traffic to your business</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Layout */}
        <div className="lg:hidden space-y-6">
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Mobile Avatar */}
              <div className="flex flex-col items-center space-y-4">
                <div className="relative">
                  <Avatar className="w-24 h-24">
                    <AvatarImage src={avatarUrl} />
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-3xl">
                      {getUserDisplayName()?.charAt(0)?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <label 
                    htmlFor="avatar-upload-mobile" 
                    className="absolute -bottom-2 -right-2 bg-white p-2 rounded-full shadow-lg cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Camera className="h-4 w-4" />
                    )}
                    <input 
                      id="avatar-upload-mobile" 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleAvatarUpload}
                      disabled={uploading}
                    />
                  </label>
                </div>
              </div>

              {/* Mobile Form Fields */}
              <div className="space-y-4">
                <div>
                  <label htmlFor="display_name" className="block text-sm font-medium text-gray-700 mb-1">
                    Display Name *
                  </label>
                  <Input
                    id="display_name"
                    value={formData.display_name}
                    onChange={(e) => handleInputChange('display_name', e.target.value)}
                    placeholder="Your display name"
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-1">
                    Bio
                  </label>
                  <Textarea
                    id="bio"
                    value={formData.bio}
                    onChange={(e) => handleInputChange('bio', e.target.value)}
                    placeholder="Tell us about yourself..."
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[120px] resize-none"
                  />
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
                    Location
                  </label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => handleInputChange('location', e.target.value)}
                    placeholder="New York, NY"
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="website" className="block text-sm font-medium text-gray-700 mb-1">
                    Website
                  </label>
                  <Input
                    id="website"
                    value={formData.website}
                    onChange={(e) => handleInputChange('website', e.target.value)}
                    placeholder="https://example.com"
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 mb-1">
                    <Globe className="w-4 h-4 inline mr-2" />
                    Timezone
                  </label>
                  <Select
                    value={formData.timezone}
                    onValueChange={(value) => handleInputChange('timezone', value)}
                  >
                    <SelectTrigger className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
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

              {/* Mobile Save Button */}
              <Button
                type="submit"
                disabled={loading || !isFormDirty}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
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
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Camera, Globe, Mail, Phone, MapPin, Calendar, Star, Video, Users, Copy, Check, ExternalLink, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/PrivyAuthContext';
import { ApiClient } from '@/lib/api';
import { getBrowserTimezone, getTimezoneOffset } from '@/lib/timezone';

const profileSchema = z.object({
  display_name: z.string().min(2, 'Name must be at least 2 characters'),
  bio: z.string().max(500, 'Bio must be less than 500 characters').optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  website: z.string().url('Invalid URL').optional().or(z.literal('')),
  timezone: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

// Base timezone data with city names
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

// Generate timezone list with dynamic GMT offsets
const generateTimezoneList = () => {
  return TIMEZONE_BASE_DATA.map(tz => {
    const offset = getTimezoneOffset(tz.value);
    return {
      value: tz.value,
      label: `${offset} - ${tz.city}`
    };
  });
};

export default function DashboardProfile() {
  const { user, profile, refreshProfile, getUserDisplayName, getUserEmail, userId } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [services, setServices] = useState<any[]>([]);
  const [profileLinkCopied, setProfileLinkCopied] = useState(false);
  const [timezoneList, setTimezoneList] = useState(generateTimezoneList());
  
  const profileUrl = `${window.location.origin}/profile/${userId}`;

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      display_name: '',
      bio: '',
      phone: '',
      location: '',
      website: '',
      timezone: '',
    },
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        display_name: profile.display_name || '',
        bio: profile.bio || '',
        phone: profile.phone || '',
        location: profile.location || '',
        website: profile.website || '',
        timezone: profile.timezone || getBrowserTimezone(),
      });
      setAvatarUrl(profile.avatar || '');
      
      // If user doesn't have a timezone set, automatically update their profile with browser timezone
      if (!profile.timezone && userId) {
        const browserTimezone = getBrowserTimezone();
        // Silently update the user's timezone in the background
        ApiClient.updateProfile({ timezone: browserTimezone }, userId)
          .then(() => {
            console.log('Auto-set user timezone to:', browserTimezone);
            refreshProfile(); // Refresh to get updated profile
          })
          .catch(error => {
            console.error('Failed to auto-set timezone:', error);
          });
      }
    }
  }, [profile, form, userId, refreshProfile]);

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
      
      await refreshProfile();
      toast.success('Avatar updated successfully');
    } catch (error) {
      console.error('Avatar upload error:', error);
      toast.error('Failed to upload avatar');
    } finally {
      setUploading(false);
    }
  };

  // Helper functions matching Profile.tsx
  const getLocationIcon = (isOnline: boolean, hasLocation: boolean) => {
    if (isOnline) return <Video className="h-3.5 w-3.5" />;
    if (hasLocation) return <Users className="h-3.5 w-3.5" />;
    return <Phone className="h-3.5 w-3.5" />;
  };

  const getLocationText = (isOnline: boolean, hasLocation: boolean) => {
    if (isOnline) return "Online";
    if (hasLocation) return "In Person";
    return "Phone Call";
  };

  const onSubmit = async (data: ProfileFormData) => {
    try {
      setLoading(true);
      await ApiClient.updateProfile({
        ...data,
        website: data.website || undefined,
      }, userId);
      await refreshProfile();
      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Profile update error:', error);
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3">
        {/* Left Column - Edit Form */}
        <div className="lg:col-span-2 p-6 space-y-6">
          {/* Avatar Section */}
          <div className="pb-8 mb-8 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Profile Picture</h2>
            <p className="text-sm text-gray-600 mb-6">Update your profile picture</p>
            
            <div className="flex items-center space-x-6">
              <div className="relative">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={avatarUrl} />
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-2xl">
                    {getUserDisplayName()?.charAt(0)?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <label 
                  htmlFor="avatar-upload" 
                  className="absolute bottom-0 right-0 p-1.5 bg-white rounded-full shadow-lg cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4" />
                  )}
                </label>
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                  disabled={uploading}
                />
              </div>
              <div>
                <p className="text-sm text-gray-600">Upload a new avatar</p>
                <p className="text-xs text-gray-400 mt-1">JPG, PNG or GIF. Max 5MB</p>
              </div>
            </div>
          </div>

          {/* Profile Link Section */}
          <div className="pb-8 mb-8 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Profile Link</h2>
            <p className="text-sm text-gray-600 mb-6">Share your profile with others</p>
            
            <div className="flex items-center space-x-2">
              <div className="flex-1">
                <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
                  <Globe className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-sm text-gray-700 truncate flex-1">{profileUrl}</span>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(profileUrl);
                  setProfileLinkCopied(true);
                  toast.success('Profile link copied!');
                  setTimeout(() => setProfileLinkCopied(false), 2000);
                }}
                className="flex items-center space-x-1"
              >
                {profileLinkCopied ? (
                  <><Check className="w-4 h-4" /><span>Copied</span></>
                ) : (
                  <><Copy className="w-4 h-4" /><span>Copy</span></>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => window.open(profileUrl, '_blank')}
                className="flex items-center space-x-1"
              >
                <ExternalLink className="w-4 h-4" />
                <span>View</span>
              </Button>
            </div>
          </div>

          {/* Basic Information */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Basic Information</h2>
            <p className="text-sm text-gray-600 mb-6">Update your personal details</p>
            
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <Label htmlFor="display_name">Display Name</Label>
                <Input
                  id="display_name"
                  {...form.register('display_name')}
                  placeholder="Enter your display name"
                  className="mt-1"
                />
                {form.formState.errors.display_name && (
                  <p className="text-sm text-red-600 mt-1">
                    {form.formState.errors.display_name.message}
                  </p>
                )}
              </div>

              <hr className="border-gray-200" />

              <div>
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  {...form.register('bio')}
                  placeholder="Tell us about yourself"
                  rows={4}
                  className="mt-1"
                />
                {form.formState.errors.bio && (
                  <p className="text-sm text-red-600 mt-1">
                    {form.formState.errors.bio.message}
                  </p>
                )}
              </div>

              <hr className="border-gray-200" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    {...form.register('phone')}
                    placeholder="+1 (555) 000-0000"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    {...form.register('location')}
                    placeholder="City, Country"
                    className="mt-1"
                  />
                </div>
              </div>

              <hr className="border-gray-200" />

              <div>
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  {...form.register('website')}
                  placeholder="https://example.com"
                  className="mt-1"
                />
                {form.formState.errors.website && (
                  <p className="text-sm text-red-600 mt-1">
                    {form.formState.errors.website.message}
                  </p>
                )}
              </div>

              <hr className="border-gray-200" />

              <div>
                <Label htmlFor="timezone" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Timezone
                </Label>
                <Select
                  value={form.watch('timezone')}
                  onValueChange={(value) => form.setValue('timezone', value)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select your timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    {timezoneList.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  This helps display accurate times for your services and bookings
                </p>
              </div>

              <hr className="border-gray-200" />

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update Profile'
                )}
              </Button>
            </form>
          </div>

        </div>

        {/* Right Column - Profile Preview */}
        <div className="lg:col-span-1 bg-gray-50 border-l border-gray-200">
          <div className="sticky top-0 h-screen overflow-y-auto">
            <div className="max-w-lg mx-auto py-8 px-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Profile Preview</h2>
              <p className="text-sm text-gray-600 mb-8">This is how others see your profile</p>
              
              {/* User Profile Section - Exact match to Profile.tsx */}
              <div className="mb-12">
                <div className="text-center mb-10">
                  <Avatar className="h-20 w-20 mx-auto mb-6">
                    <AvatarImage src={avatarUrl} />
                    <AvatarFallback className="text-lg bg-muted text-foreground">
                      {form.watch('display_name')?.charAt(0) || getUserEmail()?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <h1 className="text-2xl font-medium text-foreground mb-2">
                    {form.watch('display_name') || getUserEmail()?.split('@')[0] || 'User'}
                  </h1>
                  {form.watch('location') && (
                    <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground mb-2">
                      <MapPin className="h-3.5 w-3.5" />
                      <span>{form.watch('location')}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
                    <Star className="h-3.5 w-3.5 fill-current" />
                    <span className="font-medium">{profile?.rating?.toFixed(1) || '5.0'}</span>
                    <span>({profile?.review_count || 0} reviews)</span>
                  </div>
                </div>
                
                {form.watch('bio') && (
                  <div className="prose prose-sm max-w-none text-muted-foreground leading-relaxed">
                    <p>{form.watch('bio')}</p>
                  </div>
                )}
              </div>

              {/* Services Section - Exact match to Profile.tsx */}
              {(profile?.is_provider || services.length > 0) && (
                <div>
                  <div className="mb-6">
                    <h2 className="text-lg font-medium text-foreground mb-1">Services</h2>
                    <p className="text-sm text-muted-foreground">Your services</p>
                  </div>
                  
                  {services.length > 0 ? (
                    <div className="space-y-3">
                      {services.map((service) => (
                        <div 
                          key={service.id} 
                          className="border rounded-lg p-4 transition-colors"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs">
                                {service.categories?.name || 'General'}
                              </Badge>
                              <div className="flex items-center text-muted-foreground text-xs">
                                {getLocationIcon(service.is_online, !!service.location)}
                                <span className="ml-1">{getLocationText(service.is_online, !!service.location)}</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-medium">${service.price}</div>
                              <div className="text-xs text-muted-foreground">{service.duration_minutes}m</div>
                            </div>
                          </div>
                          
                          <h3 className="text-sm font-medium mb-2">
                            {service.title}
                          </h3>
                          
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                            {service.description}
                          </p>
                          
                          {service.tags && service.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {service.tags.slice(0, 3).map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>You haven't created any services yet.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
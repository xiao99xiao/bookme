import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Camera, Globe, Mail, Phone, MapPin, Calendar, Star, Video, Users, Copy, Check, ExternalLink, Clock, CheckCircle, XCircle, Settings } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '@/contexts/PrivyAuthContext';
import { ApiClient } from '@/lib/api-migration';
import { H2, H3 } from '@/design-system';

const profileSchema = z.object({
  display_name: z.string().min(2, 'Name must be at least 2 characters'),
  bio: z.string().max(500, 'Bio must be less than 500 characters').optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  website: z.string().url('Invalid URL').optional().or(z.literal('')),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export default function Profile() {
  const { user, profile, refreshProfile, getUserDisplayName, getUserEmail, userId } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [services, setServices] = useState<any[]>([]);
  

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      display_name: '',
      bio: '',
      phone: '',
      location: '',
      website: '',
    },
  });


  // Effect to populate form and avatar when profile loads
  useEffect(() => {
    if (profile) {
      // Populate form fields (avoiding form.watch() to prevent reactive loops)
      form.setValue('display_name', profile.display_name || '');
      form.setValue('bio', profile.bio || '');
      form.setValue('phone', profile.phone || '');
      form.setValue('location', profile.location || '');
      form.setValue('website', profile.website || '');
      
      setAvatarUrl(profile.avatar || '');
    }
  }, [profile]);

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
      
      // Update profile fields
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

          {/* Main Content Area - Desktop */}
          <div className="flex-1">
            <div className="bg-neutral-50 box-border content-stretch flex flex-col gap-6 h-full items-start justify-start min-h-px min-w-px py-0 relative shrink-0 rounded-2xl">
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
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Camera className="w-5 h-5" />
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
                    <div className="basis-0 content-stretch flex flex-col font-body font-normal gap-1 grow items-start justify-start leading-[0] min-h-px min-w-px relative shrink-0">
                      <div className="relative shrink-0 text-[16px] text-black w-full">
                        <p className="leading-[1.5]">Upload a new avatar</p>
                      </div>
                      <div className="relative shrink-0 text-[#aaaaaa] text-[12px] w-full">
                        <p className="leading-[1.5]">JPG, PNG or GIF. Max 5MB</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Divider */}
                <div className="h-0 relative shrink-0 w-full border-b border-[#eeeeee]"></div>
                
                {/* Basic Information Section */}
                <div className="content-stretch flex flex-col gap-8 items-start justify-start relative shrink-0 w-full">
                  <div className="content-stretch flex gap-8 items-center justify-start relative shrink-0 w-full">
                    <div className="basis-0 content-stretch flex flex-col gap-0.5 grow items-start justify-start leading-[0] min-h-px min-w-px relative shrink-0">
                      <H2 className="leading-[1.4]">Basic Information</H2>
                    </div>
                    <Button
                      type="button"
                      disabled={loading}
                      className="bg-black box-border content-stretch flex gap-2 items-center justify-center opacity-40 px-6 py-3 relative rounded-[40px] shrink-0 w-40 hover:bg-gray-900"
                      onClick={form.handleSubmit(onSubmit)}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <span className="font-body font-semibold text-[16px] text-white">Save</span>
                      )}
                    </Button>
                  </div>
                  
                  <form onSubmit={form.handleSubmit(onSubmit)} className="content-stretch flex flex-col gap-6 items-start justify-start relative shrink-0 w-full">
                    {/* Display Name */}
                    <div className="content-stretch flex flex-col gap-2 items-start justify-start relative shrink-0 w-full">
                      <div className="font-body font-normal leading-[0] relative shrink-0 text-[#666666] text-[14px] w-full">
                        <p className="leading-[1.5]">
                          <span>Display Name</span>
                          <span className="font-body font-normal text-[#b42318]"> *</span>
                        </p>
                      </div>
                      <Input 
                        placeholder="Your display name"
                        className="text-[16px] text-black placeholder:text-[#666666]"
                        {...form.register('display_name')}
                      />
                      {form.formState.errors.display_name && (
                        <p className="text-[#b42318] text-sm">{form.formState.errors.display_name.message}</p>
                      )}
                      
                    </div>
                    
                    {/* Email */}
                    <div className="content-stretch flex flex-col gap-2 items-start justify-start relative shrink-0 w-full">
                      <div className="font-body font-normal leading-[0] relative shrink-0 text-[#666666] text-[14px] w-full">
                        <p className="leading-[1.5]">
                          <span>Email</span>
                          <span className="font-body font-normal text-[#b42318]"> *</span>
                        </p>
                      </div>
                      <Input
                        placeholder="your@email.com"
                        className="text-[16px] text-black placeholder:text-[#666666] bg-gray-50"
                        value={getUserEmail() || ''}
                        disabled
                      />
                    </div>
                    
                    {/* Bio */}
                    <div className="content-stretch flex flex-col gap-2 items-start justify-start relative shrink-0 w-full">
                      <div className="font-body font-normal leading-[0] relative shrink-0 text-[#666666] text-[14px] w-full">
                        <p className="leading-[1.5]">
                          <span>Bio</span>
                          <span className="font-body font-normal text-[#b42318]"> *</span>
                        </p>
                      </div>
                      <Textarea 
                        rows={4}
                        placeholder="Type your message..."
                        className="text-[16px] text-black placeholder:text-[#666666]"
                        {...form.register('bio')}
                      />
                      {form.formState.errors.bio && (
                        <p className="text-[#b42318] text-sm">{form.formState.errors.bio.message}</p>
                      )}
                    </div>
                    
                    {/* Phone and Location */}
                    <div className="content-stretch flex gap-8 items-start justify-start relative shrink-0 w-full">
                      <div className="basis-0 content-stretch flex flex-col gap-2 grow items-start justify-start min-h-px min-w-px relative shrink-0">
                        <div className="font-body font-normal leading-[0] relative shrink-0 text-[#666666] text-[14px] w-full">
                          <p className="leading-[1.5]">Phone</p>
                        </div>
                        <Input 
                          placeholder="+1 (555) 000-0000"
                          className="text-[16px] text-black placeholder:text-[#666666]"
                          {...form.register('phone')}
                        />
                      </div>
                      <div className="basis-0 content-stretch flex flex-col gap-2 grow items-start justify-start min-h-px min-w-px relative shrink-0">
                        <div className="font-body font-normal leading-[0] relative shrink-0 text-[#666666] text-[14px] w-full">
                          <p className="leading-[1.5]">Location</p>
                        </div>
                        <Input 
                          placeholder="Japan"
                          className="text-[16px] text-black placeholder:text-[#666666]"
                          {...form.register('location')}
                        />
                      </div>
                    </div>
                    
                    {/* Website */}
                    <div className="content-stretch flex flex-col gap-2 items-start justify-start relative shrink-0 w-full">
                      <div className="font-body font-normal leading-[0] relative shrink-0 text-[#666666] text-[14px] w-full">
                        <p className="leading-[1.5]">Website</p>
                      </div>
                      <Input 
                        placeholder="https://example.com"
                        className="text-[16px] text-black placeholder:text-[#666666]"
                        {...form.register('website')}
                      />
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Profile Preview - Desktop Only */}
          <div className="w-[400px] flex-shrink-0">
            <div className="content-stretch flex flex-col gap-6 h-full items-start justify-start relative shrink-0 border-l border-[#eeeeee] rounded-2xl">
              <div className="basis-0 box-border content-stretch flex flex-col gap-10 grow items-center justify-start min-h-px min-w-px p-[40px] relative shrink-0 w-full">
                {/* Profile Preview */}
                <div className="content-stretch flex flex-col gap-8 items-center justify-start relative shrink-0 w-full">
                  <div className="content-stretch flex flex-col gap-0.5 items-start justify-start leading-[0] relative shrink-0 w-full">
                    <H2 className="leading-[1.4]">Profile Preview</H2>
                    <div className="font-body font-normal relative shrink-0 text-[#aaaaaa] text-[12px] w-full">
                      <p className="leading-[1.5]">This is how others see your profile</p>
                    </div>
                  </div>
                  
                  {/* Avatar and Name */}
                  <div className="content-stretch flex flex-col gap-6 items-center justify-start relative shrink-0 w-full">
                    <Avatar className="overflow-clip relative rounded-[40px] shrink-0 size-20">
                      <AvatarImage src={avatarUrl} />
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-2xl">
                        {getUserDisplayName()?.charAt(0)?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="content-stretch flex flex-col gap-2 items-start justify-start relative shrink-0 w-full">
                      <div className="font-heading font-bold leading-[0] not-italic relative shrink-0 text-[20px] text-black text-center w-full">
                        <p className="leading-[1.4]">{getUserDisplayName() || profile?.display_name || 'Your Name'}</p>
                      </div>
                      <div className="content-stretch flex gap-2 items-start justify-center relative shrink-0 w-full">
                        <div className="bg-[#fcf9f4] box-border content-stretch flex gap-1 items-center justify-start px-4 py-2 relative rounded-[12px] shrink-0">
                          <MapPin className="w-5 h-5 text-[#666666]" />
                          <div className="font-body font-normal leading-[0] relative shrink-0 text-[#666666] text-[14px] text-center text-nowrap">
                            <p className="leading-[1.5] whitespace-pre">{profile?.location || 'Location'}</p>
                          </div>
                        </div>
                        <div className="bg-[#fcf9f4] box-border content-stretch flex gap-1 items-center justify-start px-4 py-2 relative rounded-[12px] shrink-0">
                          <Star className="w-5 h-5 text-[#666666]" />
                          <div className="font-body font-normal leading-[0] relative shrink-0 text-[#666666] text-[14px] text-center text-nowrap">
                            <p className="leading-[1.5] whitespace-pre">0.0 (0 reviews)</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="font-body font-normal leading-[1.5] min-w-full relative shrink-0 text-[16px] text-black text-center prose prose-sm max-w-none [&>p]:leading-[1.5] [&>p]:my-0 [&>strong]:font-semibold [&>em]:italic [&>ul]:text-left [&>ol]:text-left [&>blockquote]:text-left">
                      <ReactMarkdown>
{profile?.bio || 'Your bio will appear here.'}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
                
                {/* Divider */}
                <div className="h-0 relative shrink-0 w-full border-b border-[#eeeeee]"></div>
                
                {/* Services Section */}
                <div className="content-stretch flex flex-col gap-1 items-start justify-start relative shrink-0 w-full">
                  <div className="font-heading font-bold leading-[0] not-italic relative shrink-0 text-[20px] text-black w-full">
                    <p className="leading-[1.4]">Services</p>
                  </div>
                </div>
                
                {services.length > 0 ? (
                  <div className="content-stretch flex flex-col gap-4 items-start justify-start relative shrink-0 w-full">
                    {services.slice(0, 2).map((service) => (
                      <div key={service.id} className="bg-white box-border content-stretch flex flex-col gap-6 items-start justify-start p-[16px] relative rounded-[16px] shrink-0 w-full border border-[#eeeeee]">
                        <div className="content-stretch flex flex-col items-start justify-start leading-[0] relative shrink-0 w-full">
                          <div className="font-body font-semibold relative shrink-0 text-[18px] text-black w-full">
                            <p className="leading-[1.5]">{service.title}</p>
                          </div>
                          <div className="font-body font-normal relative shrink-0 text-[#aaaaaa] text-[12px] w-full">
                            <p className="leading-[1.5]">{service.description}</p>
                          </div>
                        </div>
                        <div className="content-stretch flex items-center justify-between relative shrink-0 w-full">
                          <div className="bg-[#f3f3f3] box-border content-stretch flex gap-1 items-center justify-start px-2 py-1 relative rounded-[8px] shrink-0">
                            <Video className="w-5 h-5 text-[#666666]" />
                            <div className="font-body font-normal leading-[0] relative shrink-0 text-[#666666] text-[14px] text-center text-nowrap">
                              <p className="leading-[1.5] whitespace-pre">{service.is_online ? 'Online' : 'Offline'}</p>
                            </div>
                          </div>
                          <div className="content-stretch flex gap-1 items-baseline justify-start leading-[0] relative shrink-0 text-nowrap">
                            <div className="font-body font-semibold relative shrink-0 text-[18px] text-black">
                              <p className="leading-[1.5] text-nowrap whitespace-pre">${service.price}</p>
                            </div>
                            <div className="font-body font-normal relative shrink-0 text-[#666666] text-[12px]">
                              <p className="leading-[1.5] text-nowrap whitespace-pre">/ {service.duration_minutes}min</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="content-stretch flex flex-col gap-4 items-center justify-center relative shrink-0 w-full py-8">
                    <p className="font-body text-[#aaaaaa] text-center">No services created yet</p>
                  </div>
                )}
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
              <p className="text-sm text-gray-500 font-body">Update your profile picture</p>
            </div>
            
            {/* Horizontal Tab Navigation */}
            <div className="flex gap-1 p-1 bg-gray-100 rounded-lg overflow-x-auto">
              <div className="flex-1 min-w-fit px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap font-body bg-white text-black shadow-sm">
                Profile
              </div>
              <Link
                to="/settings/customize"
                className="flex-1 min-w-fit px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap font-body text-gray-600 hover:text-black"
              >
                Customize
              </Link>
              <Link
                to="/settings/timezone"
                className="flex-1 min-w-fit px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap font-body text-gray-600 hover:text-black"
              >
                Timezone
              </Link>
            </div>
          </div>

          {/* Mobile Content Area */}
          <div className="space-y-6">
            {/* Profile Picture Card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="mb-4">
                <H3 className="mb-1">Profile Picture</H3>
                <p className="text-sm text-gray-500">Update your profile picture</p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-6 items-center">
                <div className="relative">
                  <Avatar className="w-20 h-20">
                    <AvatarImage src={avatarUrl} />
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-2xl">
                      {getUserDisplayName()?.charAt(0)?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <label 
                    htmlFor="avatar-upload" 
                    className="absolute -bottom-2 -right-2 bg-white w-10 h-10 rounded-full shadow-lg flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors border border-gray-200"
                  >
                    {uploading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Camera className="w-5 h-5" />
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
                <div className="text-center sm:text-left">
                  <p className="text-base font-medium text-black">Upload a new avatar</p>
                  <p className="text-sm text-gray-500">JPG, PNG or GIF. Max 5MB</p>
                </div>
              </div>
            </div>

            {/* Basic Information Card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-6">
                <div>
                  <H3 className="mb-1">Basic Information</H3>
                </div>
                <Button
                  type="button"
                  disabled={loading}
                  className="bg-black text-white px-6 py-3 rounded-full w-full sm:w-auto hover:bg-gray-900"
                  onClick={form.handleSubmit(onSubmit)}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </div>
              
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Display Name */}
                <div className="space-y-2">
                  <Label htmlFor="display_name" className="text-sm font-medium text-gray-700">
                    Display Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="display_name"
                    {...form.register('display_name')}
                    placeholder="Your display name"
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {form.formState.errors.display_name && (
                    <p className="text-red-500 text-sm">{form.formState.errors.display_name.message}</p>
                  )}
                </div>
                
                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                    Email <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="email"
                    placeholder="your@email.com"
                    className="w-full p-3 border border-gray-200 rounded-lg bg-gray-50"
                    value={getUserEmail() || ''}
                    disabled
                  />
                </div>
                
                {/* Bio */}
                <div className="space-y-2">
                  <Label htmlFor="bio" className="text-sm font-medium text-gray-700">
                    Bio
                  </Label>
                  <Textarea rows={4}
                    id="bio"
                    {...form.register('bio')}
                    placeholder="Tell us about yourself..."
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[120px] resize-none"
                  />
                  {form.formState.errors.bio && (
                    <p className="text-red-500 text-sm">{form.formState.errors.bio.message}</p>
                  )}
                </div>
                
                {/* Phone */}
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-sm font-medium text-gray-700">
                    Phone
                  </Label>
                  <Input
                    id="phone"
                    {...form.register('phone')}
                    placeholder="+1 (555) 000-0000"
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                {/* Location */}
                <div className="space-y-2">
                  <Label htmlFor="location" className="text-sm font-medium text-gray-700">
                    Location
                  </Label>
                  <Input
                    id="location"
                    {...form.register('location')}
                    placeholder="New York, NY"
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                {/* Website */}
                <div className="space-y-2">
                  <Label htmlFor="website" className="text-sm font-medium text-gray-700">
                    Website
                  </Label>
                  <Input
                    id="website"
                    {...form.register('website')}
                    placeholder="https://example.com"
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


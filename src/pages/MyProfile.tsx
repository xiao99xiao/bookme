import { useState, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { Upload, Copy, Check, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/PrivyAuthContext';
import { ApiClient } from '@/lib/api-migration';

export default function MyProfile() {
  const { user, profile, refreshProfile, userId } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileLinkCopied, setProfileLinkCopied] = useState(false);

  const profileUrl = `${window.location.origin}/profile/${profile?.id}`;

  // Profile form
  const profileForm = useForm({
    defaultValues: {
      display_name: profile?.display_name || '',
      bio: profile?.bio || '',
      location: profile?.location || '',
      phone: profile?.phone || '',
      is_provider: profile?.is_provider || false
    }
  });

  // Update profile form when profile changes
  useEffect(() => {
    if (profile) {
      profileForm.reset({
        display_name: profile.display_name || '',
        bio: profile.bio || '',
        location: profile.location || '',
        phone: profile.phone || '',
        is_provider: profile.is_provider || false
      });
    }
  }, [profile, profileForm]);

  const handleProfileUpdate = async (data: any) => {
    setIsUpdatingProfile(true);
    try {
      await ApiClient.updateUserProfile(userId || '', data);
      await refreshProfile();
      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Profile update error:', error);
      toast.error('Failed to update profile');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const uploadResult = await ApiClient.uploadFile(file, 'avatar', userId);
      await ApiClient.updateUserProfile(userId || '', { avatar: uploadResult.url });
      await refreshProfile();
      toast.success('Avatar updated successfully');
    } catch (error) {
      console.error('Avatar upload error:', error);
      toast.error('Failed to upload avatar');
    } finally {
      setUploading(false);
    }
  };

  const copyProfileLink = () => {
    navigator.clipboard.writeText(profileUrl);
    setProfileLinkCopied(true);
    toast.success("Profile link copied to clipboard");
    setTimeout(() => setProfileLinkCopied(false), 2000);
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="max-w-4xl mx-auto p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">My Profile</h1>
          <p className="text-muted-foreground">
            Manage your personal information and account settings
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Profile Form */}
          <div className="lg:col-span-2">
            <Form {...profileForm}>
              <form onSubmit={profileForm.handleSubmit(handleProfileUpdate)} className="space-y-6">
                <div className="bg-card border rounded-lg p-6">
                  <h2 className="text-xl font-semibold mb-6">Basic Information</h2>
                  
                  <div className="space-y-6">
                    {/* Avatar Upload */}
                    <div className="flex items-center gap-4">
                      <Avatar className="h-16 w-16">
                        <AvatarImage src={profile?.avatar || ""} alt={profile?.display_name || "User"} />
                        <AvatarFallback className="text-lg bg-muted text-foreground">
                          {profile?.display_name?.charAt(0) || profile?.email?.charAt(0) || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarUpload}
                          className="hidden"
                          id="avatar-upload"
                        />
                        <Button 
                          variant="outline" 
                          size="sm" 
                          asChild
                          disabled={uploading}
                        >
                          <label htmlFor="avatar-upload" className="cursor-pointer">
                            {uploading ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Upload className="h-4 w-4 mr-2" />
                            )}
                            Change Avatar
                          </label>
                        </Button>
                      </div>
                    </div>

                    {/* Name */}
                    <FormField
                      control={profileForm.control}
                      name="display_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Display Name</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Location */}
                    <FormField
                      control={profileForm.control}
                      name="location"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Location</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ''} placeholder="City, Country" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Phone */}
                    <FormField
                      control={profileForm.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ''} placeholder="+1 (555) 123-4567" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Provider Toggle */}
                    <FormField
                      control={profileForm.control}
                      name="is_provider"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Service Provider</FormLabel>
                            <div className="text-sm text-muted-foreground">
                              Enable this to offer services to others
                            </div>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    {/* Bio */}
                    <FormField
                      control={profileForm.control}
                      name="bio"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bio</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              value={field.value || ''}
                              className="min-h-[120px]"
                              placeholder="Tell people about yourself..."
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button 
                      type="submit" 
                      className="w-full"
                      disabled={isUpdatingProfile}
                    >
                      {isUpdatingProfile ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        'Update Profile'
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            </Form>
          </div>

          {/* Profile Link & Preview */}
          <div className="space-y-6">
            {/* Profile Link */}
            <div className="bg-card border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Public Profile</h3>
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Profile Link</Label>
                  <div className="flex items-center gap-2 mt-2">
                    <Input 
                      value={profileUrl} 
                      readOnly 
                      className="text-xs bg-muted"
                    />
                    <Button onClick={copyProfileLink} variant="outline" size="sm">
                      {profileLinkCopied ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Account Stats */}
            <div className="bg-card border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Account Stats</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Rating</span>
                  <span className="text-sm font-medium">{profile?.rating?.toFixed(1) || '0.0'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Reviews</span>
                  <span className="text-sm font-medium">{profile?.review_count || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Member Since</span>
                  <span className="text-sm font-medium">
                    {profile?.created_at ? new Date(profile.created_at).getFullYear() : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
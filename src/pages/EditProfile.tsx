import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { MapPin, Video, Users, Phone, Plus, Upload, Copy, Check, Loader2, Star } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useAuth } from "@/contexts/PrivyAuthContext";
import { ApiClient } from "@/lib/api";
import { TimeSlotSelector } from "@/components/TimeSlotSelector";
import CreateServiceModal from "@/components/CreateServiceModal";

interface Service {
  id: string;
  title: string;
  description: string;
  short_description?: string;
  category_id?: string;
  price: number;
  duration_minutes: number;
  location?: string;
  is_online: boolean;
  images?: string[];
  tags?: string[];
  requirements?: string;
  cancellation_policy?: string;
  timeSlots?: { [key: string]: boolean };
  is_active: boolean;
  created_at: string;
  updated_at: string;
  categories?: {
    name: string;
    icon?: string;
    color?: string;
  };
}

interface Category {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
}

const EditProfile = () => {
  const { user, profile, refreshProfile, userId } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [isServiceDialogOpen, setIsServiceDialogOpen] = useState(false);
  const [isAddingService, setIsAddingService] = useState(false);
  const [profileLinkCopied, setProfileLinkCopied] = useState(false);
  const [isSavingService, setIsSavingService] = useState(false);
  const [isDeletingService, setIsDeletingService] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

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

  // Service form
  const serviceForm = useForm<{
    title: string;
    description: string;
    short_description: string;
    category_id: string;
    price: number;
    duration_minutes: number;
    location: string;
    is_online: boolean;
    tags: string;
    requirements: string;
    cancellation_policy: string;
    timeSlots: { [key: string]: boolean };
  }>({
    defaultValues: {
      title: "",
      description: "",
      short_description: "",
      category_id: "",
      price: 0,
      duration_minutes: 60,
      location: "",
      is_online: true,
      tags: "",
      requirements: "",
      cancellation_policy: "",
      timeSlots: {}
    }
  });

  // Load initial data - wait for userId to be available
  useEffect(() => {
    const loadData = async () => {
      if (!userId) {
        console.log('Waiting for userId to be available...');
        return;
      }
      
      console.log('Loading edit profile data for userId:', userId);
      
      try {
        setLoading(true);
        
        // Set a timeout to prevent infinite loading
        const loadTimeout = setTimeout(() => {
          console.warn('Edit profile loading timeout');
          toast.error('Profile loading timed out. Please refresh the page.');
          setLoading(false);
        }, 10000);

        try {
          console.log('Fetching user services and categories...');
          const [servicesData, categoriesData] = await Promise.all([
            ApiClient.getUserServices(userId),
            ApiClient.getCategories()
          ]);
          
          console.log('Data loaded - Services:', servicesData?.length || 0, 'Categories:', categoriesData?.length || 0);
          setServices(servicesData);
          setCategories(categoriesData);
          
          clearTimeout(loadTimeout);
        } catch (apiError) {
          clearTimeout(loadTimeout);
          throw apiError;
        }
      } catch (error) {
        console.error('Failed to load data:', error);
        toast.error(`Failed to load profile data: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [userId]); // Wait for userId to be available

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
      const uploadResult = await ApiClient.uploadFile(file, 'avatar');
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

  const handleAddService = () => {
    setEditingService(null);
    serviceForm.reset({
      title: "",
      description: "",
      short_description: "",
      category_id: "",
      price: 0,
      duration_minutes: 60,
      location: "",
      is_online: true,
      tags: "",
      requirements: "",
      cancellation_policy: "",
      timeSlots: {}
    });
    setIsAddingService(true);
    setIsServiceDialogOpen(true);
  };

  const handleEditService = (service: Service) => {
    setEditingService(service);
    serviceForm.reset({
      title: service.title,
      description: service.description,
      short_description: service.short_description || "",
      category_id: service.category_id || "",
      price: service.price,
      duration_minutes: service.duration_minutes,
      location: service.location || "",
      is_online: service.is_online,
      tags: service.tags?.join(', ') || "",
      requirements: service.requirements || "",
      cancellation_policy: service.cancellation_policy || "",
      timeSlots: service.timeSlots || {}
    });
    setIsAddingService(false);
    setIsServiceDialogOpen(true);
  };

  const handleSaveService = async (data: any) => {
    setIsSavingService(true);
    try {
      const serviceData = {
        ...data,
        tags: data.tags ? data.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
        short_description: data.short_description || undefined,
        location: data.location || undefined,
        requirements: data.requirements || undefined,
        cancellation_policy: data.cancellation_policy || undefined,
        category_id: data.category_id || undefined,
        timeSlots: data.timeSlots || {}
      };

      let savedService;
      if (isAddingService) {
        savedService = await ApiClient.createService(userId || '', serviceData);
        toast.success('Service created successfully');
        // Add new service to existing list
        setServices(prevServices => [...prevServices, savedService]);
      } else if (editingService) {
        savedService = await ApiClient.updateService(editingService.id, serviceData);
        toast.success('Service updated successfully');
        // Update existing service in list
        setServices(prevServices => 
          prevServices.map(s => s.id === editingService.id ? savedService : s)
        );
      }

      setIsServiceDialogOpen(false);
    } catch (error) {
      console.error('Service save error:', error);
      toast.error('Failed to save service');
    } finally {
      setIsSavingService(false);
    }
  };

  const handleDeleteService = async () => {
    if (!editingService) return;

    setIsDeletingService(true);
    try {
      await ApiClient.deleteService(editingService.id, userId || '');
      // Remove service from existing list instead of refetching all
      setServices(prevServices => 
        prevServices.filter(s => s.id !== editingService.id)
      );
      setIsServiceDialogOpen(false);
      toast.success('Service deleted successfully');
    } catch (error) {
      console.error('Service delete error:', error);
      toast.error('Failed to delete service');
    } finally {
      setIsDeletingService(false);
    }
  };

  const copyProfileLink = () => {
    navigator.clipboard.writeText(profileUrl);
    setProfileLinkCopied(true);
    toast.success("Profile link copied to clipboard");
    setTimeout(() => setProfileLinkCopied(false), 2000);
  };

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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-background">
        <div className="flex h-screen">
          {/* Edit Panel */}
          <div className="w-1/2 overflow-y-auto">
            <div className="pt-24 pb-8 px-6">
              <div className="max-w-lg mx-auto">
                <div className="mb-8">
                  <h1 className="text-2xl font-medium text-foreground mb-2">Edit Profile</h1>
                  <p className="text-sm text-muted-foreground">Update your profile information and services</p>
                </div>

            {/* Basic Info Section */}
            <Form {...profileForm}>
              <form onSubmit={profileForm.handleSubmit(handleProfileUpdate)} className="mb-12">
                <h2 className="text-lg font-medium text-foreground mb-6">Basic Information</h2>
                
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
              </form>
            </Form>

            {/* Services Section */}
            {profile?.is_provider && (
              <div>
                <h2 className="text-lg font-medium text-foreground mb-6">Services</h2>
                
                <div className="space-y-3 mb-4">
                  {services.map((service) => (
                    <div
                      key={service.id}
                      className="border rounded-lg p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleEditService(service)}
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
                      
                      <h3 className="text-sm font-medium mb-2">{service.title}</h3>
                      <p className="text-xs text-muted-foreground line-clamp-2">{service.description}</p>
                    </div>
                  ))}
                </div>

                <Button onClick={handleAddService} variant="outline" className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Service
                </Button>
              </div>
            )}
            </div>
          </div>
        </div>

        {/* Preview Panel */}
        <div className="w-1/2 bg-muted/30 overflow-y-auto border-l">
          <div className="pt-24 pb-8 px-6">
            {/* Profile Link Section */}
            <div className="mb-8 border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium mb-1">Profile Link</h3>
                  <p className="text-xs text-muted-foreground break-all">{profileUrl}</p>
                </div>
                <Button onClick={copyProfileLink} variant="outline" size="sm">
                  {profileLinkCopied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Profile Preview */}
            <div className="max-w-lg mx-auto">
              {/* User Profile Section */}
              <div className="mb-12">
                <div className="text-center mb-10">
                  <Avatar className="h-20 w-20 mx-auto mb-6">
                    <AvatarImage src={profile?.avatar || ""} alt={profile?.display_name || "User"} />
                    <AvatarFallback className="text-lg">
                      {profile?.display_name?.charAt(0) || profile?.email?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <h1 className="text-2xl font-medium mb-2">
                    {profile?.display_name || profile?.email?.split('@')[0] || 'User'}
                  </h1>
                  {profile?.location && (
                    <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground mb-2">
                      <MapPin className="h-3.5 w-3.5" />
                      <span>{profile.location}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
                    <Star className="h-3.5 w-3.5 fill-current" />
                    <span className="font-medium">{profile?.rating.toFixed(1) || '0.0'}</span>
                    <span>({profile?.review_count || 0} reviews)</span>
                  </div>
                </div>
                
                {profile?.bio && (
                  <div className="prose prose-sm max-w-none text-muted-foreground leading-relaxed">
                    <ReactMarkdown>{profile.bio}</ReactMarkdown>
                  </div>
                )}
              </div>

              {/* Services Section */}
              {profile?.is_provider && services.length > 0 && (
                <div>
                  <div className="mb-6">
                    <h2 className="text-lg font-medium mb-1">Services</h2>
                    <p className="text-sm text-muted-foreground">Choose a service to book</p>
                  </div>
                  
                  <div className="space-y-3">
                    {services.filter(s => s.is_active).map((service) => (
                      <div key={service.id} className="border rounded-lg p-4">
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
                        
                        <h3 className="text-sm font-medium mb-2">{service.title}</h3>
                        <p className="text-xs text-muted-foreground line-clamp-2">{service.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Beautiful CreateServiceModal - Restored from git history */}
      <CreateServiceModal
        isOpen={isServiceDialogOpen}
        onClose={() => setIsServiceDialogOpen(false)}
        onSubmit={async (data) => {
          try {
            setIsSavingService(true);
            
            // Transform the data format for the API
            const serviceData = {
              title: data.title,
              description: data.description,
              // category_id is optional - skip it for now since we don't have UUID mapping
              duration_minutes: data.duration,
              price: data.price,
              location: data.location === 'in-person' ? 'In Person' : data.location === 'phone' ? 'Phone' : 'Online',
              is_online: data.location === 'online',
              timeSlots: data.timeSlots,
              is_active: true
            };

            if (isAddingService) {
              const newService = await ApiClient.createService(userId || '', serviceData);
              setServices(prev => [newService, ...prev]);
              toast.success('Service added successfully!');
            } else if (editingService) {
              const updatedService = await ApiClient.updateService(editingService.id, serviceData);
              setServices(prev => prev.map(s => s.id === editingService.id ? updatedService : s));
              toast.success('Service updated successfully!');
            }
            
            setIsServiceDialogOpen(false);
            setEditingService(null);
          } catch (error) {
            console.error('Service save error:', error);
            toast.error('Failed to save service. Please try again.');
          } finally {
            setIsSavingService(false);
          }
        }}
        isLoading={isSavingService}
      />
    </>
  );
};

export default EditProfile;
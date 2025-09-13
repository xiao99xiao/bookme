import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Clock, DollarSign, MapPin, Eye, EyeOff, Briefcase, Calendar, Star, Mail, Phone, Globe, Video, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button as DSButton } from '@/design-system';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge as DSBadge } from '@/design-system';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/PrivyAuthContext';
import { ApiClient } from '@/lib/api-migration';
import CreateServiceModal from '@/components/CreateServiceModal';
import { RefactoredServiceModal } from '@/components/RefactoredServiceModal';
import { ServiceCard } from '@/components/ServiceCard';
import { H1, H2, H3 } from '@/design-system';

interface Service {
  id: string;
  title: string;
  description: string;
  short_description?: string;
  price: number;
  duration_minutes: number;
  category_id?: string;
  location?: string;
  is_online: boolean;
  meeting_platform?: string;
  is_visible: boolean;
  timeSlots?: { [key: string]: boolean };
  created_at: string;
  updated_at: string;
}

export default function ProviderServices() {
  const { user, profile, userId } = useAuth();
  
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [deletingService, setDeletingService] = useState<Service | null>(null);
  const [isSavingService, setIsSavingService] = useState(false);

  useEffect(() => {
    if (userId) {
      loadServices();
    }
  }, [userId]);

  const loadServices = async () => {
    try {
      setLoading(true);
      const servicesData = await ApiClient.getUserServices(userId!);
      setServices(servicesData);
    } catch (error) {
      console.error('Failed to load services:', error);
      toast.error('Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateService = () => {
    setEditingService(null);
    setIsServiceModalOpen(true);
  };

  const handleEditService = (service: Service) => {
    // Convert availability_schedule to timeSlots format for the modal
    const serviceWithTimeSlots = {
      ...service,
      timeSlots: service.availability_schedule || {}
    };
    setEditingService(serviceWithTimeSlots);
    setIsServiceModalOpen(true);
  };


  const handleToggleVisibility = async (service: Service) => {
    try {
      const updatedService = await ApiClient.toggleServiceVisibility(service.id, !service.is_visible, userId!);
      setServices(prev => 
        prev.map(s => s.id === service.id ? updatedService : s)
      );
      toast.success(`Service ${updatedService.is_visible ? 'made visible' : 'hidden from public'}`);
    } catch (error) {
      console.error('Failed to toggle service visibility:', error);
      toast.error('Failed to update service visibility');
    }
  };

  const handleDeleteService = async () => {
    if (!deletingService) return;
    
    try {
      await ApiClient.deleteService(deletingService.id);
      setServices(prev => prev.filter(s => s.id !== deletingService.id));
      toast.success('Service deleted successfully');
      setDeletingService(null);
    } catch (error) {
      console.error('Failed to delete service:', error);
      toast.error('Failed to delete service');
    }
  };

  const handleSaveService = async (data: any) => {
    try {
      setIsSavingService(true);
      
      const serviceData = {
        title: data.title,
        description: data.description,
        duration_minutes: data.duration,
        price: data.price,
        location: data.location === 'in-person' ? 'In Person' : data.location === 'phone' ? 'Phone' : 'Online',
        is_online: data.location === 'online',
        meeting_platform: data.location === 'online' ? data.meeting_platform : null,
        timeSlots: data.timeSlots,
        is_active: true
      };

      if (editingService) {
        const updatedService = await ApiClient.updateService(editingService.id, serviceData, userId!);
        setServices(prev => 
          prev.map(s => s.id === editingService.id ? updatedService : s)
        );
        toast.success('Service updated successfully');
      } else {
        const newService = await ApiClient.createService(userId || '', serviceData);
        setServices(prev => [newService, ...prev]);
        toast.success('Service created successfully');
      }

      setIsServiceModalOpen(false);
      setEditingService(null);
    } catch (error: any) {
      console.error('Service save error:', error);
      
      // Handle calendar integration validation errors
      if (error.message && error.message.includes('Calendar integration validation failed')) {
        const errorData = JSON.parse(error.message.replace('API Error: ', ''));
        if (errorData.requiresReconnection) {
          toast.error(`Calendar integration needs reconnection. Please go to Integrations page.`, {
            duration: 6000
          });
        } else {
          toast.error('Calendar integration validation failed');
        }
      } else {
        toast.error('Failed to save service');
      }
    } finally {
      setIsSavingService(false);
    }
  };

  const getLocationDisplay = (service: Service) => {
    if (service.is_online) return 'Online';
    return service.location || 'In Person';
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

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <H1 className="mb-2">Your Services</H1>
        <p className="text-gray-600 text-lg">Create and manage the services you offer to customers</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3">
        {/* Left Column - Services List */}
        <div className="lg:col-span-2 p-6 space-y-6">
          {/* Add Service Button */}
          <div className={`pb-8 mb-8 ${services.length === 0 ? "mt-12" : "mt-6"} border-b border-gray-200`}>
            <DSButton 
              onClick={handleCreateService}
              fullWidth
              size="large"
              variant="primary"
              icon={<Plus className="h-5 w-5" />}
            >
              Add New Service
            </DSButton>
          </div>

          {/* Services List */}
          {loading ? (
            <div className="py-8">
              <p className="text-center text-gray-500">Loading services...</p>
            </div>
          ) : services.length === 0 ? (
            <div className="py-12 text-center">
              <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No services yet</p>
              <p className="text-sm text-gray-400 mt-1">
                Create your first service to start accepting bookings
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {services.map((service, index) => (
                <div key={service.id} className={`pb-8 ${index !== services.length - 1 ? 'border-b border-gray-200' : ''} ${service.is_visible === false ? 'opacity-60' : ''}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <H3>{service.title}</H3>
                        {service.is_visible === false && (
                          <DSBadge variant="outline">Hidden</DSBadge>
                        )}
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                        {service.description}
                      </p>

                      <div className="flex flex-wrap gap-4 text-sm">
                        <div className="flex items-center text-gray-500">
                          <Clock className="w-4 h-4 mr-1" />
                          {service.duration_minutes} min
                        </div>
                        <div className="flex items-center text-gray-500">
                          <DollarSign className="w-4 h-4 mr-1" />
                          ${service.price}
                        </div>
                        <div className="flex items-center text-gray-500">
                          <MapPin className="w-4 h-4 mr-1" />
                          {getLocationDisplay(service)}
                        </div>
                        {service.timeSlots && (
                          <div className="flex items-center text-gray-500">
                            <Calendar className="w-4 h-4 mr-1" />
                            {Object.keys(service.timeSlots).length} slots
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 ml-4">
                      <DSButton
                        variant="tertiary"
                        size="small"
                        iconPosition="only"
                        onClick={() => handleToggleVisibility(service)}
                        title={service.is_visible !== false ? 'Hide from public view' : 'Show in public view'}
                        icon={service.is_visible !== false ? (
                          <Eye className="w-4 h-4" />
                        ) : (
                          <EyeOff className="w-4 h-4" />
                        )}
                      />
                      <DSButton
                        variant="tertiary"
                        size="small"
                        iconPosition="only"
                        onClick={() => handleEditService(service)}
                        icon={<Edit2 className="w-4 h-4" />}
                      />
                      <DSButton
                        variant="tertiary"
                        size="small"
                        iconPosition="only"
                        onClick={() => setDeletingService(service)}
                        className="text-red-600 hover:text-red-700"
                        icon={<Trash2 className="w-4 h-4" />}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column - Profile Preview */}
        <div className="lg:col-span-1 bg-gray-50 border-l border-gray-200">
          <div className="sticky top-0 h-screen overflow-y-auto">
            <div className="max-w-lg mx-auto py-8 px-6">
              <H2 className="mb-2">Profile Preview</H2>
              <p className="text-sm text-gray-600 mb-8">This is how others see your profile</p>
              
              {/* User Profile Section - Exact match to Profile.tsx */}
              <div className="mb-12">
                <div className="text-center mb-10">
                  <Avatar className="h-20 w-20 mx-auto mb-6">
                    <AvatarImage src={profile?.avatar || ''} />
                    <AvatarFallback className="text-lg bg-muted text-foreground">
                      {profile?.display_name?.charAt(0) || profile?.email?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <H1 className="mb-2">
                    {profile?.display_name || profile?.email?.split('@')[0] || 'User'}
                  </H1>
                  {profile?.location && (
                    <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground mb-2">
                      <MapPin className="h-3.5 w-3.5" />
                      <span>{profile.location}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
                    <Star className="h-3.5 w-3.5 fill-current" />
                    <span className="font-medium">{profile?.rating?.toFixed(1) || '5.0'}</span>
                    <span>({profile?.review_count || 0} reviews)</span>
                  </div>
                </div>
                
                {profile?.bio && (
                  <div className="prose prose-sm max-w-none text-muted-foreground leading-relaxed">
                    <p>{profile.bio}</p>
                  </div>
                )}
              </div>

              {/* Services Section - Exact match to Profile.tsx */}
              {(profile?.is_provider || services.length > 0) && (
                <div>
                  <div className="mb-6">
                    <H2 className="mb-1">Services</H2>
                    <p className="text-sm text-muted-foreground">Your services</p>
                  </div>
                  
                  {services.filter(service => service.is_visible !== false).length > 0 ? (
                    <div className="space-y-3">
                      {services.filter(service => service.is_visible !== false).map((service) => (
                        <div 
                          key={service.id} 
                          className="border rounded-lg p-4 transition-colors"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <DSBadge variant="secondary" size="small">
                                {service.categories?.name || 'General'}
                              </DSBadge>
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
                          
                          <H3 className="mb-2">
                            {service.title}
                          </H3>
                          
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                            {service.description}
                          </p>
                          
                          {service.tags && service.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {service.tags.slice(0, 3).map((tag) => (
                                <DSBadge key={tag} variant="secondary" size="small">
                                  {tag}
                                </DSBadge>
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

      {/* Service Modal */}
      <CreateServiceModal
        isOpen={isServiceModalOpen}
        onClose={() => {
          setIsServiceModalOpen(false);
          setEditingService(null);
        }}
        onSubmit={handleSaveService}
        isLoading={isSavingService}
        editingService={editingService}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingService} onOpenChange={() => setDeletingService(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Service</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingService?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteService} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
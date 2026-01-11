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
import { H1, H2, H3, Text, Loading } from '@/design-system';

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
      toast.success(`Talk ${updatedService.is_visible ? 'published' : 'paused'}`);
    } catch (error) {
      console.error('Failed to toggle Talk visibility:', error);
      toast.error('Failed to update Talk visibility');
    }
  };

  const handleDeleteService = async () => {
    if (!deletingService) return;
    
    try {
      await ApiClient.deleteService(deletingService.id);
      setServices(prev => prev.filter(s => s.id !== deletingService.id));
      toast.success('Talk deleted successfully');
      setDeletingService(null);
    } catch (error) {
      console.error('Failed to delete Talk:', error);
      toast.error('Failed to delete Talk');
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
        toast.success('Talk updated successfully');
      } else {
        const newService = await ApiClient.createService(userId || '', serviceData);
        setServices(prev => [newService, ...prev]);
        toast.success('Talk created successfully');
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
        toast.error('Failed to save Talk');
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
    <div>
      {/* Desktop Content Wrapper */}
      <div className="hidden lg:block max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Desktop Title */}
        <div className="mb-8">
          <H1 className="mb-2">Your Talks</H1>
          <Text className="text-lg">Create and manage the Talks you offer to visitors</Text>
        </div>

        {/* Desktop Layout */}
        <div className="flex gap-8">
          {/* Main Content - Services List */}
          <div className="flex-1 p-6 space-y-6 bg-white rounded-lg">
          {/* Add Service Button */}
          <div className={`pb-8 mb-8 ${services.length === 0 ? "mt-12" : "mt-6"} border-b border-gray-200`}>
            <DSButton
              onClick={handleCreateService}
              fullWidth
              size="large"
              variant="primary"
              icon={<Plus className="h-5 w-5" />}
            >
              Create a Talk
            </DSButton>
          </div>

          {/* Talks List */}
          {loading ? (
            <Loading variant="spinner" size="md" text="Loading Talks..." fullHeight={true} />
          ) : services.length === 0 ? (
            <div className="py-12 text-center">
              <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No Talks yet</p>
              <p className="text-sm text-gray-400 mt-1">
                Create your first Talk to start accepting bookings
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

          {/* Right Column - Preview - Desktop Only */}
          <div className="w-[400px] flex-shrink-0">
            <div className="fixed w-[400px] h-screen">
              <div className="h-full bg-white border-l border-gray-200 rounded-lg overflow-y-auto">
                <div className="py-8 px-6">
              <div className="mb-8">
                <H2 className="mb-2">Talks Preview</H2>
                <p className="text-sm text-gray-600">This is how your Talks appear to visitors</p>
              </div>

                  {services.filter(service => service.is_visible !== false).length > 0 ? (
                    <div className="space-y-4">
                      {services.filter(service => service.is_visible !== false).map((service) => (
                        <div
                          key={service.id}
                          className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-all hover:shadow-sm cursor-pointer"
                        >
                          {/* Service Header */}
                          <div className="flex items-start justify-between mb-3">
                            <H3 className="text-base font-semibold text-gray-900 flex-1">
                              {service.title}
                            </H3>
                            <div className="text-right ml-4">
                              <div className="text-lg font-semibold text-gray-900">${service.price}</div>
                              <div className="text-xs text-gray-500">{service.duration_minutes} min</div>
                            </div>
                          </div>

                          {/* Service Description */}
                          <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                            {service.description || service.short_description}
                          </p>

                          {/* Service Metadata */}
                          <div className="flex items-center gap-3 text-xs">
                            <div className="flex items-center gap-1 text-gray-500">
                              {getLocationIcon(service.is_online, !!service.location)}
                              <span>{getLocationText(service.is_online, !!service.location)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <Briefcase className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                      <p className="font-medium mb-1">No Talks to preview</p>
                      <p className="text-xs">Create your first Talk to see how it will appear to visitors</p>
                    </div>
                  )}

                  {/* Talk Tips */}
                  <div className="mt-8 pt-8 border-t border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Tips for Great Talks</h3>
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <div className="w-1 h-1 rounded-full bg-gray-400 mt-1.5 flex-shrink-0" />
                        <p className="text-xs text-gray-600">Use clear, descriptive titles that visitors can easily understand</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="w-1 h-1 rounded-full bg-gray-400 mt-1.5 flex-shrink-0" />
                        <p className="text-xs text-gray-600">Set competitive prices based on your expertise and market rates</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="w-1 h-1 rounded-full bg-gray-400 mt-1.5 flex-shrink-0" />
                        <p className="text-xs text-gray-600">Include all important details in your Talk description</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="w-1 h-1 rounded-full bg-gray-400 mt-1.5 flex-shrink-0" />
                        <p className="text-xs text-gray-600">Keep Talks visible to appear in search results</p>
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
      <div className="lg:hidden min-h-screen bg-gray-50 pb-20">
          <div className="px-4 py-6">
            {/* Mobile Title */}
            <div className="mb-6">
              <H2 className="mb-1">Talks</H2>
              <Text variant="small" color="secondary">Create and manage the Talks you offer to visitors</Text>
            </div>
          {/* Add Talk Button */}
          <div className={`pb-8 mb-8 ${services.length === 0 ? "mt-12" : "mt-6"} border-b border-gray-200`}>
            <DSButton
              onClick={handleCreateService}
              fullWidth
              size="large"
              variant="primary"
              icon={<Plus className="h-5 w-5" />}
            >
              Create a Talk
            </DSButton>
          </div>

          {/* Talks List */}
          {loading ? (
            <Loading variant="spinner" size="md" text="Loading Talks..." fullHeight={true} />
          ) : services.length === 0 ? (
            <div className="text-center py-12">
              <Briefcase className="h-16 w-16 mx-auto text-gray-400 mb-4" />
              <H3 className="mb-2">No Talks yet</H3>
              <Text variant="small" color="secondary" className="mb-6">Create your first Talk to start accepting bookings</Text>
            </div>
          ) : (
            <div className="space-y-4">
              {services.map((service) => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  onEdit={() => handleEditService(service)}
                  onDelete={() => setDeletingService(service)}
                  onToggleVisibility={() => handleToggleVisibility(service)}
                />
              ))}
            </div>
          )}
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
            <AlertDialogTitle>Delete Talk</AlertDialogTitle>
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
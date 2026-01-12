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
import { H2, H3, Text, Loading } from '@/design-system';
import { useSetPageTitle } from '@/contexts/PageTitleContext';
import './styles/host-dashboard.css';

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
  // Set page title for AppHeader (desktop only)
  useSetPageTitle('Talks', 'Create and manage your Talks');

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
    <div className="host-dashboard">
      {/* Desktop Content Wrapper */}
      <div className="hidden lg:block max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Desktop Layout */}
        <div className="flex gap-8">
          {/* Main Content - Services List */}
          <div className="host-main flex-1 space-y-6">
          {/* Add Service Button */}
          <div className={`pb-8 mb-8 ${services.length === 0 ? "mt-12" : "mt-6"} border-b`} style={{ borderColor: 'var(--border-subtle)' }}>
            <button
              onClick={handleCreateService}
              className="host-action-btn"
            >
              <Plus className="h-5 w-5" />
              Create a Talk
            </button>
          </div>

          {/* Talks List */}
          {loading ? (
            <Loading variant="spinner" size="md" text="Loading Talks..." fullHeight={true} />
          ) : services.length === 0 ? (
            <div className="host-empty-state">
              <Briefcase className="host-empty-state__icon" />
              <h3 className="host-empty-state__title">No Talks yet</h3>
              <p className="host-empty-state__description">
                Create your first Talk to start accepting bookings
              </p>
            </div>
          ) : (
            <div>
              {services.map((service, index) => (
                <div
                  key={service.id}
                  className={`talk-item ${service.is_visible === false ? 'talk-item--hidden' : ''}`}
                >
                  <div className="talk-item__content">
                    <div className="talk-item__info">
                      <div className="talk-item__header">
                        <h3 className="talk-item__title">{service.title}</h3>
                        {service.is_visible === false && (
                          <span className="talk-item__badge">Hidden</span>
                        )}
                      </div>

                      <p className="talk-item__description">
                        {service.description}
                      </p>

                      <div className="talk-item__meta">
                        <div className="talk-item__meta-item">
                          <Clock />
                          {service.duration_minutes} min
                        </div>
                        <div className="talk-item__meta-item">
                          <DollarSign />
                          ${service.price}
                        </div>
                        <div className="talk-item__meta-item">
                          <MapPin />
                          {getLocationDisplay(service)}
                        </div>
                        {service.timeSlots && (
                          <div className="talk-item__meta-item">
                            <Calendar />
                            {Object.keys(service.timeSlots).length} slots
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="talk-item__actions">
                      <button
                        className="talk-item__action-btn"
                        onClick={() => handleToggleVisibility(service)}
                        title={service.is_visible !== false ? 'Hide from public view' : 'Show in public view'}
                      >
                        {service.is_visible !== false ? (
                          <Eye className="w-4 h-4" />
                        ) : (
                          <EyeOff className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        className="talk-item__action-btn"
                        onClick={() => handleEditService(service)}
                        title="Edit Talk"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        className="talk-item__action-btn talk-item__action-btn--delete"
                        onClick={() => setDeletingService(service)}
                        title="Delete Talk"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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
              <div className="host-preview h-full overflow-y-auto">
                <div className="host-preview__content">
                  <div className="host-preview__header">
                    <h2 className="host-preview__title">Talks Preview</h2>
                    <p className="host-preview__subtitle">This is how your Talks appear to visitors</p>
                  </div>

                  {services.filter(service => service.is_visible !== false).length > 0 ? (
                    <div className="space-y-4">
                      {services.filter(service => service.is_visible !== false).map((service) => (
                        <div
                          key={service.id}
                          className="preview-talk-card"
                        >
                          {/* Service Header */}
                          <div className="preview-talk-card__header">
                            <h3 className="preview-talk-card__title">
                              {service.title}
                            </h3>
                            <div className="preview-talk-card__price-wrapper">
                              <div className="preview-talk-card__price">${service.price}</div>
                              <div className="preview-talk-card__duration">{service.duration_minutes} min</div>
                            </div>
                          </div>

                          {/* Service Description */}
                          <p className="preview-talk-card__description">
                            {service.description || service.short_description}
                          </p>

                          {/* Service Metadata */}
                          <div className="preview-talk-card__meta">
                            {getLocationIcon(service.is_online, !!service.location)}
                            <span>{getLocationText(service.is_online, !!service.location)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="host-empty-state">
                      <Briefcase className="host-empty-state__icon" />
                      <h3 className="host-empty-state__title">No Talks to preview</h3>
                      <p className="host-empty-state__description">Create your first Talk to see how it will appear to visitors</p>
                    </div>
                  )}

                  {/* Talk Tips */}
                  <div className="host-tips">
                    <h3 className="host-tips__title">Tips for Great Talks</h3>
                    <div className="host-tips__list">
                      <div className="host-tips__item">
                        <div className="host-tips__bullet" />
                        <p className="host-tips__text">Use clear, descriptive titles that visitors can easily understand</p>
                      </div>
                      <div className="host-tips__item">
                        <div className="host-tips__bullet" />
                        <p className="host-tips__text">Set competitive prices based on your expertise and market rates</p>
                      </div>
                      <div className="host-tips__item">
                        <div className="host-tips__bullet" />
                        <p className="host-tips__text">Include all important details in your Talk description</p>
                      </div>
                      <div className="host-tips__item">
                        <div className="host-tips__bullet" />
                        <p className="host-tips__text">Keep Talks visible to appear in search results</p>
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
          <div className="px-4 pt-4 pb-6">
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
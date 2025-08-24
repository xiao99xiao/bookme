import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Video, Users, Phone, Plus, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/PrivyAuthContext';
import { ApiClient } from '@/lib/api';
import { TimeSlotSelector } from '@/components/TimeSlotSelector';

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

export default function MyServices() {
  const { user, profile } = useWeb3Auth();
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [isServiceDialogOpen, setIsServiceDialogOpen] = useState(false);
  const [isAddingService, setIsAddingService] = useState(false);
  const [isSavingService, setIsSavingService] = useState(false);
  const [isDeletingService, setIsDeletingService] = useState(false);

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

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        const loadTimeout = setTimeout(() => {
          console.warn('Services loading timeout');
          toast.error('Services loading timed out. Please refresh the page.');
          setLoading(false);
        }, 10000);

        try {
          const [servicesData, categoriesData] = await Promise.all([
            ApiClient.getUserServices(),
            ApiClient.getCategories()
          ]);
          
          setServices(servicesData);
          setCategories(categoriesData);
          
          clearTimeout(loadTimeout);
        } catch (apiError) {
          clearTimeout(loadTimeout);
          throw apiError;
        }
      } catch (error) {
        console.error('Failed to load services:', error);
        toast.error(`Failed to load services: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

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
        savedService = await ApiClient.createService(serviceData);
        toast.success('Service created successfully');
        setServices(prevServices => [...prevServices, savedService]);
      } else if (editingService) {
        savedService = await ApiClient.updateService(editingService.id, serviceData);
        toast.success('Service updated successfully');
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
      await ApiClient.deleteService(editingService.id);
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
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading services...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="max-w-6xl mx-auto p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">My Services</h1>
            <p className="text-muted-foreground">
              Manage the services you offer to other users
            </p>
          </div>
          <Button onClick={handleAddService} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Service
          </Button>
        </div>

        {!profile?.is_provider ? (
          <div className="bg-card border rounded-lg p-8 text-center">
            <h3 className="text-lg font-semibold mb-2">Become a Service Provider</h3>
            <p className="text-muted-foreground mb-4">
              Enable service provider mode in your profile to start offering services to other users.
            </p>
            <Button variant="outline" onClick={() => window.location.href = '/dashboard/profile'}>
              Update Profile Settings
            </Button>
          </div>
        ) : services.length === 0 ? (
          <div className="bg-card border rounded-lg p-8 text-center">
            <h3 className="text-lg font-semibold mb-2">No Services Yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first service to start offering your skills to other users.
            </p>
            <Button onClick={handleAddService} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Create Your First Service
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service) => (
              <div
                key={service.id}
                className="bg-card border rounded-lg p-6 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleEditService(service)}
              >
                <div className="flex items-start justify-between mb-4">
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
                
                <h3 className="text-lg font-semibold mb-2">{service.title}</h3>
                <p className="text-sm text-muted-foreground line-clamp-3 mb-4">{service.description}</p>
                
                {service.tags && service.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {service.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {service.tags.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{service.tags.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Service Edit Dialog */}
        <Dialog open={isServiceDialogOpen} onOpenChange={setIsServiceDialogOpen}>
          <DialogContent className="max-w-[1200px] w-[90vw] max-h-[80vh] p-0 overflow-hidden">
            <div className="flex flex-col h-full max-h-[80vh]">
              <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
                <DialogTitle>
                  {isAddingService ? "Add Service" : "Edit Service"}
                </DialogTitle>
              </DialogHeader>
              
              <Form {...serviceForm}>
                <form onSubmit={serviceForm.handleSubmit(handleSaveService)} className="flex flex-col flex-1 min-h-0">
                  <div className="flex-1 flex gap-6 px-6 py-4 min-h-0 overflow-hidden">
                    {/* Left side - Service Details */}
                    <div className="w-1/2 space-y-6 overflow-y-auto pr-4 min-h-0">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={serviceForm.control}
                          name="title"
                          render={({ field }) => (
                            <FormItem className="col-span-2">
                              <FormLabel>Title</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={serviceForm.control}
                          name="category_id"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Category</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select category" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {categories.map((category) => (
                                    <SelectItem key={category.id} value={category.id}>
                                      {category.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={serviceForm.control}
                          name="is_online"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Service Type</FormLabel>
                              <Select onValueChange={(value) => field.onChange(value === "true")} defaultValue={field.value ? "true" : "false"}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="true">Online</SelectItem>
                                  <SelectItem value="false">In Person</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={serviceForm.control}
                          name="price"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Price ($)</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  type="number" 
                                  onChange={(e) => field.onChange(Number(e.target.value))}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={serviceForm.control}
                          name="duration_minutes"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Duration (minutes)</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  type="number" 
                                  onChange={(e) => field.onChange(Number(e.target.value))}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <FormField
                        control={serviceForm.control}
                        name="location"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Location (for in-person services)</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="e.g., Downtown Coffee Shop, My Office" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={serviceForm.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Textarea 
                                {...field} 
                                className="min-h-[120px]"
                                placeholder="Describe your service..."
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={serviceForm.control}
                        name="tags"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tags</FormLabel>
                            <FormControl>
                              <Input 
                                {...field}
                                placeholder="Enter tags separated by commas (e.g., coaching, wellness, productivity)"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Right side - Time Slots */}
                    <div className="w-1/2 border rounded-lg p-4 overflow-y-auto min-h-0">
                      <h3 className="text-lg font-medium mb-4">Available Time Slots</h3>
                      <FormField
                        control={serviceForm.control}
                        name="timeSlots"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <TimeSlotSelector
                                value={field.value || {}}
                                onChange={field.onChange}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                  
                  <div className="flex justify-between px-6 py-4 border-t bg-background flex-shrink-0">
                    <div>
                      {!isAddingService && (
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={handleDeleteService}
                          disabled={isDeletingService || isSavingService}
                        >
                          {isDeletingService ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Deleting...
                            </>
                          ) : (
                            'Delete Service'
                          )}
                        </Button>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsServiceDialogOpen(false)}
                        disabled={isSavingService || isDeletingService}
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="submit"
                        disabled={isSavingService || isDeletingService}
                      >
                        {isSavingService ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            {isAddingService ? "Adding..." : "Saving..."}
                          </>
                        ) : (
                          isAddingService ? "Add Service" : "Save Changes"
                        )}
                      </Button>
                    </div>
                  </div>
                </form>
              </Form>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
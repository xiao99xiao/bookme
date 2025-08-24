import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star, MapPin, Clock, Video, MessageCircle, Search, Filter, Users, Phone, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { ApiClient } from "@/lib/api";

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
  is_active: boolean;
  provider_id: string;
  created_at: string;
  updated_at: string;
  categories?: {
    name: string;
    icon?: string;
    color?: string;
  };
  users?: {
    display_name: string;
    avatar: string;
    rating: number;
    review_count: number;
  };
}

interface Category {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
}

const Discover = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load categories on mount
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const categoriesData = await ApiClient.getCategories();
        console.log('Categories loaded:', categoriesData);
        // Filter out any invalid categories
        const validCategories = categoriesData.filter(cat => cat && cat.id && cat.name);
        setCategories(validCategories);
      } catch (error) {
        console.error('Failed to load categories:', error);
        setCategories([]); // Set empty array on error
      }
    };

    loadCategories();
  }, []);

  // Load services with debouncing for search
  useEffect(() => {
    const loadServices = async () => {
      try {
        setLoading(true);
        const servicesData = await ApiClient.getServices({
          search: searchTerm || undefined,
          category: selectedCategory === "all" ? undefined : selectedCategory,
          sortBy: 'created_at',
          sortOrder: 'desc',
          limit: 50
        });
        
        setServices(servicesData.services);
        setError(null);
      } catch (error) {
        console.error('Failed to load services:', error);
        setError('Failed to load services. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    // Debounce search input
    const timeoutId = setTimeout(() => {
      loadServices();
    }, searchTerm ? 300 : 0);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, selectedCategory]);

  const handleServiceClick = (service: Service) => {
    // Navigate to the provider's profile page with the service pre-selected
    navigate(`/profile/${service.provider_id}?service=${service.id}`);
  };

  const getLocationIcon = (isOnline: boolean, hasLocation: boolean) => {
    if (isOnline) return <Video className="h-4 w-4" />;
    if (hasLocation) return <Users className="h-4 w-4" />;
    return <Phone className="h-4 w-4" />;
  };

  const getLocationText = (isOnline: boolean, hasLocation: boolean) => {
    if (isOnline) return "Online";
    if (hasLocation) return "In Person";
    return "Phone Call";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header Section */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl lg:text-5xl font-bold mb-6">
              Discover Expert Services
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
              Browse thousands of professionals offering their expertise. Find the perfect expert for your needs and book instantly with secure payment protection.
            </p>
          </div>

          {/* Search and Filter Section */}
          <div className="max-w-4xl mx-auto mb-8">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                <Input
                  placeholder="Search services, providers, skills, or locations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-12 text-lg"
                />
              </div>
              <div className="flex gap-2">
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-[200px] h-12">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories
                      .filter((category) => category && category.id && category.name)
                      .map((category) => (
                        <SelectItem key={category.id} value={category.name}>
                          {category.name}
                        </SelectItem>
                      ))
                    }
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Results Count */}
          <div className="text-center mb-6">
            <p className="text-muted-foreground">
              {loading ? 'Loading services...' : (
                <>
                  Showing {services.length} service{services.length !== 1 ? 's' : ''}
                  {selectedCategory && selectedCategory !== "all" && ` in ${selectedCategory}`}
                </>
              )}
            </p>
          </div>
        </div>
      </section>

      {/* Services Grid */}
      <section className="pb-8 px-4">
        <div className="max-w-6xl mx-auto">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-500 text-lg mb-4">{error}</p>
              <Button 
                variant="outline" 
                onClick={() => window.location.reload()}
              >
                Try Again
              </Button>
            </div>
          ) : (
            <>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {services.map((service) => (
                  <Card 
                    key={service.id} 
                    className="hover:shadow-lg transition-shadow duration-300 flex flex-col h-full cursor-pointer"
                    onClick={() => handleServiceClick(service)}
                  >
                    <CardHeader className="pb-4">
                      <div className="flex items-start gap-3 mb-3">
                        <Avatar className="w-12 h-12">
                          <AvatarImage src={service.users?.avatar || ""} />
                          <AvatarFallback>
                            {service.users?.display_name?.charAt(0) || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="font-semibold text-sm">
                            {service.users?.display_name || "Unknown Provider"}
                          </p>
                          <div className="flex items-center gap-1 mt-1">
                            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                            <span className="text-sm font-medium">
                              {service.users?.rating.toFixed(1) || "0.0"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              ({service.users?.review_count || 0})
                            </span>
                          </div>
                          {service.location && (
                            <div className="flex items-center gap-1 mt-1">
                              <MapPin className="w-3 h-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">{service.location}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <CardTitle className="text-lg leading-tight">{service.title}</CardTitle>
                    </CardHeader>
                    
                    <CardContent className="space-y-4 flex-1 flex flex-col">
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {service.short_description || service.description}
                        </p>
                      </div>
                      
                      <div className="space-y-3 mt-auto">
                        {service.tags && service.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {service.tags.slice(0, 3).map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                        
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>{service.duration_minutes}min</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {getLocationIcon(service.is_online, !!service.location)}
                            <span>{getLocationText(service.is_online, !!service.location)}</span>
                          </div>
                          {service.categories && (
                            <Badge variant="outline" className="text-xs">
                              {service.categories.name}
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex items-center justify-between pt-2">
                          <div className="text-lg font-bold">
                            ${service.price}
                            <span className="text-sm font-normal text-muted-foreground">
                              /{service.duration_minutes}min
                            </span>
                          </div>
                          <Button size="sm" onClick={(e) => { e.stopPropagation(); handleServiceClick(service); }}>
                            Book Now
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              {services.length === 0 && !loading && (
                <div className="text-center py-12">
                  <p className="text-muted-foreground text-lg mb-4">
                    No services found matching your criteria.
                  </p>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setSearchTerm("");
                      setSelectedCategory("all");
                    }}
                  >
                    Clear Filters
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 bg-primary/5">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Want to Offer Your Services?</h2>
          <p className="text-lg text-muted-foreground mb-6">
            Join thousands of professionals earning by sharing their expertise. Start building your income stream today.
          </p>
          <Button asChild size="lg" className="text-lg px-8">
            <Link to="/auth">Become a Service Provider</Link>
          </Button>
        </div>
      </section>
    </div>
  );
};

export default Discover;
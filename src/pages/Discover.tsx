import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button as DSButton, ServiceDiscoverCard, Container, Grid } from "@/design-system";
import { Badge as DSBadge } from "@/design-system";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter } from "lucide-react";
import { Link } from "react-router-dom";
import { ApiClient } from "@/lib/api-migration";
import { useAuth } from "@/contexts/PrivyAuthContext";
import { getBrowserTimezone } from "@/lib/timezone";
import { toast } from "sonner";
import { H1, H2, Text, Description, Loading } from "@/design-system";

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
  const { profile } = useAuth();
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
        // Get viewer's timezone to properly display service time slots
        const viewerTimezone = profile?.timezone || getBrowserTimezone();
        const filters: any = {
          viewerTimezone,
          sortBy: 'created_at',
          sortOrder: 'desc',
          limit: 50
        };
        
        // Only add search if it has a value
        if (searchTerm && searchTerm.trim()) {
          filters.search = searchTerm.trim();
        }
        
        // Only add category if it's not "all"
        if (selectedCategory && selectedCategory !== "all") {
          filters.category = selectedCategory;
        }
        
        const servicesData = await ApiClient.getServices(filters);
        
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

  const handleServiceClick = async (service: Service) => {
    // Navigate to the provider's profile page with the service pre-selected
    const { navigateToUserProfile } = await import('@/lib/username');
    const success = await navigateToUserProfile(service.provider_id, (path) => navigate(`${path}?service=${service.id}`));
    if (!success) {
      toast.error('This provider does not have a public profile');
    }
  };


  return (
    <div>
      {/* Header Section */}
      <section className="py-16 px-4 bg-muted/30">
        <Container maxWidth="lg">
          <div className="text-center mb-12">
            <H1 className="mb-6">
              Discover Expert Services
            </H1>
            <Text variant="medium" color="secondary" className="max-w-3xl mx-auto mb-8">
              Browse thousands of professionals offering their expertise. Find the perfect expert for your needs and book instantly with secure payment protection.
            </Text>
          </div>

          {/* Search and Filter Section */}
          <Container maxWidth="md" className="mb-8">
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
          </Container>

          {/* Results Count */}
          <div className="text-center mb-6">
            <Text color="secondary">
              {loading ? 'Loading services...' : (
                <>
                  Showing {services.length} service{services.length !== 1 ? 's' : ''}
                  {selectedCategory && selectedCategory !== "all" && ` in ${selectedCategory}`}
                </>
              )}
            </Text>
          </div>
        </Container>
      </section>

      {/* Services Grid */}
      <section className="pb-8 px-4 flex-1 flex flex-col min-h-[400px]">
        <Container maxWidth="lg" className="flex-1 flex flex-col">
          {loading ? (
            <Loading variant="spinner" size="md" text="Loading services..." fullHeight={true} />
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-500 text-lg mb-4">{error}</p>
              <DSButton 
                variant="secondary" 
                onClick={() => window.location.reload()}
              >
                Try Again
              </DSButton>
            </div>
          ) : (
            <>
              <Grid columns={3} spacing="lg">
                {services.map((service) => (
                  <ServiceDiscoverCard
                    key={service.id}
                    service={service}
                    onClick={handleServiceClick}
                    onBookClick={handleServiceClick}
                  />
                ))}
              </Grid>
              
              {services.length === 0 && !loading && (
                <div className="text-center py-12">
                  <p className="text-muted-foreground text-lg mb-4">
                    No services found matching your criteria.
                  </p>
                  <DSButton 
                    variant="secondary" 
                    onClick={() => {
                      setSearchTerm("");
                      setSelectedCategory("all");
                    }}
                  >
                    Clear Filters
                  </DSButton>
                </div>
              )}
            </>
          )}
        </Container>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 bg-primary/5">
        <Container maxWidth="md" className="text-center">
          <H2 className="mb-4">Want to Offer Your Services?</H2>
          <p className="text-lg text-muted-foreground mb-6">
            Join thousands of professionals earning by sharing their expertise. Start building your income stream today.
          </p>
          <DSButton as={Link} to="/auth" size="large" className="text-lg px-8">
            Become a Service Provider
          </DSButton>
        </Container>
      </section>
    </div>
  );
};

export default Discover;
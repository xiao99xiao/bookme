import { Star, MapPin, Clock, Video, Users, Phone } from 'lucide-react';
import { Card, Stack, Text, Button, Badge } from '@/design-system';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface ServiceDiscoverCardProps {
  service: {
    id: string;
    title: string;
    description: string;
    short_description?: string;
    category_id?: string;
    price: number;
    duration_minutes: number;
    location?: string;
    is_online: boolean;
    tags?: string[];
    provider?: {
      display_name: string;
      avatar: string;
      rating: number;
      review_count: number;
    };
    users?: {
      display_name: string;
      avatar: string;
      rating: number;
      review_count: number;
    };
    categories?: {
      name: string;
      icon?: string;
      color?: string;
    };
  };
  onClick?: (service: any) => void;
  onBookClick?: (service: any) => void;
}

export function ServiceDiscoverCard({ 
  service, 
  onClick, 
  onBookClick 
}: ServiceDiscoverCardProps) {
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

  const provider = service.provider || service.users;

  return (
    <Card 
      padding="none"
      radius="lg"
      className="hover:shadow-lg transition-shadow duration-300 flex flex-col h-full cursor-pointer"
      onClick={() => onClick?.(service)}
    >
      <Stack spacing="none" className="h-full">
        {/* Header */}
        <div className="p-6 pb-4">
          <Stack spacing="md">
            {/* Provider Info */}
            <Stack direction="row" spacing="md" align="start">
              <Avatar className="w-12 h-12">
                <AvatarImage src={provider?.avatar || ""} />
                <AvatarFallback>
                  {(provider?.display_name || "U").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <Stack spacing="xs" className="flex-1">
                <Text variant="small" weight="semibold">
                  {provider?.display_name || "Unknown Provider"}
                </Text>
                <Stack direction="row" spacing="xs" align="center">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <Text variant="small" weight="medium">
                    {(provider?.rating || 0).toFixed(1)}
                  </Text>
                  <Text variant="tiny" color="tertiary">
                    ({provider?.review_count || 0})
                  </Text>
                </Stack>
                {service.location && (
                  <Stack direction="row" spacing="xs" align="center">
                    <MapPin className="w-3 h-3 text-muted-foreground" />
                    <Text variant="tiny" color="tertiary">{service.location}</Text>
                  </Stack>
                )}
              </Stack>
            </Stack>

            {/* Service Title */}
            <Text variant="large" weight="semibold" className="leading-tight">
              {service.title}
            </Text>
          </Stack>
        </div>

        {/* Content */}
        <div className="px-6 pb-6 flex-1 flex flex-col">
          <Stack spacing="lg" className="h-full">
            {/* Description */}
            <div className="flex-1">
              <Text variant="small" color="secondary" className="leading-relaxed">
                {service.short_description || service.description}
              </Text>
            </div>

            {/* Tags, Details, and Action */}
            <Stack spacing="md" className="mt-auto">
              {/* Tags */}
              {service.tags && service.tags.length > 0 && (
                <Stack direction="row" spacing="xs" wrap>
                  {service.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="secondary" size="small">
                      {tag}
                    </Badge>
                  ))}
                </Stack>
              )}

              {/* Service Details */}
              <Stack direction="row" spacing="lg" align="center">
                <Stack direction="row" spacing="xs" align="center">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <Text variant="small" color="secondary">{service.duration_minutes}min</Text>
                </Stack>
                <Stack direction="row" spacing="xs" align="center">
                  {getLocationIcon(service.is_online, !!service.location)}
                  <Text variant="small" color="secondary">
                    {getLocationText(service.is_online, !!service.location)}
                  </Text>
                </Stack>
                {service.categories && (
                  <Badge variant="outline" size="small">
                    {service.categories.name}
                  </Badge>
                )}
              </Stack>

              {/* Price and Book Button */}
              <Stack direction="row" justify="between" align="center" className="pt-2">
                <Stack direction="row" spacing="xs" align="baseline">
                  <Text variant="large" weight="bold">
                    ${service.price}
                  </Text>
                  <Text variant="small" color="secondary">
                    /{service.duration_minutes}min
                  </Text>
                </Stack>
                <Button 
                  size="small" 
                  variant="primary" 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    onBookClick?.(service); 
                  }}
                >
                  Book Now
                </Button>
              </Stack>
            </Stack>
          </Stack>
        </div>
      </Stack>
    </Card>
  );
}
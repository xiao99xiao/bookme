import { Video, Users, Phone } from 'lucide-react';
import { Card, Stack, Text, Badge } from '@/design-system';

interface ServiceProfileCardProps {
  service: {
    id: string;
    title: string;
    description: string;
    price: number;
    duration_minutes: number;
    location?: string;
    is_online: boolean;
    tags?: string[];
    categories?: {
      name: string;
      icon?: string;
      color?: string;
    };
  };
  onClick?: (service: any) => void;
}

export function ServiceProfileCard({ 
  service, 
  onClick 
}: ServiceProfileCardProps) {
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
    <Card 
      padding="lg"
      radius="lg"
      className="transition-colors cursor-pointer hover:bg-muted/50"
      onClick={() => onClick?.(service)}
    >
      <Stack spacing="md">
        {/* Header Row */}
        <Stack direction="row" justify="between" align="start">
          {/* Left: Category and Location */}
          <Stack direction="row" spacing="sm" align="center">
            <Badge variant="secondary" size="small">
              {service.categories?.name || 'General'}
            </Badge>
            <Stack direction="row" spacing="xs" align="center">
              {getLocationIcon(service.is_online, !!service.location)}
              <Text variant="tiny" color="tertiary">
                {getLocationText(service.is_online, !!service.location)}
              </Text>
            </Stack>
          </Stack>
          
          {/* Right: Price and Duration */}
          <Stack align="end" spacing="xs">
            <Text variant="small" weight="medium">${service.price}</Text>
            <Text variant="tiny" color="tertiary">{service.duration_minutes}m</Text>
          </Stack>
        </Stack>
        
        {/* Service Title */}
        <Text variant="small" weight="medium">
          {service.title}
        </Text>
        
        {/* Description */}
        <Text variant="tiny" color="tertiary" className="line-clamp-2">
          {service.description}
        </Text>
        
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
      </Stack>
    </Card>
  );
}
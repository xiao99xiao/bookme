import { Eye, EyeOff, Edit2, Trash2, Clock, DollarSign, MapPin, Calendar, Video, Home } from 'lucide-react';
import { Card, Stack, Grid, Text, Button, Badge } from '@/design-system';

interface Service {
  id: string;
  title: string;
  description: string;
  short_description?: string;
  price: number;
  duration_minutes: number;
  location?: string;
  is_online: boolean;
  meeting_platform?: string;
  is_visible: boolean;
  timeSlots?: { [key: string]: boolean };
}

interface ServiceCardProps {
  service: Service;
  onEdit?: (service: Service) => void;
  onDelete?: (service: Service) => void;
  onToggleVisibility?: (service: Service) => void;
  showActions?: boolean;
  variant?: 'full' | 'preview';
}

export function ServiceCard({ 
  service, 
  onEdit, 
  onDelete, 
  onToggleVisibility,
  showActions = true,
  variant = 'full'
}: ServiceCardProps) {
  const getLocationDisplay = () => {
    if (service.is_online) {
      return { icon: Video, text: 'Online' };
    }
    return { icon: Home, text: service.location || 'In-Person' };
  };

  const { icon: LocationIcon, text: locationText } = getLocationDisplay();
  const slotsCount = service.timeSlots ? Object.keys(service.timeSlots).length : 0;

  if (variant === 'preview') {
    return (
      <Card padding="lg" radius="lg">
        <Stack spacing="lg">
          {/* Title and Description */}
          <Stack spacing="sm">
            <Text variant="medium" weight="semibold">{service.title}</Text>
            <Text variant="tiny" color="tertiary" className="line-clamp-2">
              {service.description}
            </Text>
          </Stack>

          {/* Bottom Row */}
          <Stack direction="row" justify="between" align="center">
            <Badge variant="default" icon={<LocationIcon className="w-4 h-4" />}>
              {locationText}
            </Badge>
            
            <Stack direction="row" spacing="xs" align="baseline">
              <Text variant="medium" weight="semibold">
                ${service.price}
              </Text>
              <Text variant="tiny" color="secondary">
                / {service.duration_minutes}min
              </Text>
            </Stack>
          </Stack>
        </Stack>
      </Card>
    );
  }

  return (
    <Card padding="xl" radius="lg">
      <Stack spacing="lg">
        {/* Header with Title and Actions */}
        <Stack direction="row" justify="between" align="start" spacing="xl">
          <Stack spacing="xs" className="flex-1">
            <Text variant="medium" weight="semibold">{service.title}</Text>
            <Text variant="tiny" color="tertiary" className="line-clamp-2">
              {service.description}
            </Text>
          </Stack>

          {showActions && (
            <Stack direction="row" spacing="md">
              <Button
                variant="tertiary"
                size="small"
                icon={service.is_visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                iconPosition="only"
                onClick={() => onToggleVisibility?.(service)}
                className="rounded-full p-2.5"
              />
              <Button
                variant="tertiary"
                size="small"
                icon={<Edit2 className="w-4 h-4" />}
                iconPosition="only"
                onClick={() => onEdit?.(service)}
                className="rounded-full p-2.5"
              />
              <Button
                variant="tertiary"
                size="small"
                icon={<Trash2 className="w-4 h-4 text-red-500" />}
                iconPosition="only"
                onClick={() => onDelete?.(service)}
                className="rounded-full p-2.5"
              />
            </Stack>
          )}
        </Stack>

        {/* Service Details */}
        <Stack direction="row" spacing="sm">
          <Badge 
            variant="default" 
            icon={<Clock className="w-4 h-4" />}
          >
            {service.duration_minutes} min
          </Badge>
          
          <Badge 
            variant="default" 
            icon={<DollarSign className="w-4 h-4" />}
          >
            {service.price}
          </Badge>
          
          <Badge 
            variant="default" 
            icon={<LocationIcon className="w-4 h-4" />}
          >
            {locationText}
          </Badge>
          
          {slotsCount > 0 && (
            <Badge 
              variant="default" 
              icon={<Calendar className="w-4 h-4" />}
            >
              {slotsCount} slots
            </Badge>
          )}
        </Stack>
      </Stack>
    </Card>
  );
}
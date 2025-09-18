import { Video, Users, Home } from "lucide-react";
import { Text } from '@/design-system';

interface Service {
  id: string;
  title: string;
  description: string;
  price: number;
  duration_minutes: number;
  location?: string;
  is_online: boolean;
  categories?: {
    name: string;
    icon?: string;
    color?: string;
  };
}

interface SimpleServiceCardProps {
  service: Service;
  onClick?: (service: Service) => void;
}

export function SimpleServiceCard({ service, onClick }: SimpleServiceCardProps) {
  const getLocationIcon = (isOnline: boolean, hasLocation: boolean) => {
    if (isOnline) return <Video className="h-5 w-5" />;
    if (hasLocation) return <Home className="h-5 w-5" />;
    return <Users className="h-5 w-5" />;
  };

  const getLocationText = (isOnline: boolean, hasLocation: boolean) => {
    if (isOnline) return "Online";
    if (hasLocation) return "Offline";
    return "Phone";
  };

  return (
    <div 
      className="bg-white border border-[#eeeeee] rounded-[16px] p-4 cursor-pointer transition-colors hover:bg-gray-50"
      onClick={() => onClick?.(service)}
    >
      <div className="flex flex-col gap-6">
        {/* Title and Description */}
        <div className="flex flex-col">
          <Text className="font-body text-[18px] font-semibold text-black leading-[1.5]">
            {service.title}
          </Text>
          <Text className="font-body text-[12px] font-normal text-[#aaaaaa] leading-[1.5]">
            {service.description}
          </Text>
        </div>
        
        {/* Bottom Row: Location and Price */}
        <div className="flex items-center justify-between">
          {/* Location */}
          <div className="bg-[#f3f3f3] flex gap-1 items-center px-2 py-1 rounded-[8px]">
            {getLocationIcon(service.is_online, !!service.location)}
            <Text className="font-body text-[14px] font-normal text-[#666666] leading-[1.5] whitespace-nowrap">
              {getLocationText(service.is_online, !!service.location)}
            </Text>
          </div>
          
          {/* Price and Duration */}
          <div className="flex gap-1 items-baseline">
            <Text className="font-body text-[18px] font-semibold text-black leading-[1.5] whitespace-nowrap">
              ${service.price}
            </Text>
            <Text className="font-body text-[12px] font-normal text-[#666666] leading-[1.5] whitespace-nowrap">
              / {service.duration_minutes}min
            </Text>
          </div>
        </div>
      </div>
    </div>
  );
}
import { ReactNode } from 'react';
import { CheckCircle, XCircle, Clock, AlertCircle, Calendar, Home, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';

// Badge variant types based on Figma design
export type BadgeVariant = 'status' | 'info' | 'outline';
export type BadgeSize = 'small' | 'medium';

// Status-specific types
export type BookingStatus = 'pending' | 'paid' | 'confirmed' | 'completed' | 'cancelled' | 'in_progress';
export type MeetingStatus = 'live' | 'starting_soon' | 'scheduled' | 'ended';

export interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  children: ReactNode;
  className?: string;
  animated?: boolean;
}

// Base Badge component matching Figma design exactly
export function Badge({
  variant = 'info',
  size = 'medium',
  children,
  className,
  animated = false
}: BadgeProps) {
  const baseClasses = 'inline-flex items-center gap-1 font-body font-normal text-[14px] leading-[1.5] rounded-[8px]';
  
  const sizeClasses = {
    small: 'px-1 py-0.5',
    medium: 'px-1.5 py-1'
  };

  const variantClasses = {
    status: 'bg-[#eff7ff] text-black',      // Status badges: light blue background
    info: 'bg-[#f3f3f3] text-[#666666]',   // Info badges: light grey background  
    outline: 'border border-[#eeeeee] bg-white text-[#666666]'
  };

  return (
    <div
      className={cn(
        baseClasses,
        sizeClasses[size],
        variantClasses[variant],
        animated && 'animate-pulse',
        className
      )}
    >
      {children}
    </div>
  );
}

// Status Badge for booking states (blue background like Figma)
export interface StatusBadgeProps {
  status: BookingStatus;
  size?: BadgeSize;
  className?: string;
}

export function StatusBadge({ status, size = 'medium', className }: StatusBadgeProps) {
  const getStatusContent = (status: BookingStatus) => {
    switch (status) {
      case 'pending':
        return {
          icon: <span className="w-2 h-2 bg-[#FFD43C] rounded-full" />,
          label: 'Pending',
          bgColor: 'bg-[#fcf9f4]',
          textColor: 'text-[#B8860B]'
        };
      case 'paid':
        return {
          icon: <CheckCircle className="w-5 h-5 text-[#36D267]" />,
          label: 'Paid',
          bgColor: 'bg-[#e7fded]',
          textColor: 'text-black'
        };
      case 'confirmed':
        return {
          icon: <CheckCircle className="w-5 h-5 text-[#3B9EF9]" />,
          label: 'Confirmed',
          bgColor: 'bg-[#eff7ff]',
          textColor: 'text-black'
        };
      case 'in_progress':
        return {
          icon: <CheckCircle className="w-5 h-5 text-[#3B9EF9]" />,
          label: 'In Progress',
          bgColor: 'bg-[#eff7ff]',
          textColor: 'text-black'
        };
      case 'completed':
        return {
          icon: <CheckCircle className="w-5 h-5 text-[#36D267]" />,
          label: 'Completed',
          bgColor: 'bg-[#e7fded]',
          textColor: 'text-black'
        };
      case 'cancelled':
        return {
          icon: <XCircle className="w-5 h-5 text-[#F1343D]" />,
          label: 'Cancelled',
          bgColor: 'bg-[#ffeff0]',
          textColor: 'text-black'
        };
      default:
        return {
          icon: null,
          label: status,
          bgColor: 'bg-[#f3f3f3]',
          textColor: 'text-[#666666]'
        };
    }
  };

  const content = getStatusContent(status);

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 font-body font-normal text-[14px] leading-[1.5] rounded-[8px] px-1.5 py-1',
        content.bgColor,
        content.textColor,
        size === 'small' && 'px-1 py-0.5',
        className
      )}
    >
      {content.icon}
      <span>{content.label}</span>
    </div>
  );
}

// Online/Offline Badge (grey background like Figma)
export interface OnlineBadgeProps {
  isOnline: boolean;
  size?: BadgeSize;
  className?: string;
}

export function OnlineBadge({ isOnline, size = 'medium', className }: OnlineBadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 font-body font-normal text-[14px] leading-[1.5] rounded-[8px] px-1.5 py-1 bg-[#f3f3f3] text-[#666666]',
        size === 'small' && 'px-1 py-0.5',
        className
      )}
    >
      {isOnline ? (
        <>
          <Monitor className="w-5 h-5" />
          <span>Online</span>
        </>
      ) : (
        <>
          <Home className="w-5 h-5" />
          <span>Offline</span>
        </>
      )}
    </div>
  );
}

// Duration Badge (grey background like Figma)
export interface DurationBadgeProps {
  minutes: number;
  size?: BadgeSize;
  className?: string;
}

export function DurationBadge({ minutes, size = 'medium', className }: DurationBadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 font-body font-normal text-[14px] leading-[1.5] rounded-[8px] px-1.5 py-1 bg-[#f3f3f3] text-[#666666]',
        size === 'small' && 'px-1 py-0.5',
        className
      )}
    >
      <Calendar className="w-5 h-5" />
      <span>{minutes} min</span>
    </div>
  );
}

// Meeting Status Badge (for live meetings)
export interface MeetingStatusBadgeProps {
  status: MeetingStatus;
  size?: BadgeSize;
  className?: string;
}

export function MeetingStatusBadge({ status, size = 'medium', className }: MeetingStatusBadgeProps) {
  const getStatusContent = (status: MeetingStatus) => {
    switch (status) {
      case 'live':
        return {
          icon: <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />,
          label: 'LIVE',
          bgColor: 'bg-red-100',
          textColor: 'text-red-700',
          animated: true
        };
      case 'starting_soon':
        return {
          icon: <Clock className="w-3 h-3" />,
          label: 'Starting soon',
          bgColor: 'bg-green-100',
          textColor: 'text-green-700',
          animated: false
        };
      case 'scheduled':
        return {
          icon: <Clock className="w-3 h-3" />,
          label: 'Scheduled',
          bgColor: 'bg-[#f3f3f3]',
          textColor: 'text-[#666666]',
          animated: false
        };
      case 'ended':
        return {
          icon: <XCircle className="w-4 h-4" />,
          label: 'Ended',
          bgColor: 'bg-[#f3f3f3]',
          textColor: 'text-[#666666]',
          animated: false
        };
      default:
        return {
          icon: null,
          label: status,
          bgColor: 'bg-[#f3f3f3]',
          textColor: 'text-[#666666]',
          animated: false
        };
    }
  };

  const content = getStatusContent(status);

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 font-body font-normal text-[14px] leading-[1.5] rounded-[8px] px-1.5 py-1',
        content.bgColor,
        content.textColor,
        size === 'small' && 'px-1 py-0.5',
        content.animated && 'animate-pulse',
        className
      )}
    >
      {content.icon}
      <span>{content.label}</span>
    </div>
  );
}

// Legacy exports for backward compatibility
export { StatusBadge as BookingStatusBadge };

// Transaction and Integration badges
export function TransactionStatusBadge({ status, ...props }: { status: string } & Omit<StatusBadgeProps, 'status'>) {
  const mappedStatus = status === 'failed' ? 'cancelled' : status as BookingStatus;
  return <StatusBadge status={mappedStatus} {...props} />;
}

export function IntegrationStatusBadge({ status, ...props }: { status: string } & Omit<StatusBadgeProps, 'status'>) {
  const mappedStatus = status === 'connected' ? 'completed' : 
                      status === 'expired' ? 'pending' : 'cancelled';
  return <StatusBadge status={mappedStatus as BookingStatus} {...props} />;
}
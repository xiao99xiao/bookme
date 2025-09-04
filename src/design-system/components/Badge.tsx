import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { tokens } from '../tokens';

interface BadgeProps {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'secondary' | 'outline' | 'yellow';
  size?: 'small' | 'medium';
  icon?: ReactNode;
}

export function Badge({ 
  children, 
  className, 
  variant = 'default',
  size = 'medium',
  icon 
}: BadgeProps) {
  const baseClasses = cn(
    'inline-flex items-center font-normal',
    'whitespace-nowrap'
  );

  const variantClasses = {
    default: 'bg-brandLightGrey text-textSecondary',
    secondary: 'bg-brandLightYellow text-textSecondary', 
    outline: 'bg-transparent text-textSecondary border border-neutralLightest',
    yellow: 'bg-brandYellow text-textPrimary',
  };

  const sizeClasses = {
    small: 'px-2 py-1 text-xs',
    medium: 'px-2 py-1 text-sm',
  };

  return (
    <span
      className={cn(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      style={{
        borderRadius: tokens.borderRadius.sm,
        fontFamily: tokens.fonts.body,
        gap: icon ? tokens.spacing.xs : '0',
      }}
    >
      {icon && icon}
      {children}
    </span>
  );
}
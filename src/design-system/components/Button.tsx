import { ReactNode, ButtonHTMLAttributes, ElementType } from 'react';
import { cn } from '@/lib/utils';
import { tokens } from '../tokens';

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'size'> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'tertiary' | 'link' | 'success' | 'warning' | 'danger' | 'outline';
  size?: 'small' | 'medium' | 'large';
  icon?: ReactNode;
  iconPosition?: 'leading' | 'trailing' | 'only';
  fullWidth?: boolean;
  as?: ElementType;
}

export function Button({ 
  children, 
  className,
  variant = 'primary',
  size = 'medium',
  icon,
  iconPosition = 'leading',
  fullWidth = false,
  disabled,
  as: Component = 'button',
  ...props 
}: ButtonProps) {
  const baseClasses = cn(
    'inline-flex items-center justify-center font-semibold transition-colors rounded-[12px] relative',
    'focus:outline-none focus:ring-2 focus:ring-offset-2',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    fullWidth && 'w-full'
  );

  const variantClasses = {
    primary: cn(
      'bg-black text-white border border-black',
      'hover:bg-gray-900 focus:ring-gray-900'
    ),
    secondary: cn(
      'bg-white text-black border border-neutralLightest',
      'hover:bg-gray-50 focus:ring-gray-500'
    ),
    tertiary: cn(
      'bg-transparent text-textSecondary border border-transparent',
      'hover:text-textPrimary hover:bg-gray-50 focus:ring-gray-500'
    ),
    link: cn(
      'bg-transparent text-textSecondary border-none p-0 h-auto',
      'hover:text-textPrimary underline focus:ring-gray-500'
    ),
    success: cn(
      'bg-[#36d267] text-white text-[14px] font-body',
      'hover:bg-[#2eb858] focus:ring-[#36d267]',
      'after:content-[""] after:absolute after:border after:border-[#cccccc] after:border-solid after:inset-[-1px] after:pointer-events-none after:rounded-[13px]'
    ),
    warning: cn(
      'bg-[#FF9500] text-white border border-[#FF9500]',
      'hover:bg-[#e6851a] focus:ring-[#FF9500]'
    ),
    danger: cn(
      'bg-transparent text-[#F1343D] border border-transparent',
      'hover:bg-[#ffeff0] focus:ring-[#F1343D]'
    ),
    outline: cn(
      'bg-white text-[#666666] border border-[#cccccc]',
      'hover:bg-gray-50 focus:ring-gray-400'
    ),
  };

  const sizeClasses = {
    small: cn('px-2 py-1.5 text-sm gap-2', variant === 'success' ? 'text-[14px]' : ''),
    medium: cn('h-12 text-base', variant !== 'link' && 'px-6'),
    large: cn('h-14 text-lg', variant !== 'link' && 'px-8'),
  };

  const radiusStyle = {};

  // Handle icon-only buttons
  if (iconPosition === 'only') {
    return (
      <Component
        className={cn(
          baseClasses,
          variantClasses[variant],
          sizeClasses[size],
          'aspect-square',
          className
        )}
        style={radiusStyle}
        disabled={disabled}
        {...props}
      >
        {icon}
      </Component>
    );
  }

  return (
    <Component
      className={cn(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      style={{
        ...radiusStyle,
        fontFamily: tokens.fonts.body,
        gap: icon ? tokens.spacing.sm : '0',
      }}
      disabled={disabled}
      {...props}
    >
      {icon && iconPosition === 'leading' && icon}
      {children}
      {icon && iconPosition === 'trailing' && icon}
    </Component>
  );
}
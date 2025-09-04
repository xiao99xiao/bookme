import { ReactNode, ButtonHTMLAttributes, ElementType } from 'react';
import { cn } from '@/lib/utils';
import { tokens } from '../tokens';

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'size'> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'tertiary' | 'link';
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
    'inline-flex items-center justify-center font-semibold transition-colors',
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
  };

  const sizeClasses = {
    small: cn('h-8 text-sm', variant !== 'link' && 'px-3'),
    medium: cn('h-12 text-base', variant !== 'link' && 'px-6'),
    large: cn('h-14 text-lg', variant !== 'link' && 'px-8'),
  };

  const radiusStyle = variant !== 'link' ? { borderRadius: tokens.borderRadius.pill } : {};

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
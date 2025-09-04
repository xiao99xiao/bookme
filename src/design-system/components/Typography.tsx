import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { tokens } from '../tokens';

interface TypographyProps {
  children: ReactNode;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
}

// Heading Components
export function Heading({ children, className, as: Component = 'h1', ...props }: TypographyProps) {
  return (
    <Component
      className={cn(
        'font-heading font-bold text-textPrimary leading-tight',
        'text-[20px]', // H6 from design system
        className
      )}
      style={{ fontFamily: tokens.fonts.heading }}
      {...props}
    >
      {children}
    </Component>
  );
}

// Body Text Components
interface TextProps extends TypographyProps {
  variant?: 'regular' | 'small' | 'tiny' | 'medium';
  weight?: 'regular' | 'medium' | 'semibold';
  color?: 'primary' | 'secondary' | 'tertiary' | 'alternate';
}

export function Text({ 
  children, 
  className, 
  as: Component = 'p',
  variant = 'regular',
  weight = 'regular',
  color = 'primary',
  ...props 
}: TextProps) {
  const colorClasses = {
    primary: 'text-textPrimary',
    secondary: 'text-textSecondary',
    tertiary: 'text-textTertiary',
    alternate: 'text-textAlternate',
  };

  const sizeClasses = {
    tiny: 'text-[12px]',
    small: 'text-[14px]',
    regular: 'text-[16px]',
    medium: 'text-[18px]',
  };

  const weightClasses = {
    regular: 'font-normal',
    medium: 'font-medium',
    semibold: 'font-semibold',
  };

  return (
    <Component
      className={cn(
        'font-body leading-normal',
        sizeClasses[variant],
        weightClasses[weight],
        colorClasses[color],
        className
      )}
      style={{ fontFamily: tokens.fonts.body }}
      {...props}
    >
      {children}
    </Component>
  );
}

// Semantic Components
export function Label({ children, className, ...props }: TypographyProps) {
  return (
    <Text
      as="label"
      variant="small"
      color="secondary"
      className={cn('block', className)}
      {...props}
    >
      {children}
    </Text>
  );
}

export function Description({ children, className, ...props }: TypographyProps) {
  return (
    <Text
      variant="tiny"
      color="tertiary"
      className={cn(className)}
      {...props}
    >
      {children}
    </Text>
  );
}
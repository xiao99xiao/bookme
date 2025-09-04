import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { tokens } from '../tokens';

interface TypographyProps {
  children: ReactNode;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
}

// Heading Components with proper hierarchy
interface HeadingProps extends TypographyProps {
  level?: 1 | 2 | 3 | 4 | 5 | 6;
}

export function Heading({ children, className, as, level, ...props }: HeadingProps) {
  // Determine component type based on level or as prop
  const Component = as || `h${level || 1}` as keyof JSX.IntrinsicElements;
  
  // Define heading sizes based on level
  const headingSizes = {
    1: 'text-4xl sm:text-5xl lg:text-6xl', // Hero headings
    2: 'text-3xl sm:text-4xl',            // Section headings  
    3: 'text-2xl sm:text-3xl',            // Subsection headings
    4: 'text-xl sm:text-2xl',             // Card/Component headings
    5: 'text-lg sm:text-xl',              // Small headings
    6: 'text-[20px]',                     // Smallest headings (design system base)
  };
  
  const currentLevel = level || (Component.toString().match(/h(\d)/) ? parseInt(Component.toString().match(/h(\d)/)![1]) : 1) as 1 | 2 | 3 | 4 | 5 | 6;
  
  return (
    <Component
      className={cn(
        'font-heading font-bold text-textPrimary leading-tight',
        headingSizes[currentLevel],
        className
      )}
      style={{ fontFamily: tokens.fonts.heading }}
      {...props}
    >
      {children}
    </Component>
  );
}

// Specific heading components for easier use
export function H1({ children, className, ...props }: TypographyProps) {
  return <Heading level={1} as="h1" className={className} {...props}>{children}</Heading>;
}

export function H2({ children, className, ...props }: TypographyProps) {
  return <Heading level={2} as="h2" className={className} {...props}>{children}</Heading>;
}

export function H3({ children, className, ...props }: TypographyProps) {
  return <Heading level={3} as="h3" className={className} {...props}>{children}</Heading>;
}

export function H4({ children, className, ...props }: TypographyProps) {
  return <Heading level={4} as="h4" className={className} {...props}>{children}</Heading>;
}

export function H5({ children, className, ...props }: TypographyProps) {
  return <Heading level={5} as="h5" className={className} {...props}>{children}</Heading>;
}

export function H6({ children, className, ...props }: TypographyProps) {
  return <Heading level={6} as="h6" className={className} {...props}>{children}</Heading>;
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
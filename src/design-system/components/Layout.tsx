import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { tokens } from '../tokens';

interface ContainerProps {
  children: ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  padding?: keyof typeof tokens.spacing;
}

export function Container({ 
  children, 
  className, 
  maxWidth = 'lg',
  padding = 'xl' 
}: ContainerProps) {
  const maxWidthClasses = {
    sm: 'max-w-4xl',
    md: 'max-w-6xl', 
    lg: 'max-w-7xl',
    xl: 'max-w-[1440px]',
    full: 'max-w-none',
  };

  return (
    <div 
      className={cn(
        'mx-auto',
        maxWidthClasses[maxWidth],
        className
      )}
      style={{ padding: tokens.spacing[padding] }}
    >
      {children}
    </div>
  );
}

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: keyof typeof tokens.spacing;
  radius?: keyof typeof tokens.borderRadius;
  shadow?: boolean;
}

export function Card({ 
  children, 
  className, 
  padding = 'xl',
  radius = 'lg',
  shadow = true 
}: CardProps) {
  return (
    <div
      className={cn(
        'bg-white border border-neutralLightest',
        shadow && 'shadow-card',
        className
      )}
      style={{
        padding: tokens.spacing[padding],
        borderRadius: tokens.borderRadius[radius],
        borderColor: tokens.colors.neutralLightest,
        ...(shadow && { boxShadow: tokens.shadows.card }),
      }}
    >
      {children}
    </div>
  );
}

interface StackProps {
  children: ReactNode;
  className?: string;
  direction?: 'row' | 'column';
  spacing?: keyof typeof tokens.spacing;
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around';
  wrap?: boolean;
}

export function Stack({ 
  children, 
  className, 
  direction = 'column',
  spacing = 'lg',
  align = 'start',
  justify = 'start',
  wrap = false
}: StackProps) {
  const alignClasses = {
    start: 'items-start',
    center: 'items-center', 
    end: 'items-end',
    stretch: 'items-stretch',
  };

  const justifyClasses = {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end', 
    between: 'justify-between',
    around: 'justify-around',
  };

  return (
    <div
      className={cn(
        'flex',
        direction === 'row' ? 'flex-row' : 'flex-col',
        wrap && 'flex-wrap',
        alignClasses[align],
        justifyClasses[justify],
        className
      )}
      style={{
        gap: tokens.spacing[spacing],
      }}
    >
      {children}
    </div>
  );
}

interface GridProps {
  children: ReactNode;
  className?: string;
  columns?: 1 | 2 | 3 | 4;
  spacing?: keyof typeof tokens.spacing;
}

export function Grid({ 
  children, 
  className, 
  columns = 1,
  spacing = 'lg'
}: GridProps) {
  const columnClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 lg:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3', 
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <div
      className={cn(
        'grid',
        columnClasses[columns],
        className
      )}
      style={{
        gap: tokens.spacing[spacing],
      }}
    >
      {children}
    </div>
  );
}
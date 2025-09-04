import { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { tokens } from '../tokens';

interface SkeletonLineProps {
  width?: string;
  height?: string;
  className?: string;
}

function SkeletonLine({ width = '100%', height = '1rem', className }: SkeletonLineProps) {
  return (
    <div 
      className={cn('animate-pulse bg-muted rounded', className)}
      style={{ width, height }}
    />
  );
}

interface LoadingProps {
  variant?: 'spinner' | 'skeleton' | 'dots' | 'inline';
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  className?: string;
  // For skeleton variant
  lines?: number;
  lineWidths?: string[];
  // For center positioning
  center?: boolean;
  // For inline variant (buttons, etc)
  children?: ReactNode;
  // For full height centering (useful in page/section contexts)
  fullHeight?: boolean;
}

export function Loading({
  variant = 'spinner',
  size = 'md',
  text,
  className,
  lines = 3,
  lineWidths = ['100%', '75%', '50%'],
  center = true,
  children,
  fullHeight = false
}: LoadingProps) {
  const sizeClasses = {
    spinner: {
      sm: 'h-4 w-4',
      md: 'h-8 w-8', 
      lg: 'h-12 w-12'
    },
    dots: {
      sm: 'w-1 h-1',
      md: 'w-2 h-2',
      lg: 'w-3 h-3'
    },
    text: {
      sm: 'text-sm',
      md: 'text-base',
      lg: 'text-lg'
    }
  };

  const containerClasses = cn(
    'flex items-center',
    center && variant !== 'inline' && 'justify-center',
    center && variant === 'spinner' && 'py-12',
    className
  );

  const renderSpinner = () => (
    <div className={containerClasses}>
      <div className={cn('flex flex-col items-center', center ? 'text-center' : '')}>
        <Loader2 
          className={cn(
            sizeClasses.spinner[size], 
            'animate-spin text-muted-foreground'
          )} 
        />
        {text && (
          <div 
            className={cn(
              'text-muted-foreground mt-2',
              sizeClasses.text[size]
            )}
          >
            {text}
          </div>
        )}
      </div>
    </div>
  );

  const renderSkeleton = () => (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => {
        const width = lineWidths[i] || lineWidths[lineWidths.length - 1] || '100%';
        const height = size === 'sm' ? '0.75rem' : size === 'lg' ? '1.5rem' : '1rem';
        return (
          <SkeletonLine 
            key={i}
            width={width}
            height={height}
          />
        );
      })}
    </div>
  );

  const renderDots = () => {
    const dotSize = sizeClasses.dots[size];
    return (
      <div className={containerClasses}>
        <div className="flex space-x-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={cn(
                dotSize,
                'bg-primary rounded-full animate-bounce'
              )}
              style={{
                animationDelay: `${i * 0.1}s`,
                animationDuration: '0.6s'
              }}
            />
          ))}
        </div>
        {text && (
          <div className={cn('text-muted-foreground ml-3', sizeClasses.text[size])}>
            {text}
          </div>
        )}
      </div>
    );
  };

  const renderInline = () => (
    <div className={cn('flex items-center', className)}>
      <Loader2 className={cn(sizeClasses.spinner[size], 'animate-spin mr-2')} />
      {children || text}
    </div>
  );

  // Full height wrapper for page/section contexts
  if (fullHeight && variant !== 'inline') {
    const content = (() => {
      switch (variant) {
        case 'skeleton':
          return renderSkeleton();
        case 'dots':
          return renderDots();
        case 'spinner':
        default:
          return renderSpinner();
      }
    })();
    
    return (
      <div className="flex-1 flex items-center justify-center min-h-[200px]">
        {content}
      </div>
    );
  }

  switch (variant) {
    case 'skeleton':
      return renderSkeleton();
    case 'dots':
      return renderDots();
    case 'inline':
      return renderInline();
    case 'spinner':
    default:
      return renderSpinner();
  }
}

// Specialized loading components for common patterns
export function PageLoading({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="h-full flex items-center justify-center bg-background">
      <Loading variant="spinner" size="lg" text={text} />
    </div>
  );
}

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="bg-card border rounded-lg p-6">
      <Loading 
        variant="skeleton" 
        lines={lines}
        lineWidths={['60%', '100%', '80%']}
        center={false}
      />
    </div>
  );
}

export function ButtonLoading({ 
  children, 
  loading, 
  size = 'sm' 
}: { 
  children: ReactNode;
  loading: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  if (!loading) return <>{children}</>;
  
  return (
    <Loading variant="inline" size={size}>
      {children}
    </Loading>
  );
}
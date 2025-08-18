import React from 'react';

interface CardProps {
  children: React.ReactNode;
  elevated?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function Card({ children, elevated = false, className, style }: CardProps) {
  const cardClass = elevated ? 'card-elevated' : 'card';
  
  return (
    <div className={`${cardClass} ${className || ''}`} style={style}>
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function CardHeader({ title, subtitle, action }: CardHeaderProps) {
  return (
    <div className="flex-between" style={{ marginBottom: 'var(--space-xl)' }}>
      <div>
        <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: subtitle ? 'var(--space-xs)' : 0 }}>
          {title}
        </h3>
        {subtitle && (
          <p className="text-muted" style={{ fontSize: '0.875rem' }}>{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}

interface CardContentProps {
  children: React.ReactNode;
  spacing?: 'sm' | 'md' | 'lg' | 'xl';
}

export function CardContent({ children, spacing = 'lg' }: CardContentProps) {
  const spacingClass = {
    sm: 'space-y-sm',
    md: 'space-y-md', 
    lg: 'space-y-lg',
    xl: 'space-y-xl'
  }[spacing];

  return (
    <div className={spacingClass}>
      {children}
    </div>
  );
}
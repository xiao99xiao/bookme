import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { tokens } from '../tokens';
import { Heading, Text } from './Typography';
import { Button } from './Button';
// import { EmptyCat } from './illustrations/EmptyCat';

interface EmptyStateAction {
  text: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'tertiary';
  icon?: ReactNode;
}

interface EmptyStateProps {
  /** Icon to display at the top */
  icon?: ReactNode;
  /** Main title text */
  title: string;
  /** Optional description text */
  description?: string;
  /** Optional primary action button */
  action?: EmptyStateAction;
  /** Optional secondary action button */
  secondaryAction?: EmptyStateAction;
  /** Custom className for styling */
  className?: string;
  /** Size variant for spacing and text */
  size?: 'sm' | 'md' | 'lg';
  /** Layout variant */
  variant?: 'default' | 'card' | 'minimal';
  /** For full height centering (useful in page/section contexts) */
  fullHeight?: boolean;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className,
  size = 'md',
  variant = 'default',
  fullHeight = false
}: EmptyStateProps) {
  const sizeClasses = {
    sm: {
      container: 'py-8',
      icon: 'w-16 h-16 mb-4',
      spacing: 'space-y-3'
    },
    md: {
      container: 'py-12',
      icon: 'w-24 h-24 mb-6',
      spacing: 'space-y-4'
    },
    lg: {
      container: 'py-16',
      icon: 'w-32 h-32 mb-8',
      spacing: 'space-y-6'
    }
  };

  const variantClasses = {
    default: 'text-center',
    card: 'text-center p-6 bg-card border rounded-lg',
    minimal: 'text-center'
  };

  const currentSize = sizeClasses[size];
  const variantClass = variantClasses[variant];

  const content = (
    <div 
      className={cn(
        variantClass,
        currentSize.container,
        className
      )}
    >
      <div className={cn('flex flex-col items-center', currentSize.spacing)}>
        {/* Icon */}
        {icon && (
          <div className={cn(currentSize.icon, 'text-muted-foreground flex-shrink-0')}>
            {icon}
          </div>
        )}

        {/* Content */}
        <div className={cn('text-center', currentSize.spacing)}>
          {/* Title */}
          <Heading 
            as={size === 'lg' ? 'h2' : 'h3'} 
            className={cn(
              size === 'sm' ? 'text-base' : 
              size === 'md' ? 'text-lg' : 
              'text-xl'
            )}
          >
            {title}
          </Heading>

          {/* Description */}
          {description && (
            <Text 
              color="secondary" 
              variant={size === 'sm' ? 'small' : 'regular'}
              className="max-w-md mx-auto"
            >
              {description}
            </Text>
          )}
        </div>

        {/* Actions */}
        {(action || secondaryAction) && (
          <div className={cn(
            'flex items-center gap-3',
            size === 'sm' ? 'flex-col sm:flex-row' : 'flex-col sm:flex-row'
          )}>
            {action && (
              <Button
                variant={action.variant || 'primary'}
                size={size === 'lg' ? 'medium' : 'small'}
                onClick={action.onClick}
                icon={action.icon}
                className="min-w-fit"
              >
                {action.text}
              </Button>
            )}
            {secondaryAction && (
              <Button
                variant={secondaryAction.variant || 'secondary'}
                size={size === 'lg' ? 'medium' : 'small'}
                onClick={secondaryAction.onClick}
                icon={secondaryAction.icon}
                className="min-w-fit"
              >
                {secondaryAction.text}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // Full height wrapper for page/section contexts
  if (fullHeight) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[200px]">
        {content}
      </div>
    );
  }

  return content;
}

// Specialized empty state components for common patterns

export function BookingEmptyState({ 
  type = "upcoming",
  onBrowseServices,
  fullHeight = false
}: { 
  type?: "upcoming" | "past" | "cancelled" | "all";
  onBrowseServices?: () => void;
  fullHeight?: boolean;
}) {
  const getTitle = () => {
    switch (type) {
      case "upcoming": return "No upcoming bookings";
      case "past": return "No past bookings"; 
      case "cancelled": return "No cancelled bookings";
      case "all": return "No bookings";
      default: return "No bookings";
    }
  };

  const getDescription = () => {
    switch (type) {
      case "upcoming": return "Browse services and make your first booking";
      case "past": return "Your completed bookings will appear here";
      case "cancelled": return "Your cancelled bookings will appear here";
      case "all": return "Your bookings will appear here";
      default: return "Your bookings will appear here";
    }
  };

  return (
    <EmptyState
      icon={<img src="/images/empty-cat.svg" alt="Empty cat illustration" className="w-24 h-24 object-contain" />}
      title={getTitle()}
      description={getDescription()}
      action={type === "upcoming" && onBrowseServices ? {
        text: "Looking for Services",
        onClick: onBrowseServices,
        variant: 'primary'
      } : undefined}
      size="md"
      fullHeight={fullHeight}
    />
  );
}

export function NoResultsFound({ 
  searchTerm, 
  onClear, 
  clearText = "Clear Filters" 
}: { 
  searchTerm?: string; 
  onClear?: () => void;
  clearText?: string;
}) {
  return (
    <EmptyState
      icon={<SearchIcon />}
      title={searchTerm ? `No results for "${searchTerm}"` : "No results found"}
      description={searchTerm ? "Try a different search term or clear your filters" : "Try adjusting your search criteria"}
      action={onClear ? { text: clearText, onClick: onClear, variant: 'secondary' } : undefined}
    />
  );
}

export function NoDataYet({ 
  title, 
  description, 
  actionText, 
  onAction, 
  icon 
}: { 
  title: string; 
  description?: string; 
  actionText?: string; 
  onAction?: () => void;
  icon?: ReactNode;
}) {
  return (
    <EmptyState
      icon={icon}
      title={title}
      description={description}
      action={actionText && onAction ? { 
        text: actionText, 
        onClick: onAction, 
        variant: 'primary' 
      } : undefined}
      size="md"
    />
  );
}

export function EmptyListState({ 
  itemType, 
  addText, 
  onAdd, 
  icon 
}: { 
  itemType: string; 
  addText?: string; 
  onAdd?: () => void;
  icon?: ReactNode;
}) {
  return (
    <EmptyState
      icon={icon}
      title={`No ${itemType} yet`}
      description={`Start by adding your first ${itemType.toLowerCase()}`}
      action={addText && onAdd ? { 
        text: addText, 
        onClick: onAdd, 
        variant: 'primary',
        icon: <PlusIcon />
      } : undefined}
      size="md"
    />
  );
}

// Default icons for common use cases
function SearchIcon() {
  return (
    <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
    </svg>
  );
}
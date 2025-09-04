import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { tokens } from '../tokens';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, fullWidth, ...props }, ref) => {
    return (
      <div className={cn('relative', fullWidth && 'w-full')}>
        <div 
          className="absolute inset-[-1px] pointer-events-none"
          style={{
            border: `1px solid ${error ? tokens.colors.borderError : tokens.colors.neutralLightest}`,
            borderRadius: `calc(${tokens.borderRadius.sm} + 1px)`,
          }}
        />
        <input
          ref={ref}
          className={cn(
            'bg-white flex w-full items-center justify-start border-0 focus:ring-0 p-3',
            'text-base text-textPrimary placeholder:text-textSecondary',
            'focus:outline-none',
            className
          )}
          style={{
            fontFamily: tokens.fonts.body,
            borderRadius: tokens.borderRadius.sm,
            padding: tokens.spacing.md,
          }}
          {...props}
        />
      </div>
    );
  }
);

Input.displayName = 'Input';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
  fullWidth?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, fullWidth, rows = 4, ...props }, ref) => {
    return (
      <div className={cn('relative', fullWidth && 'w-full')}>
        <div 
          className="absolute inset-[-1px] pointer-events-none"
          style={{
            border: `1px solid ${error ? tokens.colors.borderError : tokens.colors.neutralLightest}`,
            borderRadius: `calc(${tokens.borderRadius.sm} + 1px)`,
          }}
        />
        <textarea
          ref={ref}
          rows={rows}
          className={cn(
            'bg-white flex w-full items-start justify-start border-0 focus:ring-0 p-3',
            'text-base text-textPrimary placeholder:text-textSecondary',
            'focus:outline-none resize-none',
            className
          )}
          style={{
            fontFamily: tokens.fonts.body,
            borderRadius: tokens.borderRadius.sm,
            padding: tokens.spacing.md,
            minHeight: `${20 * rows}px`,
          }}
          {...props}
        />
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
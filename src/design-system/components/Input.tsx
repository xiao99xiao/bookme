import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { tokens } from '../tokens';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, fullWidth, disabled, type = 'text', ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base',
          'file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground',
          'placeholder:text-muted-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'md:text-sm transition-colors',
          // Design system overrides
          'text-textPrimary placeholder:text-textSecondary',
          'border-neutralLightest focus-visible:ring-gray-500',
          error && 'border-red-500 focus-visible:ring-red-500',
          disabled && 'bg-gray-50',
          fullWidth && 'w-full',
          className
        )}
        style={{
          fontFamily: tokens.fonts.body,
          borderRadius: tokens.borderRadius.sm,
        }}
        disabled={disabled}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
  fullWidth?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, fullWidth, rows = 4, disabled, ...props }, ref) => {
    return (
      <textarea
        rows={rows}
        ref={ref}
        className={cn(
          'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base',
          'placeholder:text-muted-foreground resize-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'md:text-sm transition-colors',
          // Design system overrides
          'text-textPrimary placeholder:text-textSecondary',
          'border-neutralLightest focus-visible:ring-gray-500',
          error && 'border-red-500 focus-visible:ring-red-500',
          disabled && 'bg-gray-50',
          fullWidth && 'w-full',
          className
        )}
        style={{
          fontFamily: tokens.fonts.body,
          borderRadius: tokens.borderRadius.sm,
        }}
        disabled={disabled}
        {...props}
      />
    );
  }
);

Textarea.displayName = 'Textarea';
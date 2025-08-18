import React from 'react';

interface FormFieldProps {
  label: string;
  error?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export function FormField({ label, error, icon, children }: FormFieldProps) {
  return (
    <div>
      <label style={{ 
        display: 'block', 
        fontSize: '0.875rem', 
        fontWeight: '500', 
        color: 'var(--text-primary)',
        marginBottom: 'var(--space-sm)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-xs)'
      }}>
        {icon}
        {label}
      </label>
      {children}
      {error && (
        <p style={{ 
          marginTop: 'var(--space-xs)', 
          fontSize: '0.875rem', 
          color: 'var(--error)' 
        }}>
          {error}
        </p>
      )}
    </div>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export function Input({ error, className, ...props }: InputProps) {
  return (
    <input
      className={`input-field ${className || ''}`}
      style={{
        borderColor: error ? 'var(--error)' : undefined,
        ...props.style
      }}
      {...props}
    />
  );
}

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export function TextArea({ error, className, rows = 4, ...props }: TextAreaProps) {
  return (
    <textarea
      rows={rows}
      style={{
        width: '100%',
        padding: 'var(--space-lg)',
        border: `1px solid ${error ? 'var(--error)' : 'var(--border-light)'}`,
        borderRadius: 'var(--radius-lg)',
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        fontSize: '0.875rem',
        resize: 'none',
        outline: 'none',
        transition: 'all 0.2s ease',
        ...props.style
      }}
      onFocus={(e) => {
        e.target.style.borderColor = 'var(--accent-primary)';
        e.target.style.boxShadow = '0 0 0 3px var(--accent-light)';
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        e.target.style.borderColor = error ? 'var(--error)' : 'var(--border-light)';
        e.target.style.boxShadow = 'none';
        props.onBlur?.(e);
      }}
      className={className}
      {...props}
    />
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export function Select({ error, className, children, ...props }: SelectProps) {
  return (
    <select
      className={`input-field ${className || ''}`}
      style={{
        borderColor: error ? 'var(--error)' : undefined,
        appearance: 'none',
        ...props.style
      }}
      {...props}
    >
      {children}
    </select>
  );
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export function Button({ 
  variant = 'primary', 
  size = 'md',
  loading = false,
  children, 
  disabled,
  className,
  ...props 
}: ButtonProps) {
  const baseClass = variant === 'primary' ? 'btn-primary' : 'btn-secondary';
  
  const sizeStyles = {
    sm: { width: 'auto', padding: 'var(--space-sm) var(--space-md)', fontSize: '0.875rem' },
    md: { width: 'auto', padding: 'var(--space-md) var(--space-lg)', fontSize: '0.875rem' },
    lg: { width: 'auto', padding: 'var(--space-lg) var(--space-xl)', fontSize: '1rem' }
  }[size];

  return (
    <button
      className={`${baseClass} ${className || ''}`}
      style={{
        ...sizeStyles,
        opacity: (disabled || loading) ? '0.5' : '1',
        cursor: (disabled || loading) ? 'not-allowed' : 'pointer',
        ...props.style
      }}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? 'Loading...' : children}
    </button>
  );
}
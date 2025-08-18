import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface PageProps {
  children: React.ReactNode;
  title?: string;
  backUrl?: string;
  backLabel?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

export function Page({ 
  children, 
  title, 
  backUrl, 
  backLabel = 'Back',
  maxWidth = 'lg' 
}: PageProps) {
  const containerClass = {
    sm: 'container-center',
    md: 'container-center',
    lg: 'container-wide',
    xl: 'container-wide',
    full: 'container-wide'
  }[maxWidth];

  return (
    <div className="page-layout">
      {/* Header */}
      <header style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-light)' }}>
        <div className="container-wide" style={{ padding: 'var(--space-lg) var(--space-lg)' }}>
          <div className="flex-between">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg)' }}>
              {backUrl && (
                <Link href={backUrl} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  textDecoration: 'none',
                  color: 'var(--text-secondary)',
                  transition: 'color 0.2s ease'
                }}>
                  <ArrowLeft size={20} style={{ marginRight: 'var(--space-sm)' }} />
                  {backLabel}
                </Link>
              )}
              {title && (
                <h1 style={{ fontSize: '1.5rem', fontWeight: '700' }}>{title}</h1>
              )}
            </div>
            
            <Link href="/" style={{ textDecoration: 'none' }}>
              <h1 style={{ 
                fontSize: '1.5rem', 
                fontWeight: '700', 
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-sm)'
              }}>
                BookMe
                <span style={{ color: '#22c55e', fontSize: '1.25rem' }}>●</span>
              </h1>
            </Link>
          </div>
        </div>
      </header>

      <div className={containerClass} style={{ padding: 'var(--space-2xl) var(--space-lg)' }}>
        {children}
      </div>
    </div>
  );
}
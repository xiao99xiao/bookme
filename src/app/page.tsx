'use client';

import { Search, Plus, Calendar, Users, Star, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="page-layout">
      {/* Header */}
      <header style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-light)' }}>
        <div className="container-wide" style={{ padding: 'var(--space-lg) var(--space-lg)' }}>
          <div className="flex-between">
            {/* Logo */}
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

            {/* Navigation */}
            <nav className="hidden md:flex items-center" style={{ gap: 'var(--space-xl)' }}>
              <Link 
                href="/discover" 
                className="text-muted"
                style={{ 
                  fontWeight: '500',
                  transition: 'color 0.2s ease'
                }}
              >
                Discover
              </Link>
              <Link 
                href="/dashboard" 
                className="text-muted"
                style={{ 
                  fontWeight: '500',
                  transition: 'color 0.2s ease'
                }}
              >
                Dashboard
              </Link>
            </nav>

            {/* Auth Button */}
            <Link href="/auth" style={{ textDecoration: 'none' }}>
              <button className="btn-primary" style={{ 
                width: 'auto', 
                minWidth: '120px',
                padding: '0.75rem 1.5rem' 
              }}>
                Sign In
              </button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section style={{ padding: 'var(--space-3xl) var(--space-lg)' }}>
        <div className="container-wide">
          <div className="text-center">
            <h1 style={{ 
              fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', 
              fontWeight: '700', 
              lineHeight: '1.1'
            }}>
              Welcome back
            </h1>
            <p className="text-large text-muted" style={{ 
              margin: 'var(--space-lg) auto var(--space-3xl)',
              maxWidth: '500px'
            }}>
              Connect with your community through BookMe
            </p>
            
            <div className="space-y-lg" style={{ maxWidth: '300px', margin: '0 auto' }}>
              <Link href="/discover" style={{ textDecoration: 'none' }}>
                <button className="btn-primary">
                  <Search size={20} />
                  Browse Services
                </button>
              </Link>
              <Link href="/auth" style={{ textDecoration: 'none' }}>
                <button className="btn-secondary">
                  <Plus size={20} />
                  Get Started
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section style={{ 
        padding: 'var(--space-3xl) var(--space-lg)', 
        background: 'var(--bg-secondary)' 
      }}>
        <div className="container-wide">
          <div className="text-center">
            <h2>How BookMe Works</h2>
            <p className="text-large text-muted" style={{ 
              margin: 'var(--space-lg) auto var(--space-2xl)',
              maxWidth: '500px'
            }}>
              Simple steps to connect with your community
            </p>
          </div>

          <div className="grid-responsive">
            {/* Feature 1 */}
            <div className="card text-center">
              <div style={{ 
                width: '60px', 
                height: '60px', 
                borderRadius: 'var(--radius-md)', 
                background: 'var(--accent-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto var(--space-lg)'
              }}>
                <Calendar size={24} style={{ color: 'var(--accent-primary)' }} />
              </div>
              <h3>Create Services</h3>
              <p className="text-muted" style={{ marginTop: 'var(--space-md)' }}>
                Set up time slots for services you want to offer. Define your expertise and availability.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="card text-center">
              <div style={{ 
                width: '60px', 
                height: '60px', 
                borderRadius: 'var(--radius-md)', 
                background: 'var(--accent-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto var(--space-lg)'
              }}>
                <Users size={24} style={{ color: 'var(--accent-primary)' }} />
              </div>
              <h3>Connect & Book</h3>
              <p className="text-muted" style={{ marginTop: 'var(--space-md)' }}>
                Browse available services and send booking requests with personalized messages.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="card text-center">
              <div style={{ 
                width: '60px', 
                height: '60px', 
                borderRadius: 'var(--radius-md)', 
                background: 'var(--accent-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto var(--space-lg)'
              }}>
                <Star size={24} style={{ color: 'var(--accent-primary)' }} />
              </div>
              <h3>Build Reputation</h3>
              <p className="text-muted" style={{ marginTop: 'var(--space-md)' }}>
                Complete services, receive reviews, and build your reputation in the community.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section style={{ padding: 'var(--space-3xl) var(--space-lg)' }}>
        <div className="container-wide text-center">
          <h2>Ready to Get Started?</h2>
          <p className="text-large text-muted" style={{ 
            margin: 'var(--space-lg) auto var(--space-2xl)',
            maxWidth: '500px'
          }}>
            Join thousands of community members sharing their time and expertise
          </p>
          <div style={{ maxWidth: '300px', margin: '0 auto' }}>
            <Link href="/auth" style={{ textDecoration: 'none' }}>
              <button className="btn-primary">
                Get Started Today
                <ArrowRight size={20} />
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ 
        padding: 'var(--space-2xl) var(--space-lg)',
        background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border-light)'
      }}>
        <div className="container-wide">
          <div className="text-center">
            <h3 style={{ color: 'var(--text-primary)' }}>BookMe</h3>
            <p className="text-muted" style={{ margin: 'var(--space-lg) 0' }}>
              Connecting people through shared time and expertise
            </p>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              gap: 'var(--space-xl)',
              flexWrap: 'wrap',
              margin: 'var(--space-lg) 0'
            }}>
              <a href="#" className="link-purple">Privacy Policy</a>
              <a href="#" className="link-purple">Terms of Service</a>
              <a href="#" className="link-purple">Contact</a>
            </div>
            <p className="text-small">
              © 2024 BookMe Platform. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
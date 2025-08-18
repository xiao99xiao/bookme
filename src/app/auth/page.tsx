'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { useAuthStore } from '@/stores/auth';

type AuthMode = 'login' | 'register';

interface LoginForm {
  email: string;
  password: string;
}

interface RegisterForm {
  name: string;
  email: string;
  password: string;
  bio: string;
}

export default function AuthPage() {
  const router = useRouter();
  const { signIn, signUp, isAuthenticated, isLoading } = useAuthStore();
  
  const [mode, setMode] = useState<AuthMode>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  
  const [loginForm, setLoginForm] = useState<LoginForm>({
    email: '',
    password: ''
  });
  
  const [registerForm, setRegisterForm] = useState<RegisterForm>({
    name: '',
    email: '',
    password: '',
    bio: ''
  });

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    
    try {
      await signIn(loginForm.email, loginForm.password);
      router.push('/dashboard');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Login failed. Please try again.';
      alert(message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    
    try {
      await signUp(registerForm.email, registerForm.password, registerForm.name);
      
      // Update bio after signup if provided
      if (registerForm.bio) {
        // This will be handled by the profile update after signup
      }
      
      router.push('/dashboard');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Registration failed. Please try again.';
      alert(message);
    } finally {
      setFormLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="page-layout flex-center">
        <div className="text-center">
          <div style={{ 
            width: '32px', 
            height: '32px', 
            border: '3px solid var(--border-light)', 
            borderTop: '3px solid var(--accent-primary)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto var(--space-md)'
          }}></div>
          <p className="text-muted">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-layout flex-center" style={{ padding: 'var(--space-xl) var(--space-lg)' }}>
      <div className="container-center">
        {/* Header - Matching Linktree exactly */}
        <div className="text-center">
          <Link href="/" style={{ textDecoration: 'none' }}>
            <h1 style={{ 
              fontSize: '1.5rem', 
              fontWeight: '700', 
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-sm)',
              marginBottom: 'var(--space-3xl)'
            }}>
              BookMe
              <span style={{ color: '#22c55e', fontSize: '1.25rem' }}>●</span>
            </h1>
          </Link>
          
          <h1 style={{ 
            fontSize: 'clamp(2rem, 5vw, 2.5rem)', 
            fontWeight: '700'
          }}>
            Welcome back
          </h1>
          
          <p className="text-muted text-large" style={{ 
            margin: 'var(--space-lg) 0 var(--space-3xl)'
          }}>
            {mode === 'login' ? 'Log in to your BookMe' : 'Create your BookMe account'}
          </p>
        </div>

        {/* Form - Matching Linktree exactly */}
        <div className="space-y-lg">
          {/* Email Input */}
          <div>
            <input
              type="email"
              required
              className="input-field"
              placeholder="Email or username"
              value={mode === 'login' ? loginForm.email : registerForm.email}
              onChange={(e) => {
                if (mode === 'login') {
                  setLoginForm({ ...loginForm, email: e.target.value });
                } else {
                  setRegisterForm({ ...registerForm, email: e.target.value });
                }
              }}
            />
          </div>

          {/* Name Input (Register only) */}
          {mode === 'register' && (
            <div>
              <input
                type="text"
                required
                className="input-field"
                placeholder="Full name"
                value={registerForm.name}
                onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
              />
            </div>
          )}

          {/* Password Input */}
          <div>
            <input
              type="password"
              required
              className="input-field"
              placeholder="Password"
              value={mode === 'login' ? loginForm.password : registerForm.password}
              onChange={(e) => {
                if (mode === 'login') {
                  setLoginForm({ ...loginForm, password: e.target.value });
                } else {
                  setRegisterForm({ ...registerForm, password: e.target.value });
                }
              }}
            />
          </div>

          {/* Continue Button */}
          <button
            type="submit"
            disabled={formLoading}
            className="btn-primary"
            onClick={mode === 'login' ? handleLogin : handleRegister}
          >
            {formLoading ? 'Loading...' : 'Continue'}
          </button>

          {/* OR Divider */}
          <div className="text-center">
            <span className="text-muted" style={{ fontSize: '0.875rem' }}>OR</span>
          </div>

          {/* Social Login Buttons */}
          <div className="space-y-md">
            <button className="btn-social">
              <span style={{ color: '#4285f4' }}>G</span>
              Continue with Google
            </button>
            <button className="btn-social">
              <span style={{ color: '#000' }}>🍎</span>
              Continue with Apple
            </button>
          </div>

          {/* Footer Links */}
          <div className="text-center">
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              gap: 'var(--space-sm)', 
              fontSize: '0.875rem',
              marginBottom: 'var(--space-md)'
            }}>
              <a href="#" className="link-purple">Forgot password?</a>
              <span className="text-muted">•</span>
              <a href="#" className="link-purple">Forgot username?</a>
            </div>
            
            <p className="text-muted" style={{ fontSize: '0.875rem' }}>
              Don't have an account?{' '}
              <button 
                className="link-purple"
                onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                {mode === 'login' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </div>
        </div>

        {/* Cookie Preferences */}
        <div style={{ 
          position: 'fixed', 
          bottom: 'var(--space-lg)', 
          left: 'var(--space-lg)',
          fontSize: '0.75rem',
          color: 'var(--text-tertiary)'
        }}>
          Cookie preferences
        </div>
      </div>
    </div>
  );
}
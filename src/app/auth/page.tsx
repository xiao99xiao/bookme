'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, User, Mail, Lock, ArrowRight, ArrowLeft, MapPin, Heart, Target, Check } from 'lucide-react';
import Link from 'next/link';

import { useAuthStore } from '@/stores/auth';
import { generateAvatar } from '@/lib/utils';
import { 
  loginSchema, 
  registerStep1Schema, 
  registerStep2Schema, 
  registerStep3Schema,
  type LoginFormData, 
  type RegisterStep1FormData,
  type RegisterStep2FormData,
  type RegisterStep3FormData
} from '@/lib/validations';

// Predefined options for hobbies and interests
const hobbiesOptions = [
  'Reading', 'Writing', 'Photography', 'Cooking', 'Gaming', 'Music', 'Art', 'Sports',
  'Fitness', 'Travel', 'Gardening', 'Technology', 'Movies', 'Dancing', 'Hiking', 'Yoga'
];

const interestsOptions = [
  'Business Consulting', 'Life Coaching', 'Tutoring', 'Language Learning', 'Fitness Training',
  'Creative Design', 'Programming', 'Marketing', 'Finance', 'Health & Wellness', 'Photography',
  'Music Lessons', 'Art Therapy', 'Career Guidance', 'Relationship Advice', 'Mental Health'
];

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [signupStep, setSignupStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [signupData, setSignupData] = useState<any>({});
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { login } = useAuthStore();

  // Login form
  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  // Multi-step signup forms
  const step1Form = useForm<RegisterStep1FormData>({
    resolver: zodResolver(registerStep1Schema),
    defaultValues: { email: '', password: '', displayName: '' },
  });

  const step2Form = useForm<RegisterStep2FormData>({
    resolver: zodResolver(registerStep2Schema),
    defaultValues: { bio: '', location: '', hobbies: [] },
  });

  const step3Form = useForm<RegisterStep3FormData>({
    resolver: zodResolver(registerStep3Schema),
    defaultValues: { interests: [] },
  });

  const onLoginSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (response.ok) {
        login({
          ...result.user,
          name: result.user.displayName, // Map displayName to name for compatibility
          avatar: result.user.avatar || generateAvatar(result.user.displayName),
        });
        router.push('/dashboard');
      } else {
        alert(result.error || 'Login failed');
      }
    } catch (error) {
      alert('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const onStep1Submit = (data: RegisterStep1FormData) => {
    setSignupData({ ...signupData, ...data });
    setSignupStep(2);
  };

  const onStep2Submit = (data: RegisterStep2FormData) => {
    setSignupData({ ...signupData, ...data });
    setSignupStep(3);
  };

  const onStep3Submit = async (data: RegisterStep3FormData) => {
    setIsLoading(true);
    const completeData = { ...signupData, ...data };
    
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(completeData),
      });

      const result = await response.json();

      if (response.ok) {
        login({
          ...result.user,
          name: result.user.displayName, // Map displayName to name for compatibility
          avatar: result.user.avatar || generateAvatar(result.user.displayName),
        });
        router.push('/dashboard');
      } else {
        alert(result.error || 'Signup failed');
      }
    } catch (error) {
      alert('Signup failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleHobbyToggle = (hobby: string) => {
    const currentHobbies = step2Form.getValues('hobbies');
    const newHobbies = currentHobbies.includes(hobby)
      ? currentHobbies.filter(h => h !== hobby)
      : [...currentHobbies, hobby];
    step2Form.setValue('hobbies', newHobbies);
  };

  const handleInterestToggle = (interest: string) => {
    const currentInterests = step3Form.getValues('interests');
    const newInterests = currentInterests.includes(interest)
      ? currentInterests.filter(i => i !== interest)
      : [...currentInterests, interest];
    step3Form.setValue('interests', newInterests);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <Link href="/" className="inline-block">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              BookMe
            </h1>
          </Link>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            {isLogin ? 'Sign in to your account' : 
             signupStep === 1 ? 'Create your account' :
             signupStep === 2 ? 'Tell us about yourself' :
             'What interests you?'}
          </h2>
          
          {isLogin ? (
            <p className="mt-2 text-sm text-gray-600">
              Don't have an account?{' '}
              <button
                onClick={() => setIsLogin(false)}
                className="font-medium text-blue-600 hover:text-blue-500 transition-colors"
              >
                Sign up
              </button>
            </p>
          ) : signupStep === 1 ? (
            <p className="mt-2 text-sm text-gray-600">
              Already have an account?{' '}
              <button
                onClick={() => setIsLogin(true)}
                className="font-medium text-blue-600 hover:text-blue-500 transition-colors"
              >
                Sign in
              </button>
            </p>
          ) : (
            <div className="mt-4 flex items-center justify-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${signupStep >= 1 ? 'bg-blue-600' : 'bg-gray-300'}`} />
              <div className={`w-3 h-3 rounded-full ${signupStep >= 2 ? 'bg-blue-600' : 'bg-gray-300'}`} />
              <div className={`w-3 h-3 rounded-full ${signupStep >= 3 ? 'bg-blue-600' : 'bg-gray-300'}`} />
            </div>
          )}
        </div>

        {/* Forms */}
        <div className="bg-white py-8 px-6 shadow-xl rounded-2xl border border-gray-100">
          {isLogin ? (
            <form className="space-y-6" onSubmit={loginForm.handleSubmit(onLoginSubmit)}>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email address
                </label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    {...loginForm.register('email')}
                    type="email"
                    className="appearance-none rounded-xl relative block w-full pl-10 pr-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    placeholder="Enter your email"
                  />
                </div>
                {loginForm.formState.errors.email && (
                  <p className="mt-1 text-sm text-red-600">{loginForm.formState.errors.email.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    {...loginForm.register('password')}
                    type={showPassword ? 'text' : 'password'}
                    className="appearance-none rounded-xl relative block w-full pl-10 pr-10 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>
                {loginForm.formState.errors.password && (
                  <p className="mt-1 text-sm text-red-600">{loginForm.formState.errors.password.message}</p>
                )}
              </div>

              <div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-xl text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all transform hover:scale-105 disabled:opacity-50"
                >
                  <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                    <ArrowRight className="h-5 w-5 text-blue-500 group-hover:text-blue-400" />
                  </span>
                  {isLoading ? 'Signing in...' : 'Sign in'}
                </button>
              </div>
            </form>
          ) : signupStep === 1 ? (
            <form className="space-y-6" onSubmit={step1Form.handleSubmit(onStep1Submit)}>
              <div>
                <label htmlFor="displayName" className="block text-sm font-medium text-gray-700">
                  Display Name
                </label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    {...step1Form.register('displayName')}
                    type="text"
                    className="appearance-none rounded-xl relative block w-full pl-10 pr-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    placeholder="How should others see you?"
                  />
                </div>
                {step1Form.formState.errors.displayName && (
                  <p className="mt-1 text-sm text-red-600">{step1Form.formState.errors.displayName.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email address
                </label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    {...step1Form.register('email')}
                    type="email"
                    className="appearance-none rounded-xl relative block w-full pl-10 pr-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    placeholder="Enter your email"
                  />
                </div>
                {step1Form.formState.errors.email && (
                  <p className="mt-1 text-sm text-red-600">{step1Form.formState.errors.email.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    {...step1Form.register('password')}
                    type={showPassword ? 'text' : 'password'}
                    className="appearance-none rounded-xl relative block w-full pl-10 pr-10 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    placeholder="Create a password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>
                {step1Form.formState.errors.password && (
                  <p className="mt-1 text-sm text-red-600">{step1Form.formState.errors.password.message}</p>
                )}
              </div>

              <div>
                <button
                  type="submit"
                  className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-xl text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all transform hover:scale-105"
                >
                  <span className="absolute right-0 inset-y-0 flex items-center pr-3">
                    <ArrowRight className="h-5 w-5 text-blue-500 group-hover:text-blue-400" />
                  </span>
                  Continue
                </button>
              </div>
            </form>
          ) : signupStep === 2 ? (
            <form className="space-y-6" onSubmit={step2Form.handleSubmit(onStep2Submit)}>
              <div>
                <label htmlFor="bio" className="block text-sm font-medium text-gray-700">
                  Tell us about yourself
                </label>
                <div className="mt-1">
                  <textarea
                    {...step2Form.register('bio')}
                    rows={4}
                    className="appearance-none rounded-xl relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none"
                    placeholder="Share your background, skills, and what makes you unique..."
                  />
                </div>
                {step2Form.formState.errors.bio && (
                  <p className="mt-1 text-sm text-red-600">{step2Form.formState.errors.bio.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="location" className="block text-sm font-medium text-gray-700">
                  Location
                </label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MapPin className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    {...step2Form.register('location')}
                    type="text"
                    className="appearance-none rounded-xl relative block w-full pl-10 pr-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    placeholder="City, Country or Online"
                  />
                </div>
                {step2Form.formState.errors.location && (
                  <p className="mt-1 text-sm text-red-600">{step2Form.formState.errors.location.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  <Heart className="inline w-4 h-4 mr-1" />
                  Your Hobbies
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {hobbiesOptions.map((hobby) => (
                    <button
                      key={hobby}
                      type="button"
                      onClick={() => handleHobbyToggle(hobby)}
                      className={`px-3 py-2 text-sm rounded-lg border transition-all ${
                        step2Form.watch('hobbies')?.includes(hobby)
                          ? 'bg-blue-100 border-blue-500 text-blue-700'
                          : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {step2Form.watch('hobbies')?.includes(hobby) && (
                        <Check className="inline w-3 h-3 mr-1" />
                      )}
                      {hobby}
                    </button>
                  ))}
                </div>
                {step2Form.formState.errors.hobbies && (
                  <p className="mt-1 text-sm text-red-600">{step2Form.formState.errors.hobbies.message}</p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setSignupStep(1)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 px-4 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
                <button
                  type="submit"
                  className="flex-2 bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                >
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </form>
          ) : (
            <form className="space-y-6" onSubmit={step3Form.handleSubmit(onStep3Submit)}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  <Target className="inline w-4 h-4 mr-1" />
                  What are you interested in offering or learning?
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {interestsOptions.map((interest) => (
                    <button
                      key={interest}
                      type="button"
                      onClick={() => handleInterestToggle(interest)}
                      className={`px-4 py-3 text-sm rounded-lg border transition-all text-left ${
                        step3Form.watch('interests')?.includes(interest)
                          ? 'bg-blue-100 border-blue-500 text-blue-700'
                          : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {step3Form.watch('interests')?.includes(interest) && (
                        <Check className="inline w-4 h-4 mr-2" />
                      )}
                      {interest}
                    </button>
                  ))}
                </div>
                {step3Form.formState.errors.interests && (
                  <p className="mt-1 text-sm text-red-600">{step3Form.formState.errors.interests.message}</p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setSignupStep(2)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 px-4 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-2 bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isLoading ? 'Creating Account...' : 'Complete Signup'}
                  <Check className="h-4 w-4" />
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="text-center">
          <p className="text-xs text-gray-500">
            By signing up, you agree to our{' '}
            <a href="#" className="text-blue-600 hover:text-blue-500">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="#" className="text-blue-600 hover:text-blue-500">
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
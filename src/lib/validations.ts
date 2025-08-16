import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

// Step 1: Basic registration
export const registerStep1Schema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  displayName: z.string().min(2, 'Display name must be at least 2 characters'),
});

// Step 2: Profile details
export const registerStep2Schema = z.object({
  bio: z.string().min(10, 'Bio must be at least 10 characters'),
  location: z.string().min(2, 'Location must be at least 2 characters'),
  hobbies: z.array(z.string()).min(1, 'Please select at least one hobby'),
});

// Step 3: Interests and preferences
export const registerStep3Schema = z.object({
  interests: z.array(z.string()).min(1, 'Please select at least one interest'),
});

// Complete registration schema
export const registerSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  displayName: z.string().min(2, 'Display name must be at least 2 characters'),
  bio: z.string().min(10, 'Bio must be at least 10 characters'),
  location: z.string().min(2, 'Location must be at least 2 characters'),
  hobbies: z.array(z.string()).min(1, 'Please select at least one hobby'),
  interests: z.array(z.string()).min(1, 'Please select at least one interest'),
});

export const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  bio: z.string().min(10, 'Bio must be at least 10 characters'),
  location: z.string().optional(),
});

export const slotSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters'),
  description: z.string().min(20, 'Description must be at least 20 characters'),
  category: z.enum(['consultation', 'coaching', 'tutoring', 'fitness', 'creative', 'other']),
  date: z.string().min(1, 'Please select a date'),
  time: z.string().min(1, 'Please select a time'),
  duration: z.number().min(15).max(480), // 15 minutes to 8 hours
  price: z.number().min(0).max(10000),
  location: z.enum(['online', 'phone', 'in-person']),
});

export const bookingSchema = z.object({
  message: z.string().min(10, 'Please provide a message of at least 10 characters'),
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterStep1FormData = z.infer<typeof registerStep1Schema>;
export type RegisterStep2FormData = z.infer<typeof registerStep2Schema>;
export type RegisterStep3FormData = z.infer<typeof registerStep3Schema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type ProfileFormData = z.infer<typeof profileSchema>;
export type SlotFormData = z.infer<typeof slotSchema>;
export type BookingFormData = z.infer<typeof bookingSchema>;
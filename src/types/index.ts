// Core types for BookMe P2P booking platform

export interface User {
  id: string;
  name: string;
  email: string;
  bio: string;
  avatar: string;
  location: string;
  rating: number;
  reviewCount: number;
  createdAt: string;
  isActive: boolean;
}

export interface Slot {
  id: string;
  providerId: string;
  providerName: string;
  providerAvatar: string;
  providerRating: number;
  providerReviews: number;
  title: string;
  description: string;
  category: SlotCategory;
  date: string;
  time: string;
  duration: number; // in minutes
  price: number;
  location: SlotLocation;
  isActive: boolean;
  bookedBy?: string;
  bookedAt?: string;
  createdAt: string;
}

export interface Booking {
  id: string;
  slotId: string;
  requesterId: string;
  requesterName: string;
  requesterEmail?: string;
  requesterAvatar?: string;
  message: string;
  status: BookingStatus;
  createdAt: string;
  confirmedAt?: string;
  declinedAt?: string;
  cancelledAt?: string;
}

export type SlotCategory = 'consultation' | 'coaching' | 'tutoring' | 'fitness' | 'creative' | 'other';
export type SlotLocation = 'online' | 'phone' | 'in-person';
export type SlotStatus = 'available' | 'booked' | 'completed' | 'cancelled';
export type BookingStatus = 'pending' | 'confirmed' | 'declined' | 'cancelled' | 'completed';
export type NotificationType = 'info' | 'success' | 'error' | 'warning';

// Form validation schemas
export interface LoginForm {
  email: string;
  password: string;
}

export interface RegisterForm {
  name: string;
  email: string;
  password: string;
  bio: string;
}

export interface SlotForm {
  title: string;
  description: string;
  category: SlotCategory;
  date: string;
  time: string;
  duration: number;
  price: number;
  location: SlotLocation;
}

export interface BookingForm {
  message: string;
}

// UI component props
export interface ServiceCardProps {
  slot: Slot;
  onBook: (slotId: string) => void;
}

export interface BookingCardProps {
  booking: Booking;
  onCancel?: (bookingId: string) => void;
  onApprove?: (bookingId: string) => void;
  onDecline?: (bookingId: string) => void;
}

// Store interfaces
export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (user: User) => void;
  logout: () => void;
  updateProfile: (updates: Partial<User>) => void;
}

export interface SlotsState {
  slots: Slot[];
  addSlot: (slot: Omit<Slot, 'id' | 'createdAt'>) => void;
  updateSlot: (id: string, updates: Partial<Slot>) => void;
  deleteSlot: (id: string) => void;
  getUserSlots: (userId: string) => Slot[];
  getAvailableSlots: () => Slot[];
  createSlot: (slotData: Omit<Slot, 'id' | 'providerId' | 'providerName' | 'providerAvatar' | 'providerRating' | 'providerReviews' | 'createdAt'>) => void;
  initializeWithSampleData: () => void;
}

export interface BookingsState {
  bookings: Booking[];
  createBooking: (booking: { slotId: string; requesterId: string; message: string }) => void;
  updateBookingStatus: (id: string, status: BookingStatus) => void;
  updateBooking: (id: string, updates: Partial<Booking>) => void;
  getUserBookings: (userId: string) => Booking[];
  getProviderRequests: (providerId: string) => Booking[];
}
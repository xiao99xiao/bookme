import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { BookingsState, Booking } from '@/types';
import { generateId } from '@/lib/utils';

export const useBookingsStore = create<BookingsState>()(
  persist(
    (set, get) => ({
      bookings: [],
      
      createBooking: ({ slotId, requesterId, message }) => {
        const { user } = require('@/stores/auth').useAuthStore.getState();
        if (!user) return;
        
        const newBooking: Booking = {
          id: generateId('booking'),
          slotId,
          requesterId,
          requesterName: user.name,
          requesterEmail: user.email,
          requesterAvatar: user.avatar,
          message,
          status: 'pending',
          createdAt: new Date().toISOString(),
        };
        
        set((state) => ({
          bookings: [...state.bookings, newBooking]
        }));
      },
      
      updateBookingStatus: (id, status) => {
        set((state) => ({
          bookings: state.bookings.map(booking =>
            booking.id === id ? { ...booking, status } : booking
          )
        }));
      },
      
      updateBooking: (id, updates) => {
        set((state) => ({
          bookings: state.bookings.map(booking =>
            booking.id === id ? { ...booking, ...updates } : booking
          )
        }));
      },
      
      getUserBookings: (userId) => {
        return get().bookings.filter(booking => booking.requesterId === userId);
      },
      
      getProviderRequests: (providerId) => {
        const { slots } = require('@/stores/slots').useSlotsStore.getState();
        return get().bookings.filter(booking => {
          const slot = slots.find((s: any) => s.id === booking.slotId);
          return slot?.providerId === providerId;
        });
      },
    }),
    {
      name: 'bookme-bookings',
    }
  )
);
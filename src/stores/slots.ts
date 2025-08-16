import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SlotsState, Slot } from '@/types';
import { generateId, generateAvatar } from '@/lib/utils';

export const useSlotsStore = create<SlotsState>()(
  persist(
    (set, get) => ({
      slots: [],
      
      addSlot: (slotData) => {
        const newSlot: Slot = {
          ...slotData,
          id: generateId('slot'),
          createdAt: new Date().toISOString(),
          status: 'available'
        };
        
        set((state) => ({
          slots: [...state.slots, newSlot]
        }));
      },
      
      updateSlot: (id, updates) => {
        set((state) => ({
          slots: state.slots.map(slot =>
            slot.id === id ? { ...slot, ...updates } : slot
          )
        }));
      },
      
      deleteSlot: (id) => {
        set((state) => ({
          slots: state.slots.filter(slot => slot.id !== id)
        }));
      },
      
      getUserSlots: (userId) => {
        return get().slots.filter(slot => slot.providerId === userId);
      },
      
      getAvailableSlots: () => {
        return get().slots.filter(slot => 
          slot.isActive && 
          new Date(slot.date + 'T' + slot.time) > new Date()
        );
      },
      
      createSlot: (slotData) => {
        const { user } = require('@/stores/auth').useAuthStore.getState();
        if (!user) return;
        
        const newSlot: Slot = {
          ...slotData,
          id: generateId('slot'),
          providerId: user.id,
          providerName: user.name,
          providerAvatar: user.avatar,
          providerRating: user.rating,
          providerReviews: user.reviewCount,
          createdAt: new Date().toISOString(),
        };
        
        set((state) => ({
          slots: [...state.slots, newSlot]
        }));
      },
      
      initializeWithSampleData: () => {
        const currentSlots = get().slots;
        if (currentSlots.length > 0) return;
        
        const sampleSlots: Slot[] = [
          {
            id: generateId('slot'),
            title: 'JavaScript Fundamentals Tutoring',
            description: 'Learn the basics of JavaScript programming with hands-on exercises and real-world examples. Perfect for beginners looking to start their coding journey.',
            category: 'tutoring',
            date: '2024-12-20',
            time: '14:00',
            duration: 90,
            price: 45,
            location: 'online',
            isActive: true,
            providerId: generateId('provider'),
            providerName: 'Sarah Chen',
            providerAvatar: generateAvatar('Sarah Chen'),
            providerRating: 4.8,
            providerReviews: 24,
            createdAt: new Date().toISOString(),
          },
          {
            id: generateId('slot'),
            title: 'Fitness Consultation & Workout Plan',
            description: 'Get a personalized fitness assessment and custom workout plan tailored to your goals. Includes nutrition guidance and progress tracking tips.',
            category: 'fitness',
            date: '2024-12-21',
            time: '10:00',
            duration: 60,
            price: 75,
            location: 'online',
            isActive: true,
            providerId: generateId('provider'),
            providerName: 'Mike Rodriguez',
            providerAvatar: generateAvatar('Mike Rodriguez'),
            providerRating: 4.9,
            providerReviews: 18,
            createdAt: new Date().toISOString(),
          },
          {
            id: generateId('slot'),
            title: 'Career Coaching Session',
            description: 'Professional career guidance session covering resume optimization, interview preparation, and career strategy. Ideal for career transitions.',
            category: 'coaching',
            date: '2024-12-22',
            time: '16:30',
            duration: 75,
            price: 120,
            location: 'phone',
            isActive: true,
            providerId: generateId('provider'),
            providerName: 'Dr. Emily Watson',
            providerAvatar: generateAvatar('Dr. Emily Watson'),
            providerRating: 4.7,
            providerReviews: 31,
            createdAt: new Date().toISOString(),
          },
          {
            id: generateId('slot'),
            title: 'UI/UX Design Consultation',
            description: 'Get expert feedback on your design projects, learn design thinking principles, and improve your portfolio. Suitable for all skill levels.',
            category: 'creative',
            date: '2024-12-23',
            time: '11:00',
            duration: 120,
            price: 95,
            location: 'online',
            isActive: true,
            providerId: generateId('provider'),
            providerName: 'Alex Thompson',
            providerAvatar: generateAvatar('Alex Thompson'),
            providerRating: 4.6,
            providerReviews: 15,
            createdAt: new Date().toISOString(),
          },
          {
            id: generateId('slot'),
            title: 'Python Programming Workshop',
            description: 'Comprehensive Python programming session covering data structures, algorithms, and practical applications. Includes coding exercises.',
            category: 'tutoring',
            date: '2024-12-24',
            time: '13:00',
            duration: 150,
            price: 85,
            location: 'online',
            isActive: true,
            providerId: generateId('provider'),
            providerName: 'David Kim',
            providerAvatar: generateAvatar('David Kim'),
            providerRating: 4.9,
            providerReviews: 42,
            createdAt: new Date().toISOString(),
          },
        ];
        
        set({ slots: sampleSlots });
      },
    }),
    {
      name: 'bookme-slots',
    }
  )
);
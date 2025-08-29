# BookMe - P2P Booking Platform

## Project Overview
BookMe is a **peer-to-peer booking platform** where users can both offer and book services from each other. It's NOT a single business model - every user can be both a service provider and a customer.

## Core Concept
- **Peer-to-Peer (P2P)**: Each user can configure/set up slots AND book other users' slots
- **Dual Role System**: Every user is both a potential provider and booker
- **Service Discovery**: Users can browse and search for available services
- **Real-time Booking**: Request-based booking system with approval workflow

## User Stories

### As a User (General)
- I can register and create an account
- I can login and manage my profile
- I can view my dashboard with all activities
- I can switch between offering services and booking services
- I can receive notifications about booking activities

### As a Service Provider
- I can create time slots for my services
- I can specify service details (title, description, category, price, duration)
- I can choose the format (online, phone, in-person)
- I can manage my available slots
- I can receive and review booking requests
- I can approve or decline booking requests
- I can view my earnings and service history

### As a Service Booker
- I can browse available services by category
- I can search for specific services or providers
- I can view detailed service information
- I can send booking requests with custom messages
- I can track my booking status (pending, confirmed, declined)
- I can cancel my bookings
- I can rate and review completed services

## Technical Architecture

### Frontend Stack (New Implementation)
- **Next.js 14** - React framework with app router
- **TypeScript** - Type safety and better developer experience
- **Tailwind CSS** - Utility-first CSS framework
- **React Hook Form** - Form handling and validation
- **Zustand** - Lightweight state management
- **React Query/TanStack Query** - Server state management

### Data Models

#### User
```typescript
interface User {
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
```

#### Slot (Service Offering)
```typescript
interface Slot {
  id: string;
  providerId: string;
  providerName: string;
  providerAvatar: string;
  providerBio: string;
  title: string;
  description: string;
  category: SlotCategory;
  date: string;
  time: string;
  duration: number; // in minutes
  price: number;
  location: SlotLocation;
  status: SlotStatus;
  bookedBy?: string;
  bookedAt?: string;
  createdAt: string;
}
```

#### Booking
```typescript
interface Booking {
  id: string;
  slotId: string;
  bookerId: string;
  bookerName: string;
  bookerEmail: string;
  bookerAvatar: string;
  message: string;
  status: BookingStatus;
  createdAt: string;
  confirmedAt?: string;
  declinedAt?: string;
  cancelledAt?: string;
  slot: Slot;
}
```

#### Enums and Types
```typescript
type SlotCategory = 'consultation' | 'coaching' | 'tutoring' | 'fitness' | 'creative' | 'other';
type SlotLocation = 'online' | 'phone' | 'in-person';
type SlotStatus = 'available' | 'booked' | 'completed' | 'cancelled';
type BookingStatus = 'pending' | 'confirmed' | 'declined' | 'cancelled' | 'completed';
```

## UI/UX Design Requirements

### Design System
- **Modern, clean interface** with Tailwind CSS
- **Responsive design** - mobile-first approach
- **Glassmorphism effects** and modern gradients
- **Smooth animations** and transitions
- **Accessible** - proper ARIA labels, keyboard navigation
- **Dark mode support** (optional enhancement)

### Color Palette
- **Primary**: Blue tones (#3b82f6, #2563eb)
- **Success**: Green (#10b981)
- **Warning**: Yellow (#f59e0b)
- **Error**: Red (#ef4444)
- **Gray scale**: Modern gray palette

### Typography
- **Headings**: Bold, clear hierarchy
- **Body text**: Readable, good contrast
- **Buttons**: Semibold, clear call-to-actions

## Page Structure

### 1. Landing Page (`/`)
- **Hero section** with value proposition
- **Feature highlights** 
- **Call-to-action** buttons (Browse Services, Start Offering)
- **Social proof** and testimonials (future enhancement)

### 2. Authentication
- **Login modal/page** with email/password
- **Registration modal/page** with profile setup
- **Profile management** page

### 3. Service Discovery (`/discover`)
- **Search and filter** functionality
- **Category-based browsing**
- **Service cards** with provider info
- **Advanced filters** (price range, location, availability)

### 4. Dashboard (`/dashboard`)
- **Overview stats** (bookings, earnings, slots)
- **Tabbed interface**:
  - My Slots (services I offer)
  - My Bookings (services I've booked)
  - Booking Requests (incoming requests)
  - Analytics (future enhancement)

### 5. Profile (`/profile`)
- **Profile information** editing
- **Avatar upload** (future enhancement)
- **Service history** and ratings
- **Account settings**

## Component Structure

### Layout Components
- `Header` - Navigation with user menu
- `Footer` - Simple footer with links
- `Sidebar` - Dashboard navigation (if needed)

### UI Components
- `Button` - Various button styles and states
- `Modal` - Reusable modal component
- `Card` - Service cards, booking cards
- `Avatar` - User avatar component
- `Badge` - Status badges, category badges
- `LoadingSpinner` - Loading states
- `NotificationToast` - Success/error messages

### Feature Components
- `ServiceCard` - Display service information
- `BookingCard` - Display booking information
- `SlotForm` - Create/edit service slots
- `BookingForm` - Create booking requests
- `SearchFilters` - Service discovery filters
- `UserMenu` - Header user dropdown
- `DashboardTabs` - Dashboard navigation

## Key Features

### Authentication System
- **JWT-based authentication** (or session-based)
- **Protected routes** - redirect to login
- **Profile management** with form validation
- **Password reset** (future enhancement)

### Service Management
- **CRUD operations** for service slots
- **Rich form validation** with proper error handling
- **Image upload** for services (future enhancement)
- **Availability calendar** integration

### Booking System
- **Request-approve workflow**
- **Real-time status updates**
- **Email notifications** (future enhancement)
- **Calendar integration** (future enhancement)
- **Payment processing** (future enhancement)

### Search and Discovery
- **Full-text search** across services
- **Category filtering** with intuitive UI
- **Price range filtering**
- **Location-based filtering**
- **Sorting options** (price, rating, date)

### User Experience
- **Responsive design** - works on all devices
- **Fast loading** with optimized images and code
- **Intuitive navigation** with breadcrumbs
- **Helpful error messages** and empty states
- **Smooth animations** and micro-interactions

## Data Persistence

### Current (Demo Mode)
- **localStorage** for demo purposes
- **Client-side state management**
- **Mock data** for development

### Future Enhancement
- **Database integration** (PostgreSQL, MongoDB)
- **REST API** or GraphQL
- **Authentication service** (Auth0, Supabase)
- **File storage** (AWS S3, Cloudinary)

## Technical Decisions Made

### Modal System
- **Simple, reliable implementation** over complex animations
- **Safari compatibility** prioritized
- **Direct CSS styling** over CSS classes for browser compatibility
- **z-index management** with proper layering

### Form Handling
- **React Hook Form** for performance and validation
- **Zod** for schema validation
- **Type-safe forms** with TypeScript

### State Management
- **Zustand** for global state (user, bookings, etc.)
- **React Query** for server state and caching
- **Local state** for UI-specific state

## Development Workflow

### Build Tools
- **Next.js** built-in build system
- **TypeScript** for type checking
- **ESLint** for code linting
- **Prettier** for code formatting
- **Tailwind CSS** for styling

### Testing Strategy (Future)
- **Jest** for unit tests
- **React Testing Library** for component tests
- **Playwright** for E2E tests
- **Storybook** for component documentation

## Deployment Strategy

### Development
- **Next.js dev server** for local development
- **Hot reloading** for fast iteration
- **Environment variables** for configuration

### Production (Future)
- **Vercel** for hosting (recommended for Next.js)
- **CDN** for static assets
- **Environment-based configuration**

## Known Issues from Previous Implementation
- **Modal z-index problems** in Safari
- **JavaScript module loading** issues
- **Complex animation systems** causing browser compatibility issues
- **Global state management** complexity
- **Missing type safety** leading to runtime errors

## Success Criteria
1. **Functional P2P booking system** - users can offer and book services
2. **Modern, responsive UI** - works well on all devices
3. **Type-safe codebase** - minimal runtime errors
4. **Good performance** - fast loading and smooth interactions
5. **Safari compatibility** - works reliably across browsers
6. **Clean, maintainable code** - easy to extend and modify

## Future Enhancements
- **Real-time chat** between providers and bookers
- **Video calling integration** for online services
- **Payment processing** with Stripe
- **Email notifications** system
- **Mobile app** with React Native
- **Advanced analytics** and reporting
- **Multi-language support** (i18n)
- **Admin dashboard** for platform management
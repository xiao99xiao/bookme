# Navigation Structure Redesign Plan

## Overview
Transform the current dashboard-based navigation into a role-based navigation system with a responsive nav bar (desktop) / tab bar (mobile) structure.

## 1. Navigation Bar Structure

### Desktop Navigation Bar
- **Layout**: Divided into 3 sections
- **Left**: Site logo only
- **Center**: Dynamic content based on current page/user role
- **Right**: User avatar button (with dropdown menu) OR "Get Started" button (if not logged in)

### Mobile Navigation Bar  
- **Layout**: Transforms into tab bar
- **Content**: Center + Right sections from desktop become tab items
- **Icons**: Each tab item has an icon (iOS-style) using Lucide React icons
- **Logo**: Site logo removed on mobile

## 2. Page Route Restructuring

### Current → New Route Mapping

#### Customer Routes (moved from /dashboard/ to /customer/)
- `/dashboard/bookings` → `/customer/bookings` (My Bookings)
- `/dashboard/profile` → `/customer/profile` (Profile)
- `/dashboard/messages` → `/customer/messages` (Messages - duplicated from dashboard)

#### Provider Routes (moved from /dashboard/ to /provider/)
- `/dashboard/orders` → `/provider/orders` (Incoming Orders)
- `/dashboard/services` → `/provider/services` (Services)
- `/dashboard/messages` → `/provider/messages` (Messages - same as current)
- `/dashboard/integrations` → `/provider/integrations` (Integrations)

#### Balance Route (moved from /dashboard/ to /)
- `/dashboard/balance` → `/balance` (Balance)

## 3. Navigation Center Content Logic

### User Mode State
- **New state**: `userMode` (stored in browser localStorage)
- **Default value**: Based on user's `is_provider` property
- **Changeable**: Via Provider Mode/Customer Mode menu items
- **Persistence**: Stored locally in browser, persists across sessions

### Not Logged In
- **Center**: Empty/no content
- **Mode state**: Does not exist

### Logged In - Customer Mode (userMode = 'customer')
- **Center Items** (no icons on desktop, with icons on mobile):
  - Bookings (→ /customer/bookings) - `Calendar` icon (mobile only)
  - Messages (→ /customer/messages) - `MessageCircle` icon (mobile only)
  - Profile (→ /customer/profile) - `User` icon (mobile only)

### Logged In - Provider Mode (userMode = 'provider')
- **Center Items** (no icons on desktop, with icons on mobile):
  - Orders (→ /provider/orders) - `ClipboardList` icon (mobile only)
  - Services (→ /provider/services) - `Settings` icon (mobile only)
  - Messages (→ /provider/messages) - `MessageCircle` icon (mobile only)
  - Integrations (→ /provider/integrations) - `Plug` icon (mobile only)

## 4. User Avatar Dropdown Menu (Dynamic)
- **💰 Balance** (→ /balance) - `Wallet` icon
- **Split line**
- **🔄 Provider Mode** (→ /provider/orders) - shown when userMode = 'customer' - `Briefcase` icon
- **🔄 Customer Mode** (→ /customer/bookings) - shown when userMode = 'provider' - `User` icon
- **Split line**
- **🚪 Logout** - `LogOut` icon

## 5. User Role Detection & Default Landing

### User Property Check
- Check if user has `is_provider` property in their profile
- Property already exists in database schema

### Mode Initialization
- **On login**: Set userMode to user's `is_provider` value ('provider' or 'customer')
- **On page load**: Check localStorage for existing userMode
- **If no stored mode**: Use user's `is_provider` property as default

### Default Landing Logic (`/`)
- **If userMode = 'provider'**: Redirect to `/provider/orders`
- **If userMode = 'customer'**: Redirect to `/customer/bookings`
- **If not logged in**: Stay on landing page

## 6. Required File Changes

### New Components to Create
1. **Navigation Component** (`src/components/Navigation.tsx`)
   - Desktop nav bar with 3-section layout
   - Mobile tab bar transformation
   - Dynamic center content based on route
   - User avatar dropdown menu with dynamic Provider/Customer mode

### Pages to Move/Create
1. **Customer Pages** (move from /dashboard/ to /customer/)
   - Move `src/pages/dashboard/DashboardBookings.tsx` → `src/pages/customer/CustomerBookings.tsx`
   - Move `src/pages/dashboard/Profile.tsx` → `src/pages/customer/CustomerProfile.tsx`
   - Duplicate `src/pages/dashboard/Messages.tsx` → `src/pages/customer/CustomerMessages.tsx`

2. **Provider Pages** (move from /dashboard/ to /provider/)
   - Move `src/pages/dashboard/DashboardOrders.tsx` → `src/pages/provider/ProviderOrders.tsx`
   - Move `src/pages/dashboard/DashboardServices.tsx` → `src/pages/provider/ProviderServices.tsx`
   - Move `src/pages/dashboard/Messages.tsx` → `src/pages/provider/ProviderMessages.tsx`
   - Move `src/pages/dashboard/DashboardIntegrations.tsx` → `src/pages/provider/ProviderIntegrations.tsx`

3. **Balance Page** (move from /dashboard/ to /)
   - Move `src/pages/dashboard/DashboardBalance.tsx` → `src/pages/Balance.tsx`

### Router Configuration Updates
- Update route definitions in main router file
- Add route guards for customer/provider sections
- Update navigation links and redirects
- Add default landing route logic with user role check

### Layout Updates
- Integrate Navigation component into main layout
- Remove existing dashboard navigation
- Ensure responsive behavior for mobile/desktop

## 7. Deep Changes Required

### Database Schema (if needed)
- Verify `users` table has `isProvider` boolean field
- Add migration if field doesn't exist

### Authentication & Role Detection
- Determine when to show customer vs provider navigation
- Handle transitions between customer/provider modes
- Update user context to include role information

### State Management
- Update any navigation state management
- Ensure consistent active states across nav items
- Track current mode (customer/provider) in context

### Mobile Responsiveness
- Implement tab bar layout for mobile using Lucide React icons
- Handle touch interactions
- Ensure proper icon sizing and spacing

### URL/Routing Updates
- Update all internal links to use new routes
- Add redirects from old routes to new routes
- Update any hardcoded route references
- Remove `/dashboard/` routes completely after migration

### Component Dependencies
- Update imports in components that reference moved pages
- Update any route-based conditional logic
- Install Lucide React if not already installed

## 8. Icon Library & Specific Icons (Lucide React)

### Navigation Icons
- **Bookings**: `Calendar`
- **Messages**: `MessageCircle` 
- **Profile**: `User`
- **Orders**: `ClipboardList`
- **Services**: `Settings`
- **Integrations**: `Plug`

### Menu Icons
- **Balance**: `Wallet`
- **Provider Mode**: `Briefcase`
- **Customer Mode**: `User`
- **Logout**: `LogOut`

## 9. Implementation Phases

### Phase 1: Infrastructure
- Add Navigation component
- Update router with new routes
- Add user role detection logic

### Phase 2: Page Migration
- Move and rename dashboard pages
- Update imports and dependencies
- Keep messages identical for now

### Phase 3: Integration & Testing
- Integrate navigation into main layout
- Test responsive behavior
- Verify role-based navigation

### Phase 4: Cleanup
- Remove old dashboard routes
- Update any remaining references
- Clean up unused components

## 10. Verification Checklist

✅ Nav bar with 3 parts on desktop (left: logo, center: dynamic, right: user avatar/get started)  
✅ Tab bar on mobile (no logo, center+right become tab content with icons)  
✅ Empty center when not logged in  
✅ Customer navigation: Bookings, Messages, Profile (moved to /customer/)  
✅ Provider navigation: Orders, Services, Messages, Integrations (moved to /provider/)  
✅ Messages page duplicated for customer (different future functionality)  
✅ User avatar menu: Balance, Provider/Customer Mode (dynamic), Logout  
✅ Balance moved to root level (/)  
✅ All dashboard pages relocated to appropriate role-based sections  
✅ Dynamic Provider/Customer Mode menu item based on current section  
✅ User property-based default landing logic  
✅ Role-based menu item switching  
✅ Identical messages pages initially  
✅ Lucide React icons for modern, consistent iconography  
✅ Complete dashboard removal after migration  

## 11. Technical Considerations

### Dependencies
- Ensure Lucide React is installed (`npm install lucide-react`)
- Update any routing dependencies if needed

### Responsive Breakpoints
- Define clear breakpoints for desktop/mobile navigation switching
- Ensure smooth transitions between layouts

### Accessibility
- Proper ARIA labels for navigation items
- Keyboard navigation support
- Screen reader compatibility

### Performance
- Lazy load route components where appropriate
- Optimize icon loading and rendering
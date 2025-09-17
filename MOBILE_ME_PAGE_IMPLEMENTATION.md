# Mobile "Me" Page Implementation Plan

## Overview
Create a mobile-only "Me" page following iOS 2024 design patterns while conforming to the existing BookMe design system. This page will serve as a centralized account management hub accessible via the bottom tab navigation.

## Design Specifications

### Visual Style
- **Background**: Use existing `bg-gray-50` (#FAFAFA) for main background
- **Cards/Groups**: White rounded cards with subtle borders
- **Spacing**: Consistent with existing mobile layouts (px-4 py-6)
- **Typography**: Follow existing font system (Spectral for headings, Baloo 2 for body)
- **Interactive Elements**: Touch-friendly with proper tap targets (min 44px height)

### iOS-Style Grouped Lists (2024)
```
┌─────────────────────────────┐
│  [Avatar] User Name         │ → Tappable row
│           email@example.com  │
└─────────────────────────────┘

┌─────────────────────────────┐
│  Username         @johndoe > │
├─────────────────────────────┤
│  Timezone         GMT-8    > │
├─────────────────────────────┤
│  Integrations              > │ (Provider only)
└─────────────────────────────┘

┌─────────────────────────────┐
│  Switch to Provider Mode     │
└─────────────────────────────┘

┌─────────────────────────────┐
│  💳 Wallet Balance           │
│     125.50 USDC             │
│  [Fund] [Withdraw]          │
└─────────────────────────────┘

┌─────────────────────────────┐
│  Log Out                    │
└─────────────────────────────┘
```

## Implementation Steps

### Step 1: Create MobileMePage Component
**File**: `src/pages/mobile/MobileMePage.tsx`

#### Component Structure:
1. **Authentication Check**
   - If not logged in: Show auth UI similar to `/auth` page
   - If logged in: Show full Me page

2. **Grouped Sections**:
   - User Profile Section
   - Settings Section (Username, Timezone, Integrations)
   - Mode Switch Section
   - Wallet Section
   - Actions Section (Logout)

3. **Navigation Handlers**:
   - Profile → `/settings/profile`
   - Username → `/settings/customize`
   - Timezone → `/settings/timezone`
   - Integrations → `/provider/integrations`

### Step 2: Update Mobile Navigation
**File**: `src/components/NewNavigation.tsx`

#### Changes:
1. **Tab Configuration**:
   - Customer: Remove 2-column grid, use 3-column (Bookings, Messages, Me)
   - Provider: Change from 4-column to 3-column (Orders, Services, Messages)
   - Remove Integrations tab for providers

2. **Add Me Tab**:
   ```tsx
   { to: '/me', icon: User, label: 'Me' }
   ```

3. **Grid Layout Update**:
   ```tsx
   <div className="grid grid-cols-3"> // Always 3 columns now
   ```

### Step 3: Add Route Configuration
**File**: `src/App.tsx`

Add new route:
```tsx
<Route
  path="/me"
  element={
    <ProtectedRoute requireAuth={false}>
      <MobileMePage />
    </ProtectedRoute>
  }
/>
```

### Step 4: Create Reusable Components

#### GroupedListItem Component
**File**: `src/components/mobile/GroupedListItem.tsx`
- Reusable row component for settings items
- Props: label, value, onClick, icon, showChevron

#### GroupedListSection Component
**File**: `src/components/mobile/GroupedListSection.tsx`
- Container for grouped items
- White background, rounded corners, border

### Step 5: Implement Wallet Section
- Display USDC balance from existing balance data
- Use existing funding functionality from Balance page
- Add withdraw functionality (if not already present)

### Step 6: Mode Switching
- Reuse logic from `NewNavigation.tsx`
- Show "Become Provider" for non-providers
- Show "Switch to Customer/Provider Mode" for providers
- Update localStorage and navigation on switch

## Component Details

### MobileMePage Structure
```tsx
const MobileMePage = () => {
  // Auth and profile hooks
  const { authenticated, profile, userId, logout } = useAuth();

  // Mode management
  const [userMode, setUserMode] = useState<'customer' | 'provider'>();

  // Wallet/balance state
  const [balance, setBalance] = useState();

  // Navigation
  const navigate = useNavigate();

  // If not authenticated, show auth UI
  if (!authenticated) {
    return <MobileAuthView />;
  }

  return (
    <div className="lg:hidden min-h-screen bg-gray-50">
      {/* User Profile Section */}
      {/* Settings Section */}
      {/* Mode Switch Section */}
      {/* Wallet Section */}
      {/* Logout Section */}
    </div>
  );
};
```

## Navigation Tab Updates

### Before (Provider Mode):
```
[Orders] [Services] [Messages] [Integrations]
```

### After (Both Modes):
```
Customer: [Bookings] [Messages] [Me]
Provider: [Orders] [Services] [Messages] [Me]
```

## Testing Checklist
- [ ] Me page only shows on mobile (hidden on desktop)
- [ ] Auth state properly handled
- [ ] All navigation links work correctly
- [ ] Mode switching updates tabs appropriately
- [ ] Wallet balance displays correctly
- [ ] Fund/Withdraw buttons functional
- [ ] Logout properly clears state
- [ ] Visual design matches iOS 2024 patterns
- [ ] Conforms to existing design system

## Color Palette (from existing design system)
- Background: `#FAFAFA` (bg-gray-50)
- Cards: `#FFFFFF` (bg-white)
- Borders: `#EEEEEE` (border-[#eeeeee])
- Text Primary: `#000000` (text-black)
- Text Secondary: `#666666` (text-[#666666])
- Chevrons/Icons: `#999999` (text-gray-400)
- Destructive: `#F1343D` (text-[#F1343D])

## Typography
- Section Headers: H3 component (Spectral font)
- List Items: Text component with variant="small" (Baloo 2)
- Values: Description component for secondary text

## Spacing Guidelines
- Page padding: `px-4 py-6`
- Section spacing: `space-y-4`
- Item padding: `p-4`
- Button padding: `px-4 py-2`

## Implementation Order
1. Create MobileMePage component with basic structure
2. Update navigation to add Me tab and remove Integrations
3. Add route configuration
4. Implement user profile section
5. Add settings section with navigation
6. Implement mode switching
7. Add wallet/balance section
8. Add logout functionality
9. Test all features on mobile
10. Verify desktop shows no Me tab/page
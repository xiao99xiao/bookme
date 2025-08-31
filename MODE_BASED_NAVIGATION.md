# Mode-Based Navigation Implementation Plan

## Overview
Transform the path-based navigation logic to a mode-based system where navigation content is determined by a user's current mode (customer/provider) rather than the URL path they're on.

## Key Changes from Previous Implementation

### 1. Remove Path-Based Logic
**Previous**: Navigation center content was determined by checking if user was on `/customer/*` or `/provider/*` paths
**New**: Navigation center content is determined solely by `userMode` state

### 2. Add User Mode State
**State Name**: `userMode`
**Type**: `'customer' | 'provider'`
**Storage**: Browser localStorage (persists across sessions)
**Default**: Set based on user's `is_provider` database property
- If `is_provider = true` → default mode is `'provider'`
- If `is_provider = false` → default mode is `'customer'`

### 3. Mode Switching Logic
**Trigger**: User clicks "Provider Mode" or "Customer Mode" in avatar dropdown menu
**Action**: 
1. Update `userMode` state
2. Save to localStorage
3. Update navigation center content immediately
4. Navigate to appropriate landing page for that mode

**Menu Display**:
- When `userMode = 'customer'`: Show "Provider Mode" option
- When `userMode = 'provider'`: Show "Customer Mode" option

## Implementation Details

### State Management
```typescript
// User mode state management
interface UserModeContext {
  userMode: 'customer' | 'provider' | null;
  setUserMode: (mode: 'customer' | 'provider') => void;
  initializeMode: (isProvider: boolean) => void;
}
```

### LocalStorage Keys
- **Key**: `bookme_user_mode`
- **Value**: `'customer'` or `'provider'`
- **Cleared on**: User logout

### Mode Initialization Flow
1. **User logs in** → Check if localStorage has `bookme_user_mode`
2. **If exists** → Use stored mode
3. **If not exists** → Use user's `is_provider` property as default
4. **Store in localStorage** → Persist for future sessions

### Navigation Center Content
```typescript
// Determine navigation items based on mode
const getNavigationItems = (userMode: string | null) => {
  if (!userMode) return []; // Not logged in
  
  if (userMode === 'customer') {
    return [
      { label: 'Bookings', path: '/customer/bookings', icon: Calendar },
      { label: 'Messages', path: '/customer/messages', icon: MessageCircle },
      { label: 'Profile', path: '/customer/profile', icon: User }
    ];
  }
  
  if (userMode === 'provider') {
    return [
      { label: 'Orders', path: '/provider/orders', icon: ClipboardList },
      { label: 'Services', path: '/provider/services', icon: Settings },
      { label: 'Messages', path: '/provider/messages', icon: MessageCircle },
      { label: 'Integrations', path: '/provider/integrations', icon: Plug }
    ];
  }
};
```

### Mode Switching Function
```typescript
const handleModeSwitch = () => {
  const newMode = userMode === 'customer' ? 'provider' : 'customer';
  
  // Update state
  setUserMode(newMode);
  
  // Save to localStorage
  localStorage.setItem('bookme_user_mode', newMode);
  
  // Navigate to appropriate landing
  if (newMode === 'provider') {
    navigate('/provider/orders');
  } else {
    navigate('/customer/bookings');
  }
};
```

## Files to Modify

### 1. NewNavigation.tsx
**Remove**:
- Path checking logic (`isCustomerSection`, `isProviderSection`)
- Conditional rendering based on pathname

**Add**:
- `userMode` state management
- localStorage read/write
- Mode-based navigation rendering
- Mode switching handler

### 2. PrivyAuthContext.tsx (or create new ModeContext)
**Add**:
- `userMode` state
- `setUserMode` function
- Mode initialization on login
- Mode persistence logic

### 3. App.tsx
**Update**:
- Default landing redirect based on `userMode` instead of `is_provider`

## Benefits of This Approach

1. **Flexibility**: Users can switch between modes without changing their account type
2. **Persistence**: Mode preference is remembered across sessions
3. **Simplicity**: Navigation logic is centralized and not dependent on URL paths
4. **User Experience**: Smooth transitions between customer and provider views
5. **Consistency**: Navigation stays consistent regardless of which page user is on

## Migration Checklist

- [ ] Remove all `location.pathname.startsWith('/customer')` checks
- [ ] Remove all `location.pathname.startsWith('/provider')` checks
- [ ] Add `userMode` state to context or component
- [ ] Implement localStorage read/write for mode persistence
- [ ] Update navigation center rendering to use `userMode`
- [ ] Update dropdown menu to show mode switch based on current mode
- [ ] Update default landing logic to use `userMode`
- [ ] Test mode switching functionality
- [ ] Test persistence across page refreshes
- [ ] Test logout clears stored mode
- [ ] Ensure mode initializes correctly for new users

## Edge Cases to Handle

1. **New User Registration**: Default to 'customer' mode unless they register as provider
2. **Corrupted localStorage**: Fallback to user's `is_provider` property
3. **Mode Switch During Active Session**: Update navigation immediately without page refresh
4. **Direct URL Access**: Allow users to access any URL regardless of mode (navigation adjusts to mode)
5. **Logout**: Clear stored mode from localStorage

## Testing Scenarios

1. **First-time Login**:
   - Provider logs in → Should default to provider mode
   - Customer logs in → Should default to customer mode

2. **Mode Switching**:
   - Customer switches to provider mode → Navigation updates, redirects to /provider/orders
   - Provider switches to customer mode → Navigation updates, redirects to /customer/bookings

3. **Persistence**:
   - Set mode, refresh page → Mode should persist
   - Set mode, close browser, reopen → Mode should persist

4. **Logout/Login**:
   - Logout → Clear stored mode
   - Login again → Use default based on `is_provider` unless localStorage has value

5. **Direct Navigation**:
   - In customer mode, directly navigate to /provider/services → Should work, navigation shows customer items
   - In provider mode, directly navigate to /customer/bookings → Should work, navigation shows provider items
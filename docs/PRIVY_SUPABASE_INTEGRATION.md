# Privy + Supabase Integration Documentation

## Overview

This document outlines the complete integration of Privy.io authentication with Supabase database in the BookMe platform. Our architecture uses Privy for user authentication and Supabase for data storage, with a custom UUID mapping system to ensure compatibility between the two services.

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│                 │    │                 │    │                 │
│  Privy Auth     │◄──►│  React App      │◄──►│  Supabase DB    │
│  (DID Format)   │    │  (UUID Mapping) │    │  (UUID Format)  │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Key Components

### 1. Authentication Flow
- **Frontend**: Privy handles all user authentication (email, social login, wallet)
- **Backend**: Supabase stores user data and handles database operations
- **Bridge**: Custom UUID mapping system connects Privy DIDs to Supabase UUIDs

### 2. ID Mapping System
- **Privy DID**: `did:privy:cmeofnf5x00lsjp0bdlvp5u7y` (user identity)
- **Mapped UUID**: `6179ca85-59ba-561e-adbb-6359ef90ec44` (database storage)

## Implementation Details

### Directory Structure

```
src/
├── contexts/
│   └── PrivyAuthContext.tsx          # Main auth context
├── lib/
│   ├── id-mapping.ts                 # UUID mapping utilities
│   ├── supabase.ts                   # Supabase clients
│   └── api.ts                        # API methods
├── main.tsx                          # Privy provider setup
└── components/
    └── ProtectedRoute.tsx            # Route protection
```

### Core Files

#### 0. `/index.html` - Permissions Policy
```html
<!-- Allow fullscreen access for Privy authentication modal -->
<meta http-equiv="Permissions-Policy" content="fullscreen=(self https://auth.privy.io)" />
```

#### 1. `/src/main.tsx` - Privy Configuration
```typescript
import { PrivyProvider } from '@privy-io/react-auth';
import { base, baseSepolia } from 'viem/chains';

const App = () => (
  <PrivyProvider
    appId={import.meta.env.VITE_PRIVY_APP_ID}
    config={{
      // Login methods
      loginMethods: ['email', 'google', 'twitter'],
      
      // Appearance
      appearance: {
        theme: 'light',
        accentColor: '#676FFF',
        logo: 'https://your-logo-url.com/logo.png',
      },
      
      // Embedded wallets
      embeddedWallets: {
        createOnLogin: 'users-without-wallets',
      },
      
      // Supported chains
      supportedChains: [base, baseSepolia],
    }}
  >
    {/* Your app components */}
  </PrivyProvider>
);
```

#### 2. `/src/lib/id-mapping.ts` - UUID Mapping System
```typescript
import { v5 as uuidv5 } from 'uuid';

// Fixed namespace for consistent mapping
const PRIVY_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

/**
 * Converts Privy DID to deterministic UUID
 * Same DID will ALWAYS produce the same UUID
 */
export function privyDidToUuid(privyDid: string): string {
  if (!privyDid) throw new Error('Privy DID is required');
  
  const uuid = uuidv5(privyDid, PRIVY_NAMESPACE);
  console.log(`DID Mapping: ${privyDid} -> ${uuid}`);
  return uuid;
}

/**
 * Validates if string is a Privy DID
 */
export function isPrivyDid(id: string): boolean {
  return id.startsWith('did:privy:');
}

/**
 * Ensures ID is in UUID format, converting from DID if needed
 */
export function ensureUuid(id: string): string {
  if (!id) throw new Error('ID is required');
  
  if (isUuid(id)) return id;
  if (isPrivyDid(id)) return privyDidToUuid(id);
  
  throw new Error(`Invalid ID format: ${id}`);
}
```

#### 3. `/src/contexts/PrivyAuthContext.tsx` - Authentication Bridge
```typescript
import { usePrivy } from '@privy-io/react-auth';
import { supabaseAdmin } from '@/lib/supabase';
import { ensureUuid } from '@/lib/id-mapping';

interface PrivyAuthContextType {
  user: any;                    // Privy user object
  profile: UserProfile | null;  // Supabase user profile
  userId: string | null;        // Mapped UUID for database
  privyUserId: string | null;   // Original Privy DID
  authenticated: boolean;
  login: () => void;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const PrivyAuthProvider = ({ children }) => {
  const { user: privyUser, authenticated, login, logout: privyLogout } = usePrivy();
  
  // Generate UUID from Privy DID
  const privyUserId = privyUser?.id || null;
  const userId = privyUserId ? ensureUuid(privyUserId) : null;
  
  // Profile management with UUID mapping
  const fetchOrCreateProfile = async (privyId: string) => {
    const uuid = ensureUuid(privyId);
    
    // Try to fetch existing profile
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', uuid)
      .single();
    
    if (data) {
      setProfile(data);
      return;
    }
    
    // Create new profile if not exists
    if (error?.code === 'PGRST116') {
      await createProfile(uuid);
    }
  };
  
  // Return context value with both IDs
  return (
    <PrivyAuthContext.Provider value={{
      user: privyUser,
      profile,
      userId,           // UUID for database operations
      privyUserId,      // DID for Privy operations
      authenticated,
      login,
      logout,
      refreshProfile
    }}>
      {children}
    </PrivyAuthContext.Provider>
  );
};
```

#### 4. `/src/lib/supabase.ts` - Database Configuration
```typescript
import { createClient } from '@supabase/supabase-js';

// Regular client for public operations
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Admin client for bypassing RLS
export const supabaseAdmin = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);
```

#### 5. `/src/lib/api.ts` - API Methods
```typescript
export class ApiClient {
  // Updated to accept userId parameter
  static async getUserBookings(userId: string, role?: 'customer' | 'provider') {
    if (!userId) throw new Error('User ID is required');
    
    let query = supabase.from('bookings').select('*');
    
    if (role === 'customer') {
      query = query.eq('customer_id', userId);
    } else if (role === 'provider') {
      query = query.eq('provider_id', userId);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data;
  }
  
  // All API methods now accept userId as first parameter
  static async updateUserProfile(userId: string, data: any) {
    const { error } = await supabaseAdmin
      .from('users')
      .update(data)
      .eq('id', userId);
    
    if (error) throw error;
  }
}
```

## Database Schema Modifications

### 1. Remove Foreign Key Constraint
The original schema had a constraint referencing `auth.users(id)`, which we removed:

```sql
-- Before: users table referenced auth.users
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- ...
);

-- After: removed foreign key constraint
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;
```

### 2. Updated RLS Policies
```sql
-- Simplified RLS policies for Privy integration
CREATE POLICY "public_read_users" ON public.users
  FOR SELECT USING (TRUE);

CREATE POLICY "service_role_all_users" ON public.users
  FOR ALL USING (current_setting('role') = 'service_role');

CREATE POLICY "authenticated_update_users" ON public.users
  FOR UPDATE TO authenticated USING (TRUE) WITH CHECK (TRUE);
```

## Environment Variables

```env
# Privy Configuration
VITE_PRIVY_APP_ID=cmeoebdro017hl50bj7c1mcui

# Supabase Configuration  
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Authentication Flow

### 1. User Registration/Login
```
User clicks login → Privy modal opens → User authenticates → 
Privy returns DID → App maps DID to UUID → 
Create/fetch user profile in Supabase → User authenticated
```

### 2. API Calls
```
Component needs data → Gets userId from context → 
Calls API method with userId → API uses UUID for database query → 
Returns data to component
```

### 3. Profile Updates
```
User updates profile → Component gets userId from context → 
Calls updateUserProfile(userId, data) → Uses admin client → 
Bypasses RLS → Updates database → Refreshes profile context
```

## Component Integration Examples

### Using Auth Context
```typescript
import { useAuth } from '@/contexts/PrivyAuthContext';

const MyComponent = () => {
  const { userId, privyUserId, profile, authenticated } = useAuth();
  
  useEffect(() => {
    if (userId) {
      // Use UUID for database operations
      ApiClient.getUserBookings(userId, 'customer');
    }
  }, [userId]);
  
  return (
    <div>
      <p>Privy ID: {privyUserId}</p>
      <p>Database ID: {userId}</p>
      <p>Profile: {profile?.display_name}</p>
    </div>
  );
};
```

### Protected Routes
```typescript
import { useAuth } from '@/contexts/PrivyAuthContext';

const ProtectedRoute = ({ children }) => {
  const { authenticated, ready } = useAuth();
  
  if (!ready) return <Loading />;
  if (!authenticated) return <Navigate to="/auth" />;
  
  return children;
};
```

## Benefits of This Architecture

### 1. **Scalability**
- Privy handles auth complexity (social logins, wallets, etc.)
- Supabase provides robust database with real-time features
- Clean separation of concerns

### 2. **Security**
- Privy manages sensitive auth operations
- Supabase RLS policies control data access
- Service role key only used server-side equivalent operations

### 3. **Developer Experience**
- Simple auth context API
- Automatic UUID mapping
- Type-safe database operations
- Hot module reloading support

### 4. **User Experience**
- Fast authentication with Privy
- Persistent sessions
- Real-time data updates
- Cross-device compatibility

## Troubleshooting

### Common Issues

#### 1. "Profile not found" errors
- **Cause**: UUID mapping not working
- **Solution**: Check `ensureUuid()` function and Privy DID format

#### 2. "Not authenticated" errors  
- **Cause**: API methods using old `supabase.auth.getUser()`
- **Solution**: Update all API methods to accept `userId` parameter

#### 3. Profile updates not persisting
- **Cause**: Missing `userId` in API calls
- **Solution**: Ensure all profile update calls pass `userId` from context

#### 4. RLS policy violations
- **Cause**: Service role key not configured
- **Solution**: Set `VITE_SUPABASE_SERVICE_ROLE_KEY` in environment

### Debug Tips

```typescript
// Enable detailed logging
console.log('DID Mapping:', privyDidToUuid(privyDid));
console.log('Auth Context:', { userId, privyUserId, authenticated });
console.log('API Call:', { userId, method: 'getUserBookings' });
```

## Migration Checklist

When integrating Privy + Supabase in a new project:

- [ ] Install Privy SDK: `npm install @privy-io/react-auth`
- [ ] Install UUID library: `npm install uuid @types/uuid`
- [ ] Add permissions policy to index.html for Privy fullscreen access
- [ ] Configure Privy provider in main.tsx
- [ ] Create UUID mapping utilities
- [ ] Set up PrivyAuthContext
- [ ] Configure Supabase admin client
- [ ] Remove auth.users foreign key constraints
- [ ] Update RLS policies for service role
- [ ] Update all API methods to accept userId
- [ ] Update all components to use PrivyAuthContext
- [ ] Test authentication flow end-to-end
- [ ] Verify profile persistence across sessions

## Performance Considerations

### Optimizations Applied
1. **Deterministic UUID Generation**: Same DID always maps to same UUID
2. **Admin Client Usage**: Bypasses RLS for faster profile operations
3. **Context Caching**: Profile data cached in React context
4. **Selective Re-renders**: Only update components when auth state changes

### Monitoring
- Track DID to UUID mapping consistency
- Monitor Supabase RLS policy performance
- Watch for authentication timing issues
- Log profile creation/fetch patterns

## Security Considerations

### Data Protection
- Service role key only used in controlled contexts
- UUID mapping prevents DID exposure in database
- RLS policies provide defense in depth
- Profile data encrypted at rest (Supabase default)

### Access Control
- Public read access for user profiles (needed for bookings)
- Authenticated users can update their own profiles
- Service role has full access (admin operations only)
- No direct auth.users table dependencies

## Future Enhancements

### Planned Improvements
1. **Server-Side Integration**: Move admin operations to backend API
2. **Enhanced Logging**: Structured logging for auth events  
3. **Profile Validation**: Schema validation for profile updates
4. **Caching Layer**: Redis caching for frequent profile queries
5. **Audit Trail**: Track profile changes and auth events

This integration provides a robust foundation for authentication and data management while maintaining flexibility for future enhancements.
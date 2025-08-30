# Edge Functions Deployment Checklist

## Pre-Deployment Verification ✅

### 1. Edge Functions Code Review
- [x] UUID generation matches frontend exactly (using uuid v5 library)
- [x] Privy token verification has proper error handling
- [x] Email extraction from linkedAccounts matches frontend logic
- [x] Booking creation uses correct database fields
- [x] Service fee calculation included (10% platform fee)

### 2. Critical Issues Fixed
- [x] Import proper UUID library instead of custom implementation
- [x] Extract email from linkedAccounts array, not privyUser.email
- [x] Use scheduled_at instead of date field for bookings
- [x] Include all required booking fields (location, is_online, etc.)

## Deployment Steps 🚀

### Phase 1: Deploy Edge Functions (Without Breaking Current App)

#### 1. Install Supabase CLI

**For macOS (recommended):**
```bash
# Using Homebrew
brew install supabase/tap/supabase

# Verify installation
supabase --version
```

**Alternative - Direct Download:**
```bash
# For Mac with Apple Silicon (M1/M2/M3)
curl -o supabase https://github.com/supabase/cli/releases/latest/download/supabase-darwin-arm64
chmod +x supabase
sudo mv supabase /usr/local/bin/

# For Mac with Intel
curl -o supabase https://github.com/supabase/cli/releases/latest/download/supabase-darwin-amd64
chmod +x supabase
sudo mv supabase /usr/local/bin/
```

#### 2. Initialize and Link Your Project
```bash
# Initialize Supabase in your project (if not already done)
supabase init

# Login to Supabase (will open browser)
supabase login

# Link to your project (get project-ref from your Supabase URL)
# Your URL: https://esfowzdgituqktemrmle.supabase.co
# Your project-ref: esfowzdgituqktemrmle
supabase link --project-ref esfowzdgituqktemrmle
```

#### 3. Set Environment Variables in Supabase Dashboard

**Navigate to: Project Settings → Edge Functions → Secrets**

Add these environment variables:
```bash
# Get these from your Privy Dashboard (https://dashboard.privy.io)
PRIVY_APP_ID=<your_privy_app_id>
PRIVY_APP_SECRET=<your_privy_app_secret>

# These are automatically available in Edge Functions:
# SUPABASE_URL (already set)
# SUPABASE_ANON_KEY (already set)
# SUPABASE_SERVICE_ROLE_KEY (already set)
# SUPABASE_JWT_SECRET (already set)
```

#### 4. Deploy the Edge Functions
```bash
# Deploy auth-exchange function
supabase functions deploy auth-exchange

# Deploy create-booking function
supabase functions deploy create-booking

# Verify deployment
supabase functions list
```

#### 5. Test Edge Functions Locally (Optional)
```bash
# Serve functions locally for testing
supabase functions serve

# In another terminal, test the auth exchange
curl -X POST http://localhost:54321/functions/v1/auth-exchange \
  -H "Authorization: Bearer <your-privy-access-token>" \
  -H "Content-Type: application/json" \
  -d '{"action": "exchange-token"}'
```

#### 6. Test Edge Functions in Production
```bash
# Get a Privy access token from your app (check browser DevTools)
# Look for getAccessToken() calls or Authorization headers

# Test auth exchange
curl -X POST https://esfowzdgituqktemrmle.supabase.co/functions/v1/auth-exchange \
  -H "Authorization: Bearer <privy-access-token>" \
  -H "Content-Type: application/json" \
  -d '{"action": "exchange-token"}'

# Expected response:
# {
#   "token": "eyJhbGciOiJIUzI1NiIs...",
#   "userId": "550e8400-e29b-41d4-a716-446655440000",
#   "privyId": "did:privy:..."
# }
```

### Phase 2: Gradual Frontend Migration

#### Step 1: Test useSupabaseAuth Hook in Development
```bash
# Start dev server
npm run dev

# Test the hook in a component:
# 1. Import: import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
# 2. Use: const { supabase, loading, userId } = useSupabaseAuth()
# 3. Verify: console.log('Authenticated userId:', userId)
```

#### Step 2: Migrate Read Operations (Non-Breaking)
```typescript
// Example: Update a component to use authenticated client
// Before:
import { supabaseAdmin } from '@/lib/supabase'
const { data } = await supabaseAdmin.from('services').select('*')

// After:
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
const { supabase } = useSupabaseAuth()
const { data } = await supabase.from('services').select('*')
```

#### Step 3: Migrate Critical Write Operations
```typescript
// For booking creation, use the Edge Function:
const { supabase } = useSupabaseAuth()
const response = await fetch(
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-booking`,
  {
    method: 'POST',
    headers: {
      'Authorization': supabase.auth.session?.access_token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      serviceId,
      scheduledAt,
      customerNotes,
      location,
      isOnline
    })
  }
)
```

#### Step 4: Enable RLS Policies in Supabase
```bash
# Connect to your Supabase SQL Editor
# Dashboard → SQL Editor → New Query

# Copy and run the contents of:
# database/enable-rls-with-jwt.sql

# Or run via CLI:
supabase db push --db-url "postgresql://postgres:[YOUR-PASSWORD]@db.esfowzdgituqktemrmle.supabase.co:5432/postgres"
```

#### Step 5: Remove Admin Client
```bash
# 1. Remove service role key from environment
grep -v "VITE_SUPABASE_SERVICE_ROLE_KEY" .env.local > .env.local.tmp && mv .env.local.tmp .env.local

# 2. Update imports in your code
# Find all supabaseAdmin usage:
grep -r "supabaseAdmin" src/

# 3. Replace with authenticated client from useSupabaseAuth hook
```

## Current Code Impact Analysis 📊

### Files That Need Updates:

#### High Priority (Direct supabaseAdmin usage):
- `/src/lib/api.ts` - 15+ methods using supabaseAdmin
- `/src/contexts/PrivyAuthContext.tsx` - Profile creation/fetching
- `/src/lib/meeting-generation.ts` - Booking updates
- `/src/pages/dashboard/IntegrationsCallback.tsx` - OAuth integration

#### Medium Priority (Component updates):
- All dashboard pages that call ApiClient methods
- Profile pages
- Service management components

#### Low Priority (Already compatible):
- UI components
- Utility functions
- Types and interfaces

## Testing Plan 🧪

### Before Deployment:

#### 1. Test UUID Generation Match
```javascript
// In browser console (your app):
import { privyDidToUuid } from '@/lib/id-mapping'
const testDid = 'did:privy:test123'
console.log('Frontend UUID:', privyDidToUuid(testDid))
// Should output: deterministic UUID

// In Edge Function, add temporary logging:
console.log('Edge Function UUID:', privyDidToUuid('did:privy:test123'))
// Both should produce the SAME UUID
```

#### 2. Get Privy Access Token for Testing
```javascript
// In your app's browser console:
const { getAccessToken } = usePrivy()
const token = await getAccessToken()
console.log('Privy Token:', token)
// Copy this token for curl testing
```

#### 3. Test Complete Booking Flow
```bash
# First get a service ID from your database
supabase db dump --data-only -t services | head -20

# Test booking creation with all fields
curl -X POST https://esfowzdgituqktemrmle.supabase.co/functions/v1/create-booking \
  -H "Authorization: Bearer <supabase-jwt-from-auth-exchange>" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceId": "<actual-service-uuid>",
    "scheduledAt": "2024-09-01T10:00:00Z",
    "customerNotes": "Test booking",
    "location": "Online",
    "isOnline": true
  }'
```

#### 4. Verify JWT Contains Correct Claims
```bash
# Decode the JWT token from auth-exchange
# Use jwt.io or this command:
echo "<jwt-token>" | cut -d. -f2 | base64 -d | jq

# Should contain:
# {
#   "sub": "<uuid>",
#   "user_id": "<uuid>",
#   "privy_id": "did:privy:...",
#   "role": "authenticated",
#   "aud": "authenticated"
# }
```

### After Phase 1:
1. [ ] Existing app still works with supabaseAdmin
2. [ ] Edge Functions are accessible
3. [ ] No breaking changes to current functionality

### After Phase 2:
1. [ ] All CRUD operations work with JWT auth
2. [ ] RLS policies properly restrict data
3. [ ] No admin keys in frontend
4. [ ] Performance is acceptable

## Rollback Plan 🔄

If issues occur:

### Phase 1 Rollback (Edge Functions)
```bash
# Remove Edge Functions if needed
supabase functions delete auth-exchange
supabase functions delete create-booking
# No impact on current app functionality
```

### Phase 2 Rollback (Frontend Changes)
```bash
# Revert to previous commit
git revert HEAD

# Or restore admin client usage
git checkout -- src/lib/api.ts
git checkout -- src/contexts/PrivyAuthContext.tsx
```

### RLS Rollback (If policies cause issues)
```sql
-- Connect to SQL Editor and run:
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE services DISABLE ROW LEVEL SECURITY;
ALTER TABLE bookings DISABLE ROW LEVEL SECURITY;
ALTER TABLE conversations DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;
```

## Migration Timeline ⏰

### Immediate (Today):
```bash
# 1. Install Supabase CLI
brew install supabase/tap/supabase

# 2. Deploy Edge Functions (safe, no impact)
supabase link --project-ref esfowzdgituqktemrmle
supabase functions deploy auth-exchange
supabase functions deploy create-booking

# 3. Test Edge Functions work
# Get Privy token from browser and test
```

### Day 1-2: Test Integration
- Test `useSupabaseAuth` hook in development
- Verify UUID mapping is consistent
- Test one read operation with new auth

### Day 3-4: Gradual Migration
- Replace 2-3 `supabaseAdmin` calls per day
- Start with read operations (safe)
- Test each change thoroughly

### Day 5-7: Complete Migration
- Migrate remaining write operations
- Enable RLS policies
- Remove service role key
- Final testing

### Checkpoint Reviews:
- After each step, verify app still works
- Keep rollback plan ready
- Monitor error logs in Supabase dashboard

## Success Metrics ✅

- [ ] No service role key in frontend
  ```bash
  # Verify no service key in code
  grep -r "SERVICE_ROLE_KEY" src/ || echo "✅ No service key found"
  ```

- [ ] All operations use JWT authentication
  ```bash
  # Check for remaining supabaseAdmin usage
  grep -r "supabaseAdmin" src/ | wc -l
  # Should be 0 after migration
  ```

- [ ] RLS policies enforced
  ```sql
  -- Check RLS status
  SELECT tablename, rowsecurity 
  FROM pg_tables 
  WHERE schemaname = 'public';
  -- All tables should show rowsecurity = true
  ```

- [ ] Price manipulation impossible
  ```bash
  # Try to create booking with wrong price (should fail)
  curl -X POST .../functions/v1/create-booking \
    -d '{"serviceId": "...", "total_price": 999999}'
  # Should use server-side price, not client-provided
  ```

- [ ] No performance degradation
  ```javascript
  // Measure API response times
  console.time('fetch-services')
  await supabase.from('services').select('*')
  console.timeEnd('fetch-services')
  // Should be < 500ms
  ```

- [ ] Zero downtime during migration
  ```bash
  # Monitor your app during deployment
  # Current app should work throughout migration
  ```
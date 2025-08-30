# Supabase Edge Functions Solution for Privy + Supabase

## Why Edge Functions Are The Best Solution

### Perfect Fit for Your Architecture
1. **Already in Supabase** - No new infrastructure
2. **Direct JWT Secret Access** - Can create proper Supabase tokens
3. **Zero Additional Cost** - Included in Supabase plan
4. **Native RLS Integration** - Works seamlessly with policies

## Implementation Overview

### Core Edge Functions

#### 1. `auth-exchange` - JWT Bridge
Converts Privy tokens to Supabase JWTs, enabling RLS policies.

```typescript
// Frontend usage
const privyToken = await getAccessToken();
const response = await fetch('/functions/v1/auth-exchange', {
  headers: { 'Authorization': `Bearer ${privyToken}` },
  body: JSON.stringify({ action: 'exchange-token' })
});
const { token, userId } = await response.json();

// Now use this token with Supabase client
const supabase = createClient(url, anonKey, {
  global: { headers: { Authorization: `Bearer ${token}` } }
});
```

#### 2. `create-booking` - Critical Operation
Validates prices and availability server-side to prevent manipulation.

```typescript
// Frontend usage
await fetch('/functions/v1/create-booking', {
  headers: { 'Authorization': `Bearer ${supabaseToken}` },
  body: JSON.stringify({ serviceId, date, message })
});
// Price is validated server-side, not trusted from client
```

## Migration Steps

### Phase 1: Deploy Edge Functions (Day 1)

1. **Set Environment Variables in Supabase Dashboard**
```bash
PRIVY_APP_ID=your_privy_app_id
PRIVY_APP_SECRET=your_privy_app_secret
```

2. **Deploy Functions**
```bash
# Install Supabase CLI if needed
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Deploy the functions
supabase functions deploy auth-exchange
supabase functions deploy create-booking
```

### Phase 2: Update Frontend (Day 2)

1. **Create useSupabaseAuth Hook**
   - Already created in `/src/hooks/useSupabaseAuth.ts`
   - Handles token exchange automatically
   - Returns authenticated Supabase client

2. **Update Components to Use Hook**
```typescript
// Before (using supabaseAdmin)
const { data } = await supabaseAdmin.from('services').select('*');

// After (using authenticated client)
const { supabase } = useSupabaseAuth();
const { data } = await supabase.from('services').select('*');
```

### Phase 3: Enable RLS Policies (Day 3)

Now that `auth.uid()` works, enable proper RLS:

```sql
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users read own profile" ON users
FOR SELECT USING (auth.uid()::text = id);

-- Users can update their own profile
CREATE POLICY "Users update own profile" ON users
FOR UPDATE USING (auth.uid()::text = id)
WITH CHECK (auth.uid()::text = id);

-- Services are public to read
CREATE POLICY "Public read services" ON services
FOR SELECT USING (true);

-- Users can only modify their own services
CREATE POLICY "Users modify own services" ON services
FOR ALL USING (auth.uid()::text = provider_id)
WITH CHECK (auth.uid()::text = provider_id);

-- Users can see bookings they're involved in
CREATE POLICY "Users see own bookings" ON bookings
FOR SELECT USING (
  auth.uid()::text = customer_id OR 
  auth.uid()::text = provider_id
);
```

### Phase 4: Remove Admin Client (Day 4)

1. Delete `VITE_SUPABASE_SERVICE_ROLE_KEY` from `.env`
2. Update all `supabaseAdmin` references to use authenticated client
3. Remove admin client from `/src/lib/supabase.ts`

## Comparison: Edge Functions vs Separate Backend

| Aspect | Edge Functions | Separate Backend |
|--------|---------------|------------------|
| **Infrastructure** | None (uses Supabase) | New server/hosting |
| **Cost** | Free (included) | $5-20/month |
| **Deployment** | `supabase functions deploy` | Docker/CI/CD setup |
| **Development** | TypeScript/Deno | Node.js/Express |
| **Maintenance** | Minimal | Regular updates |
| **Scaling** | Automatic | Manual configuration |
| **Database Access** | Direct (same infra) | Network latency |
| **JWT Secret Access** | Native | Needs env var |

## Security Benefits

### Before (Current Code)
- ❌ Service role key in frontend
- ❌ No RLS protection
- ❌ Client can manipulate prices
- ❌ All operations trusted

### After (With Edge Functions)
- ✅ No admin keys in frontend
- ✅ RLS policies enforced
- ✅ Server-side validation
- ✅ Price manipulation impossible

## Testing Locally

```bash
# Start local Supabase
supabase start

# Serve functions locally
supabase functions serve

# Test the auth exchange
curl -X POST http://localhost:54321/functions/v1/auth-exchange \
  -H "Authorization: Bearer YOUR_PRIVY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "exchange-token"}'
```

## Production Checklist

- [ ] Deploy Edge Functions to Supabase
- [ ] Set environment variables in Supabase Dashboard
- [ ] Update frontend to use `useSupabaseAuth` hook
- [ ] Test token exchange flow
- [ ] Enable RLS policies
- [ ] Remove service role key from frontend
- [ ] Test all CRUD operations
- [ ] Monitor Edge Function logs

## Next Steps

1. **Immediate**: Deploy auth-exchange function
2. **Day 1**: Update frontend auth flow
3. **Day 2**: Move critical operations to Edge Functions
4. **Day 3**: Enable RLS policies
5. **Week 1**: Complete migration and testing

## Conclusion

Supabase Edge Functions provide the perfect solution because they:
- Require minimal code changes
- Cost nothing extra
- Deploy instantly
- Scale automatically
- Integrate natively with RLS

This is simpler, cheaper, and more maintainable than any separate backend solution.
# Quick Start: Deploy Edge Functions NOW

## Your Project Info
- **Supabase URL**: `https://esfowzdgituqktemrmle.supabase.co`
- **Project Ref**: `esfowzdgituqktemrmle`
- **Edge Functions**: Located in `/supabase/functions/`

## Step 1: Install Supabase CLI (2 min)

### For macOS (using Homebrew):
```bash
brew install supabase/tap/supabase
```

### Alternative: Download directly:
```bash
# For Mac (Intel)
curl -o supabase https://github.com/supabase/cli/releases/latest/download/supabase-darwin-amd64
chmod +x supabase
sudo mv supabase /usr/local/bin/

# For Mac (Apple Silicon/M1/M2)
curl -o supabase https://github.com/supabase/cli/releases/latest/download/supabase-darwin-arm64
chmod +x supabase
sudo mv supabase /usr/local/bin/
```

### Verify installation:
```bash
supabase --version
```

## Step 2: Login & Link (2 min)
```bash
# Login (opens browser)
supabase login

# Link to your project
supabase link --project-ref esfowzdgituqktemrmle
```

## Step 3: Set Secrets in Supabase Dashboard (5 min)

1. Go to: https://supabase.com/dashboard/project/esfowzdgituqktemrmle/settings/functions
2. Click on "Secrets" section
3. Add these two secrets:
   - `PRIVY_APP_ID` = (get from https://dashboard.privy.io)
   - `PRIVY_APP_SECRET` = (get from https://dashboard.privy.io)

## Step 4: Deploy Functions (1 min)
```bash
# From your project root
supabase functions deploy auth-exchange
supabase functions deploy create-booking
```

## Step 5: Quick Test (2 min)

### Get a Privy Token:
1. Open your app in browser (http://localhost:8080)
2. Make sure you're logged in
3. Open DevTools (F12) → Network tab
4. Do any action in your app (like navigating to a page)
5. Look for any request with `Authorization: Bearer` header
6. Copy the token after "Bearer "

**Alternative Method - Add temporary button:**

Add this temporarily to any component (like App.tsx):
```jsx
import { usePrivy } from '@privy-io/react-auth';

// Inside your component
const { getAccessToken } = usePrivy();

const showToken = async () => {
  const token = await getAccessToken();
  console.log('Privy Token:', token);
  // Also copy to clipboard
  navigator.clipboard.writeText(token);
  alert('Token copied to clipboard!');
};

// In your JSX
<button onClick={showToken}>Get Privy Token (Dev Only)</button>
```

**Or check localStorage:**
```javascript
// In DevTools Console
// Look for Privy stored data
Object.keys(localStorage).filter(k => k.includes('privy')).forEach(key => {
  console.log(key, localStorage[key]);
});
```

### Test the Edge Function:
```bash
# Replace YOUR_TOKEN with the token from above
curl -X POST https://esfowzdgituqktemrmle.supabase.co/functions/v1/auth-exchange \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "exchange-token"}'
```

### Success Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "privyId": "did:privy:..."
}
```

## That's It! 🎉

Edge Functions are now deployed. Your current app continues working unchanged.

## Next Steps (When Ready):
1. Start using `useSupabaseAuth` hook in components
2. Gradually replace `supabaseAdmin` with authenticated client
3. Enable RLS policies once all code is migrated

## Troubleshooting:

### "Project ref not found"
- Make sure you're using: `esfowzdgituqktemrmle`
- Check you're logged in: `supabase projects list`

### "Invalid token" error
- Make sure you set PRIVY_APP_ID and PRIVY_APP_SECRET in Supabase dashboard
- Verify token is fresh (not expired)

### "Function not found"
- Check deployment: `supabase functions list`
- Redeploy if needed: `supabase functions deploy auth-exchange`

## Monitor Your Functions:
https://supabase.com/dashboard/project/esfowzdgituqktemrmle/functions
# Set Edge Function Secrets - REQUIRED!

## The Issue
Your Edge Functions are deployed but can't verify Privy tokens because the secrets aren't set.

## Quick Fix (2 minutes)

### 1. Go to Supabase Dashboard
https://supabase.com/dashboard/project/esfowzdgituqktemrmle/settings/functions

### 2. Click on "Edge Function Secrets" section

### 3. Add these EXACT secrets:

| Secret Name | Value |
|------------|-------|
| `PRIVY_APP_ID` | `cmeoebdro017hl50bj7c1mcui` |
| `PRIVY_APP_SECRET` | Get from https://dashboard.privy.io → Settings → API Keys |

### 4. Get your Privy App Secret:
1. Go to https://dashboard.privy.io
2. Click on your app
3. Go to Settings → API Keys
4. Copy the "App Secret" (starts with random characters)
5. Paste it as the `PRIVY_APP_SECRET` value in Supabase

### 5. Save the secrets in Supabase

### 6. Test again with your token:
```bash
curl -X POST https://esfowzdgituqktemrmle.supabase.co/functions/v1/auth-exchange \
  -H "Authorization: Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImxXeEotVjZBQWQwYXZaSDNoTjJHVUI5VjZwcnpzVTVpMVBhUGYyeUNGaEkifQ.eyJzaWQiOiJjbWVzNHMyNjUwMjlwbDcwY3hnODR5Y2JtIiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NTY0NDg0MzEsImF1ZCI6ImNtZW9lYmRybzAxN2hsNTBiajdjMW1jdWkiLCJzdWIiOiJkaWQ6cHJpdnk6Y21lczRzMjg0MDI5cmw3MGNqdzdmOTdnOCIsImV4cCI6MTc1NjUzNDgzMX0.ydw_NAvm0mvWMhDU4_y5Tx6B3yi5BiJ8fJBMzr7EhTdw_rQJXgshtsb82f4-pyQCQUf5z6IsfGC1VMktpwmn9g" \
  -H "Content-Type: application/json" \
  -d '{"action": "exchange-token"}'
```

## Expected Success Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "privyId": "did:privy:cmes4s284029rl70cjw7f97g8"
}
```

## Alternative: Set via CLI (if you prefer)
```bash
# Set the secrets via CLI (need the actual secret value)
supabase secrets set PRIVY_APP_ID=cmeoebdro017hl50bj7c1mcui
supabase secrets set PRIVY_APP_SECRET=YOUR_ACTUAL_PRIVY_SECRET_HERE

# List secrets to verify
supabase secrets list
```

## Why This Happened
The Edge Functions are deployed but can't verify Privy tokens without:
1. `PRIVY_APP_ID` - to identify your Privy app
2. `PRIVY_APP_SECRET` - to cryptographically verify tokens

These must match your Privy dashboard configuration exactly.
# Edge Function - WORKING! ✅

## Important Discovery
Supabase validates ALL `Authorization: Bearer` tokens before they reach Edge Functions. 
We must use a custom header for the Privy token.

## Correct Test Command

1. **Get a fresh Privy token** from the Dev Helper in your app
2. **Use this command** (with BOTH tokens):

```bash
curl -X POST https://esfowzdgituqktemrmle.supabase.co/functions/v1/auth-exchange \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzZm93emRnaXR1cWt0ZW1ybWxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2MTg3NzIsImV4cCI6MjA3MTE5NDc3Mn0.oSvwfiuVhLtrxgO2XwiuvYKt01536i7wiY4JflxyZeU" \
  -H "x-privy-token: YOUR_FRESH_PRIVY_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"action": "exchange-token"}'
```

Replace `YOUR_FRESH_PRIVY_TOKEN_HERE` with the token from the Dev Helper.

## What Changed
- Authorization header: Supabase anon key (to pass gateway)
- x-privy-token header: Your actual Privy token
- Edge Function reads from x-privy-token instead of Authorization

## Success Response Should Be:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "privyId": "did:privy:cmes4s284029rl70cjw7f97g8"
}
```

## If You Get "Internal server error"
Your Privy token might be expired. Get a fresh one from the Dev Helper.
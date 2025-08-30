# Deploy Backend to Render - FREE & FAST (5 min)

## Step 1: Prepare (1 min)

First, add PRIVY_APP_SECRET to your .env.local:
```bash
# Get from https://dashboard.privy.io → Settings → API Keys
PRIVY_APP_SECRET=your-secret-here
```

## Step 2: Create Render Account (1 min)
Go to https://render.com and sign up (free)

## Step 3: Deploy (3 min)

### Option A: Deploy via GitHub
1. Commit your backend:
```bash
git add backend/
git commit -m "Add Hono backend"
git push
```

2. In Render Dashboard:
- New → Web Service
- Connect GitHub
- Select your repo
- **Root Directory**: `backend`
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Instance Type**: Free

### Option B: Deploy via CLI (Alternative)
```bash
# Install Render CLI
brew tap render-oss/render
brew install render

# Deploy
cd backend
render create web-service \
  --name bookme-backend \
  --env node \
  --build-command "npm install" \
  --start-command "npm start"
```

## Step 4: Set Environment Variables

In Render Dashboard → Environment:

```env
VITE_SUPABASE_URL=https://esfowzdgituqktemrmle.supabase.co
VITE_SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzZm93emRnaXR1cWt0ZW1ybWxlIiwicm9sZSI6InNlcnZpY2Vfc29sZSIsImlhdCI6MTc1NTYxODc3MiwiZXhwIjoyMDcxMTk0NzcyfQ.WM_1nQntOotP8xisyA3Hg7c-gGlvhPrIxZpT38q8oLI
VITE_PRIVY_APP_ID=cmeoebdro017hl50bj7c1mcui
PRIVY_APP_SECRET=<YOUR_PRIVY_SECRET>
PORT=10000
```

## Step 5: Get Your Backend URL

After deploy, Render gives you:
```
https://bookme-backend.onrender.com
```

## Step 6: Update Frontend

Add to your `.env.local`:
```bash
VITE_BACKEND_URL=https://bookme-backend.onrender.com
```

## Done! Test It:

```bash
# Test health
curl https://bookme-backend.onrender.com/health

# Should return: {"status":"ok"}
```

Now your Cloudflare Tunnel frontend can access the backend!

## Note on Free Tier:
- Spins down after 15 min of inactivity
- First request after sleep takes ~30 seconds
- Perfect for development/testing
- Upgrade to paid ($7/month) for production
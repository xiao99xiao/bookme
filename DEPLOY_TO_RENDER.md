# Deploy Frontend + Backend to Render (One-Click)

## Step 1: Push Your Code

```bash
git add .
git commit -m "Add Render deployment configuration"
git push origin main
```

## Step 2: Deploy on Render

### Option A: One-Click Blueprint Deploy (Recommended)

1. Go to https://render.com and sign up/login
2. Click "New" → "Blueprint"
3. Connect your GitHub repository
4. Render will detect `render.yaml` automatically
5. You'll see TWO services:
   - `bookme-backend` (Web Service)
   - `bookme-frontend` (Static Site)

### Option B: Manual Deploy (If Blueprint doesn't work)

#### Deploy Backend First:
1. New → Web Service
2. Connect repo → Select `bookme`
3. Settings:
   - **Name**: bookme-backend
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free

#### Deploy Frontend:
1. New → Static Site
2. Connect repo → Select `bookme`
3. Settings:
   - **Name**: bookme-frontend
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`

## Step 3: Set Environment Variables

### For Backend Service (`bookme-backend`):
Go to Dashboard → bookme-backend → Environment

```env
PORT=10000
VITE_SUPABASE_URL=https://esfowzdgituqktemrmle.supabase.co
VITE_SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzZm93emRnaXR1cWt0ZW1ybWxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTYxODc3MiwiZXhwIjoyMDcxMTk0NzcyfQ.WM_1nQntOotP8xisyA3Hg7c-gGlvhPrIxZpT38q8oLI
VITE_PRIVY_APP_ID=cmeoebdro017hl50bj7c1mcui
PRIVY_APP_SECRET=<YOUR_PRIVY_SECRET_FROM_ENV_LOCAL>
```

### For Frontend Static Site (`bookme-frontend`):
Go to Dashboard → bookme-frontend → Environment

```env
VITE_SUPABASE_URL=https://esfowzdgituqktemrmle.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzZm93emRnaXR1cWt0ZW1ybWxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2MTg3NzIsImV4cCI6MjA3MTE5NDc3Mn0.oSvwfiuVhLtrxgO2XwiuvYKt01536i7wiY4JflxyZeU
VITE_SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzZm93emRnaXR1cWt0ZW1ybWxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTYxODc3MiwiZXhwIjoyMDcxMTk0NzcyfQ.WM_1nQntOotP8xisyA3Hg7c-gGlvhPrIxZpT38q8oLI
VITE_PRIVY_APP_ID=cmeoebdro017hl50bj7c1mcui
VITE_BACKEND_URL=https://bookme-backend.onrender.com
```

**IMPORTANT**: Update `VITE_BACKEND_URL` with your actual backend URL after it deploys!

## Step 4: Get Your URLs

After deployment, you'll get:
- Backend: `https://bookme-backend.onrender.com`
- Frontend: `https://bookme-frontend.onrender.com`

## Step 5: Update Backend URL in Frontend

1. Go to Frontend service → Environment
2. Update `VITE_BACKEND_URL` with your backend URL
3. Redeploy frontend (happens automatically)

## Timeline

- Backend deploy: ~5 minutes
- Frontend deploy: ~3 minutes
- Total: ~10 minutes

## Free Tier Notes

- Backend will spin down after 15 min of inactivity
- First request after sleep takes ~30 seconds
- Perfect for development/testing
- Upgrade to paid ($7/month each) for production

## Test Your Deployment

```bash
# Test backend health
curl https://bookme-backend.onrender.com/health

# Visit frontend
open https://bookme-frontend.onrender.com
```

## Troubleshooting

### "Build failed"
- Check logs in Render dashboard
- Usually missing environment variables

### "Cannot connect to backend"
- Make sure VITE_BACKEND_URL is set correctly in frontend
- Check backend is running (visit /health endpoint)

### "Slow first load"
- Normal for free tier - services sleep after 15 min
- Upgrade to paid for always-on

## Success! 🎉

You now have:
- ✅ Frontend deployed and accessible
- ✅ Backend API running securely
- ✅ Both from same repo
- ✅ Automatic deploys on git push
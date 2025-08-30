# Deploy Your Hono Backend - Quick Start

## Step 1: Prepare Your Backend (2 min)

### Add the Privy Secret to .env.local:
```bash
# In your main project root .env.local, add:
PRIVY_APP_SECRET=<get-from-privy-dashboard>
```

Get it from: https://dashboard.privy.io → Settings → API Keys → App Secret

### Install and Test Locally:
```bash
cd backend
npm install
npm run dev
```

Visit http://localhost:4000/health - should return `{"status":"ok"}`

## Step 2: Deploy to Railway (Recommended - 5 min)

### A. Push to GitHub:
```bash
# In project root
git add backend/
git commit -m "Add secure Hono backend for Privy auth"
git push
```

### B. Deploy on Railway:
1. Go to https://railway.app
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Railway auto-detects Node.js app

### C. Set Environment Variables:
In Railway dashboard → Variables:
```env
VITE_SUPABASE_URL=https://esfowzdgituqktemrmle.supabase.co
VITE_SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
VITE_PRIVY_APP_ID=cmeoebdro017hl50bj7c1mcui
PRIVY_APP_SECRET=<your-privy-secret>
PORT=4000
```

### D. Set Root Directory:
Settings → Root Directory: `/backend`

### E. Deploy!
Railway automatically deploys. Get your URL from Settings → Domains

## Step 3: Update Frontend (2 min)

### Add backend URL to .env.local:
```bash
# In your main .env.local
VITE_BACKEND_URL=https://your-app.up.railway.app
```

### Use the new API client:
```typescript
// In a component that needs secure backend
import { useSecureApi } from '@/lib/api-backend';

function MyComponent() {
  const api = useSecureApi();
  
  // Create booking with validation
  const booking = await api.createBooking({
    serviceId: 'xxx',
    scheduledAt: '2024-09-01T10:00:00Z',
    customerNotes: 'Looking forward to this!'
  });
}
```

## Alternative: Deploy to Render (Also Easy)

### 1. Create account at https://render.com
### 2. New → Web Service
### 3. Connect GitHub repo
### 4. Configure:
- **Root Directory**: `backend`
- **Build Command**: `npm install`
- **Start Command**: `npm start`

### 5. Add environment variables (same as Railway)
### 6. Deploy!

## Testing Your Deployment

### Test health endpoint:
```bash
curl https://your-backend.railway.app/health
# Should return: {"status":"ok","timestamp":"..."}
```

### Test with your Privy token:
```bash
# Get token from Dev Helper in your app
curl https://your-backend.railway.app/api/profile \
  -H "Authorization: Bearer YOUR_PRIVY_TOKEN"
# Should return user profile
```

## Production Checklist

- [ ] Privy secret is set correctly
- [ ] Supabase service role key is set
- [ ] CORS origins include your production domain
- [ ] Health check returns ok
- [ ] Can create booking with validated price
- [ ] Frontend VITE_BACKEND_URL points to production

## Monitoring

### Railway:
- Logs: Dashboard → Deployments → View Logs
- Metrics: Dashboard → Metrics tab
- Alerts: Set up in Settings → Notifications

### Render:
- Logs: Dashboard → Logs
- Metrics: Dashboard → Metrics
- Health checks: Automatically configured

## Cost

- **Railway**: ~$5/month for this backend
- **Render**: Free tier available (spins down after 15 min)
- **Your own VPS**: ~$5/month on DigitalOcean/Linode

## Troubleshooting

### "Cannot verify Privy token"
- Check PRIVY_APP_SECRET is set correctly
- Ensure token is fresh (not expired)

### "CORS error"
- Add your frontend URL to CORS origins in `backend/src/index.js`

### "Cannot connect to Supabase"
- Verify VITE_SUPABASE_URL is correct
- Check service role key is valid

## Success! 🎉

Your backend is now:
- ✅ Validating every request with Privy
- ✅ Protecting prices from manipulation  
- ✅ Using Supabase admin safely on server
- ✅ Ready for production

Total time: ~10 minutes
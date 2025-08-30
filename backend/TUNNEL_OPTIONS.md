# Accessing Backend from Cloudflare Tunnel Frontend

Your frontend is at: https://roulette-phenomenon-airfare-claire.trycloudflare.com/
Problem: It can't access localhost:4000 backend

## Solution 1: Deploy to Render (RECOMMENDED - 5 min)
See `QUICK_DEPLOY_RENDER.md` - Free and instant

## Solution 2: Tunnel Your Backend (For Testing)

### Option A: Cloudflare Tunnel for Backend
```bash
# Terminal 1: Start backend
cd backend
npm run dev

# Terminal 2: Create tunnel for backend
npx cloudflared tunnel --url http://localhost:4000
# You'll get: https://some-random-name.trycloudflare.com

# Update your frontend to use this URL temporarily
```

### Option B: Use ngrok
```bash
# Install ngrok
brew install ngrok

# Terminal 1: Start backend
cd backend
npm run dev

# Terminal 2: Tunnel with ngrok
ngrok http 4000
# You'll get: https://abc123.ngrok.io

# Update frontend to use ngrok URL
```

### Option C: Both in One Tunnel (Advanced)
```bash
# Create a local proxy that serves both
# frontend on / and backend on /api
npm install -g http-proxy-cli

# Proxy both services
http-proxy \
  --proxy "/api -> http://localhost:4000" \
  --proxy "/ -> http://localhost:8080" \
  --port 3000

# Then tunnel port 3000
npx cloudflared tunnel --url http://localhost:3000
```

## Solution 3: Use Public Backend (Production Ready)

Deploy to any of these (all have free tiers):
- **Render.com** - Free, sleeps after 15 min
- **Railway.app** - $5/month, always on
- **Fly.io** - Free tier available
- **Vercel** - Can deploy Hono as serverless

## Quick Fix for Testing NOW:

1. **Deploy to Render** (5 minutes):
```bash
# Just follow QUICK_DEPLOY_RENDER.md
# You'll get: https://bookme-backend.onrender.com
```

2. **Update .env.local**:
```env
VITE_BACKEND_URL=https://bookme-backend.onrender.com
```

3. **Restart frontend**:
```bash
# Restart your frontend dev server
# The Cloudflare tunnel will now work with the public backend
```

## Why This Happens:

```
[Cloudflare Tunnel] → [Internet] → [Your Frontend:8080]
                           ↓
                    Can't reach localhost:4000
                           ↓
                    Need public URL for backend
```

## Best Practice:
- **Development**: Use localhost for both
- **Testing with tunnels**: Deploy backend to Render/Railway
- **Production**: Both deployed to proper hosting
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
BookMe is a peer-to-peer booking platform where users can offer services and book time slots from others. Built with Vite, React, TypeScript, and Supabase.

## Commands

### Development
```bash
# SSL Setup (one-time, generates certificates for local IP)
npm run setup:ssl

# Start BOTH frontend and backend with HTTPS
npm run dev:all

# Or run them separately with HTTPS:
npm run dev:ssl       # Frontend with HTTPS on port 8443
npm run dev:backend   # Backend with HTTPS on port 4443

# Legacy HTTP development (original setup)
VITE_DEV_PORT=8080 npm run dev              # Frontend on port 8080
cd backend && PORT=4001 npm run dev         # Backend on port 4001

# Cloudflare Tunnel (alternative for SSL)
npx cloudflared tunnel --url http://localhost:8080
npx cloudflared tunnel --url http://localhost:4001

# Build for production
npm run build

# Build for development mode
npm run build:dev

# Preview production build
npm run preview

# Run linter
npm run lint
```

### Troubleshooting Dev Server
```bash
# If server keeps terminating
pkill -f "vite"
rm -rf node_modules package-lock.json
npm install
npm run dev

# Check port usage
lsof -i :8080

# Monitor process
ps aux | grep vite | grep -v grep
```

## Architecture Overview

### Backend Service (Hono)
The app now includes a **backend service** at `/backend` for secure Privy token validation:
- **Framework**: Hono (lightweight Node.js server)
- **Purpose**: Validates Privy tokens and performs secure database operations
- **Port**: 4001 (development)
- **Auth Flow**: Frontend sends Privy token → Backend validates → Backend uses Supabase service role

### Authentication System
The app uses a **dual authentication approach**:
- **Privy**: Primary authentication for user identity (stored as DID format: `did:privy:xxx`)
- **Backend**: Validates Privy tokens and handles all database operations
- **Supabase**: Database only (not for auth) - backend uses service role key
- **ID Mapping**: Privy DIDs are converted to UUIDs for database operations via `src/lib/id-mapping.ts`

Critical pattern: Frontend sends Privy token to backend, which validates and performs secure operations.

### Core Components Structure

```
src/
├── contexts/
│   └── PrivyAuthContext.tsx    # Main auth provider, handles Privy user and Supabase profile sync
├── lib/
│   ├── api.ts                   # API client - uses supabaseAdmin for all operations
│   ├── supabase.ts              # Supabase client configurations
│   └── id-mapping.ts            # Converts Privy DIDs to UUIDs
├── pages/
│   ├── dashboard/               # Protected dashboard pages
│   │   ├── DashboardServices.tsx    # Service management
│   │   ├── DashboardBookings.tsx    # User's bookings
│   │   ├── DashboardOrders.tsx      # Incoming orders (provider view)
│   │   └── DashboardBalance.tsx     # Wallet balance & funding
│   └── Profile.tsx              # Public profile page
└── components/
    ├── CreateServiceModal.tsx   # Service creation/editing modal
    ├── ChatModal.tsx           # Real-time chat between users
    └── ReviewDialog.tsx        # Review submission/viewing
```

### Database Schema
Tables in Supabase (see `/database/*.sql`):
- `users`: User profiles with timezone, ratings, earnings
- `services`: Service offerings with availability schedules
- `bookings`: Booking records with meeting links
- `categories`: Service categories
- `chats` & `messages`: Real-time messaging
- `reviews`: Service reviews
- `meeting_integrations`: OAuth connections for Google Meet/Zoom

### Smart Wallets & Blockchain
- **Smart Wallets**: Automatically created via Privy's SmartWalletsProvider
- **Networks**: Base (production) and Base Sepolia (development)
- **USDC Addresses**: 
  - Base: `0x833589fcd6edb6e08f4c7c32d4f71b54bda02913`
  - Base Sepolia: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- **Funding**: Integrated with Privy's `useFundWallet` for card purchases

### State Management
- **React Query**: For data fetching and caching
- **Local State**: Component-level with useState
- **Global Auth**: PrivyAuthContext provides user state across app

### API Patterns
All API methods in `src/lib/api.ts` follow this pattern:
```typescript
// Uses supabaseAdmin to bypass RLS
static async methodName(userId: string, data: any) {
  // Validate userId
  // Use supabaseAdmin for operations
  // Return transformed data
}
```

### Critical Files to Understand
1. **src/contexts/PrivyAuthContext.tsx**: Central auth logic and profile management
2. **src/lib/api.ts**: All database operations
3. **src/main.tsx**: App initialization with Privy and Smart Wallets
4. **vite.config.ts**: Node polyfills configuration for crypto operations

## Environment Variables
Required in `.env.local`:
```
# Frontend variables (VITE_ prefix for browser access)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_PRIVY_APP_ID=
VITE_GOOGLE_CLIENT_ID=
VITE_GOOGLE_CLIENT_SECRET=
VITE_BACKEND_URL=  # Backend URL (use Cloudflare tunnel URL for SSL in dev)

# Backend-only variables (in .env.local)
PRIVY_APP_SECRET=
VITE_SUPABASE_SERVICE_ROLE_KEY=
```

## Development Gotchas

### Authentication
- Never use `supabase.auth.getUser()` - we use Privy for auth
- Always pass `userId` to API methods explicitly
- Use `ensureUuid()` to convert Privy DIDs to database UUIDs

### Smart Wallets
- Requires Buffer polyfill (configured in vite.config.ts)
- Smart wallets auto-created for users without external wallets
- Test on Base Sepolia for development

### Real-time Features
- Chat uses Supabase real-time subscriptions
- Meeting links generated via Google OAuth integration
- Reviews have 7-day edit window after booking completion

### UI Components
- Using shadcn/ui components (in src/components/ui/)
- Styling with Tailwind CSS
- Forms use react-hook-form with zod validation

## Testing Access

### With SSL (Recommended - after running `npm run setup:ssl`)
- Frontend: https://<YOUR-LOCAL-IP>:8443 (e.g., https://192.168.0.10:8443)
- Backend: https://<YOUR-LOCAL-IP>:4443 (e.g., https://192.168.0.10:4443)
- Access from any device on your network using the same URLs

### Without SSL (Legacy)
- Frontend Local: http://localhost:8080
- Backend Local: http://localhost:4001

### With Cloudflare Tunnel (Alternative SSL)
- Frontend: Run `npx cloudflared tunnel --url http://localhost:8080`
- Backend: Run `npx cloudflared tunnel --url http://localhost:4001`
- Both services get unique `https://*.trycloudflare.com` URLs for development with SSL
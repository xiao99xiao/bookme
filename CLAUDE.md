# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
BookMe is a peer-to-peer booking platform where users can offer services and book time slots from others. Built with Vite, React, TypeScript, and Supabase.

## Commands

### Development
```bash
# Start development server on port 8080
VITE_DEV_PORT=8080 npm run dev

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

### Authentication System
The app uses a **dual authentication approach**:
- **Privy**: Primary authentication for user identity (stored as DID format: `did:privy:xxx`)
- **Supabase**: Database operations with admin client bypassing RLS
- **ID Mapping**: Privy DIDs are converted to UUIDs for database operations via `src/lib/id-mapping.ts`

Critical pattern: When making API calls, always pass `userId` (UUID) explicitly rather than relying on Supabase auth.

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
Required in `.env`:
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_PRIVY_APP_ID=
VITE_GOOGLE_CLIENT_ID=
VITE_GOOGLE_CLIENT_SECRET=
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
- Local: http://localhost:8080
- Cloudflare Tunnel: Use `npx cloudflared tunnel` for public access
- Network URLs vary by local network configuration
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ IMPORTANT: Always Check Working Directory
**ALWAYS run `pwd` before executing commands to ensure you're in the correct directory.**
- Root directory: `/Users/xiao99xiao/Developer/bookme`
- Backend directory: `/Users/xiao99xiao/Developer/bookme/backend`
- Commands assume you're in the correct directory unless explicitly stated

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

### CRITICAL DEV SERVER RULE
**NEVER RESTART THE DEV SERVER UNLESS EXPLICITLY ASKED BY THE USER.**
- Do NOT kill or restart `npm run dev:all` or any dev server processes
- Do NOT use KillBash tool on development servers
- If there are compilation errors, fix the code - do NOT restart the server
- The dev server has hot module replacement and will recover from most errors automatically
- Only restart if the user explicitly requests it

## Architecture Overview

### Backend Service (Hono)
The app now includes a **backend service** at `/backend` for secure Privy token validation:
- **Framework**: Hono (lightweight Node.js server)
- **Purpose**: Validates Privy tokens and performs secure database operations
- **Ports**: 4001 (HTTP), 4443 (HTTPS with SSL)
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
│   ├── api-migration.ts         # ApiClient with Promise-based initialization (prevents race conditions)
│   ├── backend-api.ts           # Backend API client for token-based auth
│   ├── api.ts                   # Legacy API client (deprecated - use ApiClient)
│   ├── supabase.ts              # Supabase client configurations
│   ├── id-mapping.ts            # Converts Privy DIDs to UUIDs
│   └── username.ts              # Username validation, generation, and URL utilities
├── pages/
│   ├── customer/                # Customer-specific pages
│   │   ├── CustomerBookings.tsx # Customer's bookings
│   │   ├── CustomerProfile.tsx  # Customer profile management
│   │   └── CustomerMessages.tsx # Customer messaging
│   ├── provider/                # Provider-specific pages
│   │   ├── ProviderOrders.tsx   # Incoming orders (provider view)
│   │   ├── ProviderServices.tsx # Service management
│   │   ├── ProviderMessages.tsx # Provider messaging
│   │   ├── ProviderIntegrations.tsx # OAuth integrations
│   │   └── IntegrationsCallback.tsx # OAuth callback handler
│   └── Profile.tsx              # Public user page (username-based)
└── components/
    ├── CreateServiceModal.tsx   # Service creation/editing modal
    ├── ChatModal.tsx           # Real-time chat between users
    └── ReviewDialog.tsx        # Review submission/viewing
```

### Database Schema
Tables in Supabase (see `/database/*.sql`):
- `users`: User profiles with timezone, ratings, earnings, usernames
- `services`: Service offerings with availability schedules and visibility controls
- `bookings`: Booking records with meeting links, blockchain integration fields
- `categories`: Service categories
- `chats` & `messages`: Real-time messaging
- `reviews`: Service reviews
- `meeting_integrations`: OAuth connections for Google Meet/Zoom
- `blockchain_events`: Tracks blockchain events for audit and synchronization
- `signature_nonces`: Prevents EIP-712 signature replay attacks

### Smart Wallets & Blockchain

#### Smart Contract Integration
- **Contract Address**: `0x33ddEd6F8183aa4dAB04E2aE216a5a3f9871405a` (Base Sepolia)
- **Smart Wallets**: Automatically created via Privy's SmartWalletsProvider
- **Networks**: Base (production) and Base Sepolia (development)
- **USDC Addresses**: 
  - Base: `0x833589fcd6edb6e08f4c7c32d4f71b54bda02913`
  - Base Sepolia: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- **Funding**: Integrated with Privy's `useFundWallet` for card purchases

#### Blockchain Payment Flow
1. **Booking Creation**: User selects service → Backend creates booking + EIP-712 payment authorization
2. **Payment Execution**: Frontend prompts wallet transaction → USDC payment to smart contract
3. **3-Minute Timeout**: If no payment within 3 minutes → booking status becomes `pending_payment`
4. **Pay Later**: Pending payments show "Pay Now" button in My Bookings page
5. **Service Completion**: Customer marks complete → Smart contract distributes funds (90% provider, 10% platform)

#### Backend Blockchain Services
- **EIP-712 Signer** (`backend/src/eip712-signer.js`): Creates signed payment authorizations
- **Event Monitor** (`backend/src/event-monitor.js`): WebSocket monitoring of blockchain events
- **Blockchain Service** (`backend/src/blockchain-service.js`): Contract interaction utilities

#### Frontend Blockchain Components
- **BlockchainService** (`src/lib/blockchain-service.ts`): Contract interaction with ethers.js
- **Transaction Hooks** (`src/hooks/useTransaction.ts`): Transaction lifecycle management
- **TransactionModal** (`src/components/TransactionModal.tsx`): Payment UI components
- **BlockchainErrorHandler** (`src/lib/blockchain-errors.ts`): User-friendly error messages

### State Management
- **React Query**: For data fetching and caching
- **Local State**: Component-level with useState
- **Global Auth**: PrivyAuthContext provides user state across app

### Username System

BookMe features a comprehensive username system for clean public user page URLs.

#### Username Requirements
- **Length**: 3-30 characters
- **Allowed Characters**: Letters (a-z, A-Z), numbers (0-9), underscores (_), dashes (-)
- **Restrictions**: No spaces, special characters, or reserved words (admin, api, etc.)
- **Examples**: `john-smith`, `jane_doe`, `alex123`

#### Database Implementation
- **Field**: `users.username` (TEXT, unique, nullable)
- **Constraints**: Format validation via PostgreSQL check constraint
- **Auto-generation**: Functions to create default usernames from display names
- **Blacklist**: Reserved words prevented at database and application level

#### Public User Pages
- **URL Pattern**: `/{username}` (e.g., `https://app.com/john-smith`)
- **Authentication**: No authentication required for viewing public user pages
- **Fallback**: Users without usernames have no public user page URL
- **Legacy**: `/profile/:userId` routes completely removed

#### API Patterns
- **Public Methods**: `getPublicUserByUsername()`, `getPublicUserProfile()`, `getPublicUserServices()`
- **Authentication**: Public methods bypass auth, use direct fetch to public endpoints
- **Availability Checking**: Real-time throttled validation + final submission check

#### Real-time Validation
- **Throttling**: 500ms delay to prevent API spam while typing
- **Visual Feedback**: Green/red borders, loading spinners, status icons
- **Dual Validation**: Real-time UX feedback + security check during submission
- **Error Handling**: Specific messages for format, availability, and reserved word issues

### API Patterns

#### ApiClient (api-migration.ts) - RECOMMENDED
The ApiClient uses a **Promise-based initialization pattern** to prevent race conditions:
```typescript
export class ApiClient {
  private static backendApi: BackendAPI | null = null
  private static initializationPromise: Promise<void> | null = null
  
  // All auth-required methods wait for initialization
  static async getMyBookings(userId?: string) {
    await this.waitForInitialization()  // Prevents race conditions
    return this.backendApi!.getMyBookings(userId)
  }
}
```

**Key Features:**
- Prevents "Not authenticated" errors during app startup
- Automatically waits for token availability before API calls
- Global solution - no retry logic needed in components
- All methods that require auth use `waitForInitialization()`

#### Legacy API (api.ts) - DEPRECATED
Old pattern using supabaseAdmin directly:
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
2. **src/lib/api-migration.ts**: ApiClient with race condition prevention (use this!)
3. **src/lib/backend-api.ts**: Backend API client for token-based authentication
4. **src/lib/username.ts**: Username validation, URL generation, and navigation utilities
5. **src/main.tsx**: App initialization with Privy and Smart Wallets
6. **vite.config.ts**: Node polyfills configuration for crypto operations
7. **BOOKING_CARD_SPECIFICATIONS.md**: Booking card behavior specifications and required fixes

## Environment Variables

### Frontend (.env.local)
```bash
# Frontend variables (VITE_ prefix for browser access)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_PRIVY_APP_ID=
VITE_GOOGLE_CLIENT_ID=
VITE_GOOGLE_CLIENT_SECRET=
VITE_BACKEND_URL=  # Backend URL (use Cloudflare tunnel URL for SSL in dev)

# Blockchain Configuration
VITE_CONTRACT_ADDRESS=0x33ddEd6F8183aa4dAB04E2aE216a5a3f9871405a
VITE_USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
VITE_CHAIN_ID=84532
VITE_BLOCKCHAIN_EXPLORER=https://sepolia.basescan.org

# SSL Development (set when using SSL)
VITE_HTTPS=true
VITE_BACKEND_URL=https://192.168.0.10:4443  # Your local IP with HTTPS
```

### Backend (.env)
```bash
# Supabase Configuration (NO VITE_ prefix in backend!)
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# Privy Configuration
PRIVY_APP_ID=
PRIVY_APP_SECRET=

# Server port
PORT=4000

# Smart Contract Configuration
CONTRACT_ADDRESS=0x33ddEd6F8183aa4dAB04E2aE216a5a3f9871405a
CONTRACT_CHAIN_ID=84532
BLOCKCHAIN_RPC_URL=https://sepolia.base.org
BLOCKCHAIN_WEBSOCKET_URL=wss://base-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY

# Backend Signer (SECURE - DO NOT COMMIT!)
BACKEND_SIGNER_PRIVATE_KEY=your_private_key_here
BACKEND_SIGNER_ADDRESS=0x941bcd9063550a584348BC0366E93Dcb08FEcC5d

# USDC Token
USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e

# Redis (Railway addon or local)
REDIS_URL=redis://localhost:6379

# Blockchain Event Monitoring
ENABLE_BLOCKCHAIN_MONITORING=false
```

## Development Gotchas

### SSL Setup
- Run `npm run setup:ssl` once to generate certificates for your local IP
- Certificates are stored in `/certs/` and work across all devices on your network
- Use `npm run dev:all` for the complete SSL development environment
- Access via https://YOUR-LOCAL-IP:8443 from any device on your network

### Authentication
- Never use `supabase.auth.getUser()` - we use Privy for auth
- Always pass `userId` to API methods explicitly
- Use `ensureUuid()` to convert Privy DIDs to database UUIDs

### Background Colors & Design System
- **NEVER set background colors on page components** - the global body background is already set
- Global CSS already applies `bg-background` to body element (`#FAFAFA` light gray)
- Individual pages should inherit this global background, not override it
- Only set backgrounds on specific components (cards, modals, etc.) when needed for design
- This ensures consistent theming and prevents background color conflicts

### Environment Variables Security
- **CRITICAL**: Never use `VITE_` prefix for sensitive keys like service role keys
- `VITE_` prefixed variables are exposed to the browser and public
- Backend-only secrets use no prefix (e.g., `SUPABASE_SERVICE_ROLE_KEY`)

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

### Username System
- **Public User Pages**: Only users with usernames have public user pages (`/{username}`)
- **Legacy Routes**: `/profile/:userId` routes are completely removed
- **Navigation**: Use `navigateToUserProfile()` helper for safe navigation to user pages
- **Validation**: Always use dual validation (real-time + submission) for username availability
- **Public APIs**: Use `getPublicUser*()` methods for unauthenticated access to user data

## Case Convention Standards

### Overview
BookMe follows a **layered approach** to naming conventions, where each layer uses the appropriate convention for its platform:

### Database Layer (PostgreSQL/Supabase)
- **Convention**: `snake_case` (PostgreSQL standard)
- **Examples**: `user_id`, `display_name`, `username`, `created_at`, `is_visible`, `total_earnings`
- **All database tables and columns follow this pattern consistently**

### Backend API (Hono)
- **Request/Response Fields**: `snake_case` (matches database)
- **Variable Names**: `camelCase` (JavaScript standard)
- **Field Mapping Pattern**:
```javascript
// Extract snake_case from request body, assign to camelCase variables
const { service_id: serviceId, scheduled_at: scheduledAt, customer_notes: customerNotes } = body

// Send snake_case to database
const bookingData = {
  service_id: serviceId,
  customer_id: userId,
  provider_id: service.provider_id,
  scheduled_at: scheduledAt,
  // ...
}
```

### Frontend (TypeScript/React)
- **Component Variables**: `camelCase` (JavaScript/React standard)
- **API Response Fields**: `snake_case` (matches backend responses)
- **TypeScript Interfaces**: `snake_case` (matches API responses)

```typescript
// Interface definitions match API responses
interface User {
  display_name: string
  username?: string
  is_verified: boolean
  total_earnings: number
  created_at: string
}

// Component usage
const { display_name, username, is_verified, total_earnings } = user
```

### Best Practices

#### When Adding New Fields
1. **Database**: Always use `snake_case`
2. **Backend**: Map request fields to `camelCase` variables, send `snake_case` to database
3. **Frontend**: Access `snake_case` fields from API responses directly
4. **TypeScript**: Define interfaces with `snake_case` to match API responses

#### Field Mapping Pattern (Backend)
```javascript
// ✅ Correct: Extract and map field names
const { snake_case_field: camelCaseVar } = requestBody

// ❌ Wrong: Assume camelCase exists in request
const { camelCaseField } = requestBody // undefined if frontend sends snake_case
```

#### Frontend API Consumption
```typescript
// ✅ Correct: Access snake_case fields from API responses
booking.service_id
user.display_name  
service.duration_minutes

// ❌ Wrong: Assume camelCase conversion happened
booking.serviceId // undefined unless explicitly converted
```

#### Common Field Mappings
| Database/API | Component Variable | Notes |
|-------------|-------------------|-------|
| `service_id` | `serviceId` | Backend maps on extraction |
| `scheduled_at` | `scheduledAt` | Backend maps on extraction |
| `customer_notes` | `customerNotes` | Backend maps on extraction |
| `is_online` | `isOnline` | Backend maps on extraction |
| `is_visible` | `isVisible` | Backend maps on extraction |
| `created_at` | Access directly | Frontend uses `item.created_at` |
| `display_name` | Access directly | Frontend uses `user.display_name` |
| `username` | Access directly | Frontend uses `user.username` |

### Debugging Field Name Issues
If you encounter "undefined" field errors:
1. Check if backend is extracting the correct field names from request body
2. Verify frontend is sending the expected field names (usually `snake_case`)  
3. Ensure TypeScript interfaces match actual API response structure
4. Use browser dev tools to inspect actual API request/response field names

### Why This Pattern Works
- **Database**: Follows PostgreSQL conventions
- **Backend**: Maintains JavaScript conventions while properly interfacing with database
- **Frontend**: TypeScript interfaces provide type safety with actual API response structure
- **Consistency**: Each layer is internally consistent and correctly interfaces with adjacent layers

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
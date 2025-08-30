# Complete Backend Migration Guide

## 🎯 Migration Overview

We are migrating from an insecure frontend-only architecture (with exposed service role keys) to a secure backend-based architecture using Privy authentication.

### Current Problems
- ❌ Service role key exposed in frontend (`supabaseAdmin`)
- ❌ No request validation or business logic enforcement
- ❌ RLS policies using `auth.uid()` don't work with Privy
- ❌ Direct database access allows data manipulation
- ❌ Real-time features require Supabase Auth (which we don't use)

### Target Architecture
```
Frontend (React) → Backend (Hono/Node.js) → Supabase (PostgreSQL)
    ↓                    ↓                        ↓
Privy Token      Validates & Uses         Service Role Key
(in browser)     Service Role Key         (secure on server)
                        ↓
                  WebSocket Server
                  (for real-time)
```

## 📋 Complete Migration TODO List

### ✅ Phase 0: Backend Foundation (COMPLETED)
- [x] Create Hono backend server with Privy token validation
- [x] Implement JWT generation endpoint (attempted, not needed)
- [x] Create BackendAPI class for frontend
- [x] Test basic endpoints (profile, services, bookings)
- [x] Remove service role key from frontend environment

### 🔄 Phase 1: Complete Backend API (IN PROGRESS)

#### 1.1 Add Missing Endpoints
```javascript
// Currently have:
- GET/POST /api/profile
- GET /api/services
- POST /api/services (create/update)
- DELETE /api/services/:id
- POST /api/bookings
- GET /api/bookings/user/:userId
- PATCH /api/bookings/:bookingId
- GET /api/categories

// Need to add:
- GET /api/services/:id
- GET /api/services/search
- POST /api/bookings/:id/cancel
- POST /api/bookings/:id/complete
- GET /api/conversations
- GET /api/conversations/:id
- POST /api/messages
- GET /api/messages/:conversationId
- POST /api/reviews
- GET /api/reviews/:bookingId
- POST /api/upload (file uploads)
- POST /api/meeting/generate
- DELETE /api/meeting/:bookingId
```

#### 1.2 Implement Business Logic
- [ ] Price validation on bookings
- [ ] Availability checking
- [ ] Meeting link generation
- [ ] Email notifications
- [ ] Review eligibility (7-day window)
- [ ] Service fee calculations

### 📡 Phase 2: WebSocket Implementation

Since Supabase real-time won't work without Supabase Auth, we need our own WebSocket server:

#### 2.1 Setup Socket.io Server
```javascript
// backend/src/websocket.js
import { Server } from 'socket.io';
import { verifyPrivyToken } from './auth';

export function setupWebSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL,
      credentials: true
    }
  });

  io.on('connection', async (socket) => {
    // Verify Privy token
    const token = socket.handshake.auth.token;
    const user = await verifyPrivyToken(token);
    
    if (!user) {
      socket.disconnect();
      return;
    }

    // Join user's room
    socket.join(`user:${user.id}`);
    
    // Subscribe to Supabase changes for this user
    subscribeToUserMessages(user.id, socket);
    subscribeToUserBookings(user.id, socket);
  });
}
```

#### 2.2 Subscribe to Supabase Real-time (Backend)
```javascript
// Backend subscribes using service role
const channel = supabaseAdmin
  .channel('messages')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages'
  }, (payload) => {
    // Forward to appropriate users via WebSocket
    forwardToParticipants(payload.new);
  })
  .subscribe();
```

#### 2.3 Update Frontend for WebSocket
```javascript
// frontend/src/lib/websocket.ts
import io from 'socket.io-client';

export function connectWebSocket(token: string) {
  const socket = io(BACKEND_URL, {
    auth: { token }
  });
  
  socket.on('new-message', (message) => {
    // Update UI
  });
  
  return socket;
}
```

### 🔄 Phase 3: Frontend Migration Strategy

#### 3.1 Create Compatibility Layer
```typescript
// src/lib/api-migration.ts
import { BackendAPI } from './backend-api';
import { usePrivy } from '@privy-io/react-auth';

// Wrapper that mimics old ApiClient interface
export class ApiClient {
  private static backendApi: BackendAPI;
  
  static initialize(getAccessToken: () => Promise<string>) {
    this.backendApi = new BackendAPI(getAccessToken);
  }
  
  // Map old methods to new backend calls
  static async getUserProfileById(userId: string) {
    return this.backendApi.getUserProfileById(userId);
  }
  
  static async getUserServices(userId: string) {
    return this.backendApi.getUserServices(userId);
  }
  
  // ... map all other methods
}
```

#### 3.2 Components to Migrate (14 total)
- [ ] DashboardProfile
- [ ] DashboardServices  
- [ ] DashboardOrders
- [ ] DashboardBookings
- [ ] DashboardIntegrations
- [ ] Profile (public)
- [ ] Discover
- [ ] Onboarding
- [ ] MyOrders
- [ ] MyServices
- [ ] MyBookingsCustomer
- [ ] MyProfile
- [ ] CreateServiceModal
- [ ] ChatModal (needs WebSocket)

### 🔒 Phase 4: Update RLS Policies

Since we're using backend with service role, update RLS to be restrictive:

```sql
-- Only allow backend (service role) to modify data
-- Public reads for some tables

-- Users: Public profiles
DROP POLICY IF EXISTS "users_update_own" ON users;
CREATE POLICY "users_public_read" ON users
FOR SELECT USING (true);

-- Services: Public active services
DROP POLICY IF EXISTS "services_provider_insert" ON services;
DROP POLICY IF EXISTS "services_provider_update" ON services;
CREATE POLICY "services_public_read" ON services
FOR SELECT USING (is_active = true);

-- Bookings: No public access
DROP POLICY IF EXISTS "bookings_customer_read" ON bookings;
DROP POLICY IF EXISTS "bookings_provider_read" ON bookings;
-- Backend uses service role, bypasses RLS

-- Messages: No public access
DROP POLICY IF EXISTS "messages_conversation_participants" ON messages;
-- Real-time handled by backend WebSocket
```

### 🧹 Phase 5: Cleanup

#### 5.1 Remove Old Code
- [ ] Delete `src/lib/api.ts` (old ApiClient)
- [ ] Delete `src/lib/meeting-generation.ts` (move to backend)
- [ ] Remove `supabaseAdmin` from all files
- [ ] Clean up unused imports

#### 5.2 Update Environment Variables
```env
# Frontend (.env)
VITE_SUPABASE_URL=xxx
VITE_SUPABASE_ANON_KEY=xxx  # Keep for public reads
VITE_PRIVY_APP_ID=xxx
VITE_BACKEND_URL=https://your-backend.com
# Remove: VITE_SUPABASE_SERVICE_ROLE_KEY

# Backend (.env)
PRIVY_APP_SECRET=xxx
SUPABASE_JWT_SECRET=xxx  # Not actually needed
VITE_SUPABASE_URL=xxx
VITE_SUPABASE_SERVICE_ROLE_KEY=xxx
```

### 🚀 Phase 6: Deployment

#### 6.1 Backend Deployment Options
- **Option A**: Railway/Render (Easy)
  ```yaml
  # railway.json or render.yaml
  services:
    - type: web
      name: bookme-backend
      env: node
      buildCommand: npm install
      startCommand: npm start
      envVars:
        - PRIVY_APP_SECRET
        - VITE_SUPABASE_SERVICE_ROLE_KEY
  ```

- **Option B**: Docker (Flexible)
  ```dockerfile
  FROM node:18-alpine
  WORKDIR /app
  COPY backend/package*.json ./
  RUN npm ci --production
  COPY backend/src ./src
  CMD ["node", "src/index.js"]
  ```

#### 6.2 Update Frontend
- [ ] Set `VITE_BACKEND_URL` to production URL
- [ ] Remove all service role key references
- [ ] Deploy to Vercel/Netlify/Cloudflare

### 📊 Phase 7: Testing & Monitoring

#### 7.1 Test Checklist
- [ ] User registration/login with Privy
- [ ] Profile creation and updates
- [ ] Service CRUD operations
- [ ] Booking flow (create, confirm, cancel, complete)
- [ ] Real-time chat via WebSocket
- [ ] Review system
- [ ] File uploads
- [ ] Meeting generation

#### 7.2 Security Verification
- [ ] No exposed keys in frontend bundle
- [ ] All operations require valid Privy token
- [ ] RLS prevents direct database access
- [ ] Rate limiting on backend endpoints
- [ ] Input validation on all endpoints

## 🎯 Migration Milestones

### Milestone 1: Core Functionality (Week 1)
- Complete backend API
- Migrate critical components (Dashboard)
- Basic WebSocket for chat

### Milestone 2: Full Migration (Week 2)
- Migrate all components
- Complete WebSocket implementation
- Update all RLS policies

### Milestone 3: Production Ready (Week 3)
- Deploy backend to production
- Complete testing
- Remove all old code
- Documentation

## ⚠️ Critical Considerations

### Real-time Architecture
Since we can't use Supabase Auth, real-time MUST go through our backend:
```
User → WebSocket → Backend → Supabase Real-time
                      ↓
                Validates Privy Token
                Filters by User Access
```

### File Uploads
Two options:
1. **Through Backend**: Safer but uses more bandwidth
2. **Direct with Signed URLs**: Backend generates signed upload URL

### Meeting Integration
- OAuth tokens stored in backend only
- Backend handles all Google Calendar API calls
- Meeting links generated server-side

### Performance Optimizations
- Implement caching (Redis) for frequently accessed data
- Use connection pooling for database
- Implement pagination for large datasets
- Consider CDN for static assets

## 📈 Success Metrics

- ✅ Zero exposed credentials in frontend
- ✅ All database operations authenticated
- ✅ Real-time features working through WebSocket
- ✅ < 200ms API response time (p95)
- ✅ Zero security vulnerabilities
- ✅ Successful production deployment

## 🚦 Current Status

- ✅ Phase 0: Backend Foundation
- 🔄 Phase 1: Complete Backend API (30% done)
- ⏳ Phase 2: WebSocket Implementation
- ⏳ Phase 3: Frontend Migration
- ⏳ Phase 4: Update RLS Policies
- ⏳ Phase 5: Cleanup
- ⏳ Phase 6: Deployment
- ⏳ Phase 7: Testing & Monitoring

## Next Immediate Steps

1. **Add remaining backend endpoints** (reviews, messages, meetings)
2. **Setup WebSocket server** for real-time features
3. **Create migration wrapper** for easy component updates
4. **Start migrating Dashboard components** (highest priority)
5. **Test thoroughly** before removing old code

---

This migration will transform BookMe from a vulnerable frontend-only app to a secure, scalable architecture with proper authentication, real-time features, and business logic enforcement.
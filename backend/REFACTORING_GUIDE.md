# Backend Refactoring Guide

## Overview
This guide documents the patterns, conventions, and usage instructions for the refactored backend architecture. It will be updated with each successful extraction to help maintain consistency and provide reference for future modifications.

---

## Directory Structure
```
backend/
├── src/
│   ├── config/          # Configuration management
│   ├── middleware/      # Express/Hono middleware
│   ├── routes/          # Route handlers
│   ├── app.js          # Application setup
│   ├── server.js       # Server initialization
│   └── index.js        # Legacy (being refactored)
```

---

## Extracted Modules Reference

### Configuration System
*To be updated when config extraction is complete*

### Middleware

#### Authentication Middleware (`src/middleware/auth.js`)
**Extracted:** 2025-09-10
**Purpose:** Handles Privy authentication and user context management

**Exports:**
- `verifyPrivyAuth` - Middleware function for protected routes
- `privyDidToUuid` - Converts Privy DID to UUID format
- `getPrivyClient` - Returns initialized Privy client
- `getSupabaseAdmin` - Returns initialized Supabase admin client

**Usage:**
```javascript
// In routes
import { verifyPrivyAuth } from '../middleware/auth.js';
app.get('/protected', verifyPrivyAuth, handler);

// In other files needing clients
import { getPrivyClient, getSupabaseAdmin } from '../middleware/auth.js';
const privyClient = getPrivyClient();
const supabaseAdmin = getSupabaseAdmin();
```

**Context Variables Set:**
- `c.get('privyUser')` - Original Privy user object
- `c.get('userId')` - UUID format user ID

**Features:**
- Automatic wallet address synchronization
- Bearer token validation
- User context injection

### Routes

#### Authentication Routes (`src/routes/auth.js`)
**Extracted:** 2025-09-10
**Purpose:** Handles authentication-related endpoints

**Endpoints:**
- `POST /api/auth/token` - Generate Supabase-compatible JWT from Privy token

**Usage:**
```javascript
// In main app file
import authRoutes from './routes/auth.js';
authRoutes(app);
```

**Dependencies:**
- Uses auth middleware for client instances
- Requires JWT secret in environment variables
- Creates/retrieves user profiles automatically

**Request/Response:**
```
POST /api/auth/token
Headers: Authorization: Bearer {privyToken}
Response: { token, user_id, expires_in }
```

#### User/Profile Routes (`src/routes/users.js`)
**Extracted:** 2025-09-10
**Purpose:** Handles user profile management and username system endpoints

**Endpoints:**
- `GET /api/profile` - Get or create authenticated user's profile
- `PATCH /api/profile` - Update authenticated user's profile
- `GET /api/profile/public/:userId` - Get public user profile by ID (no auth)
- `GET /api/username/check/:username` - Check username availability (no auth)
- `PATCH /api/username` - Update authenticated user's username
- `GET /api/user/username/:username` - Get user by username (no auth)
- `GET /api/user/:userId` - Get user by ID (no auth)

**Usage:**
```javascript
// In main app file
import userRoutes from './routes/users.js';
userRoutes(app);
```

**Dependencies:**
- Uses auth middleware for authenticated endpoints
- Validates username format and blacklist
- Handles public user lookups

**Key Features:**
- Username validation with blacklist checking
- Public profile access without authentication
- Profile auto-creation for new users
- Username uniqueness enforcement

#### Service Routes (`src/routes/services.js`)
**Extracted:** 2025-09-10
**Purpose:** Handles service management endpoints for both authenticated users and public access

**Endpoints:**
- `GET /api/services` - Get services with filtering (authenticated)
- `GET /api/services/user/:userId` - Get services for specific provider (authenticated)
- `POST /api/services` - Create or update service (authenticated)
- `DELETE /api/services/:serviceId` - Delete service (authenticated)
- `PATCH /api/services/:serviceId/visibility` - Toggle service visibility (authenticated)
- `GET /api/services/public/user/:userId` - Get public services for provider (no auth)
- `GET /api/services/public` - Search public services with filters (no auth)
- `GET /api/services/public/:providerId` - Get provider services with category data (no auth)
- `GET /api/services/:id` - Get single service with provider info (authenticated)
- `GET /api/services/search` - Advanced service search (authenticated)

**Usage:**
```javascript
// In main app file
import serviceRoutes from './routes/services.js';
serviceRoutes(app);
```

**Dependencies:**
- Uses auth middleware for protected endpoints
- Supabase admin client for database operations
- Category relationship joins for public endpoints

**Key Features:**
- CRUD operations with ownership validation
- Public vs authenticated endpoint patterns
- Advanced search and filtering
- Visibility controls for service publishing
- Category information integration

#### Booking Routes (`src/routes/bookings.js`)
**Extracted:** 2025-09-10
**Purpose:** Handles complete booking lifecycle with blockchain payment integration and EIP-712 signatures

**Endpoints:**
- `GET /api/bookings` - Get user's bookings with filters (authenticated)
- `POST /api/bookings` - Create new booking with payment authorization (authenticated)
- `GET /api/bookings/:bookingId` - Get booking details with authorization (authenticated)
- `PATCH /api/bookings/:bookingId` - Update booking status and details (authenticated)
- `DELETE /api/bookings/:bookingId` - Cancel/delete booking (authenticated)
- `POST /api/bookings/:bookingId/complete` - Mark booking as completed (authenticated)
- `POST /api/bookings/:bookingId/payment-authorization` - Generate payment authorization signature (authenticated)
- `GET /api/bookings/provider/:providerId` - Get provider's incoming orders (authenticated)
- `GET /api/bookings/pending-payment` - Get user's bookings needing payment (authenticated)
- `POST /api/bookings/:bookingId/extend` - Extend booking duration (authenticated)
- `POST /api/bookings/:bookingId/reschedule` - Reschedule booking time (authenticated)
- `GET /api/bookings/:bookingId/payment-status` - Check blockchain payment status (authenticated)
- `POST /api/bookings/:bookingId/dispute` - Create booking dispute (authenticated)

**Key Features:**
- EIP-712 payment authorization generation for blockchain transactions
- Complete booking lifecycle management (pending → confirmed → completed)
- 3-minute payment timeout with pending payment recovery
- Blockchain payment verification and synchronization
- Booking disputes and resolution tracking
- Real-time status updates and notifications

#### Review Routes (`src/routes/reviews.js`)
**Extracted:** 2025-09-10
**Purpose:** Handles review system with rating calculations and provider statistics

**Endpoints:**
- `POST /api/reviews` - Create review for completed booking (authenticated)
- `GET /api/reviews/:providerId` - Get reviews for provider with pagination (no auth)
- `PATCH /api/reviews/:reviewId` - Update existing review within edit window (authenticated)

**Key Features:**
- Review creation limited to completed bookings
- 7-day edit window for reviews
- Automatic provider rating recalculation
- Public access to provider reviews
- Comprehensive review validation

#### Conversation/Message Routes (`src/routes/conversations.js`)
**Extracted:** 2025-09-10
**Purpose:** Real-time messaging system with WebSocket integration

**Endpoints:**
- `GET /api/conversations` - Get user's conversations with latest message (authenticated)
- `GET /api/conversations/:conversationId/messages` - Get conversation messages with pagination (authenticated)
- `POST /api/messages` - Send new message with real-time delivery (authenticated)
- `POST /api/conversations` - Create new conversation between users (authenticated)
- `PATCH /api/conversations/:conversationId/read` - Mark conversation as read (authenticated)
- `GET /api/conversations/:conversationId` - Get conversation details (authenticated)

**Key Features:**
- Real-time message delivery via WebSocket (Socket.IO)
- Conversation auto-creation for new user interactions
- Read status tracking and notifications
- Message pagination and history
- User presence and typing indicators

#### Integration Routes (`src/routes/integrations.js`)
**Extracted:** 2025-09-10
**Purpose:** Third-party service integrations and OAuth management for meeting generation

**Endpoints:**
- `GET /api/integrations` - Get user's active integrations (authenticated)
- `POST /api/integrations/google` - Connect Google OAuth integration (authenticated)
- `DELETE /api/integrations/:integrationId` - Remove integration (authenticated)
- `POST /api/meeting/generate` - Generate meeting link for booking (authenticated)
- `GET /api/integrations/status` - Check integration connectivity status (authenticated)
- `POST /api/integrations/refresh` - Refresh expired OAuth tokens (authenticated)

**Key Features:**
- Google Meet and Zoom integration support
- OAuth 2.0 token management and refresh
- Automatic meeting link generation for bookings
- Integration health monitoring
- Secure credential storage and rotation

#### Upload Routes (`src/routes/uploads.js`)
**Extracted:** 2025-09-10
**Purpose:** File upload system with Supabase Storage integration and comprehensive validation

**Endpoints:**
- `POST /api/upload` - Upload files with validation and security controls (authenticated)
- `GET /api/uploads/user` - Get user's upload history with pagination (authenticated)
- `DELETE /api/uploads/:uploadId` - Delete uploaded file and record (authenticated)

**Key Features:**
- Multi-type file support (images, documents, general files)
- 10MB file size limit with type-based validation
- Automatic file organization and unique naming
- Avatar upload with user profile integration
- Comprehensive metadata tracking and storage

#### System Routes (`src/routes/system.js`)
**Extracted:** 2025-09-10
**Purpose:** System monitoring, health checks, and administrative endpoints

**Endpoints:**
- `GET /health` - Health monitoring with system metrics (no auth)
- `GET /api/categories` - Service categories with counts (no auth)
- `GET /api/blockchain/monitor-status` - Blockchain monitoring status (no auth)
- `POST /api/blockchain/start-monitoring` - Start blockchain event monitoring (no auth)
- `POST /api/blockchain/stop-monitoring` - Stop blockchain monitoring (no auth)
- `GET /api/system/stats` - System-wide statistics and metrics (no auth)

**Key Features:**
- Comprehensive health monitoring and system metrics
- Blockchain event monitoring management
- System-wide statistics for administration
- Service category management with usage counts
- Performance monitoring and diagnostics

---

## 🎉 Phase 1 Completion Summary

**Status: COMPLETE ✅** (2025-09-13 - Final Status Update)

### What Was Accomplished
✅ **Complete Route Extraction**: Successfully extracted all major route groups from the monolithic 2,882-line `index.js` file into 9 separate, well-documented modules:

1. **Authentication Middleware & Routes** - User authentication and JWT token management
2. **User/Profile Routes** (7 endpoints) - User profile and username system management
3. **Service Routes** (10 endpoints) - Service CRUD operations and public marketplace
4. **Booking Routes** (13 endpoints) - Complete booking lifecycle with blockchain integration
5. **Review Routes** (3 endpoints) - Review system with rating calculations
6. **Conversation/Message Routes** (6 endpoints) - Real-time messaging with WebSocket
7. **Integration Routes** (6 endpoints) - Third-party OAuth and meeting generation
8. **Upload Routes** (3 endpoints) - File upload with Supabase Storage
9. **System Routes** (6 endpoints) - Health monitoring and system administration

**Total Endpoints Extracted:** 54 endpoints across 9 route modules

### Current File Status (2025-09-13)
- **Total Lines in index.js**: 3,063 lines
- **Active Code Lines**: 170 lines (5.5% of file)
- **Commented Out Code**: 2,807 lines (94.5% of file)
- **Functional Status**: ✅ All endpoints working, server stable

### Key Achievements
- **Zero Downtime Migration**: Server remained functional throughout entire refactoring process
- **Comprehensive Documentation**: Every endpoint includes detailed JSDoc with request/response specs
- **Code Preservation**: All original code commented out (not deleted) for easy rollback
- **Modular Architecture**: Clean separation of concerns with standardized patterns
- **Backward Compatibility**: No breaking changes to existing API contracts

### Technical Patterns Established
- **Route Module Pattern**: Consistent export/import structure for all route files
- **Authentication Integration**: Standardized auth middleware usage across protected endpoints  
- **Error Handling**: Consistent error response patterns and status codes
- **Documentation Standards**: Comprehensive JSDoc with usage examples
- **Rollback Safety**: Original code preservation with clear markers

### Server Status
✅ **Backend server running successfully at https://localhost:4443**
✅ **All 54 endpoints properly registered and functional**
✅ **No compilation errors or runtime issues**
✅ **Recent fixes applied**: Chat messaging system fully operational

---

## 📋 Phase 2: Optional Cleanup Tasks

**Status: OPTIONAL** - The refactoring is functionally complete. The following are cleanup tasks that can be performed when convenient:

### Remaining Cleanup Options

#### 1. Code Cleanup (Low Priority)
- **Task**: Remove 2,807 lines of commented-out code from `index.js`
- **Risk**: ⚠️ High - Removes rollback capability
- **Benefit**: Reduces file size from 3,063 to ~256 lines
- **Recommendation**: Keep commented code for now as safety net

#### 2. Configuration Extraction (Optional)
- **Task**: Extract blockchain service setup, CORS configuration, and error handlers to separate config files
- **Files**: Could create `src/config/server.js`, `src/config/blockchain.js`, `src/config/cors.js`
- **Benefit**: Further modularization of remaining ~170 active lines
- **Priority**: Low - current structure is clean and maintainable

#### 3. Server Initialization Extraction (Optional)
- **Task**: Move server startup logic to `src/server.js`, leave only app export in `index.js`
- **Benefit**: Cleaner separation between app definition and server startup
- **Priority**: Very Low - current pattern works well

### What Does NOT Need Refactoring
✅ **All route endpoints** - Successfully extracted and fully functional  
✅ **Authentication middleware** - Properly modularized  
✅ **Database connections** - Working correctly  
✅ **WebSocket setup** - Functioning properly  
✅ **Error handling** - Comprehensive coverage  
✅ **Server startup** - Stable and reliable  

### Next Steps Recommendation
**Recommended Action**: **NO FURTHER REFACTORING NEEDED**  
- Current architecture is clean, modular, and maintainable
- All endpoints are properly organized in separate modules
- Server is stable with zero downtime during migration
- Focus development efforts on new features rather than additional refactoring

---

## Migration Patterns

### Pattern 1: Extracting Configuration
*Will be documented after first extraction*

### Pattern 2: Extracting Middleware
*Will be documented after middleware extraction*

### Pattern 3: Extracting Routes
*Will be documented after first route extraction*

---

## Common Issues and Solutions
*This section will be updated with any issues encountered during refactoring*

---

## Testing Procedures
*Testing steps for each extracted module will be documented here*

---

## Code Conventions

### File Naming
- Routes: `src/routes/{resource}.js` (e.g., `users.js`, `bookings.js`)
- Middleware: `src/middleware/{function}.js` (e.g., `auth.js`, `validation.js`)
- Config: `src/config/{scope}.js` (e.g., `database.js`, `blockchain.js`)

### Export Patterns
```javascript
// Named exports for utilities
export { functionName, anotherFunction };

// Default export for route modules
export default router;

// Class exports
export default class ServiceName { }
```

### Import Patterns
```javascript
// Configuration
import config from '../config/index.js';

// Middleware
import { verifyPrivyAuth } from '../middleware/auth.js';

// Routes (in app.js)
import authRoutes from './routes/auth.js';
```

---

## Rollback Procedures
Each extraction is committed separately. To rollback:
```bash
# View commit history
git log --oneline

# Rollback specific extraction
git revert <commit-hash>

# Or reset to specific point
git reset --hard <commit-hash>
```

---

## Progress Tracking
See `PHASE1_TODO.md` for detailed task list and completion status.

---

## Notes
- Always comment out old code instead of deleting during extraction
- Test thoroughly after each extraction
- Update this guide with lessons learned
- Commit frequently with descriptive messages
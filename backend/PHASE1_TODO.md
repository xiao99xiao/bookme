# Backend Refactoring Phase 1: TODO List

## Overview
This document tracks the progress of splitting the monolithic `index.js` (2,882 lines) into modular components.

## Approach
1. Create new file with extracted functionality
2. Comment out (don't delete) old code in index.js
3. Update all references to use new module
4. Test thoroughly before proceeding
5. Commit after each successful extraction

---

## Phase 1.1: Core Infrastructure Setup

### [ ] 1. Configuration System (`src/config/`)
- [ ] Create `src/config/index.js` - Centralized configuration
- [ ] Create `src/config/database.js` - Database configuration
- [ ] Create `src/config/blockchain.js` - Blockchain settings
- [ ] Create `src/config/auth.js` - Authentication settings
- [ ] Create `src/config/cors.js` - CORS configuration
- [ ] Update all files to use centralized config
- [ ] Test all configuration loading
- [ ] Commit: "Extract configuration system"

### [ ] 2. Middleware Extraction (`src/middleware/`)
- [ ] Create `src/middleware/auth.js` - Extract verifyPrivyAuth middleware
- [ ] Create `src/middleware/error-handler.js` - Centralized error handling
- [ ] Create `src/middleware/validation.js` - Request validation helpers
- [ ] Create `src/middleware/logging.js` - Request/response logging
- [ ] Update all routes to use extracted middleware
- [ ] Test authentication flow
- [ ] Commit: "Extract middleware layer"

---

## Phase 1.2: Route Extraction (Split 47 endpoints)

### [ ] 3. Authentication Routes (`src/routes/auth.js`)
**Endpoints to extract (1):**
- [ ] POST `/api/auth/token` (lines ~178-268)
- [ ] Update imports in index.js
- [ ] Test authentication flow
- [ ] Commit: "Extract authentication routes"

### [ ] 4. User/Profile Routes (`src/routes/users.js`)
**Endpoints to extract (6):**
- [ ] GET `/api/profile` (lines ~270-318)
- [ ] PATCH `/api/profile` (lines ~878-909)
- [ ] GET `/api/profile/public/:userId` (lines ~1293-1314)
- [ ] GET `/api/user/:userId` (lines ~1540-1564)
- [ ] GET `/api/username/check/:username` (lines ~1415-1462)
- [ ] PATCH `/api/username` (lines ~1464-1512)
- [ ] GET `/api/user/username/:username` (lines ~1514-1538)
- [ ] Update all user-related imports
- [ ] Test profile operations
- [ ] Commit: "Extract user/profile routes"

### [ ] 5. Service Routes (`src/routes/services.js`)
**Endpoints to extract (12):**
- [ ] GET `/api/services` (lines ~320-344)
- [ ] POST `/api/services` (lines ~935-986)
- [ ] GET `/api/services/user/:userId` (lines ~911-933)
- [ ] DELETE `/api/services/:serviceId` (lines ~988-1010)
- [ ] PATCH `/api/services/:serviceId/visibility` (lines ~1012-1046)
- [ ] GET `/api/services/public` (lines ~1371-1413)
- [ ] GET `/api/services/public/:providerId` (lines ~1566-1607)
- [ ] GET `/api/services/public/user/:userId` (lines ~1316-1341)
- [ ] GET `/api/services/:id` (lines ~1609-1633)
- [ ] GET `/api/services/search` (lines ~1635-1676)
- [ ] Update all service-related imports
- [ ] Test service CRUD operations
- [ ] Commit: "Extract service routes"

### [ ] 6. Booking Routes (`src/routes/bookings.js`)
**Endpoints to extract (16):**
- [ ] POST `/api/bookings` (lines ~346-556)
- [ ] POST `/api/bookings/:id/authorize-payment` (lines ~558-667)
- [ ] POST `/api/bookings/:id/complete-service` (lines ~669-732)
- [ ] POST `/api/bookings/:id/complete-service-backend` (lines ~734-796)
- [ ] GET `/api/bookings/:id/blockchain-status` (lines ~798-833)
- [ ] GET `/api/bookings/user/:userId` (lines ~1048-1102)
- [ ] PATCH `/api/bookings/:bookingId` (lines ~1104-1181)
- [ ] POST `/api/bookings/:bookingId/reject` (lines ~1183-1271)
- [ ] POST `/api/bookings/:id/cancel` (lines ~1678-1732)
- [ ] GET `/api/bookings/:id/cancellation-policies` (lines ~1734-1753)
- [ ] POST `/api/bookings/:id/refund-breakdown` (lines ~1755-1778)
- [ ] POST `/api/bookings/:id/cancel-with-policy` (lines ~1780-1818)
- [ ] POST `/api/bookings/:id/authorize-cancellation` (lines ~1820-1946)
- [ ] Update all booking-related imports
- [ ] Test booking operations
- [ ] Commit: "Extract booking routes"

### [ ] 7. Review Routes (`src/routes/reviews.js`)
**Endpoints to extract (2):**
- [ ] POST `/api/reviews` (lines ~2273-2395)
- [ ] GET `/api/reviews/:bookingId` (lines ~2397-2449)
- [ ] GET `/api/reviews/public/provider/:providerId` (lines ~1343-1369)
- [ ] Update review-related imports
- [ ] Test review operations
- [ ] Commit: "Extract review routes"

### [ ] 8. Conversation/Message Routes (`src/routes/conversations.js`)
**Endpoints to extract (6):**
- [ ] GET `/api/conversations` (lines ~1948-2023)
- [ ] GET `/api/conversations/:id` (lines ~2025-2056)
- [ ] POST `/api/conversations` (lines ~2058-2113)
- [ ] PUT `/api/conversations/:conversationId/read` (lines ~2115-2138)
- [ ] POST `/api/messages` (lines ~2140-2206)
- [ ] GET `/api/messages/:conversationId` (lines ~2208-2271)
- [ ] Update messaging-related imports
- [ ] Test messaging operations
- [ ] Commit: "Extract conversation routes"

### [ ] 9. Integration Routes (`src/routes/integrations.js`)
**Endpoints to extract (6):**
- [ ] GET `/api/integrations` (lines ~2537-2558, ~2692-2720)
- [ ] POST `/api/integrations` (lines ~2560-2605)
- [ ] DELETE `/api/integrations/:id` (lines ~2607-2630, ~2722-2744)
- [ ] POST `/api/oauth/google-callback` (lines ~2746-2847)
- [ ] POST `/api/meeting/generate` (lines ~2451-2501)
- [ ] DELETE `/api/meeting/:bookingId` (lines ~2503-2535)
- [ ] Update integration-related imports
- [ ] Test OAuth and meeting operations
- [ ] Commit: "Extract integration routes"

### [ ] 10. Upload Routes (`src/routes/uploads.js`)
**Endpoints to extract (1):**
- [ ] POST `/api/upload` (lines ~2632-2690)
- [ ] Update upload-related imports
- [ ] Test file upload operations
- [ ] Commit: "Extract upload routes"

### [ ] 11. System Routes (`src/routes/system.js`)
**Endpoints to extract (4):**
- [ ] GET `/health` (lines ~170-176)
- [ ] GET `/api/categories` (lines ~1273-1291)
- [ ] GET `/api/blockchain/monitor-status` (lines ~835-848)
- [ ] POST `/api/blockchain/start-monitoring` (lines ~850-860)
- [ ] POST `/api/blockchain/stop-monitoring` (lines ~862-876)
- [ ] Update system-related imports
- [ ] Test system endpoints
- [ ] Commit: "Extract system routes"

---

## Phase 1.3: Core App Setup

### [ ] 12. Main App File (`src/app.js`)
- [ ] Create new app.js with Hono setup
- [ ] Import all route modules
- [ ] Setup middleware chain
- [ ] Configure error handling
- [ ] Test complete application flow
- [ ] Commit: "Create modular app structure"

### [ ] 13. Server File (`src/server.js`)
- [ ] Extract server initialization
- [ ] Move WebSocket setup
- [ ] Configure HTTPS/HTTP servers
- [ ] Test server startup
- [ ] Commit: "Extract server initialization"

---

## Phase 1.4: Cleanup and Verification

### [ ] 14. Remove Commented Code
- [ ] Verify all functionality working
- [ ] Remove all commented code from index.js
- [ ] Update imports and exports
- [ ] Run comprehensive tests
- [ ] Commit: "Complete Phase 1 refactoring"

### [ ] 15. Documentation Update
- [ ] Update API documentation
- [ ] Update README with new structure
- [ ] Create migration guide
- [ ] Commit: "Update documentation for new structure"

---

## Success Metrics
- [ ] All 47 endpoints working correctly
- [ ] Authentication flow intact
- [ ] WebSocket connections functional
- [ ] Blockchain operations working
- [ ] No regression in functionality
- [ ] index.js reduced from 2,882 lines to < 100 lines

## Testing Checklist
- [ ] User registration and login
- [ ] Service creation and management
- [ ] Booking flow (create, pay, complete, cancel)
- [ ] Review submission
- [ ] Messaging between users
- [ ] File uploads
- [ ] Meeting generation
- [ ] OAuth integration flow

---

## Notes
- Each extraction should be atomic and testable
- Keep old code commented until fully verified
- Update guide document with each extraction
- Commit frequently for easy rollback
- Test after each extraction
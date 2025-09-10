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
*To be updated as each route module is extracted*

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
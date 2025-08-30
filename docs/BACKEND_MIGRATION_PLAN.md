# Backend Migration Plan for BookMe

## Executive Summary
Transform BookMe from a frontend-only application with direct database access to a secure, scalable architecture with a dedicated backend API server, while maintaining ease of deployment through Docker containerization.

## Current Architecture Analysis

### Current Stack
```
┌─────────────┐
│   Browser   │
│  (React)    │
└──────┬──────┘
       │ Direct Access (INSECURE)
       ├────────────────┐
       ▼                ▼
┌──────────────┐  ┌─────────────┐
│   Supabase   │  │    Privy    │
│  (Database)  │  │   (Auth)    │
└──────────────┘  └─────────────┘
```

### Security Vulnerabilities
1. **Exposed Admin Keys**: `supabaseAdmin` client in browser code
2. **No Request Validation**: Direct database writes without business logic
3. **Price Manipulation Risk**: Users can modify booking prices
4. **Unprotected APIs**: All database operations exposed to client
5. **No Rate Limiting**: Potential for abuse and DOS attacks

## Proposed Architecture

### Target Stack
```
┌─────────────┐
│   Browser   │
│  (React)    │
└──────┬──────┘
       │ HTTPS API Calls
       ▼
┌─────────────┐
│  API Server │ (Node.js/Express)
│  - Auth     │
│  - Validate │
│  - Business │
└──────┬──────┘
       │ Secure Server-Side
       ├────────────────┐
       ▼                ▼
┌──────────────┐  ┌─────────────┐
│   Supabase   │  │    Privy    │
│  (Database)  │  │   (Auth)    │
└──────────────┘  └─────────────┘
```

## Implementation Options Comparison

### Option 1: Express.js + TypeScript (Recommended)
**Pros:**
- Familiar to React developers
- Share types between frontend/backend
- Extensive middleware ecosystem
- Easy WebSocket support for real-time features
- Lightweight and fast

**Cons:**
- Need to structure everything from scratch
- More boilerplate code

**Deployment:** Single Docker container or separate containers

### Option 2: Next.js Full-Stack
**Pros:**
- Minimal changes to current React code
- Built-in API routes
- Automatic TypeScript support
- SSR/SSG capabilities for better SEO
- Vercel deployment option

**Cons:**
- Heavier than pure Express
- Vendor lock-in risk with Vercel
- Learning curve for Next.js patterns

**Deployment:** Single Docker container with Node.js

### Option 3: NestJS
**Pros:**
- Enterprise-grade structure
- Built-in validation, guards, interceptors
- Modular architecture
- Great for large teams

**Cons:**
- Steeper learning curve
- Overkill for current project size
- More complex setup

**Deployment:** Separate backend container

### Option 4: Supabase Edge Functions (Serverless)
**Pros:**
- No server management
- Auto-scaling
- Integrated with Supabase
- Pay-per-use

**Cons:**
- Vendor lock-in
- Limited runtime (Deno)
- Cold starts
- Harder local development

**Deployment:** Deploy functions to Supabase

## Recommended Solution: Express.js + TypeScript

### Phase 1: Backend Setup (Week 1)

#### Project Structure
```
bookme/
├── apps/
│   ├── frontend/          # Current React app
│   │   ├── src/
│   │   └── package.json
│   └── backend/           # New Express API
│       ├── src/
│       │   ├── routes/    # API endpoints
│       │   ├── services/  # Business logic
│       │   ├── middleware/ # Auth, validation
│       │   ├── types/     # Shared TypeScript types
│       │   └── index.ts  # Server entry
│       ├── Dockerfile
│       └── package.json
├── shared/                # Shared types/utils
│   └── types/
├── docker-compose.yml
└── package.json          # Monorepo root
```

#### Core Dependencies
```json
{
  "dependencies": {
    "express": "^4.18.0",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "express-rate-limit": "^6.0.0",
    "@supabase/supabase-js": "^2.0.0",
    "@privy-io/node-sdk": "^1.0.0",
    "zod": "^3.0.0",
    "winston": "^3.0.0",
    "dotenv": "^16.0.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "typescript": "^5.0.0",
    "ts-node-dev": "^2.0.0",
    "jest": "^29.0.0"
  }
}
```

### Phase 2: API Migration (Week 2-3)

#### Priority API Endpoints
```typescript
// 1. Authentication
POST   /api/auth/login      // Verify Privy token
POST   /api/auth/refresh
GET    /api/auth/me

// 2. User Management
GET    /api/users/:id
PUT    /api/users/:id
GET    /api/users/:id/profile

// 3. Services (Critical)
GET    /api/services
POST   /api/services
PUT    /api/services/:id
DELETE /api/services/:id
GET    /api/services/user/:userId

// 4. Bookings (Critical)
POST   /api/bookings
GET    /api/bookings/my
GET    /api/bookings/incoming
PUT    /api/bookings/:id/status
POST   /api/bookings/:id/complete

// 5. Reviews
POST   /api/reviews
PUT    /api/reviews/:id
GET    /api/reviews/service/:serviceId

// 6. Payments/Wallet
GET    /api/wallet/balance
POST   /api/wallet/fund
POST   /api/payments/process

// 7. Real-time
WS     /api/chat           // WebSocket for chat
GET    /api/chat/messages/:roomId
```

#### Authentication Middleware
```typescript
// middleware/auth.ts
import { PrivyClient } from '@privy-io/node-sdk';

export async function authenticateRequest(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const privyClient = new PrivyClient(process.env.PRIVY_APP_ID!, process.env.PRIVY_APP_SECRET!);
    const user = await privyClient.verifyAuthToken(token);
    
    // Convert Privy DID to UUID for database
    req.user = {
      privyId: user.userId,
      dbId: convertToUUID(user.userId)
    };
    
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
```

#### Request Validation
```typescript
// middleware/validate.ts
import { z } from 'zod';

const createServiceSchema = z.object({
  title: z.string().min(5).max(100),
  description: z.string().min(20).max(1000),
  price: z.number().min(10).max(10000),
  duration_minutes: z.number().min(15).max(480),
  is_online: z.boolean(),
  timeSlots: z.record(z.boolean())
});

export function validateRequest(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: error.errors 
      });
    }
  };
}
```

#### Business Logic Layer
```typescript
// services/bookingService.ts
export class BookingService {
  async createBooking(userId: string, bookingData: CreateBookingDto) {
    // 1. Validate user has sufficient balance
    const balance = await this.walletService.getBalance(userId);
    if (balance < bookingData.totalPrice) {
      throw new InsufficientFundsError();
    }
    
    // 2. Check slot availability
    const isAvailable = await this.checkSlotAvailability(bookingData.slotId);
    if (!isAvailable) {
      throw new SlotUnavailableError();
    }
    
    // 3. Create booking with transaction
    const booking = await this.db.transaction(async (trx) => {
      // Create booking
      const booking = await trx.bookings.create(bookingData);
      
      // Hold funds
      await this.walletService.holdFunds(userId, bookingData.totalPrice, booking.id);
      
      // Update slot availability
      await trx.slots.update({ available: false }, { id: bookingData.slotId });
      
      return booking;
    });
    
    // 4. Send notifications
    await this.notificationService.sendBookingConfirmation(booking);
    
    return booking;
  }
}
```

### Phase 3: Frontend Migration (Week 3-4)

#### API Client Update
```typescript
// frontend/src/lib/api.ts
class ApiClient {
  private baseURL = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';
  private token: string | null = null;
  
  async request(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': this.token ? `Bearer ${this.token}` : '',
        ...options.headers,
      },
    });
    
    if (!response.ok) {
      throw new ApiError(response.status, await response.json());
    }
    
    return response.json();
  }
  
  // Updated methods
  async createService(serviceData: CreateServiceDto) {
    return this.request('/services', {
      method: 'POST',
      body: JSON.stringify(serviceData),
    });
  }
  
  async getServices(filters?: ServiceFilters) {
    const params = new URLSearchParams(filters);
    return this.request(`/services?${params}`);
  }
}
```

#### Environment Configuration
```env
# Frontend .env
REACT_APP_API_URL=http://localhost:4000/api
REACT_APP_WS_URL=ws://localhost:4000
VITE_PRIVY_APP_ID=xxx

# Backend .env
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://...
SUPABASE_URL=xxx
SUPABASE_SERVICE_KEY=xxx
PRIVY_APP_ID=xxx
PRIVY_APP_SECRET=xxx
JWT_SECRET=xxx
REDIS_URL=redis://localhost:6379
```

### Phase 4: Docker Setup (Week 4)

#### Docker Compose Configuration
```yaml
# docker-compose.yml
version: '3.8'

services:
  # Frontend
  frontend:
    build:
      context: ./apps/frontend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - REACT_APP_API_URL=http://backend:4000/api
    depends_on:
      - backend
    networks:
      - bookme-network

  # Backend API
  backend:
    build:
      context: ./apps/backend
      dockerfile: Dockerfile
    ports:
      - "4000:4000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}
      - PRIVY_APP_SECRET=${PRIVY_APP_SECRET}
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis
    networks:
      - bookme-network

  # Redis for sessions/caching
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    networks:
      - bookme-network

  # Nginx reverse proxy
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - frontend
      - backend
    networks:
      - bookme-network

networks:
  bookme-network:
    driver: bridge

volumes:
  redis-data:
```

#### Backend Dockerfile
```dockerfile
# apps/backend/Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built application
COPY --from=builder /app/dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

EXPOSE 4000

CMD ["node", "dist/index.js"]
```

#### Frontend Dockerfile
```dockerfile
# apps/frontend/Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build React app
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built app to nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### Phase 5: Advanced Features (Week 5-6)

#### 1. Queue System (Bull/Redis)
```typescript
// queues/emailQueue.ts
import Bull from 'bull';

export const emailQueue = new Bull('email', {
  redis: process.env.REDIS_URL,
});

emailQueue.process(async (job) => {
  const { to, subject, template, data } = job.data;
  await sendEmail(to, subject, template, data);
});

// Usage
await emailQueue.add('booking-confirmation', {
  to: user.email,
  subject: 'Booking Confirmed',
  template: 'booking-confirmation',
  data: { bookingId, serviceName }
});
```

#### 2. Caching Layer
```typescript
// middleware/cache.ts
import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export function cacheMiddleware(key: string, ttl: number = 3600) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const cacheKey = `${key}:${req.user.id}:${JSON.stringify(req.query)}`;
    
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }
    
    // Store original send
    const originalSend = res.json;
    res.json = function(data) {
      redis.setex(cacheKey, ttl, JSON.stringify(data));
      return originalSend.call(this, data);
    };
    
    next();
  };
}
```

#### 3. Rate Limiting
```typescript
// middleware/rateLimiter.ts
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';

export const apiLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rate-limit:',
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later.',
});

export const bookingLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'booking-limit:',
  }),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Max 10 bookings per hour
  keyGenerator: (req) => req.user.id, // Rate limit by user, not IP
});
```

#### 4. WebSocket for Real-time
```typescript
// websocket/chatSocket.ts
import { Server } from 'socket.io';
import { verifyPrivyToken } from '../auth';

export function setupWebSocket(server: HttpServer) {
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL,
      credentials: true,
    },
  });
  
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      const user = await verifyPrivyToken(token);
      socket.data.user = user;
      next();
    } catch (err) {
      next(new Error('Authentication failed'));
    }
  });
  
  io.on('connection', (socket) => {
    const userId = socket.data.user.id;
    
    // Join user's room
    socket.join(`user:${userId}`);
    
    // Handle chat messages
    socket.on('send-message', async (data) => {
      const message = await saveMessage(data);
      
      // Send to recipient
      io.to(`user:${data.recipientId}`).emit('new-message', message);
    });
    
    // Handle typing indicators
    socket.on('typing', (data) => {
      socket.to(`user:${data.recipientId}`).emit('user-typing', {
        userId,
        isTyping: data.isTyping,
      });
    });
  });
}
```

### Phase 6: Monitoring & Logging (Week 6)

#### Application Monitoring
```typescript
// monitoring/metrics.ts
import promClient from 'prom-client';

// Create metrics
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
});

const activeBookings = new promClient.Gauge({
  name: 'active_bookings_total',
  help: 'Total number of active bookings',
});

// Middleware to track metrics
export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration
      .labels(req.method, req.route?.path || 'unknown', res.statusCode.toString())
      .observe(duration);
  });
  
  next();
}

// Expose metrics endpoint
app.get('/metrics', (req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(promClient.register.metrics());
});
```

#### Structured Logging
```typescript
// utils/logger.ts
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'bookme-api' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}

// Usage
logger.info('Booking created', {
  userId: req.user.id,
  bookingId: booking.id,
  amount: booking.totalPrice,
});
```

## Migration Timeline

### Week 1: Foundation
- [ ] Set up monorepo structure
- [ ] Create Express backend boilerplate
- [ ] Configure TypeScript and build tools
- [ ] Set up Docker development environment

### Week 2-3: Core API
- [ ] Implement authentication middleware
- [ ] Migrate user management endpoints
- [ ] Migrate service CRUD operations
- [ ] Migrate booking system
- [ ] Add request validation

### Week 3-4: Frontend Integration
- [ ] Update API client in React
- [ ] Replace direct Supabase calls
- [ ] Update authentication flow
- [ ] Test all user flows

### Week 4: Containerization
- [ ] Create production Dockerfiles
- [ ] Set up docker-compose
- [ ] Configure Nginx reverse proxy
- [ ] Test containerized deployment

### Week 5-6: Advanced Features
- [ ] Implement caching layer
- [ ] Add queue system for async tasks
- [ ] Set up WebSocket for real-time
- [ ] Add monitoring and logging

### Week 6: Testing & Deployment
- [ ] Write integration tests
- [ ] Performance testing
- [ ] Security audit
- [ ] Deploy to staging
- [ ] Production deployment

## Security Improvements

### Before (Current)
- ❌ Admin keys in browser
- ❌ No request validation
- ❌ Direct database access
- ❌ No rate limiting
- ❌ Unencrypted sensitive data

### After (With Backend)
- ✅ Credentials only on server
- ✅ Zod schema validation
- ✅ Business logic enforcement
- ✅ Rate limiting per user/IP
- ✅ Encrypted sensitive fields
- ✅ CORS protection
- ✅ SQL injection prevention
- ✅ XSS protection via CSP

## Performance Improvements

### Caching Strategy
```
┌─────────┐     ┌─────────┐     ┌──────────┐     ┌──────────┐
│ Browser │────▶│  CDN    │────▶│  Redis   │────▶│ Database │
│ Cache   │     │ (Static)│     │ (Dynamic)│     │(Supabase)│
└─────────┘     └─────────┘     └──────────┘     └──────────┘
```

### Expected Improvements
- **API Response Time**: <100ms (cached), <500ms (uncached)
- **Database Queries**: 50% reduction via caching
- **Concurrent Users**: Support 10,000+ active users
- **Cost Reduction**: 70% less database reads

## Deployment Options

### Option 1: Single VPS (Simplest)
```bash
# Deploy to DigitalOcean/Linode/AWS EC2
docker-compose up -d
```
**Cost**: ~$20-40/month

### Option 2: Kubernetes (Scalable)
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: bookme-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: bookme-backend
  template:
    metadata:
      labels:
        app: bookme-backend
    spec:
      containers:
      - name: backend
        image: bookme/backend:latest
        ports:
        - containerPort: 4000
```
**Cost**: ~$100-200/month

### Option 3: Serverless (Auto-scaling)
- Frontend: Vercel/Netlify
- Backend: AWS Lambda + API Gateway
- Database: Supabase (managed)
**Cost**: Pay-per-use, ~$0-50/month for low traffic

## Rollback Plan

If migration fails, we can:
1. Keep frontend pointing to direct Supabase
2. Run backend in parallel for testing
3. Gradual migration endpoint by endpoint
4. Feature flags for switching between old/new

## Success Metrics

- **Security**: 0 exposed credentials, 100% validated requests
- **Performance**: <500ms p95 response time
- **Reliability**: 99.9% uptime
- **Scalability**: Handle 10x current load
- **Developer Experience**: 50% faster feature development

## Cost Analysis

### Current Costs
- Supabase: $25/month
- Privy: $0-99/month
- **Total**: ~$25-124/month

### After Migration
- VPS/Cloud: $20-40/month
- Supabase: $25/month
- Privy: $0-99/month
- Redis: $5-15/month
- **Total**: ~$50-179/month

**Additional cost justified by**:
- Enhanced security
- Better performance
- Scalability
- Advanced features
- Professional deployment

## Next Steps

1. **Review & Approval**: Discuss migration plan with team
2. **Choose Architecture**: Decide between Express/Next.js/NestJS
3. **Set Up Repository**: Create monorepo structure
4. **Start Phase 1**: Begin backend foundation
5. **Weekly Reviews**: Track progress against timeline

## Conclusion

This migration will transform BookMe from a prototype to a production-ready application with:
- **Professional architecture** suitable for scaling
- **Enterprise-grade security** protecting user data
- **Advanced features** like real-time updates and caching
- **Easy deployment** via Docker containers
- **Monitoring & observability** for production operations

The 6-week timeline is aggressive but achievable with focused development. The modular approach allows for gradual migration with minimal disruption to existing users.
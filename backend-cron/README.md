# BookMe Cron Service

Railway-based cron service for booking automation and time-based status transitions.

## What This Service Does

- **Status Transitions**: Automatically updates booking statuses based on time
  - `confirmed` → `in_progress` when start time is reached
  - `in_progress` → `completed` when end time is reached
  - `ongoing` → `completed` when end time + 30 minutes grace period is reached
- **Reminder Notifications**: Tracks and sends upcoming booking reminders (placeholder)
- **Runs Every 15 Minutes**: Cost-effective scheduling on Railway

## Local Development

### Setup
```bash
cd backend-cron
npm install
```

### Environment Variables
Create `.env` in backend-cron directory with:
```env
# Supabase Database Configuration
SUPABASE_URL=https://esfowzdgituqktemrmle.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Backend API Configuration
BACKEND_URL=https://localhost:4443

# Google OAuth (for meeting generation fallback)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# SSL Configuration (for development)
NODE_TLS_REJECT_UNAUTHORIZED=0
```

### Test Locally
```bash
npm run dev
# or
npm start
```

### Test Single Execution
```bash
node src/index.js
```

## Railway Deployment

### 1. Deploy Service
1. Go to Railway Dashboard
2. Create new service from GitHub repo
3. Set **Root Directory**: `/backend-cron`
4. Set **Start Command**: `npm start`

### 2. Configure Environment Variables
In Railway service settings → Variables:
```env
# Supabase Database Configuration
SUPABASE_URL=https://esfowzdgituqktemrmle.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Backend API Configuration (use your production backend URL)
BACKEND_URL=https://your-production-backend.railway.app

# Google OAuth (for meeting generation fallback)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Production environment
NODE_ENV=production
```

### 3. Enable Cron Schedule
In Railway service settings → Cron Schedule:
```cron
*/15 * * * *
```
This runs every 15 minutes.

### 4. Monitor Execution
- Railway Dashboard → Service → Logs
- Each execution should show:
  - Start message with timestamp
  - Booking transitions performed
  - Summary of actions taken
  - Exit with code 0 (success)

## Expected Log Output

```
🚀 BookMe Cron Service Starting...
📅 Execution time: 2025-01-15T10:15:00.000Z
🤖 Starting booking automation job...
⏰ Current time: 2025-01-15T10:15:00.000Z
🔄 Checking confirmed bookings to start...
📋 Found 2 bookings to start: a1b2c3d4... (2025-01-15T10:00:00.000Z)
✅ Successfully started 2 bookings
🏁 Checking in_progress bookings to complete...
📋 Found 1 bookings to complete
✅ Successfully completed 1 bookings
🏁 Checking ongoing bookings to auto-complete (past end time + 30 min)...
📋 Found 2 bookings to auto-complete
✅ Successfully auto-completed 2 ongoing bookings
📧 Checking for upcoming booking reminders...
📧 Found 3 bookings needing reminders
✅ Successfully sent 3 reminders
✅ Automation job completed in 1250ms
📊 Summary: 2 started, 1 in_progress->completed, 2 ongoing->completed, 3 reminders sent
✅ Cron job completed successfully
```

## Architecture

### File Structure
```
backend-cron/
├── src/
│   ├── index.js              # Main entry point - exits after completion
│   ├── booking-automation.js # Core automation logic
│   └── supabase-admin.js     # Database client
├── package.json              # Dependencies and scripts
└── README.md                 # This file
```

### Key Design Principles

1. **Exit After Completion**: Service must terminate for Railway cron to work
2. **Idempotent Operations**: Safe to run multiple times
3. **Comprehensive Logging**: Easy to debug through Railway dashboard
4. **Error Handling**: Graceful failure with appropriate exit codes
5. **Resource Efficient**: Only runs when scheduled, no 24/7 costs

## Database Schema

This service requires the reminder tracking columns:
```sql
-- Run this migration:
-- database/12-add-reminder-tracking.sql
```

## Future Enhancements

### Phase 2: Real Notifications
- Replace placeholder functions with:
  - Email service (SendGrid, Mailgun)
  - Push notifications (Firebase FCM)
  - SMS service (Twilio)

### Phase 3: Advanced Features
- Booking analytics and insights
- Dynamic scheduling based on booking patterns
- Integration with calendar systems
- Multi-language notification templates

## Monitoring

### Success Indicators
- Service exits with code 0
- Booking status transitions logged
- No error messages in Railway logs
- Database timestamps updated correctly

### Failure Indicators  
- Service exits with code 1
- Error messages in logs
- Database connection failures
- Booking statuses not updating

### Health Check
The service is stateless and doesn't run continuously, so health is measured by:
- Successful cron executions in Railway dashboard
- Recent booking status transitions in database
- Error-free execution logs
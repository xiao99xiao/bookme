# BookMe Railway Deployment Guide

## Cron Service Setup

### 1. Apply Database Migration
First, run the new migration in your Supabase dashboard:

```sql
-- Run in Supabase SQL Editor: database/12-add-reminder-tracking.sql

-- Add reminder tracking columns to bookings table for automation
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS reminder_24h_sent TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS reminder_1h_sent TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS reminder_15m_sent TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS auto_status_updated BOOLEAN DEFAULT FALSE;

-- Add index for efficient cron job queries
CREATE INDEX IF NOT EXISTS bookings_automation_idx ON public.bookings(status, scheduled_at, reminder_1h_sent);

-- Add comments for documentation
COMMENT ON COLUMN public.bookings.reminder_24h_sent IS 'Timestamp when 24-hour reminder was sent';
COMMENT ON COLUMN public.bookings.reminder_1h_sent IS 'Timestamp when 1-hour reminder was sent';  
COMMENT ON COLUMN public.bookings.reminder_15m_sent IS 'Timestamp when 15-minute reminder was sent';
COMMENT ON COLUMN public.bookings.auto_status_updated IS 'Flag to track if booking was updated by automation system';
```

### 2. Deploy Cron Service to Railway

1. **Create New Service**:
   - Go to Railway Dashboard
   - Click "New Service" → "GitHub Repository"
   - Select your BookMe repository

2. **Configure Service**:
   - **Service Name**: `bookme-cron`
   - **Root Directory**: `/backend-cron`
   - **Start Command**: `npm start`

3. **Set Environment Variables**:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   NODE_ENV=production
   ```

4. **Enable Cron Schedule**:
   - Go to Service Settings → **Cron Schedule**
   - Set schedule: `*/15 * * * *` (every 15 minutes)
   - Save settings

5. **Deploy**:
   - Railway will auto-deploy from GitHub
   - Monitor first execution in Logs tab

### 3. Verification

#### Expected Log Output:
```
🚀 BookMe Cron Service Starting...
📅 Execution time: 2025-01-15T10:15:00.000Z
🤖 Starting booking automation job...
⏰ Current time: 2025-01-15T10:15:00.000Z
🔄 Checking confirmed bookings to start...
📋 No confirmed bookings to start
🏁 Checking in_progress bookings to complete...
📋 No in_progress bookings to check
📧 Checking for upcoming booking reminders...
📧 No upcoming bookings need reminders
✅ Automation job completed in 1250ms
📊 Summary: 0 started, 0 completed, 0 reminders sent
✅ Cron job completed successfully
```

#### Health Checks:
1. **Railway Dashboard**: Service should show "Deployed" status
2. **Cron Executions**: Check Logs tab every 15 minutes for execution logs
3. **Database**: Verify booking statuses are updating automatically
4. **Exit Status**: Each execution should end with exit code 0

### 4. Monitoring and Troubleshooting

#### Success Indicators:
- ✅ Service exits cleanly (no hanging processes)  
- ✅ Booking transitions logged in Railway dashboard
- ✅ Database timestamps updated correctly
- ✅ No error messages in logs

#### Common Issues:

**Service Not Executing:**
- Check cron schedule format: `*/15 * * * *`
- Verify environment variables are set
- Ensure service has proper Railway deployment

**Database Connection Errors:**
- Verify `SUPABASE_SERVICE_ROLE_KEY` is correct
- Check `VITE_SUPABASE_URL` format
- Confirm Supabase project is active

**Service Not Exiting:**
- Check for hanging promises in code
- Verify `process.exit(0)` is called
- Look for unclosed database connections

### 5. Architecture Summary

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Railway Cron  │    │  BookMe Backend │    │    Supabase     │
│   (15 minutes)  │    │   (24/7 API)    │    │   (Database)    │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ • Status Updates│────│ • User APIs     │────│ • bookings      │
│ • Reminders     │    │ • Authentication│    │ • users         │
│ • Notifications │    │ • Business Logic│    │ • services      │
│ • Exits on Done │    │ • WebSocket     │    │ • Real-time     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Cost Analysis

### Before Automation:
- Backend running 24/7 for occasional status updates
- Manual intervention required
- Inconsistent user experience

### After Automation:
- Backend runs only when serving requests
- Cron service runs 15min every execution (~1-5 seconds each)
- Automatic status transitions
- Better resource efficiency

### Railway Costs:
- **Main Backend**: Pay for actual request serving time
- **Cron Service**: ~$0.01/month (96 executions/day × 1-5 seconds each)
- **Total Savings**: Significant reduction in idle backend time

## Future Enhancements

### Phase 2: Enhanced Notifications
- Add email service integration (SendGrid)
- Add push notification service (Firebase)
- Add SMS service integration (Twilio)

### Phase 3: Advanced Automation
- Dynamic scheduling based on booking patterns
- Calendar system integration
- Multi-language notifications
- Advanced analytics and insights
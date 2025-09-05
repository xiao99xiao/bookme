# Time-Based Booking Automation System

## Problem Statement

**Current Gap**: BookMe bookings remain in `confirmed` status indefinitely without automatic status transitions based on time. This creates issues with:
- Cancellation policies not working properly for past bookings
- No automated notifications for upcoming appointments
- Manual intervention required for all status changes
- Inconsistent user experience

## Current Booking Status Lifecycle

### Defined Status Values (database/04-create-bookings-table.sql:12)
```sql
status IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'refunded')
```

### Current Status Transitions (Manual Only)
1. **pending** → **confirmed**: Manual booking confirmation
2. **confirmed** → **cancelled**: Manual cancellation via API
3. **confirmed** → **completed**: Manual completion via API
4. **any** → **refunded**: Manual refund processing

### Missing Automatic Transitions
- **confirmed** → **in_progress**: When booking start time is reached
- **in_progress** → **completed**: When booking end time is reached
- **confirmed/in_progress** → **expired**: When booking becomes overdue
- Status-based notifications and reminders

## Technical Solutions & Architecture Options

### 1. Database-Level Solutions

#### A) PostgreSQL Triggers & Functions
**Pros:**
- Guaranteed execution at data level
- No external dependencies
- Immediate consistency

**Cons:**
- Limited flexibility for complex logic
- Difficult to debug and maintain
- Cannot handle external services (emails, push notifications)

```sql
-- Example trigger for automatic status updates
CREATE OR REPLACE FUNCTION update_booking_status_on_time()
RETURNS trigger AS $$
BEGIN
    -- Update in_progress bookings to completed when duration expires
    UPDATE bookings 
    SET status = 'completed', completed_at = NOW()
    WHERE status = 'in_progress' 
      AND scheduled_at + (duration_minutes * interval '1 minute') <= NOW();
    
    -- Update confirmed bookings to in_progress when start time reached
    UPDATE bookings 
    SET status = 'in_progress'
    WHERE status = 'confirmed' 
      AND scheduled_at <= NOW();
      
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

#### B) Database Scheduled Jobs (pg_cron)
**Pros:**
- Built into PostgreSQL
- Reliable scheduling
- Direct database access

**Cons:**
- PostgreSQL extension required
- Limited to database operations
- Not available on all hosting platforms

### 2. Application-Level Solutions

#### A) Node.js Cron Jobs (node-cron)
**Implementation:**
```javascript
const cron = require('node-cron');

// Run every minute to check booking status updates
cron.schedule('* * * * *', async () => {
  await updateBookingStatuses();
  await sendUpcomingBookingNotifications();
});

async function updateBookingStatuses() {
  // Update confirmed → in_progress
  await supabaseAdmin
    .from('bookings')
    .update({ status: 'in_progress' })
    .eq('status', 'confirmed')
    .lte('scheduled_at', new Date().toISOString());
    
  // Update in_progress → completed  
  await supabaseAdmin
    .from('bookings')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('status', 'in_progress')
    .lte('scheduled_at', new Date(Date.now() + booking.duration_minutes * 60000).toISOString());
}
```

**Pros:**
- Simple implementation
- Full access to application logic
- Can integrate with external services

**Cons:**
- Single point of failure
- Requires application to be running
- Not suitable for high-scale applications

#### B) Queue-Based System (Bull/BullMQ + Redis)
**Implementation:**
```javascript
const Queue = require('bull');
const bookingQueue = new Queue('booking automation', 'redis://127.0.0.1:6379');

// Schedule jobs when booking is created
app.post('/api/bookings', async (c) => {
  const booking = await createBooking(bookingData);
  
  // Schedule start notification (15 minutes before)
  await bookingQueue.add('send-reminder', {
    bookingId: booking.id,
    type: 'start-reminder'
  }, {
    delay: new Date(booking.scheduled_at).getTime() - Date.now() - (15 * 60000)
  });
  
  // Schedule status update to in_progress
  await bookingQueue.add('update-status', {
    bookingId: booking.id,
    newStatus: 'in_progress'
  }, {
    delay: new Date(booking.scheduled_at).getTime() - Date.now()
  });
  
  // Schedule completion
  await bookingQueue.add('update-status', {
    bookingId: booking.id,
    newStatus: 'completed'
  }, {
    delay: new Date(booking.scheduled_at).getTime() - Date.now() + (booking.duration_minutes * 60000)
  });
});
```

**Pros:**
- Highly reliable and scalable
- Persistent job storage
- Built-in retry mechanisms
- Can handle complex workflows

**Cons:**
- Additional Redis infrastructure
- More complex setup
- Requires separate worker processes

### 3. Cloud-Based Solutions

#### A) Vercel Cron Jobs (for Frontend)
**Implementation:**
```javascript
// api/cron/update-bookings.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405);
  
  // Verify cron secret
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401);
  }
  
  await updateBookingStatuses();
  res.status(200).json({ success: true });
}

// vercel.json
{
  "crons": [{
    "path": "/api/cron/update-bookings",
    "schedule": "* * * * *"
  }]
}
```

#### B) Railway Cron Jobs (for Backend)
**Implementation:**
```javascript
// Add to backend package.json
{
  "scripts": {
    "cron:bookings": "node src/cron/update-bookings.js"
  }
}

// Railway deployment with cron service
services:
  backend:
    build: ./backend
  cron:
    build: ./backend
    cron: "* * * * * npm run cron:bookings"
```

#### C) External Cron Services (cron-job.org, EasyCron)
**Pros:**
- No infrastructure management
- Reliable external triggers
- Simple webhook-based

**Cons:**
- External dependency
- Requires webhook security
- Limited to HTTP triggers

### 4. Event-Driven Architecture

#### A) Database Change Streams
**Implementation with Supabase Realtime:**
```javascript
const subscription = supabase
  .channel('booking-changes')
  .on('postgres_changes', 
    { event: '*', schema: 'public', table: 'bookings' },
    (payload) => {
      if (payload.eventType === 'INSERT') {
        scheduleBookingAutomation(payload.new);
      }
    }
  )
  .subscribe();
```

#### B) Webhook-Based System
**Implementation:**
```javascript
// Schedule external webhooks when booking created
app.post('/api/bookings', async (c) => {
  const booking = await createBooking(bookingData);
  
  // Schedule webhook calls
  await scheduleWebhook({
    url: `${process.env.APP_URL}/api/webhooks/booking-start`,
    payload: { bookingId: booking.id },
    executeAt: booking.scheduled_at
  });
});
```

## Notification Systems Integration

### Email Notifications
```javascript
// Using nodemailer or service like SendGrid
async function sendBookingReminder(booking) {
  await emailService.send({
    to: booking.customer_email,
    template: 'booking-reminder',
    data: {
      serviceName: booking.service_name,
      startTime: booking.scheduled_at,
      providerName: booking.provider_name
    }
  });
}
```

### Push Notifications
```javascript
// Using service like Firebase Cloud Messaging
async function sendPushNotification(userId, message) {
  await fcm.send({
    token: user.fcm_token,
    notification: {
      title: 'Booking Starting Soon',
      body: `Your ${booking.service_name} appointment starts in 15 minutes`
    }
  });
}
```

## Recommended Architecture

### Phase 1: Quick Implementation (MVP)
1. **Node.js Cron Jobs** in backend service
2. **Simple status transitions** based on time
3. **Basic email notifications** for reminders

```javascript
// backend/src/cron/booking-automation.js
const cron = require('node-cron');

// Run every minute
cron.schedule('* * * * *', async () => {
  await updateBookingStatuses();
  await sendReminders();
});

async function updateBookingStatuses() {
  const now = new Date().toISOString();
  
  // confirmed → in_progress
  await supabaseAdmin
    .from('bookings')
    .update({ status: 'in_progress' })
    .eq('status', 'confirmed')
    .lte('scheduled_at', now);
  
  // in_progress → completed (after duration)
  const { data: inProgressBookings } = await supabaseAdmin
    .from('bookings')
    .select('*')
    .eq('status', 'in_progress');
    
  for (const booking of inProgressBookings) {
    const endTime = new Date(booking.scheduled_at);
    endTime.setMinutes(endTime.getMinutes() + booking.duration_minutes);
    
    if (endTime <= new Date()) {
      await supabaseAdmin
        .from('bookings')
        .update({ 
          status: 'completed',
          completed_at: now 
        })
        .eq('id', booking.id);
    }
  }
}

async function sendReminders() {
  const reminderTime = new Date();
  reminderTime.setMinutes(reminderTime.getMinutes() + 15);
  
  const { data: upcomingBookings } = await supabaseAdmin
    .from('bookings')
    .select('*, users!customer_id(email, display_name)')
    .eq('status', 'confirmed')
    .gte('scheduled_at', new Date().toISOString())
    .lte('scheduled_at', reminderTime.toISOString());
    
  for (const booking of upcomingBookings) {
    await sendBookingReminder(booking);
    
    // Mark reminder as sent to avoid duplicates
    await supabaseAdmin
      .from('bookings')
      .update({ reminder_sent: true })
      .eq('id', booking.id);
  }
}
```

### Phase 2: Production-Ready System
1. **Queue-based system** with Bull/BullMQ + Redis
2. **Multiple notification channels** (email, push, SMS)
3. **Comprehensive event tracking**
4. **Admin dashboard** for monitoring

```javascript
// Advanced queue-based system
const bookingQueue = new Queue('booking automation');

// Process different job types
bookingQueue.process('update-status', async (job) => {
  const { bookingId, newStatus } = job.data;
  await updateBookingStatus(bookingId, newStatus);
});

bookingQueue.process('send-notification', async (job) => {
  const { bookingId, type, channels } = job.data;
  await sendMultiChannelNotification(bookingId, type, channels);
});

// Schedule comprehensive automation when booking created
async function scheduleBookingAutomation(booking) {
  const startTime = new Date(booking.scheduled_at);
  const endTime = new Date(startTime.getTime() + booking.duration_minutes * 60000);
  
  // Reminder 24 hours before
  await bookingQueue.add('send-notification', {
    bookingId: booking.id,
    type: '24h-reminder',
    channels: ['email']
  }, { 
    delay: startTime.getTime() - Date.now() - (24 * 60 * 60 * 1000) 
  });
  
  // Reminder 1 hour before  
  await bookingQueue.add('send-notification', {
    bookingId: booking.id,
    type: '1h-reminder', 
    channels: ['email', 'push']
  }, { 
    delay: startTime.getTime() - Date.now() - (60 * 60 * 1000) 
  });
  
  // Start booking
  await bookingQueue.add('update-status', {
    bookingId: booking.id,
    newStatus: 'in_progress'
  }, { 
    delay: startTime.getTime() - Date.now() 
  });
  
  // Complete booking
  await bookingQueue.add('update-status', {
    bookingId: booking.id,
    newStatus: 'completed'
  }, { 
    delay: endTime.getTime() - Date.now() 
  });
}
```

### Phase 3: Enterprise Scale
1. **Microservices architecture** with dedicated scheduling service
2. **Event sourcing** for complete audit trail
3. **Multi-region deployment** with failover
4. **Advanced analytics** and monitoring

## Database Schema Updates Required

```sql
-- Add automation tracking fields
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS
  reminder_24h_sent BOOLEAN DEFAULT FALSE,
  reminder_1h_sent BOOLEAN DEFAULT FALSE,
  reminder_15m_sent BOOLEAN DEFAULT FALSE,
  auto_status_updated BOOLEAN DEFAULT FALSE,
  automation_logs JSONB DEFAULT '[]';

-- Create automation events table
CREATE TABLE IF NOT EXISTS public.booking_automation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id),
  event_type TEXT NOT NULL, -- 'status_update', 'notification_sent', 'reminder_sent'
  event_data JSONB,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'completed', -- 'pending', 'completed', 'failed'
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Security Considerations

1. **Webhook Authentication**: Use signed payloads or secret tokens
2. **Rate Limiting**: Prevent abuse of automation endpoints  
3. **Idempotency**: Ensure operations can be safely retried
4. **Error Handling**: Graceful failure and retry mechanisms
5. **Monitoring**: Track job success/failure rates
6. **Data Privacy**: Secure handling of user data in automated processes

## Implementation Priority

### Immediate (Week 1-2)
- [ ] Add basic cron job for status transitions
- [ ] Fix current cancellation policy issues
- [ ] Add booking status update endpoints

### Short Term (Month 1)
- [ ] Email reminder system (24h, 1h before)
- [ ] Push notification infrastructure
- [ ] Admin monitoring dashboard
- [ ] Queue-based job system

### Medium Term (Month 2-3)
- [ ] Advanced notification templates
- [ ] SMS notifications
- [ ] Booking analytics and insights
- [ ] Multi-language support

### Long Term (Month 3+)
- [ ] AI-powered booking optimization
- [ ] Advanced scheduling algorithms
- [ ] Integration with calendar systems
- [ ] Mobile app deep linking

## Cost Analysis

### Development Costs
- **Phase 1 (MVP)**: 1-2 weeks development
- **Phase 2 (Production)**: 3-4 weeks development  
- **Phase 3 (Enterprise)**: 8-12 weeks development

### Infrastructure Costs (Monthly)
- **Redis instance**: $10-50/month
- **Email service** (SendGrid/Mailgun): $10-100/month
- **Push notifications** (Firebase): Free tier available
- **Monitoring** (DataDog/NewRelic): $50-200/month

### ROI Benefits
- **Improved user experience**: Higher booking completion rates
- **Reduced support burden**: Fewer manual interventions needed
- **Better data insights**: Automated tracking and analytics
- **Scalability**: Handle more bookings without linear staff increase

## Conclusion

The time-based booking automation system is critical for BookMe's success. The recommended approach is:

1. **Start with Phase 1** for immediate relief of current issues
2. **Migrate to Phase 2** for production reliability and scalability  
3. **Plan Phase 3** for long-term competitive advantage

The queue-based system (Bull/BullMQ) is the optimal long-term solution, providing reliability, scalability, and flexibility for complex booking workflows while maintaining the ability to integrate with external services for notifications and analytics.
# Booking Reschedule Feature Specification

## Overview
Allow both hosts and visitors to request time changes for confirmed bookings. The other party can accept or reject the proposed new time.

---

## Business Rules

### Who Can Initiate
| Role | Can Initiate | Time Limit | Max Requests |
|------|--------------|------------|--------------|
| Host | ✅ Yes | Until booking ends | Unlimited |
| Visitor | ✅ Yes | Until 1 hour before booking starts | 1 per booking |

### Request Lifecycle
- **Pending**: Awaiting response from the other party
- **Approved**: New time accepted, booking updated
- **Rejected**: Request declined, original time kept
- **Expired**: No response within 72 hours (3 days)
- **Withdrawn**: Requester cancelled their own request

### Validation Rules
1. Booking must be in `paid` or `confirmed` status
2. Proposed time must be in the future
3. Proposed time must be available (no conflicts with other bookings)
4. Visitor can only have 1 reschedule request per booking (pending or approved)
5. Cannot create new request while one is pending

---

## Database Schema

### New Table: `reschedule_requests`
```sql
CREATE TABLE reschedule_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES users(id),
  requester_role TEXT NOT NULL CHECK (requester_role IN ('host', 'visitor')),

  -- Proposed changes
  proposed_scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  proposed_duration_minutes INTEGER,  -- NULL means keep original duration
  reason TEXT,  -- Optional explanation

  -- Response
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'withdrawn')),
  response_notes TEXT,  -- Optional rejection reason
  responded_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + INTERVAL '3 days')
);

-- Indexes
CREATE INDEX idx_reschedule_requests_booking_id ON reschedule_requests(booking_id);
CREATE INDEX idx_reschedule_requests_status ON reschedule_requests(status);
CREATE INDEX idx_reschedule_requests_expires_at ON reschedule_requests(expires_at)
  WHERE status = 'pending';

-- Trigger to update updated_at
CREATE TRIGGER update_reschedule_requests_updated_at
  BEFORE UPDATE ON reschedule_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Booking Table Updates
```sql
-- Track visitor reschedule usage
ALTER TABLE bookings
ADD COLUMN visitor_reschedule_count INTEGER DEFAULT 0;

-- Track reschedule history
ALTER TABLE bookings
ADD COLUMN original_scheduled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN last_rescheduled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN rescheduled_by UUID REFERENCES users(id);
```

---

## API Endpoints

### 1. Create Reschedule Request
```
POST /api/bookings/:bookingId/reschedule-request
```

**Request Body:**
```json
{
  "proposed_scheduled_at": "2025-01-20T14:00:00Z",
  "proposed_duration_minutes": 60,  // optional
  "reason": "I have a conflict at the original time"  // optional
}
```

**Response:**
```json
{
  "success": true,
  "request": {
    "id": "uuid",
    "booking_id": "uuid",
    "proposed_scheduled_at": "2025-01-20T14:00:00Z",
    "status": "pending",
    "expires_at": "2025-01-18T10:00:00Z"
  }
}
```

**Validation:**
- Check booking exists and user is participant
- Check booking status is `paid` or `confirmed`
- Check time limits based on role
- Check visitor hasn't exceeded reschedule limit
- Check no pending request exists
- Validate proposed time is available

### 2. Get Reschedule Requests for Booking
```
GET /api/bookings/:bookingId/reschedule-requests
```

**Response:**
```json
{
  "requests": [
    {
      "id": "uuid",
      "requester": {
        "id": "uuid",
        "display_name": "John",
        "role": "visitor"
      },
      "proposed_scheduled_at": "2025-01-20T14:00:00Z",
      "reason": "Schedule conflict",
      "status": "pending",
      "created_at": "2025-01-15T10:00:00Z",
      "expires_at": "2025-01-18T10:00:00Z"
    }
  ],
  "can_create_request": true,
  "visitor_reschedule_remaining": 1
}
```

### 3. Respond to Reschedule Request
```
POST /api/reschedule-requests/:requestId/respond
```

**Request Body:**
```json
{
  "action": "approve",  // or "reject"
  "response_notes": "Works for me!"  // optional
}
```

**Response:**
```json
{
  "success": true,
  "request": {
    "id": "uuid",
    "status": "approved",
    "responded_at": "2025-01-16T09:00:00Z"
  },
  "booking": {
    "id": "uuid",
    "scheduled_at": "2025-01-20T14:00:00Z",  // Updated if approved
    "last_rescheduled_at": "2025-01-16T09:00:00Z"
  }
}
```

**On Approve:**
1. Update booking `scheduled_at` to proposed time
2. Update booking `original_scheduled_at` (if first reschedule)
3. Update booking `last_rescheduled_at`
4. Update booking `rescheduled_by`
5. Increment `visitor_reschedule_count` if visitor initiated
6. Regenerate meeting link if online service
7. Send notification to requester

### 4. Withdraw Reschedule Request
```
POST /api/reschedule-requests/:requestId/withdraw
```

Only the requester can withdraw their pending request.

### 5. Check Time Slot Availability
```
GET /api/services/:serviceId/availability?date=2025-01-20
```

Existing endpoint - reuse for reschedule time selection.

---

## Frontend Components

### 1. RescheduleRequestModal
**Location:** `src/components/RescheduleRequestModal.tsx`

**Features:**
- Date/time picker for new time
- Shows host's available slots
- Optional reason text field
- Submit button
- Shows remaining reschedules for visitors

### 2. PendingRescheduleCard
**Location:** `src/components/PendingRescheduleCard.tsx`

**Display when booking has pending request:**
```
┌─────────────────────────────────────────────┐
│ 📅 Reschedule Request                       │
│                                             │
│ [Avatar] John requested to change time      │
│                                             │
│ Current: Jan 18, 2025 at 2:00 PM           │
│ Proposed: Jan 20, 2025 at 2:00 PM          │
│                                             │
│ "I have a conflict at the original time"   │
│                                             │
│ Expires in 2 days                          │
│                                             │
│     [Reject]  [Accept New Time]            │
└─────────────────────────────────────────────┘
```

### 3. Booking Card Updates

**Add to CustomerBookings.tsx and ProviderOrders.tsx:**
- "Request Reschedule" button (if allowed)
- Pending request indicator
- Reschedule history indicator

**Button visibility logic:**
```typescript
const canRequestReschedule = (booking, userRole) => {
  // Check booking status
  if (!['paid', 'confirmed'].includes(booking.status)) return false;

  // Check for pending request
  if (booking.pending_reschedule_request) return false;

  const now = new Date();
  const startTime = new Date(booking.scheduled_at);
  const endTime = new Date(startTime.getTime() + booking.duration_minutes * 60000);

  if (userRole === 'host') {
    // Host can request until booking ends
    return now < endTime;
  } else {
    // Visitor: 1 hour before start, max 1 reschedule
    const oneHourBefore = new Date(startTime.getTime() - 60 * 60000);
    return now < oneHourBefore && booking.visitor_reschedule_count < 1;
  }
};
```

---

## Notifications

### When Request Created
**To: Other party**
```
📅 Reschedule Request
[Name] wants to change the time for "[Service Title]"

Current: Jan 18, 2025 at 2:00 PM
Proposed: Jan 20, 2025 at 2:00 PM

[View Request]
```

### When Request Approved
**To: Requester**
```
✅ Reschedule Approved
Your reschedule request was approved!

New time: Jan 20, 2025 at 2:00 PM

[View Booking]
```

### When Request Rejected
**To: Requester**
```
❌ Reschedule Declined
Your reschedule request was declined.

The booking remains at: Jan 18, 2025 at 2:00 PM

[View Booking]
```

### When Request Expires
**To: Both parties**
```
⏰ Reschedule Request Expired
The reschedule request for "[Service Title]" has expired.

The booking remains at: Jan 18, 2025 at 2:00 PM
```

---

## Meeting Link Handling

When a reschedule is approved for an online service:

1. **Google Meet**: Update existing calendar event with new time
   - Call `calendar.events.patch()` to update start/end time
   - Meeting link remains the same

2. **Future (Jitsi)**: No action needed
   - JWT tokens are generated on-demand
   - Room name is based on booking ID (unchanged)

---

## Cron Job: Expire Pending Requests

**File:** `backend/src/cron/expire-reschedule-requests.js`

```javascript
// Run every hour
async function expireRescheduleRequests() {
  const result = await db.query(`
    UPDATE reschedule_requests
    SET status = 'expired', updated_at = now()
    WHERE status = 'pending' AND expires_at < now()
    RETURNING id, booking_id
  `);

  // Send expiration notifications
  for (const request of result.rows) {
    await sendRescheduleExpiredNotification(request.booking_id);
  }
}
```

---

## i18n Strings

Add to `src/lib/i18n/locales/en.ts`:

```typescript
reschedule: {
  requestTitle: 'Request Reschedule',
  pendingRequest: 'Reschedule Request Pending',
  proposeNewTime: 'Propose New Time',
  reason: 'Reason (optional)',
  reasonPlaceholder: 'Why do you need to reschedule?',
  currentTime: 'Current Time',
  proposedTime: 'Proposed Time',
  expiresIn: 'Expires in {{time}}',
  accept: 'Accept New Time',
  reject: 'Decline',
  withdraw: 'Withdraw Request',

  // Visitor limits
  remainingReschedules: '{{count}} reschedule remaining',
  noReschedulesLeft: 'No reschedules remaining',

  // Status messages
  requestSent: 'Reschedule request sent',
  requestApproved: 'Reschedule approved! Time updated.',
  requestRejected: 'Reschedule request declined',
  requestExpired: 'Reschedule request expired',
  requestWithdrawn: 'Reschedule request withdrawn',

  // Errors
  cannotReschedule: 'Cannot reschedule this booking',
  tooCloseToStart: 'Too close to booking start time',
  timeNotAvailable: 'Selected time is not available',
  pendingRequestExists: 'A reschedule request is already pending',
}
```

---

## Implementation Order

### Phase 1: Backend Foundation
1. Create database migration
2. Implement `POST /reschedule-request` endpoint
3. Implement `GET /reschedule-requests` endpoint
4. Implement `POST /respond` endpoint
5. Add availability check integration

### Phase 2: Frontend - Request Flow
1. Create RescheduleRequestModal component
2. Add "Request Reschedule" button to booking cards
3. Integrate with availability API for time selection
4. Add i18n strings

### Phase 3: Frontend - Response Flow
1. Create PendingRescheduleCard component
2. Add pending request display to booking cards
3. Implement accept/reject actions
4. Add withdrawal functionality

### Phase 4: Notifications & Polish
1. Implement notification sending
2. Add cron job for expiration
3. Handle meeting link updates
4. Add reschedule history display
5. Testing and edge cases

---

## Edge Cases

1. **Booking cancelled while request pending**
   - Auto-withdraw pending requests on booking cancellation

2. **Multiple rapid requests**
   - Database constraint prevents duplicate pending requests
   - Frontend disables button while request pending

3. **Time slot becomes unavailable**
   - Re-validate availability on approve
   - Show error if no longer available

4. **Booking time passes while request pending**
   - Auto-expire requests for past bookings
   - Cron job handles this case

5. **Offline/online service switch**
   - Not allowed - only time changes permitted

---

## Security Considerations

1. **Authorization**
   - Only booking participants can create/view requests
   - Only the other party can respond
   - Only requester can withdraw

2. **Rate Limiting**
   - Limit request creation to prevent spam
   - Consider cooldown after rejection

3. **Audit Trail**
   - All actions logged with timestamps
   - Original time preserved in booking record

---

## UI/UX Flow Design

### User Journey Maps

#### Flow A: Visitor Requests Reschedule

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        VISITOR INITIATES RESCHEDULE                          │
└─────────────────────────────────────────────────────────────────────────────┘

Step 1: View Booking (My Bookings Page)
┌─────────────────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 📅 Coffee Chat with Sarah                                    [Paid] │   │
│  │                                                                      │   │
│  │ 🗓️ Jan 18, 2025 at 2:00 PM                                          │   │
│  │ ⏱️ 30 minutes  •  💻 Online                                          │   │
│  │                                                                      │   │
│  │ ┌──────────────┐ ┌──────────────┐ ┌────────────────────┐            │   │
│  │ │ 💬 Message   │ │ ❌ Cancel    │ │ 📅 Request Change  │            │   │
│  │ └──────────────┘ └──────────────┘ └────────────────────┘            │   │
│  │                                    ↑                                 │   │
│  │                         Shows if: status=paid/confirmed              │   │
│  │                                   AND no pending request             │   │
│  │                                   AND >1hr before start              │   │
│  │                                   AND reschedule_count < 1           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼ Click "Request Change"
Step 2: Reschedule Request Modal
┌─────────────────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     Request Time Change                         [X] │   │
│  │  ─────────────────────────────────────────────────────────────────  │   │
│  │                                                                      │   │
│  │  Current booking:                                                    │   │
│  │  ┌────────────────────────────────────────────────────────────────┐ │   │
│  │  │  📅 Saturday, January 18, 2025                                 │ │   │
│  │  │  🕐 2:00 PM - 2:30 PM (30 min)                                 │ │   │
│  │  └────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                      │   │
│  │  Select new time:                                                    │   │
│  │  ┌────────────────────────────────────────────────────────────────┐ │   │
│  │  │  📅 [January 2025          ▼]  ← Date Picker                   │ │   │
│  │  │                                                                 │ │   │
│  │  │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐      │ │   │
│  │  │  │ Sun │ │ Mon │ │ Tue │ │ Wed │ │ Thu │ │ Fri │ │ Sat │      │ │   │
│  │  │  │ 19  │ │ 20  │ │ 21  │ │ 22  │ │ 23  │ │ 24  │ │ 25  │      │ │   │
│  │  │  │     │ │  ●  │ │  ●  │ │     │ │  ●  │ │  ●  │ │     │      │ │   │
│  │  │  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘      │ │   │
│  │  │                    ↑ ● = has available slots                   │ │   │
│  │  └────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                      │   │
│  │  Available times on Mon, Jan 20:                                     │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐                    │   │
│  │  │ 9:00 AM │ │10:00 AM │ │ 2:00 PM │ │ 3:00 PM │  ← Time Slots     │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘                    │   │
│  │       ↑ Selected (highlighted)                                       │   │
│  │                                                                      │   │
│  │  Reason (optional):                                                  │   │
│  │  ┌────────────────────────────────────────────────────────────────┐ │   │
│  │  │ I have a work meeting at the original time...                  │ │   │
│  │  └────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                      │   │
│  │  ⚠️ You can only reschedule once per booking.                        │   │
│  │                                                                      │   │
│  │  ┌──────────────────┐  ┌──────────────────────────┐                 │   │
│  │  │     Cancel       │  │   Send Request  →        │                 │   │
│  │  └──────────────────┘  └──────────────────────────┘                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼ Click "Send Request"
Step 3: Request Sent - Waiting State
┌─────────────────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 📅 Coffee Chat with Sarah                              [Paid]       │   │
│  │                                                                      │   │
│  │ ┌──────────────────────────────────────────────────────────────────┐│   │
│  │ │ ⏳ RESCHEDULE PENDING                                             ││   │
│  │ │                                                                   ││   │
│  │ │ You requested to change:                                          ││   │
│  │ │ Jan 18, 2:00 PM  →  Jan 20, 9:00 AM                              ││   │
│  │ │                                                                   ││   │
│  │ │ Waiting for Sarah's response...                                   ││   │
│  │ │ Expires in 2 days 23 hours                                        ││   │
│  │ │                                                                   ││   │
│  │ │ ┌─────────────────────┐                                          ││   │
│  │ │ │  Withdraw Request   │  ← Only requester sees this              ││   │
│  │ │ └─────────────────────┘                                          ││   │
│  │ └──────────────────────────────────────────────────────────────────┘│   │
│  │                                                                      │   │
│  │ 🗓️ Current: Jan 18, 2025 at 2:00 PM                                 │   │
│  │ ⏱️ 30 minutes  •  💻 Online                                          │   │
│  │                                                                      │   │
│  │ ┌──────────────┐ ┌──────────────┐   [Request Change] ← Disabled     │   │
│  │ │ 💬 Message   │ │ ❌ Cancel    │                                    │   │
│  │ └──────────────┘ └──────────────┘                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Flow B: Host Receives & Responds to Request

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        HOST RECEIVES RESCHEDULE REQUEST                      │
└─────────────────────────────────────────────────────────────────────────────┘

Step 1: Notification (Toast + Badge)
┌─────────────────────────────────────────────────────────────────────────────┐
│  Navigation Bar:                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  [Discover]  [My Bookings]  [Orders (1)]  [Messages]  [Profile]      │  │
│  │                                ↑                                      │  │
│  │                          Badge shows pending action                   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Toast notification:                                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  📅 New Reschedule Request                                            │  │
│  │  John wants to change the time for "Coffee Chat"                      │  │
│  │                                                      [View] [Dismiss] │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼ Navigate to Orders
Step 2: View in Orders Page (Host View)
┌─────────────────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 📅 Coffee Chat                                        [Confirmed]   │   │
│  │ with John Smith                                                      │   │
│  │                                                                      │   │
│  │ ┌──────────────────────────────────────────────────────────────────┐│   │
│  │ │ 📅 RESCHEDULE REQUEST                               [New Badge]  ││   │
│  │ │                                                                   ││   │
│  │ │ ┌─────┐  John wants to change the time:                          ││   │
│  │ │ │ 👤  │                                                          ││   │
│  │ │ └─────┘  Current:  Sat, Jan 18 at 2:00 PM                        ││   │
│  │ │          Proposed: Mon, Jan 20 at 9:00 AM                        ││   │
│  │ │                                                                   ││   │
│  │ │          "I have a work meeting at the original time"             ││   │
│  │ │                                                                   ││   │
│  │ │          ⏰ Expires in 2 days 23 hours                            ││   │
│  │ │                                                                   ││   │
│  │ │ ┌─────────────────┐  ┌─────────────────────────────┐             ││   │
│  │ │ │    Decline      │  │   ✓ Accept New Time         │             ││   │
│  │ │ └─────────────────┘  └─────────────────────────────┘             ││   │
│  │ └──────────────────────────────────────────────────────────────────┘│   │
│  │                                                                      │   │
│  │ 🗓️ Current: Jan 18, 2025 at 2:00 PM                                 │   │
│  │ ⏱️ 30 minutes  •  💻 Online                                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                        ┌─────────────┴─────────────┐
                        ▼                           ▼
Step 3a: Accept                          Step 3b: Decline
┌───────────────────────────────┐       ┌───────────────────────────────┐
│  Confirmation Dialog:         │       │  Decline Dialog:              │
│  ┌─────────────────────────┐  │       │  ┌─────────────────────────┐  │
│  │ Accept Time Change?     │  │       │  │ Decline Request?        │  │
│  │                         │  │       │  │                         │  │
│  │ The booking will be     │  │       │  │ The booking will remain │  │
│  │ moved to:               │  │       │  │ at:                     │  │
│  │                         │  │       │  │                         │  │
│  │ 📅 Mon, Jan 20, 2025    │  │       │  │ 📅 Sat, Jan 18, 2025    │  │
│  │ 🕐 9:00 AM - 9:30 AM    │  │       │  │ 🕐 2:00 PM - 2:30 PM    │  │
│  │                         │  │       │  │                         │  │
│  │ John will be notified.  │  │       │  │ Reason (optional):      │  │
│  │                         │  │       │  │ ┌─────────────────────┐ │  │
│  │ [Cancel] [✓ Confirm]    │  │       │  │ │ Sorry, I'm not...   │ │  │
│  └─────────────────────────┘  │       │  │ └─────────────────────┘ │  │
│                               │       │  │                         │  │
│  ↓ On Confirm                 │       │  │ [Cancel] [Decline]      │  │
│                               │       │  └─────────────────────────┘  │
│  • Booking time updated       │       │                               │
│  • Calendar event updated     │       │  ↓ On Decline                 │
│  • Visitor notified           │       │                               │
│  • Toast: "Time updated!"     │       │  • Request marked rejected    │
│                               │       │  • Visitor notified           │
└───────────────────────────────┘       │  • Toast: "Request declined"  │
                                        └───────────────────────────────┘
```

#### Flow C: Host Initiates Reschedule

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        HOST INITIATES RESCHEDULE                             │
└─────────────────────────────────────────────────────────────────────────────┘

Step 1: Host Views Order (Provider Orders Page)
┌─────────────────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 📅 Coffee Chat                                        [Confirmed]   │   │
│  │ with John Smith                                                      │   │
│  │                                                                      │   │
│  │ 🗓️ Jan 18, 2025 at 2:00 PM                                          │   │
│  │ ⏱️ 30 minutes  •  💻 Online                                          │   │
│  │                                                                      │   │
│  │ ┌──────────────┐ ┌──────────────┐ ┌────────────────────┐            │   │
│  │ │ 💬 Message   │ │ ❌ Cancel    │ │ 📅 Propose Change  │            │   │
│  │ └──────────────┘ └──────────────┘ └────────────────────┘            │   │
│  │                                    ↑                                 │   │
│  │                         Shows until booking ends                     │   │
│  │                         (Host has unlimited reschedules)             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼ Click "Propose Change"
Step 2: Host Reschedule Modal (Different from Visitor)
┌─────────────────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     Propose Time Change                         [X] │   │
│  │  ─────────────────────────────────────────────────────────────────  │   │
│  │                                                                      │   │
│  │  Current booking with John:                                          │   │
│  │  ┌────────────────────────────────────────────────────────────────┐ │   │
│  │  │  📅 Saturday, January 18, 2025                                 │ │   │
│  │  │  🕐 2:00 PM - 2:30 PM (30 min)                                 │ │   │
│  │  └────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                      │   │
│  │  Propose new time:                                                   │   │
│  │  ┌────────────────────────────────────────────────────────────────┐ │   │
│  │  │  📅 Date: [January 20, 2025    ▼]                              │ │   │
│  │  │  🕐 Time: [9:00 AM             ▼]                              │ │   │
│  │  │                                                                 │ │   │
│  │  │  ⚠️ Make sure you're available at this time!                   │ │   │
│  │  └────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                      │   │
│  │  Reason (optional):                                                  │   │
│  │  ┌────────────────────────────────────────────────────────────────┐ │   │
│  │  │ I need to attend an urgent meeting at 2 PM...                  │ │   │
│  │  └────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                      │   │
│  │  💡 John will be notified and can accept or decline.                │   │
│  │                                                                      │   │
│  │  ┌──────────────────┐  ┌──────────────────────────┐                 │   │
│  │  │     Cancel       │  │   Send Proposal  →       │                 │   │
│  │  └──────────────────┘  └──────────────────────────┘                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘

Note: Host doesn't see availability slots - they propose any time they want.
      The visitor will decide if it works for them.
```

---

### Component States & Variants

#### Booking Card States

```
STATE 1: Normal (No Pending Request)
┌─────────────────────────────────────────────────────────────┐
│ 📅 Service Title                                   [Status] │
│ 🗓️ Date & Time  •  ⏱️ Duration  •  📍 Location              │
│                                                             │
│ [Message] [Cancel] [Request Change]  ← All enabled          │
└─────────────────────────────────────────────────────────────┘

STATE 2: Pending Request (As Requester)
┌─────────────────────────────────────────────────────────────┐
│ 📅 Service Title                                   [Status] │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ ⏳ RESCHEDULE PENDING                                    ││
│ │ You requested: Jan 18 → Jan 20                          ││
│ │ Waiting for response... (expires in 2d)                 ││
│ │ [Withdraw Request]                                      ││
│ └─────────────────────────────────────────────────────────┘│
│ 🗓️ Current: Date & Time  •  ⏱️ Duration  •  📍 Location     │
│                                                             │
│ [Message] [Cancel] [Request Change] ← Disabled              │
└─────────────────────────────────────────────────────────────┘

STATE 3: Pending Request (As Responder)
┌─────────────────────────────────────────────────────────────┐
│ 📅 Service Title                                   [Status] │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ 📅 RESCHEDULE REQUEST                             [NEW] ││
│ │ [Avatar] Name wants to change:                          ││
│ │ Current: Jan 18, 2:00 PM                                ││
│ │ Proposed: Jan 20, 9:00 AM                               ││
│ │ "Reason text..."                                        ││
│ │ ⏰ Expires in 2 days                                    ││
│ │ [Decline] [Accept New Time]                             ││
│ └─────────────────────────────────────────────────────────┘│
│ 🗓️ Current: Date & Time  •  ⏱️ Duration  •  📍 Location     │
│                                                             │
│ [Message] [Cancel] [Request Change] ← Disabled              │
└─────────────────────────────────────────────────────────────┘

STATE 4: Recently Rescheduled
┌─────────────────────────────────────────────────────────────┐
│ 📅 Service Title                                   [Status] │
│ 🗓️ Jan 20, 2025 at 9:00 AM  ← New time                      │
│ ⏱️ 30 min  •  📍 Online                                     │
│                                                             │
│ ↻ Rescheduled from Jan 18 at 2:00 PM  ← History indicator  │
│                                                             │
│ [Message] [Cancel] [Request Change]                         │
└─────────────────────────────────────────────────────────────┘

STATE 5: Visitor - No Reschedules Left
┌─────────────────────────────────────────────────────────────┐
│ 📅 Service Title                                   [Status] │
│ 🗓️ Date & Time  •  ⏱️ Duration  •  📍 Location              │
│                                                             │
│ [Message] [Cancel]  ← No "Request Change" button            │
│                                                             │
│ ℹ️ You've used your reschedule for this booking             │
└─────────────────────────────────────────────────────────────┘
```

---

### Mobile Responsive Design

#### Mobile Booking Card
```
┌─────────────────────────────────┐
│ Coffee Chat with Sarah   [Paid]│
│                                 │
│ 📅 Jan 18, 2025                 │
│ 🕐 2:00 PM  •  30 min           │
│ 💻 Online                       │
│                                 │
│ ┌─────────────────────────────┐│
│ │ ⏳ Reschedule Pending       ││
│ │ You requested: Jan 20 9AM   ││
│ │ [Withdraw]                  ││
│ └─────────────────────────────┘│
│                                 │
│ ┌─────┐ ┌─────┐ ┌───────────┐  │
│ │ 💬  │ │ ❌  │ │ 📅 Change │  │
│ └─────┘ └─────┘ └───────────┘  │
└─────────────────────────────────┘
```

#### Mobile Reschedule Modal (Bottom Sheet)
```
┌─────────────────────────────────┐
│ ═══════════════════════         │  ← Drag handle
│                                 │
│ Request Time Change             │
│                                 │
│ Current:                        │
│ ┌─────────────────────────────┐│
│ │ Sat, Jan 18 at 2:00 PM      ││
│ └─────────────────────────────┘│
│                                 │
│ Select new date:                │
│ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ │
│ │Mon│ │Tue│ │Wed│ │Thu│ │Fri│ │
│ │20 │ │21 │ │22 │ │23 │ │24 │ │
│ │ ● │ │ ● │ │   │ │ ● │ │ ● │ │
│ └───┘ └───┘ └───┘ └───┘ └───┘ │
│   ↑ Selected                    │
│                                 │
│ Available times:                │
│ ┌────────┐ ┌────────┐ ┌──────┐ │
│ │ 9:00AM │ │10:00AM │ │2:00PM│ │
│ └────────┘ └────────┘ └──────┘ │
│                                 │
│ Reason (optional):              │
│ ┌─────────────────────────────┐│
│ │ Type here...                ││
│ └─────────────────────────────┘│
│                                 │
│ ⚠️ 1 reschedule per booking     │
│                                 │
│ ┌─────────────────────────────┐│
│ │      Send Request  →        ││
│ └─────────────────────────────┘│
└─────────────────────────────────┘
```

---

### Interaction Specifications

#### Button States & Feedback

| Action | Loading State | Success State | Error State |
|--------|---------------|---------------|-------------|
| Send Request | "Sending..." + spinner | Toast: "Request sent!" | Toast: Error message |
| Accept | "Accepting..." + spinner | Toast: "Time updated!" | Toast: Error message |
| Decline | "Declining..." + spinner | Toast: "Request declined" | Toast: Error message |
| Withdraw | "Withdrawing..." + spinner | Toast: "Request withdrawn" | Toast: Error message |

#### Animations

1. **Request Card Appearance**: Slide down + fade in (300ms ease-out)
2. **Status Update**: Pulse animation on status badge change
3. **Card Removal**: Fade out + collapse (200ms ease-in)
4. **Toast Notifications**: Slide in from top-right, auto-dismiss after 4s

#### Accessibility

1. **Focus Management**: After modal close, return focus to trigger button
2. **Screen Reader**: Announce pending requests count, status changes
3. **Keyboard**: Full keyboard navigation in modals, Escape to close
4. **Color Contrast**: All text meets WCAG AA standards
5. **Touch Targets**: Minimum 44x44px for all interactive elements

---

### Error States & Empty States

#### No Available Slots
```
┌─────────────────────────────────────────────────────────────┐
│                     Request Time Change                 [X] │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  📅 No available times                                      │
│                                                             │
│  Sarah doesn't have any open slots in the next 30 days.     │
│                                                             │
│  💡 Try messaging Sarah to discuss alternative times.       │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              💬 Message Sarah                        │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

#### Time Slot Conflict (On Approve)
```
┌─────────────────────────────────────────────────────────────┐
│                     Cannot Accept                       [X] │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  ⚠️ Time No Longer Available                                │
│                                                             │
│  The proposed time (Jan 20, 9:00 AM) is no longer           │
│  available because another booking was made.                │
│                                                             │
│  Please decline this request and ask the visitor to         │
│  submit a new one.                                          │
│                                                             │
│  ┌───────────────────┐  ┌───────────────────┐              │
│  │     Close         │  │   Decline Request │              │
│  └───────────────────┘  └───────────────────┘              │
└─────────────────────────────────────────────────────────────┘
```

---

### Design Tokens

#### Colors
```css
/* Request status colors */
--reschedule-pending-bg: #FEF3C7;      /* Amber-100 */
--reschedule-pending-border: #F59E0B;  /* Amber-500 */
--reschedule-pending-text: #92400E;    /* Amber-800 */

--reschedule-approved-bg: #D1FAE5;     /* Green-100 */
--reschedule-approved-text: #065F46;   /* Green-800 */

--reschedule-rejected-bg: #FEE2E2;     /* Red-100 */
--reschedule-rejected-text: #991B1B;   /* Red-800 */

/* Time change indicator */
--reschedule-history-text: #6B7280;    /* Gray-500 */
--reschedule-history-icon: #9CA3AF;    /* Gray-400 */
```

#### Spacing
```css
/* Request card within booking card */
--request-card-margin: 12px;
--request-card-padding: 16px;
--request-card-radius: 8px;

/* Time display */
--time-row-gap: 8px;
--time-arrow-margin: 0 12px;
```

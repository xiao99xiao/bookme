# Google Meet Session Duration Tracking Specification

## Overview
Implement automated session duration tracking for Google Meet bookings to ensure providers deliver the full booked service duration before automatic payment release.

## Business Requirements

### Core Logic
- Track actual Google Meet session duration for both provider and customer
- Compare provider's session duration against booked service duration
- Require provider to be online for at least 90% of booked duration for auto-completion
- Block automatic payment release if duration threshold not met
- Require manual completion by customer when auto-completion is blocked

### User Experience
- **Provider**: Clear indication on orders when duration requirement not met
- **Customer**: Clear warning that payment won't auto-release until manual confirmation
- **Transparency**: Both parties can see actual session durations

## Technical Requirements

### 1. Database Schema Updates

#### New Table: `booking_session_data`
```sql
CREATE TABLE booking_session_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  provider_total_duration INTEGER, -- Total duration in seconds
  customer_total_duration INTEGER, -- Total duration in seconds
  provider_sessions JSONB, -- Array of session objects with startTime/endTime
  customer_sessions JSONB, -- Array of session objects with startTime/endTime
  last_checked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_booking_session_data_booking_id ON booking_session_data(booking_id);
```

#### Update `bookings` table
```sql
ALTER TABLE bookings ADD COLUMN auto_complete_blocked BOOLEAN DEFAULT FALSE;
ALTER TABLE bookings ADD COLUMN auto_complete_blocked_reason TEXT;
```

### 2. Backend API Implementation

#### New Function: `checkGoogleMeetSessionDuration(bookingId)`
**Location**: `backend/src/google-meet-session-tracker.js`

**Purpose**: Query Google Meet API to get session data for a booking

**Logic**:
1. Get booking details (meeting_link, provider_id, customer_id, service duration)
2. Extract Google Meet conference ID from meeting_link
3. Call Google Meet API to get participant sessions
4. Filter sessions by provider and customer user IDs
5. Calculate total duration for each participant
6. Save session data to `booking_session_data` table
7. Return session analysis

**Return Format**:
```javascript
{
  success: boolean,
  providerDuration: number, // seconds
  customerDuration: number, // seconds
  serviceDuration: number, // seconds (from service.duration_minutes * 60)
  providerMeetsThreshold: boolean, // >= 90% of service duration
  threshold: number, // 0.9
  sessions: {
    provider: [{ startTime, endTime, duration }],
    customer: [{ startTime, endTime, duration }]
  }
}
```

#### Updated Function: `markBookingComplete(bookingId, source)`
**Location**: `backend/src/booking-service.js`

**Enhanced Logic**:
1. For online bookings with Google Meet links:
   - Call `checkGoogleMeetSessionDuration(bookingId)`
   - If provider duration < 90% of service duration:
     - Set `auto_complete_blocked = true`
     - Set `auto_complete_blocked_reason = 'Provider session duration insufficient'`
     - Do NOT mark booking as complete
     - Do NOT initiate blockchain transaction
     - Return early with blocked status
2. For other bookings or when threshold is met:
   - Proceed with normal completion flow

#### New API Endpoint: `GET /api/bookings/:bookingId/session-data`
**Purpose**: Frontend can fetch session duration data for display

**Response**:
```javascript
{
  bookingId: string,
  providerDuration: number,
  customerDuration: number,
  serviceDuration: number,
  providerMeetsThreshold: boolean,
  lastChecked: string,
  sessions: {
    provider: Array<SessionObject>,
    customer: Array<SessionObject>
  }
}
```

### 3. Backend Cron Updates

#### Modified Logic in `backend-cron/src/booking-completion-monitor.js`
1. When querying bookings eligible for auto-completion:
   - Add filter: `AND auto_complete_blocked = false`
2. Skip any bookings where `auto_complete_blocked = true`

### 4. Frontend Implementation

#### Provider Orders Page (`src/pages/provider/ProviderOrders.tsx`)
**New UI Component**: Session Duration Warning

```jsx
// In order card, after booking details, before review section
{booking.auto_complete_blocked && (
  <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
    <div className="flex items-start gap-2">
      <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
      <div>
        <Text variant="small" className="font-medium text-amber-800">
          Insufficient Session Duration
        </Text>
        <Text variant="small" className="text-amber-700 mt-1">
          Your Google Meet session was shorter than required. Payment is on hold pending customer confirmation.
        </Text>
        {sessionData && (
          <Text variant="small" className="text-amber-600 mt-1">
            Your time: {formatDuration(sessionData.providerDuration)} / {formatDuration(sessionData.serviceDuration)} required
          </Text>
        )}
      </div>
    </div>
  </div>
)}
```

#### Customer Bookings Page (`src/pages/customer/CustomerBookings.tsx`)
**New UI Component**: Manual Completion Required

```jsx
// In booking card, prominent warning section
{booking.auto_complete_blocked && (
  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
    <div className="flex items-start gap-2">
      <Clock className="h-4 w-4 text-blue-600 mt-0.5" />
      <div className="flex-1">
        <Text variant="small" className="font-medium text-blue-800">
          Manual Completion Required
        </Text>
        <Text variant="small" className="text-blue-700 mt-1">
          The provider's session time was shorter than expected. Please confirm if you received satisfactory service.
        </Text>
        {sessionData && (
          <Text variant="small" className="text-blue-600 mt-1">
            Provider time: {formatDuration(sessionData.providerDuration)} / {formatDuration(sessionData.serviceDuration)} expected
          </Text>
        )}
        <Button
          size="sm"
          className="mt-2"
          onClick={() => handleManualComplete(booking.id)}
        >
          Mark as Complete & Release Payment
        </Button>
      </div>
    </div>
  </div>
)}
```

## Implementation Plan

### Phase 1: Database Schema
1. Create SQL migration files for new table and column additions
2. Test schema changes in development environment

### Phase 2: Backend Core Logic
1. Implement `google-meet-session-tracker.js`
2. Add Google Meet API integration
3. Implement session duration calculation logic
4. Add database operations for session data storage

### Phase 3: Backend Integration
1. Update `markBookingComplete` function
2. Add new API endpoint for session data retrieval
3. Update backend-cron to respect `auto_complete_blocked` flag
4. Add error handling and logging

### Phase 4: Frontend Integration
1. Update provider orders page with duration warnings
2. Update customer bookings page with manual completion UI
3. Add session data fetching and display
4. Implement manual completion action

### Phase 5: Testing & Validation
1. Test Google Meet API integration
2. Verify duration calculation accuracy
3. Test auto-completion blocking logic
4. Test manual completion flow
5. Validate UI/UX with session data display

## Configuration

### Environment Variables
```bash
# Backend .env additions
GOOGLE_MEET_API_ENABLED=true
SESSION_DURATION_THRESHOLD=0.9  # 90%
```

### Google Meet API Requirements
- Google Workspace account with Meet API access
- OAuth scopes: `https://www.googleapis.com/auth/meetings.space.readonly`
- Service account or user credentials for API access

## Error Handling

### API Failures
- If Google Meet API fails, log error but don't block completion
- Fallback to normal auto-completion if session tracking unavailable
- Notify administrators of API issues

### Data Consistency
- Ensure session data is saved even if completion logic fails
- Retry mechanism for temporary API failures
- Graceful degradation when Meet link is invalid or inaccessible

## Security Considerations

### Data Privacy
- Only store session duration data, not meeting content
- Respect Google Meet API usage policies
- Ensure session data is associated only with relevant booking participants

### Access Control
- Session data API endpoint requires authentication
- Users can only access session data for their own bookings
- Protect against data leakage between different bookings

## Success Metrics

### Business Impact
- Reduced payment disputes related to incomplete services
- Increased customer confidence in service delivery
- Better provider accountability for service duration

### Technical Metrics
- Google Meet API success rate > 95%
- Session duration calculation accuracy
- Auto-completion blocking effectiveness
- Manual completion conversion rate

---

This specification provides a comprehensive framework for implementing Google Meet session duration tracking while maintaining system reliability and user experience quality.
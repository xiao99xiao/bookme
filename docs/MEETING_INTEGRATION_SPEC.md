# Online Meeting Integration Feature Specification

## Overview
Implement automated meeting link generation for online services using provider's connected meeting platforms (Google Meet, Zoom, etc.). When a booking is made for an online service, the system will automatically create a meeting link and include it in the booking details.

## Current System Analysis

### Existing Infrastructure
- ✅ Database field `meeting_link` exists in bookings table
- ✅ UI components already reference `meeting_link` in some places
- ✅ Services have `is_online` boolean field 
- ✅ Dashboard layout with sidebar navigation
- ✅ Service creation flow in EditProfile.tsx
- ✅ Booking creation in BookingTimeSlots.tsx

### Current Booking Flow
1. Customer selects service from Discover/Profile page
2. BookingTimeSlots component handles booking creation
3. API creates booking record with `meeting_link: null`
4. Booking appears in DashboardOrders (provider) and DashboardBookings (customer)

## Feature Requirements

### 1. Meeting Platform Management
- **New Dashboard Page**: `/dashboard/integrations`
- **Supported Platforms**: Google Meet (primary), Zoom (future)
- **OAuth Integration**: Secure token storage and refresh
- **Platform Selection**: Allow providers to choose preferred platform per service

### 2. Service Creation Enhancement
- **Platform Selection**: When creating online services, providers must select meeting platform
- **Validation**: Require platform selection for online services
- **Auth Check**: Redirect to integrations page if platform not connected

### 3. Automatic Meeting Creation
- **Trigger**: When booking status changes to 'confirmed'
- **Meeting Details**: Auto-populate title, description, datetime from booking
- **Link Storage**: Save meeting link to booking record
- **Error Handling**: Graceful fallback if meeting creation fails

### 4. Meeting Link Display
- **Provider View**: Show meeting link in Incoming Orders
- **Customer View**: Show meeting link in My Bookings (after confirmation)
- **Calendar Integration**: Include meeting link in calendar exports

## Technical Architecture

### Database Schema Changes
```sql
-- Add meeting integrations table
CREATE TABLE user_meeting_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  platform VARCHAR(50) NOT NULL, -- 'google_meet', 'zoom'
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  scope TEXT[],
  platform_user_id TEXT,
  platform_user_email TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, platform)
);

-- Add meeting platform to services
ALTER TABLE services 
ADD COLUMN meeting_platform VARCHAR(50), -- 'google_meet', 'zoom', null for in-person
ADD COLUMN meeting_settings JSONB DEFAULT '{}';

-- Add meeting metadata to bookings
ALTER TABLE bookings
ADD COLUMN meeting_platform VARCHAR(50),
ADD COLUMN meeting_id TEXT, -- external meeting ID
ADD COLUMN meeting_settings JSONB DEFAULT '{}';
```

### API Endpoints
```typescript
// Meeting integration endpoints
POST /api/auth/google-meet/connect
GET  /api/auth/google-meet/callback
DELETE /api/integrations/{platform}
GET  /api/integrations

// Meeting management
POST /api/meetings/create
PUT  /api/meetings/{bookingId}/update
DELETE /api/meetings/{bookingId}
```

### Component Structure
```
src/
├── pages/dashboard/
│   └── DashboardIntegrations.tsx          // New integration management page
├── components/
│   ├── MeetingPlatformSelector.tsx        // Platform selection for services
│   ├── MeetingLinkDisplay.tsx             // Meeting link display component
│   └── IntegrationCard.tsx                // OAuth platform connection cards
├── lib/
│   ├── meeting-providers/
│   │   ├── google-meet.ts                 // Google Meet API integration
│   │   ├── zoom.ts                        // Zoom API integration (future)
│   │   └── base-provider.ts               // Abstract base class
│   └── meeting-api.ts                     // Meeting management API client
```

## Implementation Tasks Breakdown

### Phase 1: Database & API Foundation
1. **Database Schema Updates**
   - Create user_meeting_integrations table
   - Add meeting_platform to services table
   - Add meeting metadata to bookings table
   - Create migration script

2. **API Infrastructure**
   - Create meeting API client base classes
   - Implement Google Calendar/Meet API integration
   - Add OAuth flow handlers
   - Create meeting CRUD endpoints

### Phase 2: Dashboard Integration Management
1. **DashboardIntegrations Page**
   - Create new dashboard page for platform connections
   - Implement OAuth connection flow for Google Meet
   - Add platform status indicators and management
   - Handle token refresh and error states

2. **Navigation Updates**
   - Add "Integrations" to dashboard sidebar
   - Update routing configuration
   - Add proper permissions and loading states

### Phase 3: Service Creation Enhancement
1. **MeetingPlatformSelector Component**
   - Create platform selection UI for online services
   - Validate platform selection requirement
   - Integrate with service creation flow
   - Add platform-specific settings options

2. **Service Creation Flow Updates**
   - Modify EditProfile.tsx service creation
   - Add validation for online services
   - Implement redirect to integrations if not connected
   - Update API to store meeting platform preferences

### Phase 4: Automatic Meeting Generation
1. **Meeting Creation Logic**
   - Hook into booking status change (pending → confirmed)
   - Implement Google Meet meeting creation
   - Handle meeting details population
   - Implement error handling and retry logic

2. **Booking API Updates**
   - Modify booking confirmation process
   - Add meeting link generation step
   - Update booking records with meeting info
   - Add webhook/event system for status changes

### Phase 5: UI Integration & Display
1. **Meeting Link Display**
   - Update DashboardOrders to show meeting links
   - Update DashboardBookings to show meeting links
   - Create MeetingLinkDisplay component
   - Add proper styling and interaction states

2. **Calendar Integration**
   - Update AddToCalendar component to include meeting links
   - Ensure meeting links appear in Google Calendar events
   - Update ICS file generation with meeting info

### Phase 6: Testing & Polish
1. **Integration Testing**
   - Test OAuth flows with Google
   - Test meeting creation and deletion
   - Test error handling scenarios
   - Test token refresh flows

2. **User Experience Polish**
   - Add loading states and error messages
   - Implement proper error boundaries
   - Add user guidance and onboarding
   - Test responsive design

## Google Meet Integration Details

### OAuth Scopes Required
```
https://www.googleapis.com/auth/calendar
https://www.googleapis.com/auth/calendar.events
```

### Meeting Creation Flow
1. Provider connects Google account in Integrations page
2. When booking confirmed, create Google Calendar event with Meet
3. Extract meeting link from calendar event
4. Store link in booking record
5. Display in both provider and customer dashboards

### API Integration Points
- **Google Calendar API**: Create events with Google Meet
- **Event Creation**: Use conferenceData.createRequest
- **Meeting Link**: Extract from event.conferenceData.entryPoints

## Security Considerations

### Token Management
- Store tokens encrypted in database
- Implement proper token refresh logic
- Use secure HTTP-only cookies for OAuth state
- Add token expiration monitoring

### Access Control
- Only providers can manage integrations
- Validate user ownership of services/bookings
- Implement proper RBAC for meeting operations
- Add audit logging for meeting operations

## Error Handling Strategy

### OAuth Failures
- Clear error messages for authorization failures
- Automatic retry with exponential backoff
- Graceful degradation if meeting creation fails
- Manual meeting link input as fallback

### Meeting Creation Failures
- Retry logic for temporary API failures
- Notification to provider if meeting creation fails
- Fallback to generic meeting room if configured
- Clear status indicators for meeting availability

## Future Enhancements

### Additional Platforms
- Zoom integration
- Microsoft Teams integration
- **Jitsi Meet integration** (see detailed spec below)
- Custom meeting room providers

### Advanced Features
- Meeting recording options
- Waiting room settings
- Meeting templates and branding
- Bulk meeting management

---

## Jitsi Meet Integration (Future Feature)

### Why Jitsi?
| Feature | Google Meet | Jitsi (JaaS) |
|---------|-------------|--------------|
| Privacy | Email visible to all participants | Fully anonymous (custom display names) |
| OAuth Required | Yes (complex) | No (JWT-based, simpler) |
| Account Required | Google account | None for participants |
| White-labeling | No | Yes |
| Webhooks | No | Yes (meeting events) |
| Cost | Free (user's account) | $99-999/month based on MAU |

### JaaS (8x8) Pricing Summary
| Plan | MAU Limit | Monthly Cost |
|------|-----------|--------------|
| Developer | 25 | **Free** |
| Basic | 300 | $99 |
| Standard | 1,500 | $499 |
| Business | 3,000 | $999 |
| Enterprise | 5,000+ | Contact sales |

**Overage:** $0.99 per additional MAU
**Recording:** $0.01/minute (stored 24 hours)

### Technical Implementation

#### 1. Database Changes
```sql
-- Add 'jitsi' to platform enum
ALTER TABLE user_meeting_integrations
  DROP CONSTRAINT user_meeting_integrations_platform_check;
ALTER TABLE user_meeting_integrations
  ADD CONSTRAINT user_meeting_integrations_platform_check
  CHECK (platform IN ('google_meet', 'zoom', 'teams', 'jitsi'));

-- Add Jitsi-specific settings
ALTER TABLE services ADD COLUMN jitsi_settings JSONB DEFAULT '{}';
-- Example: {"moderatorOnly": true, "lobbyEnabled": false}
```

#### 2. Backend JWT Generation
```javascript
// backend/src/jitsi-jwt.js
import jwt from 'jsonwebtoken';

const JAAS_APP_ID = process.env.JAAS_APP_ID;  // vpaas-magic-cookie-xxx
const JAAS_API_KEY = process.env.JAAS_API_KEY;
const JAAS_PRIVATE_KEY = process.env.JAAS_PRIVATE_KEY;

export function generateJitsiJWT(options) {
  const { roomName, user, isModerator = false, expiresIn = '2h' } = options;

  const payload = {
    aud: 'jitsi',
    iss: 'chat',
    sub: JAAS_APP_ID,
    room: roomName,
    context: {
      user: {
        name: user.displayName,
        // No email - privacy preserved!
        moderator: isModerator ? 'true' : 'false'
      },
      features: {
        livestreaming: 'false',
        recording: 'false',
        transcription: 'false',
        'outbound-call': 'false'
      }
    }
  };

  return jwt.sign(payload, JAAS_PRIVATE_KEY, {
    algorithm: 'RS256',
    expiresIn,
    header: { kid: JAAS_API_KEY, typ: 'JWT', alg: 'RS256' }
  });
}

export function generateJitsiMeetingLink(bookingId, user, isModerator) {
  const roomName = `nook-${bookingId}`;
  const token = generateJitsiJWT({ roomName, user, isModerator });
  return `https://8x8.vc/${JAAS_APP_ID}/${roomName}?jwt=${token}`;
}
```

#### 3. Meeting Generation Changes
```javascript
// backend/src/meeting-generation.js - add Jitsi case
async function generateMeetingLinkForBooking(bookingId) {
  const booking = await getBookingWithDetails(bookingId);

  switch (booking.services.meeting_platform) {
    case 'google_meet':
      return await generateGoogleMeetLink(booking);
    case 'jitsi':
      // No OAuth needed - just generate JWT links
      return {
        hostLink: generateJitsiMeetingLink(bookingId, booking.provider, true),
        guestLink: generateJitsiMeetingLink(bookingId, booking.customer, false)
      };
    default:
      return null;
  }
}
```

#### 4. Frontend Changes

**Add Jitsi icon:**
```tsx
// src/components/icons/MeetingPlatformIcons.tsx
export const JitsiIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6">
    {/* Jitsi logo SVG */}
  </svg>
);
```

**Update platform selector:**
```tsx
// src/components/CreateServiceModal.tsx
const meetingPlatforms = [
  { value: 'google_meet', label: 'Google Meet', icon: GoogleMeetIcon },
  { value: 'jitsi', label: 'Jitsi Meet', icon: JitsiIcon, badge: 'Privacy-first' },
  { value: 'zoom', label: 'Zoom', icon: ZoomIcon, disabled: true },
  { value: 'teams', label: 'Microsoft Teams', icon: TeamsIcon, disabled: true },
];
```

**No integration page needed for Jitsi** - it works without OAuth!

#### 5. Environment Variables
```bash
# Backend .env
JAAS_APP_ID=vpaas-magic-cookie-xxxxx
JAAS_API_KEY=your-api-key-id
JAAS_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
```

### Implementation Priority
1. **Phase 1 (MVP):** Free tier (25 MAU) for testing
2. **Phase 2:** Add UI option in platform selector
3. **Phase 3:** Webhook integration for meeting analytics
4. **Phase 4:** Evaluate upgrade to Basic plan ($99/month) based on usage

### Resources
- [JaaS Developer Portal](https://developer.8x8.com/jaas/)
- [JaaS JWT Documentation](https://developer.8x8.com/jaas/docs/api-keys-jwt/)
- [JaaS Webhooks](https://developer.8x8.com/jaas/docs/webhooks-overview/)
- [JaaS Pricing](https://cpaas.8x8.com/en/pricing/jitsi-as-a-service-pricing/)
- [Jitsi React SDK](https://jitsi.github.io/handbook/docs/dev-guide/dev-guide-react-sdk/)

---

This specification provides a comprehensive foundation for implementing the online meeting integration feature while maintaining compatibility with the existing system architecture.
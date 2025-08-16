# Agora Messaging Integration Plan

## Overview
Integrate Agora Chat SDK to enable direct messaging between users who have accepted service bookings. The chat interface will follow Instagram's DM design pattern with a chat list sidebar and conversation view.

## Business Logic

### Access Control
- **DM Creation Trigger**: A conversation is automatically created when a booking status changes to "confirmed"
- **Access Permission**: Only users with an accepted booking between them can access the DM
- **Entry Point**: "Message" button on confirmed booking items in dashboard

### User Journey
1. User A creates a service and User B books it
2. User A confirms the booking → Conversation is created automatically
3. Both users can now access the chat through their booking dashboard
4. Chat remains available as long as the booking exists

## Data Architecture

### Database Schema Changes

```sql
-- Add to Prisma schema
model Conversation {
  id          String   @id @default(cuid())
  bookingId   String   @unique  // One conversation per booking
  agoraChannelId String @unique  // Agora channel identifier
  
  // Participants (derived from booking)
  providerId  String   // Service provider
  customerId  String   // Service booker
  
  // Metadata
  lastMessageAt DateTime?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  // Relations
  booking     Booking  @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  provider    User     @relation("ConversationProvider", fields: [providerId], references: [id])
  customer    User     @relation("ConversationCustomer", fields: [customerId], references: [id])
  
  @@map("conversations")
}

-- Update User model to include conversation relations
model User {
  // ... existing fields
  providerConversations Conversation[] @relation("ConversationProvider")
  customerConversations Conversation[] @relation("ConversationCustomer")
}

-- Update Booking model
model Booking {
  // ... existing fields
  conversation Conversation?
}
```

### Agora Integration Points

1. **Channel Management**
   - Each conversation = One Agora Chat channel
   - Channel ID format: `bookme_${bookingId}`
   - Only conversation participants can join the channel

2. **Authentication**
   - Generate Agora user tokens server-side
   - User ID format: `user_${userId}`
   - Token expiration: 24 hours (refresh automatically)

## API Endpoints

### Backend Routes

```typescript
// /api/conversations
GET    /api/conversations              // Get user's conversation list
POST   /api/conversations              // Create conversation (auto on booking confirm)
GET    /api/conversations/[id]         // Get conversation details
DELETE /api/conversations/[id]         // Archive conversation

// /api/conversations/[id]/agora-token
GET    /api/conversations/[id]/agora-token  // Get Agora token for conversation

// /api/bookings/[id]/conversation
GET    /api/bookings/[id]/conversation      // Get conversation for booking
POST   /api/bookings/[id]/conversation      // Create conversation for booking
```

### Integration with Existing Booking Flow

```typescript
// Modify booking confirmation API
// /api/bookings/[id]/route.ts - PATCH method
if (status === 'confirmed' && currentStatus !== 'confirmed') {
  // Auto-create conversation
  await createConversationForBooking(bookingId)
}
```

## Frontend Architecture

### Component Structure

```
src/components/chat/
├── ChatLayout.tsx           // Main chat layout (sidebar + conversation)
├── ConversationList.tsx     // Left sidebar with chat list
├── ConversationItem.tsx     // Individual chat list item
├── ChatInterface.tsx        // Right side chat UI
├── MessageBubble.tsx        // Individual message component
├── MessageInput.tsx         // Chat input component
└── ChatProvider.tsx         // Agora Chat context provider
```

### State Management

```typescript
// Zustand store for chat
interface ChatState {
  conversations: Conversation[]
  activeConversationId: string | null
  messages: Record<string, Message[]>
  
  // Actions
  setActiveConversation: (id: string) => void
  addMessage: (conversationId: string, message: Message) => void
  updateLastMessage: (conversationId: string, message: Message) => void
  loadConversations: () => Promise<void>
  loadMessages: (conversationId: string) => Promise<void>
}
```

### UI Layout Design

```
┌─────────────────────────────────────────────────────────────┐
│ Dashboard Header                                            │
├─────────────────┬───────────────────────────────────────────┤
│ Chat List       │ Chat Interface                            │
│ ┌─────────────┐ │ ┌─────────────────────────────────────────┤
│ │ User Avatar │ │ │ Chat Header (User name, online status) │
│ │ Last Message│ │ ├─────────────────────────────────────────┤
│ │ Timestamp   │ │ │                                         │
│ └─────────────┘ │ │ Messages Container                      │
│ ┌─────────────┐ │ │ (Scrollable message list)               │
│ │ User Avatar │ │ │                                         │
│ │ Last Message│ │ │                                         │
│ │ Timestamp   │ │ │                                         │
│ └─────────────┘ │ │                                         │
│                 │ ├─────────────────────────────────────────┤
│                 │ │ Message Input                           │
│                 │ │ [Type a message...] [Send]              │
└─────────────────┴─┴─────────────────────────────────────────┘
```

## Implementation Steps

### Phase 1: Backend Foundation
1. Update Prisma schema with Conversation model
2. Install Agora Chat SDK server dependencies
3. Create conversation management APIs
4. Implement Agora token generation
5. Modify booking confirmation to auto-create conversations

### Phase 2: Frontend Integration
1. Install Agora Chat React SDK
2. Create chat context provider
3. Build conversation list sidebar
4. Implement chat interface
5. Add message input and display components

### Phase 3: UI Integration
1. Add "Message" buttons to booking items
2. Create chat page route (`/dashboard/messages`)
3. Integrate with existing dashboard navigation
4. Style components to match Instagram DM design

### Phase 4: Real-time Features
1. Implement real-time message delivery
2. Add typing indicators
3. Add read receipts
4. Handle offline message storage

## Security Considerations

### Access Control
- Validate user permissions before generating Agora tokens
- Ensure users can only access conversations they're part of
- Implement rate limiting on message APIs

### Data Privacy
- Messages stored and managed by Agora (no local storage)
- Conversation metadata only stored locally
- Option to delete conversations (archives locally, messages remain in Agora)

## Environment Configuration

```env
# .env.local
AGORA_APP_ID=your_agora_app_id
AGORA_APP_CERTIFICATE=your_agora_app_certificate
AGORA_REST_API_KEY=your_agora_rest_api_key
AGORA_REST_API_SECRET=your_agora_rest_api_secret
```

## Testing Strategy

1. **Unit Tests**: API endpoints, token generation, access control
2. **Integration Tests**: Booking → Conversation creation flow
3. **E2E Tests**: Complete user journey from booking to messaging
4. **Manual Testing**: Real-time messaging between two browser windows

## Future Enhancements

1. **Rich Media**: Image/file sharing capabilities
2. **Push Notifications**: Real-time notifications for new messages
3. **Message Search**: Search within conversation history
4. **Message Reactions**: Emoji reactions to messages
5. **Voice Messages**: Audio message support
6. **Video Calling**: Upgrade to Agora Video SDK integration

## Dependencies

```json
{
  "agora-chat": "^4.x.x",
  "agora-rtm-sdk": "^2.x.x"
}
```

This integration will provide a robust, scalable messaging solution that enhances the P2P booking experience by enabling direct communication between service providers and customers.
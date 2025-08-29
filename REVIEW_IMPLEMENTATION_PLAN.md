# Review Feature Implementation Plan

## Overview
Implement a comprehensive review system that allows customers to rate and review services after completion, with reviews displayed on provider profiles and integrated into the booking completion flow.

## Database Analysis
### Existing Tables
- **reviews** table - Already exists with proper structure:
  - `id` (uuid) - Primary key
  - `booking_id` (uuid) - Links to specific booking (UNIQUE constraint)
  - `reviewer_id` (uuid) - Customer who writes the review
  - `reviewee_id` (uuid) - Provider being reviewed
  - `service_id` (uuid) - Service being reviewed
  - `rating` (integer 1-5) - Star rating
  - `comment` (text) - Review text
  - `is_public` (boolean) - Visibility flag
  - `created_at`, `updated_at` - Timestamps

- **users** table - Has review aggregation fields:
  - `rating` (numeric) - Average rating
  - `review_count` (integer) - Total reviews received

- **services** table - Has review aggregation fields:
  - `rating` (numeric) - Average rating
  - `review_count` (integer) - Total reviews

## Implementation Tasks

### 1. Backend API (src/lib/api.ts)
- [ ] Create `submitReview()` method
  - Parameters: bookingId, rating, comment
  - Creates review record
  - Updates user and service aggregate ratings
- [ ] Create `getReviewsByProvider()` method
  - Fetch all reviews for a provider
  - Include service info and reviewer info
- [ ] Create `getReviewByBooking()` method
  - Check if booking already has a review
- [ ] Create `getProviderStats()` method
  - Get average rating and review count

### 2. Review Dialog Component (src/components/ReviewDialog.tsx)
- [ ] Create modal dialog component
- [ ] Star rating selector (1-5 stars)
- [ ] Text area for comments (max 2000 chars)
- [ ] Character counter
- [ ] Submit and Skip buttons
- [ ] Success/error handling

### 3. Update DashboardBookings Component
- [ ] Modify `handleCompleteBooking()` to show review dialog
- [ ] After marking complete, open ReviewDialog
- [ ] Pass booking details to dialog
- [ ] Handle review submission
- [ ] Update UI after submission

### 4. Update Profile Page
- [ ] Display average rating with stars
- [ ] Show review count
- [ ] Add "Reviews" section below services
- [ ] List recent reviews with:
  - Reviewer name
  - Rating stars
  - Review text
  - Service name
  - Date

### 5. Database Triggers/Functions (optional but recommended)
- [ ] Create trigger to update user ratings on review insert
- [ ] Create trigger to update service ratings on review insert
- [ ] Ensure atomic updates for rating calculations

## Component Structure

### ReviewDialog Component
```tsx
interface ReviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  booking: {
    id: string;
    service_id: string;
    provider_id: string;
    services?: {
      title: string;
    };
    provider?: {
      display_name: string;
    };
  };
  onSubmit: (rating: number, comment: string) => Promise<void>;
}
```

### Star Rating Component
```tsx
interface StarRatingProps {
  value: number;
  onChange: (value: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
}
```

## API Endpoints Structure

### Submit Review
```typescript
static async submitReview(bookingId: string, rating: number, comment: string, userId: string) {
  // 1. Check if review already exists
  // 2. Create review record
  // 3. Update user rating & count
  // 4. Update service rating & count
  // 5. Return success/error
}
```

### Get Reviews
```typescript
static async getProviderReviews(providerId: string) {
  // Fetch reviews with joins to get:
  // - Service title
  // - Reviewer name
  // - Formatted dates
}
```

## UI/UX Considerations

1. **Review Dialog Flow**:
   - Opens automatically after "Mark Complete"
   - Can be skipped (but encourage reviewing)
   - Shows service and provider info
   - Clear star selection
   - Optional comment field

2. **Profile Page Reviews**:
   - Show aggregate rating prominently
   - Display individual reviews chronologically
   - Show which service was reviewed
   - Respect `is_public` flag

3. **Visual Design**:
   - Use filled/unfilled star icons
   - Yellow/gold color for stars
   - Clear hover states
   - Mobile-responsive layout

## Implementation Order

1. **Phase 1: Core Review Submission**
   - ReviewDialog component
   - Star rating component
   - API submitReview method
   - Integration with Mark Complete

2. **Phase 2: Display Reviews**
   - API methods for fetching reviews
   - Profile page review section
   - Review stats display

3. **Phase 3: Polish & Edge Cases**
   - Prevent duplicate reviews
   - Edit/delete reviews (if needed)
   - Review moderation (if needed)

## Testing Checklist

- [ ] Can submit review after completing booking
- [ ] Cannot submit duplicate review for same booking
- [ ] Rating updates correctly on profile
- [ ] Review count increments properly
- [ ] Reviews display on profile page
- [ ] Character limit enforced
- [ ] Error handling for failed submissions
- [ ] Mobile responsive layout

## SQL Helpers

### Update User Rating (to be run after review insert)
```sql
UPDATE users 
SET rating = (
  SELECT AVG(rating) FROM reviews WHERE reviewee_id = $1
),
review_count = (
  SELECT COUNT(*) FROM reviews WHERE reviewee_id = $1
)
WHERE id = $1;
```

### Update Service Rating
```sql
UPDATE services 
SET rating = (
  SELECT AVG(rating) FROM reviews WHERE service_id = $1
),
review_count = (
  SELECT COUNT(*) FROM reviews WHERE service_id = $1
)
WHERE id = $1;
```
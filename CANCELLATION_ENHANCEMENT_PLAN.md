# Enhanced Cancellation System Implementation Plan

## Overview
Enhance the current booking cancellation system with multiple cancellation reasons, dynamic refund percentages based on timing and context, and flexible configuration for future rule additions.

## Current System Analysis

### Existing Components:
- **Backend**: `/api/bookings/:id/cancel` endpoint with basic reason field
- **Frontend**: `CancelBookingModal.tsx` component with simple confirmation
- **Database**: Basic cancellation fields (`cancellation_reason`, `cancelled_by`, `cancelled_at`)

### Current Limitations:
- Only stores a simple text reason
- No refund calculation logic
- No time-based or context-based rules
- No configurable cancellation policies

## Enhanced Requirements

### Cancellation Reasons (Rewritten in Native English):

1. **Customer No Show (Ongoing Orders)**
   - *Timing*: For orders with status "ongoing" (already started)
   - *Refund*: 0% to customer, 100% to provider
   - *Description*: "Customer failed to attend the scheduled appointment"

2. **Customer Requested Cancellation (Early)**
   - *Timing*: More than 12 hours before start time, status "confirmed"
   - *Refund*: 100% to customer, 0% to provider
   - *Description*: "Customer requested cancellation with advance notice"

3. **Customer Requested Cancellation (Late)**
   - *Timing*: Less than 12 hours before start time, but before start, status "confirmed"
   - *Refund*: 50% to customer, 0% to provider, 50% platform fee
   - *Description*: "Customer requested cancellation with short notice"

4. **Provider Cancellation**
   - *Timing*: Any time before start
   - *Refund*: 100% to customer, 0% to provider
   - *Description*: "Provider cancelled the appointment"

## Implementation Plan

### Phase 1: Database Schema Enhancement

#### 1.1 Create Cancellation Policies Table
```sql
CREATE TABLE cancellation_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reason_key TEXT NOT NULL UNIQUE,
  reason_title TEXT NOT NULL,
  reason_description TEXT NOT NULL,
  customer_refund_percentage INTEGER NOT NULL CHECK (customer_refund_percentage >= 0 AND customer_refund_percentage <= 100),
  provider_earnings_percentage INTEGER NOT NULL CHECK (provider_earnings_percentage >= 0 AND provider_earnings_percentage <= 100),
  platform_fee_percentage INTEGER NOT NULL CHECK (platform_fee_percentage >= 0 AND platform_fee_percentage <= 100),
  requires_explanation BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 1.2 Create Cancellation Policy Conditions Table
```sql
CREATE TABLE cancellation_policy_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES cancellation_policies(id) ON DELETE CASCADE,
  condition_type TEXT NOT NULL CHECK (condition_type IN ('booking_status', 'time_before_start', 'min_time_before_start', 'max_time_before_start')),
  condition_value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 1.3 Enhance Bookings Table
```sql
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancellation_policy_id UUID REFERENCES cancellation_policies(id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancellation_explanation TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS refund_amount DECIMAL(10,2);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS provider_earnings DECIMAL(10,2);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS platform_fee DECIMAL(10,2);
```

### Phase 2: Seed Initial Policies

#### 2.1 Insert Default Policies
```sql
-- Customer No Show
INSERT INTO cancellation_policies (reason_key, reason_title, reason_description, customer_refund_percentage, provider_earnings_percentage, platform_fee_percentage, requires_explanation) VALUES 
('customer_no_show', 'Customer No Show', 'Customer failed to attend the scheduled appointment', 0, 100, 0, true);

-- Customer Requested Early
INSERT INTO cancellation_policies (reason_key, reason_title, reason_description, customer_refund_percentage, provider_earnings_percentage, platform_fee_percentage, requires_explanation) VALUES 
('customer_early_cancel', 'Customer Early Cancellation', 'Customer requested cancellation with advance notice', 100, 0, 0, false);

-- Customer Requested Late
INSERT INTO cancellation_policies (reason_key, reason_title, reason_description, customer_refund_percentage, provider_earnings_percentage, platform_fee_percentage, requires_explanation) VALUES 
('customer_late_cancel', 'Customer Late Cancellation', 'Customer requested cancellation with short notice', 50, 0, 50, false);

-- Provider Cancellation
INSERT INTO cancellation_policies (reason_key, reason_title, reason_description, customer_refund_percentage, provider_earnings_percentage, platform_fee_percentage, requires_explanation) VALUES 
('provider_cancel', 'Provider Cancellation', 'Provider cancelled the appointment', 100, 0, 0, true);
```

#### 2.2 Insert Conditions
```sql
-- Customer No Show conditions
INSERT INTO cancellation_policy_conditions (policy_id, condition_type, condition_value) 
SELECT id, 'booking_status', 'ongoing' FROM cancellation_policies WHERE reason_key = 'customer_no_show';

-- Customer Early Cancel conditions
INSERT INTO cancellation_policy_conditions (policy_id, condition_type, condition_value) 
SELECT id, 'booking_status', 'confirmed' FROM cancellation_policies WHERE reason_key = 'customer_early_cancel';
INSERT INTO cancellation_policy_conditions (policy_id, condition_type, condition_value) 
SELECT id, 'min_time_before_start', '720' FROM cancellation_policies WHERE reason_key = 'customer_early_cancel'; -- 12 hours in minutes

-- Customer Late Cancel conditions
INSERT INTO cancellation_policy_conditions (policy_id, condition_type, condition_value) 
SELECT id, 'booking_status', 'confirmed' FROM cancellation_policies WHERE reason_key = 'customer_late_cancel';
INSERT INTO cancellation_policy_conditions (policy_id, condition_type, condition_value) 
SELECT id, 'max_time_before_start', '720' FROM cancellation_policies WHERE reason_key = 'customer_late_cancel'; -- Less than 12 hours

-- Provider Cancel conditions
INSERT INTO cancellation_policy_conditions (policy_id, condition_type, condition_value) 
SELECT id, 'booking_status', 'confirmed' FROM cancellation_policies WHERE reason_key = 'provider_cancel';
INSERT INTO cancellation_policy_conditions (policy_id, condition_type, condition_value) 
SELECT id, 'booking_status', 'ongoing' FROM cancellation_policies WHERE reason_key = 'provider_cancel';
```

### Phase 3: Backend API Enhancement

#### 3.1 Create Policy Helper Functions
- `getApplicableCancellationPolicies(bookingId, userRole)` - Returns available policies based on booking state and timing
- `calculateRefundBreakdown(bookingId, policyId)` - Calculates exact refund amounts
- `processCancellation(bookingId, policyId, explanation)` - Handles the full cancellation process

#### 3.2 New API Endpoints
- `GET /api/bookings/:id/cancellation-policies` - Get available cancellation reasons for a booking
- `POST /api/bookings/:id/cancel-with-policy` - Enhanced cancellation with policy selection

#### 3.3 Update Existing Endpoint
- Modify `/api/bookings/:id/cancel` to use new policy system while maintaining backward compatibility

### Phase 4: Frontend Enhancement

#### 4.1 Create Enhanced Components
- `CancellationPolicySelector` - Component for selecting cancellation reason
- `RefundBreakdownDisplay` - Component showing refund calculation breakdown
- `CancellationExplanationInput` - Optional explanation text input

#### 4.2 Update CancelBookingModal
- Replace simple confirmation with policy selection interface
- Add refund breakdown preview
- Add explanation input when required
- Show confirmation with calculated amounts

#### 4.3 Integration Points
- Update `handleCancelBooking` in ProviderOrders.tsx to use new modal
- Add similar integration for customer cancellation flows
- Add proper error handling and loading states

### Phase 5: Configuration Interface (Future)

#### 5.1 Admin Interface Components
- Policy management interface
- Condition builder interface  
- Preview and testing tools

## Technical Considerations

### API Design
- Use consistent error handling
- Include proper validation for policy selection
- Maintain backward compatibility
- Add proper logging for financial calculations

### Database Design
- Use CHECK constraints to ensure percentage totals are valid
- Add proper indexes for policy lookup performance
- Include audit trail for policy changes
- Use soft deletion for policy management

### Frontend UX
- Clear visual hierarchy for policy selection
- Prominent display of financial implications
- Progressive disclosure for explanation fields
- Confirmation steps for irreversible actions

### Edge Cases
- Handle timezone differences for timing calculations
- Account for booking modifications that affect timing
- Handle concurrent cancellation attempts
- Validate policy availability at submission time

## Implementation Timeline

1. **Week 1**: Database schema and migrations
2. **Week 2**: Backend API enhancement and testing
3. **Week 3**: Frontend component development
4. **Week 4**: Integration, testing, and refinement
5. **Week 5**: Admin interface (if needed)

## Success Criteria

- ✅ Multiple cancellation reasons available based on context
- ✅ Accurate refund calculations based on policies
- ✅ Configurable policy system for future additions
- ✅ Clear user interface for policy selection
- ✅ Proper explanation capture when required
- ✅ Audit trail for all cancellation decisions
- ✅ Backward compatibility with existing cancellations
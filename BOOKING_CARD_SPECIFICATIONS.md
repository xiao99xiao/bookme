# **BOOKING CARD SPECIFICATIONS**

## **CUSTOMER BOOKING CARDS (CustomerBookings.tsx)**

### **Card Information Display:**
- Service title, provider name & avatar
- Date, time, duration, location  
- Total price (shows USDC for pending_payment, $ for others)
- Status badge with color coding
- Meeting link platform icon (if online)
- Auto-completion countdown for in_progress bookings

### **Status Text & Actions by Status:**

**`pending` Status:**
- **Text**: "Awaiting Confirmation"  
- **Actions**: [Cancel Request] button

**`pending_payment` Status:**
- **Text**: "Payment Required"
- **Actions**: [Cancel] + [Pay X USDC] buttons

**`paid` Status:** 
- **Text**: "Pending Provider's Confirmation"
- **Actions**: No buttons (waiting for provider)

**`confirmed` Status:**
- **Text**: "Upcoming" 
- **Actions**: [Copy Link] + [Join] (if meeting link exists) for Online type
- **Note**: confirmed status is ALWAYS before "In Progress", ALWAYS "BEFORE START". NO [Cancel] button.

**`in_progress` Status:**
- **Text**: "In Progress" 
- **Actions**: [Mark Complete] + [Copy Link] + [Join] (if meeting link exists) for Online type
- **Note**: Meeting buttons should be the same as confirmed status. NO [No Meeting Link] button.

**`completed` Status:**
- **Text**: None (shows review section)
- **Actions**: 
  - Review form if no review exists
  - [Edit Review] button if existing review exists

**`rejected` Status:**
- **Text**: "Rejected by Provider"
- **Actions**: No buttons

---

## **PROVIDER ORDER CARDS (ProviderOrders.tsx)**

### **Card Information Display:**
- Service title, customer name & avatar
- Date, time, duration, location
- Total price and earnings breakdown
- Status badge 
- Time remaining/countdown for active bookings

### **Status Text & Actions by Status:**

**`pending` Status:**
- **Text**: "New order"
- **Actions**: [Decline] + [Accept] buttons

**`paid` Status:**
- **Text**: "New order" 
- **Actions**: [Decline] + [Accept] buttons
- **Note**: Decline calls special `handleRejectPaidBooking()` for refunds

**`confirmed` Status:**
- **Text**: Shows time remaining until start
- **Actions**: 
  - [Copy Link] + [Join] buttons if meeting link exists
  - [Generate Meeting Link] button if online booking but no meeting link exists

**`in_progress` Status:**  
- **Text**: Shows "In progress" with end time
- **Actions**: 
  - [Copy Link] + [Join] buttons if meeting link exists
  - [Generate Meeting Link] button if online booking but no meeting link exists

**`completed` Status:**
- **Text**: None (shows review section)
- **Actions**: Displays customer review if exists

---

## **CURRENT IMPLEMENTATION ISSUES TO FIX:**

### **Customer Cards Issues:**
1. **`confirmed` status logic is WRONG** - currently shows different actions before/after start
2. **Missing [Copy Link] + [Join] buttons for `confirmed` status** when online
3. **Wrong [Cancel] button shown for `confirmed` status** 
4. **Missing [Edit Review] button for `completed` status** with existing reviews
5. **Unnecessary [No Meeting Link] button for `in_progress` status**

### **Provider Cards Issues:**
1. Meeting link generation not working properly
2. Status transitions may be failing

## **REQUIRED FIXES:**

1. ✅ **Fix `confirmed` status customer logic**: Remove before/after start logic, always show [Copy Link] + [Join] for online bookings
2. ✅ **Remove [Cancel] button from `confirmed` status** 
3. ✅ **Standardize meeting buttons**: Same [Copy Link] + [Join] logic for both `confirmed` and `in_progress`
4. ✅ **Add [Edit Review] button** for completed bookings with existing reviews
5. ✅ **Remove [No Meeting Link] button** from `in_progress` status
6. ✅ **Fix meeting link generation**: Added Google OAuth credentials to backend
7. **NEW: Add [Generate Meeting Link] button** for provider on confirmed/in_progress status when online booking has no meeting link
# Profile Creation Issue Fix

## Problem
When users authenticate via magic link, they get a PGRST116 error because their profile doesn't exist in the `users` table. The authentication succeeds but profile creation fails due to missing database permissions.

## Root Cause
The Supabase Row Level Security (RLS) policies are missing an INSERT policy for the `users` table. This prevents authenticated users from creating their own profiles.

## Solution

### Step 1: Fix Database Policies
Run this SQL command in your Supabase SQL Editor:

```sql
-- Fix missing INSERT policy for users table
-- This allows authenticated users to create their own profile

CREATE POLICY "Users can create their own profile" ON users 
  FOR INSERT 
  WITH CHECK (auth.uid() = id);
```

### Step 2: Create Storage Bucket
1. Go to your Supabase Dashboard
2. Navigate to **Storage** section
3. Click **"Create bucket"**
4. Name: `uploads`
5. **Make it Public**: ✅ Checked
6. Click **"Create bucket"**

### Step 3: Set Up Storage Policies
After creating the bucket, run the SQL commands from `supabase-storage-setup.sql` in your SQL Editor.

### Step 4: Verify Database Schema
Ensure your `users` table matches the expected schema. Run the complete schema from `supabase-schema.sql` if needed.

### Step 5: Test the Fix
1. Go to the auth page at http://localhost:8080/auth
2. Enter an email address and click "Continue with Email"
3. Check your email for the magic link
4. Click the magic link to authenticate
5. You should be redirected to the Discover page with your profile created

## Expected Behavior After Fix
- User authenticates successfully via magic link
- Profile is automatically created in the database
- User is redirected to the Discover page
- Edit Profile page loads with real user data
- No more PGRST116 errors

## Debug Information
If issues persist, check the browser console for detailed error messages. The AuthContext now provides:
- Detailed error logging
- Error codes and hints
- Specific messages for permission issues
- Fallback to fetch existing profiles

## Files Modified
- `src/contexts/AuthContext.tsx` - Enhanced error handling and debugging
- `fix-user-insert-policy.sql` - SQL script to fix the database policy

## Next Steps
After fixing the profile creation:
1. Connect other pages to real backend data
2. Test service creation and management
3. Implement booking functionality
4. Add file upload for avatars and service images
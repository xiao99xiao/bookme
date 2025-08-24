# Storage Bucket Setup Guide

## The Issue
You're getting `StorageApiError: Bucket not found` because the "uploads" bucket doesn't exist in your Supabase project.

## Quick Fix

### Step 1: Create the Bucket (Supabase Dashboard)
1. Go to your Supabase project dashboard
2. Click on **"Storage"** in the left sidebar
3. Click **"Create bucket"** button
4. Enter bucket details:
   - **Name**: `uploads`
   - **Public bucket**: ✅ **CHECKED** (Important!)
   - **File size limit**: Leave default (50MB) or set as needed
   - **Allowed MIME types**: Leave empty for all types
5. Click **"Create bucket"**

### Step 2: Set Up Policies (SQL Editor)
1. Go to **"SQL Editor"** in your Supabase dashboard
2. Run the commands from `supabase-storage-setup.sql`

## Alternative: Quick SQL Setup
If you prefer to do everything via SQL, you can also create the bucket programmatically, but the dashboard method is simpler and more reliable.

## Test the Fix
After creating the bucket:
1. Go to http://localhost:8080/edit-profile
2. Try uploading an avatar image
3. The upload should now work without the "Bucket not found" error

## File Organization
The bucket will organize files like this:
```
uploads/
├── {user-id}/
│   ├── avatar/
│   │   └── {timestamp}.jpg
│   ├── service_image/
│   │   └── {timestamp}.png
│   └── document/
│       └── {timestamp}.pdf
```

This ensures each user can only access their own files while keeping everything organized.
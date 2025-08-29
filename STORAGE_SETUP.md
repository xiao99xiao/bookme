# Storage Setup Guide for Timee

## Quick Fix via Supabase Dashboard

Since you're getting permission errors when trying to modify storage policies via SQL, here's how to fix it through the Supabase Dashboard:

### Step 1: Create Storage Bucket

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Navigate to **Storage** in the left sidebar
3. Click **New Bucket**
4. Configure as follows:
   - Bucket name: `uploads`
   - Public bucket: **ON** (toggle enabled)
   - File size limit: `5MB`
   - Allowed MIME types: `image/*` (or leave empty to allow all)
5. Click **Create Bucket**

### Step 2: Configure Storage Policies

1. After creating the bucket, click on it to open
2. Go to the **Policies** tab
3. Click **New Policy** and create these policies:

#### Policy 1: Public Read Access
- **Policy Name**: `Public Access`
- **Allowed operation**: `SELECT`
- **Target roles**: Leave empty or select all
- **USING expression**: `true`
- Click **Create Policy**

#### Policy 2: Allow All Uploads
- **Policy Name**: `Allow uploads` 
- **Allowed operation**: `INSERT`
- **Target roles**: Leave empty or select all
- **WITH CHECK expression**: `true`
- Click **Create Policy**

#### Policy 3: Allow Updates
- **Policy Name**: `Allow updates`
- **Allowed operation**: `UPDATE`
- **Target roles**: Leave empty or select all
- **USING expression**: `true`
- Click **Create Policy**

#### Policy 4: Allow Deletes
- **Policy Name**: `Allow deletes`
- **Allowed operation**: `DELETE`
- **Target roles**: Leave empty or select all
- **USING expression**: `true`
- Click **Create Policy**

### Step 3: Test the Upload

1. Go back to your app
2. Try uploading an avatar in the onboarding flow
3. It should work now!

## Alternative: Use Service Role Key

If you want to bypass all RLS policies, make sure you have the service role key in your `.env`:

```env
VITE_SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

You can find this in:
1. Supabase Dashboard → Settings → API
2. Copy the `service_role` key (not the `anon` key)
3. Add it to your `.env` file

The app is already configured to use the service role key when uploading files for Privy users, which bypasses all RLS policies.

## Why This Happens

The error occurs because:
1. Privy users don't have Supabase auth sessions
2. Storage RLS policies by default require authenticated Supabase users
3. The `storage.objects` table is system-owned and can't be modified directly via SQL

## Testing

After setting up, test by:
1. Creating a new account via Privy
2. Going through onboarding
3. Uploading an avatar in step 1
4. It should upload successfully and show the image

## Troubleshooting

If uploads still fail:
1. Check browser console for specific error messages
2. Verify the bucket is marked as PUBLIC
3. Ensure all 4 policies are created with `true` expressions
4. Try using an incognito window to rule out cache issues
5. Check that the service role key is properly set in `.env`
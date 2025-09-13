/**
 * Upload Routes
 * 
 * This module handles file upload endpoints including image uploads for avatars,
 * service images, and general file uploads. Supports multiple storage providers
 * and file validation with security controls.
 * 
 * Usage:
 * ```javascript
 * import uploadRoutes from './routes/uploads.js';
 * uploadRoutes(app);
 * ```
 */

import { Hono } from 'hono';
import { verifyPrivyAuth, getSupabaseAdmin } from '../middleware/auth.js';

// Get Supabase admin client
const supabaseAdmin = getSupabaseAdmin();

/**
 * Create upload routes
 * 
 * @param {Hono} app - The Hono application instance
 */
export default function uploadRoutes(app) {

  /**
   * POST /api/upload
   * 
   * Upload files to cloud storage with validation and security controls.
   * This endpoint handles various file types including images, documents,
   * and other media files with proper validation and storage management.
   * 
   * Headers:
   * - Authorization: Bearer {privyToken}
   * - Content-Type: multipart/form-data
   * 
   * Form Data:
   * - file: The file to upload (required)
   * - upload_type: Type of upload ('avatar', 'service_image', 'document', 'general')
   * - folder: Optional folder path for organization
   * - resize_options: Optional image resize parameters (JSON string)
   * 
   * Response:
   * - Upload result with file URL and metadata
   * 
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with upload data or error
   */
  app.post('/api/upload', verifyPrivyAuth, async (c) => {
    try {
      const userId = c.get('userId');
      
      // Get the form data
      const formData = await c.req.formData();
      const file = formData.get('file');
      const uploadType = formData.get('upload_type') || 'general';
      const folder = formData.get('folder') || '';
      const resizeOptionsStr = formData.get('resize_options');

      if (!file || !(file instanceof File)) {
        return c.json({ error: 'No file provided or invalid file format' }, 400);
      }

      // Validate file size (10MB limit)
      const maxFileSize = 10 * 1024 * 1024; // 10MB in bytes
      if (file.size > maxFileSize) {
        return c.json({ 
          error: 'File too large. Maximum file size is 10MB.' 
        }, 400);
      }

      // Validate file type based on upload type
      const allowedTypes = {
        avatar: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        service_image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        document: [
          'application/pdf', 
          'application/msword', 
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain'
        ],
        general: [
          'image/jpeg', 'image/png', 'image/gif', 'image/webp',
          'application/pdf', 
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain'
        ]
      };

      const allowedMimeTypes = allowedTypes[uploadType] || allowedTypes.general;
      if (!allowedMimeTypes.includes(file.type)) {
        return c.json({ 
          error: `Invalid file type. Allowed types for ${uploadType}: ${allowedMimeTypes.join(', ')}` 
        }, 400);
      }

      // Generate unique filename
      const fileExtension = file.name.split('.').pop() || '';
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 15);
      const fileName = `${uploadType}_${userId}_${timestamp}_${randomString}.${fileExtension}`;
      
      // Construct storage path
      const storagePath = folder ? `${folder}/${fileName}` : fileName;

      // Process resize options for images
      let resizeOptions = null;
      if (resizeOptionsStr) {
        try {
          resizeOptions = JSON.parse(resizeOptionsStr);
        } catch (parseError) {
          return c.json({ error: 'Invalid resize_options JSON format' }, 400);
        }
      }

      // Upload to storage (using Supabase Storage in this example)
      try {
        // Convert File to ArrayBuffer
        const fileBuffer = await file.arrayBuffer();
        const fileBytes = new Uint8Array(fileBuffer);

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
          .from('uploads') // Your storage bucket name
          .upload(storagePath, fileBytes, {
            contentType: file.type,
            duplex: 'half'
          });

        if (uploadError) {
          console.error('Storage upload error:', uploadError);
          return c.json({ error: 'Failed to upload file to storage' }, 500);
        }

        // Get public URL
        const { data: { publicUrl } } = supabaseAdmin.storage
          .from('uploads')
          .getPublicUrl(storagePath);

        // Store upload record in database
        const uploadRecord = {
          id: `upload_${timestamp}_${randomString}`,
          user_id: userId,
          file_name: file.name,
          file_size: file.size,
          file_type: file.type,
          upload_type: uploadType,
          storage_path: storagePath,
          public_url: publicUrl,
          folder: folder || null,
          metadata: {
            original_name: file.name,
            upload_timestamp: new Date().toISOString(),
            resize_options: resizeOptions,
            user_agent: c.req.header('User-Agent') || null
          },
          created_at: new Date().toISOString()
        };

        const { data: dbRecord, error: dbError } = await supabaseAdmin
          .from('file_uploads')
          .insert(uploadRecord)
          .select()
          .single();

        if (dbError) {
          console.error('Upload record creation error:', dbError);
          // Continue even if database record fails - file is already uploaded
        }

        // Update user avatar if this is an avatar upload
        if (uploadType === 'avatar') {
          try {
            await supabaseAdmin
              .from('users')
              .update({ 
                avatar: publicUrl,
                updated_at: new Date().toISOString() 
              })
              .eq('id', userId);
          } catch (avatarUpdateError) {
            console.error('Avatar update error:', avatarUpdateError);
            // Continue - upload was successful even if avatar update failed
          }
        }

        // Return success response
        return c.json({
          success: true,
          upload: {
            id: uploadRecord.id,
            file_name: file.name,
            file_size: file.size,
            file_type: file.type,
            upload_type: uploadType,
            public_url: publicUrl,
            storage_path: storagePath,
            uploaded_at: uploadRecord.created_at
          }
        });

      } catch (storageError) {
        console.error('Storage operation error:', storageError);
        return c.json({ error: 'Failed to process file upload' }, 500);
      }

    } catch (error) {
      console.error('Upload error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  // Additional helper endpoints could be added here:

  /**
   * GET /api/uploads/user
   * 
   * Get all uploads for the authenticated user.
   * This endpoint returns paginated upload history.
   * 
   * Headers:
   * - Authorization: Bearer {privyToken}
   * 
   * Query Parameters:
   * - limit: Number of uploads to return (default: 20, max: 100)
   * - offset: Pagination offset (default: 0)
   * - upload_type: Filter by upload type
   * - folder: Filter by folder
   * 
   * Response:
   * - Array of upload objects with metadata
   * 
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with uploads or error
   */
  app.get('/api/uploads/user', verifyPrivyAuth, async (c) => {
    try {
      const userId = c.get('userId');
      const { 
        limit = '20', 
        offset = '0', 
        upload_type, 
        folder 
      } = c.req.query();

      const limitNum = Math.min(parseInt(limit) || 20, 100);
      const offsetNum = Math.max(parseInt(offset) || 0, 0);

      let query = supabaseAdmin
        .from('file_uploads')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offsetNum, offsetNum + limitNum - 1);

      if (upload_type) {
        query = query.eq('upload_type', upload_type);
      }

      if (folder) {
        query = query.eq('folder', folder);
      }

      const { data: uploads, error: uploadsError } = await query;

      if (uploadsError) {
        console.error('Uploads fetch error:', uploadsError);
        return c.json({ error: 'Failed to fetch uploads' }, 500);
      }

      return c.json({
        uploads: uploads || [],
        pagination: {
          limit: limitNum,
          offset: offsetNum,
          has_more: (uploads?.length || 0) === limitNum
        }
      });

    } catch (error) {
      console.error('User uploads fetch error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  /**
   * DELETE /api/uploads/:uploadId
   * 
   * Delete an uploaded file and its record.
   * This endpoint removes files from storage and database.
   * 
   * Headers:
   * - Authorization: Bearer {privyToken}
   * 
   * Parameters:
   * - uploadId: ID of the upload to delete
   * 
   * Response:
   * - Success confirmation
   * 
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with success status or error
   */
  app.delete('/api/uploads/:uploadId', verifyPrivyAuth, async (c) => {
    try {
      const userId = c.get('userId');
      const uploadId = c.req.param('uploadId');

      // Get upload record to verify ownership
      const { data: upload, error: uploadError } = await supabaseAdmin
        .from('file_uploads')
        .select('*')
        .eq('id', uploadId)
        .eq('user_id', userId)
        .single();

      if (uploadError || !upload) {
        console.error('Upload fetch error:', uploadError);
        return c.json({ error: 'Upload not found' }, 404);
      }

      // Delete from storage
      if (upload.storage_path) {
        try {
          const { error: storageDeleteError } = await supabaseAdmin.storage
            .from('uploads')
            .remove([upload.storage_path]);

          if (storageDeleteError) {
            console.error('Storage deletion error:', storageDeleteError);
            // Continue with database deletion even if storage deletion fails
          }
        } catch (storageError) {
          console.error('Storage deletion error:', storageError);
        }
      }

      // Delete database record
      const { error: dbDeleteError } = await supabaseAdmin
        .from('file_uploads')
        .delete()
        .eq('id', uploadId)
        .eq('user_id', userId);

      if (dbDeleteError) {
        console.error('Upload record deletion error:', dbDeleteError);
        return c.json({ error: 'Failed to delete upload record' }, 500);
      }

      return c.json({ 
        success: true,
        message: 'Upload deleted successfully' 
      });

    } catch (error) {
      console.error('Upload deletion error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });
}
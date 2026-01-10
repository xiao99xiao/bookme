/**
 * Cloudflare R2 Storage Client
 *
 * Provides S3-compatible storage operations using Cloudflare R2.
 * API is designed to be compatible with Supabase Storage for easy migration.
 */

import { S3Client, PutObjectCommand, DeleteObjectsCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import dotenv from 'dotenv'

dotenv.config({ path: '.env' })

// R2 Configuration
const R2_ENDPOINT = process.env.R2_ENDPOINT
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY
const R2_BUCKET = process.env.R2_BUCKET || 'bookme-uploads'
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL

// Check if R2 is configured
const isR2Configured = !!(R2_ENDPOINT && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY)

// Create S3 client for R2 (only if configured)
let s3Client = null
if (isR2Configured) {
  s3Client = new S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  })
  console.log('✅ R2 Storage client initialized')
} else {
  console.warn('⚠️ R2 Storage not configured - file uploads will not work')
  console.warn('   Set R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY in .env')
}

/**
 * Storage Bucket Client
 * Provides Supabase-compatible storage API using R2
 */
class StorageBucketClient {
  constructor(bucketName) {
    this.bucketName = bucketName
  }

  /**
   * Upload a file to R2
   *
   * @param {string} path - The file path within the bucket
   * @param {Buffer|Uint8Array|string} data - The file data
   * @param {Object} options - Upload options
   * @param {string} options.contentType - MIME type of the file
   * @returns {Promise<{data: {path: string}, error: Error|null}>}
   */
  async upload(path, data, options = {}) {
    if (!isR2Configured) {
      console.error('❌ R2 Storage not configured')
      return {
        data: null,
        error: new Error('R2 Storage not configured. Please set R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY in .env')
      }
    }

    try {
      // Ensure path doesn't start with /
      const cleanPath = path.startsWith('/') ? path.slice(1) : path

      // Convert data to Buffer if needed
      let bodyData = data
      if (data instanceof Uint8Array) {
        bodyData = Buffer.from(data)
      }

      const command = new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: cleanPath,
        Body: bodyData,
        ContentType: options.contentType || 'application/octet-stream',
      })

      await s3Client.send(command)

      console.log(`✅ Uploaded file to R2: ${cleanPath}`)

      return {
        data: { path: cleanPath },
        error: null
      }
    } catch (error) {
      console.error('❌ R2 upload error:', error)
      return {
        data: null,
        error: error
      }
    }
  }

  /**
   * Remove files from R2
   *
   * @param {string[]} paths - Array of file paths to delete
   * @returns {Promise<{data: null, error: Error|null}>}
   */
  async remove(paths) {
    if (!isR2Configured) {
      console.error('❌ R2 Storage not configured')
      return {
        data: null,
        error: new Error('R2 Storage not configured')
      }
    }

    try {
      // Ensure paths don't start with /
      const cleanPaths = paths.map(p => p.startsWith('/') ? p.slice(1) : p)

      const command = new DeleteObjectsCommand({
        Bucket: R2_BUCKET,
        Delete: {
          Objects: cleanPaths.map(path => ({ Key: path })),
          Quiet: true
        }
      })

      await s3Client.send(command)

      console.log(`✅ Deleted ${cleanPaths.length} file(s) from R2`)

      return {
        data: null,
        error: null
      }
    } catch (error) {
      console.error('❌ R2 delete error:', error)
      return {
        data: null,
        error: error
      }
    }
  }

  /**
   * Check if a file exists in R2
   *
   * @param {string} path - The file path to check
   * @returns {Promise<boolean>}
   */
  async exists(path) {
    if (!isR2Configured) {
      return false
    }

    try {
      const cleanPath = path.startsWith('/') ? path.slice(1) : path

      const command = new HeadObjectCommand({
        Bucket: R2_BUCKET,
        Key: cleanPath
      })

      await s3Client.send(command)
      return true
    } catch (error) {
      if (error.name === 'NotFound') {
        return false
      }
      throw error
    }
  }

  /**
   * Get the public URL for a file
   *
   * @param {string} path - The file path
   * @returns {{data: {publicUrl: string}}}
   */
  getPublicUrl(path) {
    const cleanPath = path.startsWith('/') ? path.slice(1) : path

    // Use R2 public URL if configured, otherwise construct from endpoint
    let publicUrl
    if (R2_PUBLIC_URL) {
      publicUrl = `${R2_PUBLIC_URL}/${cleanPath}`
    } else if (R2_ENDPOINT) {
      // For development/testing, construct URL from endpoint
      // Note: This requires the bucket to be publicly accessible
      publicUrl = `${R2_ENDPOINT}/${R2_BUCKET}/${cleanPath}`
    } else {
      publicUrl = `https://placeholder.r2.dev/${this.bucketName}/${cleanPath}`
    }

    return {
      data: { publicUrl }
    }
  }

  /**
   * Download a file from R2
   * Note: For public files, use getPublicUrl() instead
   *
   * @param {string} path - The file path
   * @returns {Promise<{data: Buffer|null, error: Error|null}>}
   */
  async download(path) {
    if (!isR2Configured) {
      return {
        data: null,
        error: new Error('R2 Storage not configured')
      }
    }

    try {
      const cleanPath = path.startsWith('/') ? path.slice(1) : path

      // For public R2 buckets, we can fetch directly from the public URL
      const { data: { publicUrl } } = this.getPublicUrl(cleanPath)

      const response = await fetch(publicUrl)
      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.status}`)
      }

      const buffer = Buffer.from(await response.arrayBuffer())

      return {
        data: buffer,
        error: null
      }
    } catch (error) {
      console.error('❌ R2 download error:', error)
      return {
        data: null,
        error: error
      }
    }
  }
}

/**
 * Main Storage Client
 * Provides .from() method for bucket selection
 */
export const storage = {
  from: (bucketName) => new StorageBucketClient(bucketName),

  // Expose configuration status
  isConfigured: isR2Configured,

  // Expose bucket name for reference
  defaultBucket: R2_BUCKET,

  // Get public URL base
  getPublicUrlBase: () => R2_PUBLIC_URL || R2_ENDPOINT
}

export default storage

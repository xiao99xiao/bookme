/**
 * Database Client for Backend-Cron
 *
 * Re-exports the database client from the main backend service.
 * This ensures both services use the same database layer.
 */

import db from '../../backend/src/supabase-compat.js'

// Export as supabaseAdmin for compatibility with existing code
export const supabaseAdmin = db

export default db

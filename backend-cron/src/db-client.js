/**
 * Database Client for Backend-Cron
 *
 * Re-exports the database client from the main backend service.
 * This ensures both services use the same database layer.
 * Connects to Railway PostgreSQL.
 */

import db from '../../backend/src/db-compat.js'

// Export as dbClient for use in booking-automation.js
export const dbClient = db

export default db

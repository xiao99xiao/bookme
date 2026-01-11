/**
 * Scheduled Tasks Module
 *
 * Handles periodic background tasks like cleaning up expired data.
 * Tasks run on intervals and are designed to be lightweight and non-blocking.
 */

import { getSupabaseAdmin } from "./middleware/auth.js";

// Get Supabase admin client
const supabaseAdmin = getSupabaseAdmin();

/**
 * Clean up expired reschedule requests
 * Marks pending requests as 'expired' if their expires_at time has passed
 *
 * @returns {Promise<number>} Number of expired requests updated
 */
async function cleanupExpiredRescheduleRequests() {
  try {
    const now = new Date().toISOString();

    // Find and update expired pending requests
    const { data: expiredRequests, error } = await supabaseAdmin
      .from("reschedule_requests")
      .update({
        status: 'expired',
        updated_at: now
      })
      .eq("status", "pending")
      .lt("expires_at", now)
      .select("id");

    if (error) {
      console.error("❌ Error cleaning up expired reschedule requests:", error);
      return 0;
    }

    const count = expiredRequests?.length || 0;
    if (count > 0) {
      console.log(`🧹 Cleaned up ${count} expired reschedule request(s)`);
    }

    return count;
  } catch (error) {
    console.error("❌ Error in cleanupExpiredRescheduleRequests:", error);
    return 0;
  }
}

/**
 * Run all cleanup tasks
 * Called periodically to maintain data hygiene
 */
async function runCleanupTasks() {
  console.log("🔄 Running scheduled cleanup tasks...");

  const results = await Promise.allSettled([
    cleanupExpiredRescheduleRequests(),
    // Add more cleanup tasks here as needed
  ]);

  const rescheduleCleanupResult = results[0];
  if (rescheduleCleanupResult.status === 'fulfilled') {
    // Count is already logged in the function
  } else {
    console.error("❌ Reschedule cleanup failed:", rescheduleCleanupResult.reason);
  }
}

/**
 * Setup scheduled tasks with configurable intervals
 *
 * @param {Object} options - Configuration options
 * @param {number} options.cleanupInterval - Interval for cleanup tasks in ms (default: 5 minutes)
 * @returns {Object} Object containing interval IDs for cleanup
 */
export function setupScheduledTasks(options = {}) {
  const {
    cleanupInterval = 5 * 60 * 1000, // 5 minutes default
  } = options;

  console.log(`⏰ Setting up scheduled tasks (cleanup interval: ${cleanupInterval / 1000}s)`);

  // Run cleanup immediately on startup
  runCleanupTasks();

  // Setup recurring cleanup
  const cleanupIntervalId = setInterval(runCleanupTasks, cleanupInterval);

  // Clean up on process exit
  process.on("beforeExit", () => {
    clearInterval(cleanupIntervalId);
    console.log("🔚 Scheduled tasks stopped");
  });

  console.log("✅ Scheduled tasks initialized");

  return {
    cleanupIntervalId,
  };
}

// Export individual functions for testing
export {
  cleanupExpiredRescheduleRequests,
  runCleanupTasks,
};

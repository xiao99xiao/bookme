/**
 * Server Configuration Module
 * 
 * Extracted from index.js for better modularity and maintainability.
 * Handles process-level error handlers, graceful shutdown, memory monitoring,
 * and server startup logging.
 * 
 * @extracted 2025-09-13
 */

import dotenv from "dotenv";

/**
 * Load environment variables from .env file
 */
export function loadEnvironmentConfig() {
  dotenv.config({ path: ".env" });
  console.log("✅ Environment variables loaded");
}

/**
 * Setup critical process-level error handlers to catch silent crashes
 * Prevents undefined behavior and provides detailed error logging
 */
export function setupProcessErrorHandlers() {
  // CRITICAL: Add process-level error handlers to catch silent crashes
  process.on("uncaughtException", (err) => {
    console.error("❌❌❌ UNCAUGHT EXCEPTION - SERVER WILL CRASH ❌❌❌");
    console.error("Error:", err);
    console.error("Stack:", err.stack);
    console.error("Time:", new Date().toISOString());
    // Log and exit to prevent undefined behavior
    process.exit(1);
  });

  process.on("unhandledRejection", (reason, promise) => {
    console.error("❌❌❌ UNHANDLED PROMISE REJECTION ❌❌❌");
    console.error("Reason:", reason);
    console.error("Promise:", promise);
    console.error("Time:", new Date().toISOString());
    // Convert to exception
    throw reason;
  });

  process.on("warning", (warning) => {
    console.warn("⚠️ Process Warning:", warning.name);
    console.warn("Message:", warning.message);
    console.warn("Stack:", warning.stack);
  });

  console.log("✅ Process error handlers installed");
}

/**
 * Setup graceful shutdown handlers for process termination signals
 */
export function setupGracefulShutdown() {
  // Monitor process exit
  process.on("exit", (code) => {
    console.log(
      `💀 Process exiting with code: ${code} at ${new Date().toISOString()}`,
    );
  });

  process.on("SIGTERM", () => {
    console.log("📛 SIGTERM received, shutting down gracefully...");
    process.exit(0);
  });

  process.on("SIGINT", () => {
    console.log("📛 SIGINT received, shutting down gracefully...");
    process.exit(0);
  });

  console.log("✅ Graceful shutdown handlers installed");
}

/**
 * Log process startup information
 */
export function logProcessInfo() {
  console.log(`📍 Process started at: ${new Date().toISOString()}`);
  console.log(`📍 Node version: ${process.version}`);
  console.log(`📍 PID: ${process.pid}`);
}

/**
 * Log environment variable status for debugging
 */
export function debugEnvironmentVariables() {
  console.log("Privy App ID:", process.env.PRIVY_APP_ID ? "Set" : "Not set");
  console.log(
    "Privy App Secret:",
    process.env.PRIVY_APP_SECRET ? "Set" : "Not set",
  );
}

/**
 * Setup heartbeat monitoring with memory leak detection
 * @param {number} interval - Heartbeat interval in milliseconds (default: 10000)
 * @returns {NodeJS.Timeout} Heartbeat interval ID
 */
export function setupHeartbeatMonitoring(interval = 10000) {
  let heartbeatCount = 0;
  
  const heartbeatInterval = setInterval(() => {
    heartbeatCount++;
    const uptime = Math.floor(process.uptime());
    const memory = process.memoryUsage();
    console.log(
      `💓 Heartbeat #${heartbeatCount} - Uptime: ${uptime}s - Memory: RSS ${Math.round(memory.rss / 1024 / 1024)}MB, Heap ${Math.round(memory.heapUsed / 1024 / 1024)}MB/${Math.round(memory.heapTotal / 1024 / 1024)}MB - Time: ${new Date().toISOString()}`,
    );

    // Check for memory leaks
    if (memory.heapUsed / memory.heapTotal > 0.9) {
      console.warn("⚠️ High memory usage detected (>90% heap)");
    }
  }, interval);

  // Clean up on exit
  process.on("beforeExit", () => {
    clearInterval(heartbeatInterval);
    console.log("🔚 Server shutting down, clearing intervals...");
  });

  console.log(`✅ Heartbeat monitoring started (interval: ${interval}ms)`);
  return heartbeatInterval;
}

/**
 * Complete server setup - configure all server-level settings
 * This is the main function to call from the main application
 */
export function setupServer() {
  loadEnvironmentConfig();
  setupProcessErrorHandlers();
  setupGracefulShutdown();
  logProcessInfo();
  debugEnvironmentVariables();
}
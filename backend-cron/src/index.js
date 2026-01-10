#!/usr/bin/env node
/**
 * Nook Cron Service
 * Railway cron job for booking automation
 * 
 * This service runs on Railway's cron schedule every 15 minutes
 * It handles:
 * - Booking status transitions (confirmed → in_progress → completed)
 * - Upcoming booking reminders (placeholder)
 * 
 * IMPORTANT: This service must exit after completion for Railway cron to work properly
 */

import { updateBookingStatuses } from './booking-automation.js';

async function main() {
  console.log('🚀 Nook Cron Service Starting...');
  console.log('📅 Execution time:', new Date().toISOString());
  
  try {
    // Run the booking automation
    const result = await updateBookingStatuses();
    
    console.log('✅ Cron job completed successfully');
    console.log('📊 Results:', JSON.stringify(result, null, 2));
    
    // Exit successfully - REQUIRED for Railway cron
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Cron job failed:', error);
    console.error('Stack trace:', error.stack);
    
    // Exit with error code - Railway will log this as failed execution
    process.exit(1);
  }
}

// Handle process signals gracefully
process.on('SIGTERM', () => {
  console.log('📡 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📡 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Promise Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Start the cron job
main();
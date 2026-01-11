/**
 * Blockchain Configuration Module
 * 
 * Extracted from index.js for better modularity and maintainability.
 * Handles blockchain service initialization, event monitoring setup,
 * and environment-based configuration management.
 * 
 * @extracted 2025-09-13
 */

import { getDb } from "../middleware/auth.js";
import BlockchainService from "../blockchain-service.js";
import EIP712Signer from "../eip712-signer.js";
import BlockchainEventMonitor from "../event-monitor.js";

// Global instances
let blockchainService;
let eip712Signer;
let eventMonitor;

/**
 * Initialize blockchain services
 * Creates instances of blockchain service, EIP712 signer, and event monitor
 */
export function initializeBlockchainServices() {
  console.log("🔗 Initializing blockchain services...");
  
  // Initialize blockchain services
  blockchainService = new BlockchainService();
  eip712Signer = new EIP712Signer();
  
  // Test blockchain connection on startup
  blockchainService.testConnection().then((result) => {
    if (result.success) {
      console.log("✅ Blockchain connection successful");
    } else {
      console.error("❌ Blockchain connection failed:", result.error);
    }
  });

  // Initialize database client for event monitoring
  const db = getDb();

  // Initialize blockchain event monitor
  eventMonitor = new BlockchainEventMonitor(db);
  
  console.log("✅ Blockchain services initialized");
}

/**
 * Start blockchain event monitoring based on environment configuration
 * Monitors in production or when explicitly enabled via environment variable
 */
export function startBlockchainMonitoring() {
  if (!eventMonitor) {
    console.error("❌ Event monitor not initialized. Call initializeBlockchainServices() first.");
    return;
  }

  // Start event monitoring in production or when explicitly enabled
  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_BLOCKCHAIN_MONITORING === 'true') {
    eventMonitor.startMonitoring().then(() => {
      console.log('🚀 Blockchain event monitoring started');
    }).catch(error => {
      console.error('❌ Failed to start blockchain event monitoring:', error);
    });
  } else {
    console.log('⏸️ Blockchain event monitoring disabled (set ENABLE_BLOCKCHAIN_MONITORING=true to enable)');
  }
  
  // Test mode logging - can be removed if not needed
  console.log('🧪 TEST MODE: Blockchain event monitoring ENABLED for memory comparison');
}

/**
 * Get initialized blockchain service instance
 * @returns {BlockchainService} Blockchain service instance
 */
export function getBlockchainService() {
  if (!blockchainService) {
    throw new Error("Blockchain service not initialized. Call initializeBlockchainServices() first.");
  }
  return blockchainService;
}

/**
 * Get initialized EIP712 signer instance
 * @returns {EIP712Signer} EIP712 signer instance
 */
export function getEIP712Signer() {
  if (!eip712Signer) {
    throw new Error("EIP712 signer not initialized. Call initializeBlockchainServices() first.");
  }
  return eip712Signer;
}

/**
 * Get initialized event monitor instance
 * @returns {BlockchainEventMonitor} Event monitor instance
 */
export function getEventMonitor() {
  if (!eventMonitor) {
    throw new Error("Event monitor not initialized. Call initializeBlockchainServices() first.");
  }
  return eventMonitor;
}

/**
 * Complete blockchain setup - initialize services and start monitoring
 * This is the main function to call from the main application
 */
export function setupBlockchain() {
  initializeBlockchainServices();
  startBlockchainMonitoring();
}
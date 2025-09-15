import { ethers } from "ethers";
import Redis from "ioredis";
import dotenv from "dotenv";
import contractABI from "./contract-abi.json" with { type: "json" };
import { deleteMeetingForBooking } from "./meeting-generation.js";

// Load environment variables
dotenv.config();

class BlockchainEventMonitor {
  constructor(supabaseAdmin) {
    this.supabaseAdmin = supabaseAdmin;
    this.CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
    this.RPC_URL = process.env.BLOCKCHAIN_RPC_URL;
    this.WEBSOCKET_URL = process.env.BLOCKCHAIN_WEBSOCKET_URL;
    this.REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

    // Lazy initialization - don't create connections until monitoring starts
    this.provider = null;
    this.contract = null;
    this.redis = null;
    this.subscriber = null;
    this.publisher = null;

    // Event processing state
    this.isMonitoring = false;
    this.eventQueue = "blockchain-events";
    this.eventNotificationChannel = "blockchain-event-added";
    this.processedEvents = new Set();
    this.maxProcessedEvents = 1000; // Prevent unbounded growth

    // Connection management
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;

    // Resource cleanup tracking
    this.intervals = [];
    this.timeouts = [];
    this.abortController = null;

    console.log("📡 Blockchain Event Monitor initialized (lazy loading)");
    console.log("Contract Address:", this.CONTRACT_ADDRESS);
    console.log("RPC URL:", this.RPC_URL);
    console.log("Redis URL:", this.REDIS_URL);
  }

  /**
   * Initialize all connections (called when monitoring starts)
   */
  async initializeConnections() {
    console.log("🔧 Initializing blockchain monitoring connections...");

    // Initialize Redis connections
    await this.initializeRedis();

    // Initialize blockchain connections
    await this.initializeBlockchain();

    console.log("✅ All connections initialized");
  }

  /**
   * Initialize Redis connections with pub/sub
   */
  async initializeRedis() {
    if (this.redis) return; // Already initialized

    const redisConfig = {
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      retryStrategy: (times) => {
        if (times > 10) {
          console.error("❌ Redis connection failed after 10 attempts");
          return undefined;
        }
        const delay = Math.min(times * 2000, 10000);
        console.log(`🔄 Redis reconnecting in ${delay}ms (attempt ${times})...`);
        return delay;
      },
    };

    // Main Redis connection for queue operations
    this.redis = new Redis(this.REDIS_URL, redisConfig);

    // Separate connections for pub/sub (Redis best practice)
    this.subscriber = new Redis(this.REDIS_URL, redisConfig);
    this.publisher = new Redis(this.REDIS_URL, redisConfig);

    // Set up Redis event handlers
    this.redis.on("error", (error) => {
      console.error("❌ Redis error:", error.message);
    });

    this.redis.on("connect", () => {
      console.log("✅ Redis main connection established");
    });

    this.subscriber.on("connect", () => {
      console.log("✅ Redis subscriber connection established");
    });

    this.publisher.on("connect", () => {
      console.log("✅ Redis publisher connection established");
    });

    // Connect all Redis instances
    await Promise.all([
      this.redis.connect(),
      this.subscriber.connect(),
      this.publisher.connect(),
    ]);
  }

  /**
   * Initialize blockchain provider and contract
   */
  async initializeBlockchain() {
    if (this.provider) return; // Already initialized

    // Create WebSocket provider for real-time events
    if (this.WEBSOCKET_URL) {
      this.provider = new ethers.WebSocketProvider(this.WEBSOCKET_URL);
      console.log("✅ WebSocket provider created for real-time events");
    } else {
      this.provider = new ethers.JsonRpcProvider(this.RPC_URL);
      console.log("✅ HTTP provider created (WebSocket URL not provided)");
    }

    // Create contract instance
    this.contract = new ethers.Contract(
      this.CONTRACT_ADDRESS,
      contractABI,
      this.provider,
    );

    console.log("✅ Blockchain contract instance created");
  }

  /**
   * Start monitoring blockchain events
   */
  async startMonitoring() {
    if (this.isMonitoring) {
      console.log("⚠️ Event monitoring already running");
      return;
    }

    try {
      console.log("🚀 Starting memory-optimized blockchain event monitoring...");

      // Initialize all connections
      await this.initializeConnections();

      this.isMonitoring = true;
      this.abortController = new AbortController();

      // Set up event-driven processing (replaces polling loop)
      await this.setupEventDrivenProcessing();

      // Set up blockchain event listeners
      this.setupBlockchainEventListeners();

      // Set up periodic cleanup
      this.setupPeriodicCleanup();

      console.log("✅ Memory-optimized blockchain event monitoring started");
    } catch (error) {
      console.error("❌ Failed to start event monitoring:", error);
      this.isMonitoring = false;
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Set up event-driven processing (replaces polling loop)
   */
  async setupEventDrivenProcessing() {
    // Subscribe to event notifications
    await this.subscriber.subscribe(this.eventNotificationChannel);

    this.subscriber.on("message", async (channel, message) => {
      if (channel === this.eventNotificationChannel && this.isMonitoring) {
        // Process events only when notified (no polling)
        await this.processQueueBatch();
      }
    });

    console.log("✅ Event-driven processing setup complete (no polling)");
  }

  /**
   * Process events in batches to reduce Redis overhead
   */
  async processQueueBatch() {
    if (!this.isMonitoring) return;

    try {
      const batchSize = 5; // Small batches to control memory
      const events = [];

      // Get batch of events (non-blocking)
      for (let i = 0; i < batchSize; i++) {
        const eventJson = await this.redis.rpop(this.eventQueue);
        if (!eventJson) break;
        events.push(JSON.parse(eventJson));
      }

      if (events.length > 0) {
        console.log(`📦 Processing batch of ${events.length} events`);
        
        // Process sequentially to control memory usage
        for (const eventData of events) {
          await this.processEvent(eventData);
        }
        
        console.log(`✅ Completed processing batch of ${events.length} events`);
      }
    } catch (error) {
      console.error("❌ Error processing event batch:", error);
    }
  }

  /**
   * Set up periodic cleanup to prevent memory leaks
   */
  setupPeriodicCleanup() {
    // Clean up processed events set every 5 minutes
    const cleanupInterval = setInterval(() => {
      if (!this.isMonitoring) {
        clearInterval(cleanupInterval);
        return;
      }

      if (this.processedEvents.size > this.maxProcessedEvents) {
        // Keep only recent events to prevent unbounded growth
        const recent = Array.from(this.processedEvents).slice(-500);
        this.processedEvents.clear();
        recent.forEach(event => this.processedEvents.add(event));
        
        console.log(`🧹 Cleaned up processed events cache (kept ${recent.length} recent entries)`);
      }
    }, 300000); // Every 5 minutes

    this.intervals.push(cleanupInterval);
  }

  /**
   * Set up blockchain event listeners
   */
  setupBlockchainEventListeners() {
    // Set up WebSocket error handling
    if (this.provider && this.provider._websocket) {
      this.provider._websocket.on("error", (error) => {
        console.error("❌ WebSocket error:", error);
        if (this.isMonitoring) {
          this.scheduleReconnect();
        }
      });

      this.provider._websocket.on("close", () => {
        console.log("⚠️ WebSocket connection closed");
        if (this.isMonitoring) {
          this.scheduleReconnect();
        }
      });
    }

    // Listen for BookingCreatedAndPaid events
    this.contract.on(
      "BookingCreatedAndPaid",
      async (bookingId, customer, provider, inviter, amount, platformFeeRate, inviterFeeRate, event) => {
        await this.queueEvent({
          type: "BookingCreatedAndPaid",
          bookingId,
          customer,
          provider,
          inviter,
          amount: amount.toString(),
          platformFeeRate: platformFeeRate.toString(),
          inviterFeeRate: inviterFeeRate.toString(),
          transactionHash: event.transactionHash || event.log?.transactionHash,
          timestamp: Date.now(),
        });
      },
    );

    // Listen for ServiceCompleted events
    this.contract.on(
      "ServiceCompleted",
      async (bookingId, provider, providerAmount, platformFee, inviterFee, event) => {
        await this.queueEvent({
          type: "ServiceCompleted",
          bookingId,
          provider,
          providerAmount: providerAmount.toString(),
          platformFee: platformFee.toString(),
          inviterFee: inviterFee.toString(),
          transactionHash: event.transactionHash || event.log?.transactionHash,
          timestamp: Date.now(),
        });
      },
    );

    // Listen for BookingCancelled events
    this.contract.on(
      "BookingCancelled",
      async (bookingId, cancelledBy, customerAmount, providerAmount, platformAmount, inviterAmount, reason, event) => {
        await this.queueEvent({
          type: "BookingCancelled",
          bookingId,
          cancelledBy,
          customerAmount: customerAmount.toString(),
          providerAmount: providerAmount.toString(),
          platformAmount: platformAmount.toString(),
          inviterAmount: inviterAmount.toString(),
          reason,
          transactionHash: event.transactionHash || event.log?.transactionHash,
          timestamp: Date.now(),
        });
      },
    );

    console.log("👂 Blockchain event listeners set up for all contract events");
  }

  /**
   * Stop monitoring blockchain events
   */
  async stopMonitoring() {
    console.log("🛑 Stopping memory-optimized blockchain event monitoring...");
    this.isMonitoring = false;

    // Signal all operations to stop
    if (this.abortController) {
      this.abortController.abort();
    }

    // Clean up all resources
    await this.cleanup();

    console.log("✅ Memory-optimized event monitoring stopped");
  }

  /**
   * Schedule WebSocket reconnection with exponential backoff
   */
  scheduleReconnect() {
    if (!this.isMonitoring) return;
    
    const delay = Math.min(5000 * Math.pow(2, this.reconnectAttempts), 30000); // Max 30 seconds
    console.log(`🔄 Scheduling WebSocket reconnection in ${delay}ms...`);
    
    const timeout = setTimeout(async () => {
      if (this.isMonitoring) {
        await this.handleWebSocketReconnect();
      }
    }, delay);
    
    this.timeouts.push(timeout);
  }

  /**
   * Queue an event for processing with pub/sub notification
   */
  async queueEvent(eventData) {
    try {
      const eventKey = `${eventData.transactionHash}-${eventData.logIndex || 'no-index'}`;

      // Check if we've already processed this event
      if (this.processedEvents.has(eventKey)) {
        console.log("⏭️ Event already processed, skipping:", eventKey);
        return;
      }

      // Add to Redis queue
      if (this.redis && this.redis.status === "ready") {
        await this.redis.lpush(this.eventQueue, JSON.stringify(eventData));
        
        // Notify event processor (replaces polling)
        if (this.publisher && this.publisher.status === "ready") {
          await this.publisher.publish(this.eventNotificationChannel, "1");
        }
        
        console.log(
          "📥 Queued blockchain event:",
          eventData.type,
          "for booking:",
          eventData.bookingId,
        );
      } else {
        console.warn(
          "⚠️ Redis not available, event not queued:",
          eventData.type,
        );
      }
    } catch (error) {
      console.error("❌ Error queuing event:", error.message);
      // Don't throw - prevent crash
    }
  }

  /**
   * Clean up all resources
   */
  async cleanup() {
    console.log("🧹 Cleaning up blockchain monitoring resources...");

    // Clear all intervals and timeouts
    this.intervals.forEach(clearInterval);
    this.timeouts.forEach(clearTimeout);
    this.intervals = [];
    this.timeouts = [];

    // Remove blockchain event listeners
    if (this.contract) {
      this.contract.removeAllListeners();
    }

    // Close Redis connections
    const connections = [this.redis, this.subscriber, this.publisher];
    await Promise.all(connections.map(async (conn) => {
      if (conn && conn.status !== 'end') {
        try {
          await conn.quit();
        } catch (error) {
          console.warn("⚠️ Error closing Redis connection:", error.message);
        }
      }
    }));

    // Close WebSocket provider
    if (this.provider && !this.provider.destroyed) {
      try {
        await this.provider.destroy();
      } catch (error) {
        console.warn("⚠️ Error closing WebSocket provider:", error.message);
      }
    }

    // Clear references
    this.redis = null;
    this.subscriber = null;
    this.publisher = null;
    this.provider = null;
    this.contract = null;
    this.abortController = null;

    // Clear processed events set
    this.processedEvents.clear();
    this.reconnectAttempts = 0;

    console.log("✅ Blockchain monitoring resources cleaned up");
  }

  /**
   * Process a single blockchain event
   */
  async processEvent(eventData) {
    const eventKey = `${eventData.transactionHash}-${eventData.logIndex || 'no-index'}`;

    try {
      console.log(
        "⚡ Processing event:",
        eventData.type,
        "for booking:",
        eventData.bookingId,
      );

      // Mark as processed
      this.processedEvents.add(eventKey);

      // Store event in database
      await this.storeEvent(eventData);

      // Process specific event type
      switch (eventData.type) {
        case "BookingCreatedAndPaid":
          await this.handleBookingPaid(eventData);
          break;
        case "ServiceCompleted":
          await this.handleServiceCompleted(eventData);
          break;
        case "BookingCancelled":
          await this.handleBookingCancelled(eventData);
          break;
        default:
          console.log("❓ Unknown event type:", eventData.type);
      }

      console.log("✅ Successfully processed event:", eventKey);
    } catch (error) {
      console.error("❌ Error processing event:", eventKey, error);

      // Store failed event for manual review
      await this.storeFailedEvent(eventData, error.message);

      // Remove from processed set so it can be retried
      this.processedEvents.delete(eventKey);
    }
  }

  /**
   * Store blockchain event in database
   */
  async storeEvent(eventData) {
    // Ensure we have a transaction hash or use a placeholder
    const txHash = eventData.transactionHash || "unknown";

    const { error } = await this.supabaseAdmin
      .from("blockchain_events")
      .upsert({
        event_type: eventData.type,
        transaction_hash: txHash,
        booking_id: eventData.bookingId,
        event_data: eventData,
        processing_status: "PROCESSED",
      });

    if (error) {
      console.error("❌ Error storing blockchain event:", error);
      throw error;
    }
  }

  /**
   * Store failed event for manual review
   */
  async storeFailedEvent(eventData, errorMessage) {
    await this.supabaseAdmin.from("blockchain_events").upsert({
      event_type: eventData.type,
      transaction_hash: eventData.transactionHash,
      booking_id: eventData.bookingId,
      event_data: eventData,
      processing_status: "FAILED",
      error_message: errorMessage,
    });
  }

  /**
   * Handle BookingCreatedAndPaid event
   */
  async handleBookingPaid(eventData) {
    // Find booking by blockchain_booking_id
    const { data: booking, error } = await this.supabaseAdmin
      .from("bookings")
      .select()
      .eq("blockchain_booking_id", eventData.bookingId)
      .single();

    if (error || !booking) {
      console.error(
        "⚠️ Booking not found for blockchain event:",
        eventData.bookingId,
      );
      throw new Error(`Booking not found: ${eventData.bookingId}`);
    }

    // Update booking with payment information
    const { error: updateError } = await this.supabaseAdmin
      .from("bookings")
      .update({
        status: "paid",
        blockchain_tx_hash: eventData.transactionHash,
        blockchain_confirmed_at: new Date().toISOString(),
        blockchain_data: {
          amount: eventData.amount,
          platformFeeRate: eventData.platformFeeRate,
          inviterFeeRate: eventData.inviterFeeRate,
          customer: eventData.customer,
          provider: eventData.provider,
          inviter: eventData.inviter,
        },
      })
      .eq("id", booking.id);

    if (updateError) {
      throw updateError;
    }

    console.log("💰 Updated booking payment status:", booking.id);
  }

  /**
   * Handle ServiceCompleted event
   */
  async handleServiceCompleted(eventData) {
    // Find booking by blockchain_booking_id with related data
    const { data: booking, error } = await this.supabaseAdmin
      .from("bookings")
      .select(`
        *,
        services!inner(id, title),
        users!bookings_customer_id_fkey(display_name, email)
      `)
      .eq("blockchain_booking_id", eventData.bookingId)
      .single();

    if (error || !booking) {
      console.error(
        "⚠️ Booking not found for completion event:",
        eventData.bookingId,
      );
      throw new Error(`Booking not found: ${eventData.bookingId}`);
    }

    // Update booking to completed
    const { error: updateError } = await this.supabaseAdmin
      .from("bookings")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        completion_tx_hash: eventData.transactionHash,
      })
      .eq("id", booking.id);

    if (updateError) {
      throw updateError;
    }

    // Calculate net amount received by provider
    const netAmount = parseFloat(ethers.formatUnits(eventData.providerAmount, 6));

    // Get customer name and service title for description
    const customerName = booking.users.display_name || booking.users.email?.split('@')[0] || 'Unknown Customer';
    const serviceTitle = booking.services.title;
    const description = `${serviceTitle}`;

    // Create transaction record using new schema
    const { error: transactionError } = await this.supabaseAdmin
      .from("transactions")
      .insert({
        provider_id: booking.provider_id,
        type: 'booking_payment',
        amount: netAmount,
        booking_id: booking.id,
        source_user_id: booking.customer_id,
        service_id: booking.service_id,
        description: description,
        transaction_hash: eventData.transactionHash,
      });

    if (transactionError) {
      console.error("⚠️ Error creating transaction record:", transactionError);
    }

    // Update provider total_earnings by calculating from all transaction records
    const { error: earningsError } = await this.supabaseAdmin
      .from("users")
      .update({
        total_earnings: this.supabaseAdmin.raw(
          `(SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE provider_id = '${booking.provider_id}')`
        ),
      })
      .eq("id", booking.provider_id);

    if (earningsError) {
      console.error("⚠️ Error updating provider earnings:", earningsError);
    }

    console.log("🎉 Service completed for booking:", booking.id, "- Transaction recorded");
  }

  /**
   * Handle BookingCancelled event
   */
  async handleBookingCancelled(eventData) {
    // Find booking by blockchain_booking_id
    const { data: booking, error } = await this.supabaseAdmin
      .from("bookings")
      .select()
      .eq("blockchain_booking_id", eventData.bookingId)
      .single();

    if (error || !booking) {
      console.error(
        "⚠️ Booking not found for cancellation event:",
        eventData.bookingId,
      );
      throw new Error(`Booking not found: ${eventData.bookingId}`);
    }

    // Update booking to cancelled
    const { error: updateError } = await this.supabaseAdmin
      .from("bookings")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancellation_tx_hash: eventData.transactionHash,
        cancellation_reason: eventData.reason,
      })
      .eq("id", booking.id);

    if (updateError) {
      throw updateError;
    }

    // Delete associated Google Meet/Zoom meeting if exists
    try {
      console.log(
        "🗑️ Attempting to delete meeting for cancelled booking:",
        booking.id,
      );
      await deleteMeetingForBooking(booking.id);
      console.log("✅ Successfully deleted meeting for booking:", booking.id);
    } catch (meetingError) {
      console.warn(
        "⚠️ Failed to delete meeting for booking:",
        booking.id,
        meetingError.message,
      );
      // Don't throw error - meeting deletion failure shouldn't prevent cancellation processing
    }

    console.log(
      "❌ Booking cancelled:",
      booking.id,
      "Reason:",
      eventData.reason,
    );
  }

  /**
   * Handle WebSocket reconnection with exponential backoff
   */
  async handleWebSocketReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("❌ Max WebSocket reconnection attempts reached");
      return;
    }

    this.reconnectAttempts++;
    console.log(`🔄 Attempting WebSocket reconnection (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

    try {
      // Remove old listeners
      if (this.contract) {
        this.contract.removeAllListeners();
      }

      // Recreate connections
      await this.initializeBlockchain();

      // Wait for connection to stabilize
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Restart event listeners
      this.setupBlockchainEventListeners();

      // Reset reconnect attempts on success
      this.reconnectAttempts = 0;
      console.log("✅ WebSocket reconnection successful");
    } catch (error) {
      console.error("❌ WebSocket reconnection failed:", error);
      
      // Schedule next retry if we haven't exceeded max attempts
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.scheduleReconnect();
      }
    }
  }

  /**
   * Start backup polling for a specific booking completion
   * Checks every 30 seconds for 6 attempts (3 minutes total)
   */
  startCompletionBackupPolling(bookingId, blockchainBookingId) {
    console.log(`🔄 Starting backup polling for booking completion: ${bookingId} (blockchain: ${blockchainBookingId})`);

    const pollAttempts = 6;
    const pollInterval = 30000; // 30 seconds
    let attemptCount = 0;

    const pollForCompletion = async () => {
      attemptCount++;
      console.log(`🔍 Backup poll attempt ${attemptCount}/${pollAttempts} for booking ${bookingId}`);

      try {
        // Check if booking status has already been updated
        const { data: booking, error: bookingError } = await this.supabaseAdmin
          .from("bookings")
          .select("status, completion_tx_hash, blockchain_booking_id")
          .eq("id", bookingId)
          .single();

        if (bookingError) {
          console.error(`❌ Error checking booking ${bookingId}:`, bookingError);
          return;
        }

        // If already completed, stop polling
        if (booking.status === 'completed') {
          console.log(`✅ Booking ${bookingId} already marked as completed, stopping backup polling`);
          return;
        }

        // Look for ServiceCompleted events for this booking on the blockchain
        const filter = this.contract.filters.ServiceCompleted(blockchainBookingId);
        const currentBlock = await this.provider.getBlockNumber();
        // Check last 10 blocks (Base Sepolia has ~2 second block time, so ~20 seconds of history)
        const fromBlock = Math.max(0, currentBlock - 10);

        const events = await this.contract.queryFilter(filter, fromBlock, currentBlock);

        if (events.length > 0) {
          console.log(`🎯 Backup polling found ServiceCompleted event for booking ${bookingId}`);
          const event = events[0]; // Use the first (should be only) event

          // Process the event
          const eventData = {
            bookingId: blockchainBookingId,
            provider: event.args.provider,
            customer: event.args.customer,
            providerAmount: event.args.providerAmount,
            platformFee: event.args.platformFee,
            transactionHash: event.transactionHash,
            blockNumber: event.blockNumber
          };

          await this.handleServiceCompleted(eventData);
          console.log(`✅ Backup polling successfully processed completion for booking ${bookingId}`);
          return;
        }

        // If this was the last attempt and no event found, log warning
        if (attemptCount >= pollAttempts) {
          console.warn(`⚠️ BACKUP POLLING FAILED for booking ${bookingId}`);
          console.warn(`📋 Booking Details:`);
          console.warn(`   - Booking ID: ${bookingId}`);
          console.warn(`   - Blockchain Booking ID: ${blockchainBookingId}`);
          console.warn(`   - Current Status: ${booking.status}`);
          console.warn(`   - Completion TX Hash: ${booking.completion_tx_hash || 'None'}`);
          console.warn(`   - Attempts Made: ${pollAttempts}`);
          console.warn(`   - Total Time: ${pollAttempts * pollInterval / 1000} seconds`);
          console.warn(`   - Block Range Checked: ${fromBlock} to ${currentBlock} (last 10 blocks)`);
          console.warn(`📧 This may indicate:`);
          console.warn(`   - Transaction failed or was reverted`);
          console.warn(`   - Event not emitted by smart contract`);
          console.warn(`   - Network connectivity issues`);
          console.warn(`   - Contract address mismatch`);
          console.warn(`   - Block explorer delay`);
          return;
        }

        // Schedule next attempt
        const timeoutId = setTimeout(pollForCompletion, pollInterval);
        this.timeouts.push(timeoutId);

      } catch (error) {
        console.error(`❌ Error in backup polling attempt ${attemptCount} for booking ${bookingId}:`, error);

        // If this was the last attempt, log the error details
        if (attemptCount >= pollAttempts) {
          console.warn(`⚠️ BACKUP POLLING ERROR for booking ${bookingId}: ${error.message}`);
        } else {
          // Schedule next attempt even on error
          const timeoutId = setTimeout(pollForCompletion, pollInterval);
          this.timeouts.push(timeoutId);
        }
      }
    };

    // Start the first poll attempt
    const timeoutId = setTimeout(pollForCompletion, pollInterval);
    this.timeouts.push(timeoutId);
  }

  /**
   * Get monitoring status
   */
  async getStatus() {
    const status = {
      isMonitoring: this.isMonitoring,
      contractAddress: this.CONTRACT_ADDRESS,
      isWebSocket: !!this.WEBSOCKET_URL,
      processedEventsCount: this.processedEvents.size,
      reconnectAttempts: this.reconnectAttempts,
      activeIntervals: this.intervals.length,
      activeTimeouts: this.timeouts.length,
    };

    // Add queue length if Redis is available
    if (this.redis && this.redis.status === 'ready') {
      try {
        status.queueLength = await this.redis.llen(this.eventQueue);
      } catch (error) {
        status.queueLength = 'unavailable';
      }
    } else {
      status.queueLength = 'redis-not-connected';
    }

    // Add provider type if available
    if (this.provider) {
      status.providerType = this.provider.constructor.name;
    }

    return status;
  }
}

export default BlockchainEventMonitor;

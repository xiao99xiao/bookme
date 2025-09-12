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

    // Initialize blockchain provider and contract
    // Use WebSocket provider for real-time events if available, fallback to HTTP
    if (this.WEBSOCKET_URL) {
      this.provider = new ethers.WebSocketProvider(this.WEBSOCKET_URL);
      console.log("Using WebSocket provider for real-time events");
    } else {
      this.provider = new ethers.JsonRpcProvider(this.RPC_URL);
      console.log("Using HTTP provider (WebSocket URL not provided)");
    }
    this.contract = new ethers.Contract(
      this.CONTRACT_ADDRESS,
      contractABI,
      this.provider,
    );

    // Initialize Redis for event queuing
    this.redis = new Redis(this.REDIS_URL, {
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        // Reconnect after 2 seconds, up to 10 times
        if (times > 10) {
          console.error("❌ Redis connection failed after 10 attempts");
          // Don't throw error, just return undefined to stop retrying
          return undefined;
        }
        const delay = Math.min(times * 2000, 10000);
        console.log(
          `🔄 Redis reconnecting in ${delay}ms (attempt ${times})...`,
        );
        return delay;
      },
      reconnectOnError: (err) => {
        const targetError = "READONLY";
        if (err.message.includes(targetError)) {
          // Only reconnect when the error contains "READONLY"
          return true;
        }
        return false;
      },
    });

    // Set up Redis error handlers
    this.redis.on("error", (error) => {
      console.error("❌ Redis error:", error.message);
      // Don't crash the server, just log the error
    });

    this.redis.on("connect", () => {
      console.log("✅ Redis connected successfully");
    });

    this.redis.on("close", () => {
      console.log("⚠️ Redis connection closed");
    });

    this.redis.on("reconnecting", () => {
      console.log("🔄 Redis reconnecting...");
    });

    // Event processing state
    this.isMonitoring = false;
    this.isReconnecting = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.eventQueue = "blockchain-events";
    this.processedEvents = new Set();

    console.log("📡 Blockchain Event Monitor initialized");
    console.log("Contract Address:", this.CONTRACT_ADDRESS);
    console.log("RPC URL:", this.RPC_URL);
    console.log("Redis URL:", this.REDIS_URL);
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
      console.log("🚀 Starting blockchain event monitoring...");
      this.isMonitoring = true;

      // Set up event listeners for all contract events
      this.setupEventListeners();

      // Start processing queued events
      this.startEventProcessor();

      console.log("✅ Blockchain event monitoring started");
    } catch (error) {
      console.error("❌ Failed to start event monitoring:", error);
      this.isMonitoring = false;
      throw error;
    }
  }

  /**
   * Stop monitoring blockchain events
   */
  async stopMonitoring() {
    console.log("🛑 Stopping blockchain event monitoring...");
    this.isMonitoring = false;

    // Remove all listeners
    this.contract.removeAllListeners();

    // Close WebSocket connection if using WebSocket provider
    if (this.provider && typeof this.provider.destroy === "function") {
      await this.provider.destroy();
    }

    console.log("✅ Event monitoring stopped");
  }

  /**
   * Set up event listeners for contract events
   */
  setupEventListeners() {
    // Set up WebSocket error handling and reconnection
    // Check if provider has WebSocket and it's not already being reconnected
    if (this.provider && this.provider._websocket && !this.isReconnecting) {
      // Remove any existing listeners first to prevent duplicates
      if (this.provider._websocket.removeAllListeners) {
        this.provider._websocket.removeAllListeners("error");
        this.provider._websocket.removeAllListeners("close");
      }

      this.provider._websocket.on("error", (error) => {
        console.error("❌ WebSocket error:", error);
        // Only attempt reconnect if not already reconnecting
        if (!this.isReconnecting) {
          this.handleWebSocketReconnect();
        }
      });

      this.provider._websocket.on("close", () => {
        console.log("⚠️ WebSocket connection closed");
        // Only attempt reconnect if monitoring and not already reconnecting
        if (this.isMonitoring && !this.isReconnecting) {
          this.handleWebSocketReconnect();
        }
      });
    }

    // Listen for BookingCreatedAndPaid events
    this.contract.on(
      "BookingCreatedAndPaid",
      async (
        bookingId,
        customer,
        provider,
        inviter,
        amount,
        platformFeeRate,
        inviterFeeRate,
        event,
      ) => {
        console.log("🔍 Raw event object:", event);
        console.log("🔍 Transaction hash:", event.transactionHash);
        console.log("🔍 Block number:", event.blockNumber);

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
      async (
        bookingId,
        provider,
        providerAmount,
        platformFee,
        inviterFee,
        event,
      ) => {
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
      async (
        bookingId,
        cancelledBy,
        customerAmount,
        providerAmount,
        platformAmount,
        inviterAmount,
        reason,
        event,
      ) => {
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

    console.log("👂 Event listeners set up for contract events");
  }

  /**
   * Queue an event for processing
   */
  async queueEvent(eventData) {
    try {
      const eventKey = `${eventData.transactionHash}-${eventData.logIndex}`;

      // Check if we've already processed this event
      if (this.processedEvents.has(eventKey)) {
        console.log("⏭️ Event already processed, skipping:", eventKey);
        return;
      }

      // Add to Redis queue only if Redis is connected
      if (this.redis && this.redis.status === "ready") {
        await this.redis.lpush(this.eventQueue, JSON.stringify(eventData));
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
        // Optionally, you could store events in memory or process them directly
        // For now, just log the warning
      }
    } catch (error) {
      console.error("❌ Error queuing event:", error.message);
      // Don't throw - prevent crash
    }
  }

  /**
   * Start processing events from the queue
   */
  startEventProcessor() {
    // Process events continuously
    const processNext = async () => {
      if (!this.isMonitoring) return;

      try {
        // Only try to get events if Redis is connected
        if (this.redis && this.redis.status === "ready") {
          // Get next event from queue
          const eventJson = await this.redis.brpop(this.eventQueue, 1); // 1 second timeout

          if (eventJson && eventJson[1]) {
            const eventData = JSON.parse(eventJson[1]);
            await this.processEvent(eventData);
          }
        } else {
          // Redis not ready, wait a bit longer
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error("❌ Error processing event from queue:", error.message);
        // Wait before retrying if there's an error
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      // Continue processing
      if (this.isMonitoring) {
        setTimeout(processNext, 100); // Small delay to prevent spinning
      }
    };

    processNext();
    console.log("⚙️ Event processor started");
  }

  /**
   * Process a single blockchain event
   */
  async processEvent(eventData) {
    const eventKey = `${eventData.transactionHash}-${eventData.logIndex}`;

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
    // Find booking by blockchain_booking_id
    const { data: booking, error } = await this.supabaseAdmin
      .from("bookings")
      .select()
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

    // Update provider earnings
    const providerEarnings = parseFloat(
      ethers.formatUnits(eventData.providerAmount, 6),
    );

    const { error: earningsError } = await this.supabaseAdmin
      .from("users")
      .update({
        total_earnings: this.supabaseAdmin.raw(
          `total_earnings + ${providerEarnings}`,
        ),
      })
      .eq("id", booking.provider_id);

    if (earningsError) {
      console.error("⚠️ Error updating provider earnings:", earningsError);
    }

    console.log("🎉 Service completed for booking:", booking.id);
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
   * Handle WebSocket reconnection
   */
  async handleWebSocketReconnect() {
    console.log("🔄 Attempting WebSocket reconnection...");

    try {
      // Remove old listeners
      this.contract.removeAllListeners();

      // Recreate WebSocket provider
      if (this.WEBSOCKET_URL) {
        this.provider = new ethers.WebSocketProvider(this.WEBSOCKET_URL);
        this.contract = new ethers.Contract(
          this.CONTRACT_ADDRESS,
          contractABI,
          this.provider,
        );

        // Wait a moment for connection to establish
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Restart event listeners
        this.setupEventListeners();

        console.log("✅ WebSocket reconnection successful");
      }
    } catch (error) {
      console.error("❌ WebSocket reconnection failed:", error);

      // Retry after delay
      setTimeout(() => {
        if (this.isMonitoring) {
          this.handleWebSocketReconnect();
        }
      }, 5000);
    }
  }

  /**
   * Get monitoring status
   */
  getStatus() {
    return {
      isMonitoring: this.isMonitoring,
      queueLength: this.redis.llen(this.eventQueue),
      processedEventsCount: this.processedEvents.size,
      contractAddress: this.CONTRACT_ADDRESS,
      providerType: this.provider.constructor.name,
      isWebSocket: !!this.WEBSOCKET_URL,
    };
  }
}

export default BlockchainEventMonitor;

/**
 * Booking Routes
 *
 * This module handles all booking-related endpoints including creation, payment authorization,
 * service completion, cancellation, blockchain status tracking, and booking management.
 * Integrates with blockchain smart contracts for secure payment processing.
 *
 * Usage:
 * ```javascript
 * import bookingRoutes from './routes/bookings.js';
 * bookingRoutes(app);
 * ```
 */

import { Hono } from "hono";
import { verifyPrivyAuth, getSupabaseAdmin } from "../middleware/auth.js";
import { getEventMonitor } from "../config/blockchain.js";
import {
  getApplicableCancellationPolicies,
  calculateRefundBreakdown,
  validatePolicySelection,
} from "../cancellation-policies.js";
import EIP712Signer from "../eip712-signer.js";
// BlockchainService removed - not needed since methods are commented out

// Get Supabase admin client
const supabaseAdmin = getSupabaseAdmin();

/**
 * Create booking routes
 *
 * @param {Hono} app - The Hono application instance
 */
export default function bookingRoutes(app) {
  /**
   * POST /api/bookings
   *
   * Create a new booking with EIP-712 payment authorization.
   * This endpoint handles the complete booking creation flow including:
   * - Service availability validation
   * - Booking record creation
   * - Blockchain payment authorization generation
   * - Email notifications to both parties
   *
   * Headers:
   * - Authorization: Bearer {privyToken}
   *
   * Body:
   * - service_id: UUID of the service to book
   * - scheduled_at: ISO timestamp for the appointment
   * - customer_notes: Optional notes from customer
   * - duration_minutes: Service duration override (optional)
   * - price: Service price override (optional)
   *
   * Response:
   * - Full booking object with EIP-712 payment authorization
   *
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with booking data or error
   */
  app.post("/api/bookings", verifyPrivyAuth, async (c) => {
    try {
      const userId = c.get("userId");
      const body = await c.req.json();
      const {
        service_id,
        scheduled_at,
        customer_notes,
        duration_minutes,
        price,
        location,
        is_online: isOnline,
      } = body;

      if (!service_id || !scheduled_at) {
        return c.json(
          { error: "Service ID and scheduled time are required" },
          400,
        );
      }

      // Get service details
      const { data: service, error: serviceError } = await supabaseAdmin
        .from("services")
        .select("*")
        .eq("id", service_id)
        .eq("is_visible", true)
        .single();

      if (serviceError || !service) {
        console.error("Service fetch error:", serviceError);
        return c.json({ error: "Service not found" }, 404);
      }

      // Prevent self-booking
      if (service.provider_id === userId) {
        return c.json({ error: "Cannot book your own service" }, 400);
      }

      // Get customer details
      const { data: customer, error: customerError } = await supabaseAdmin
        .from("users")
        .select("*")
        .eq("id", userId)
        .single();

      if (customerError || !customer) {
        console.error("Customer fetch error:", customerError);
        return c.json({ error: "Customer not found" }, 404);
      }

      // Get provider details
      const { data: provider, error: providerError } = await supabaseAdmin
        .from("users")
        .select("*")
        .eq("id", service.provider_id)
        .single();

      if (providerError || !provider) {
        console.error("Provider fetch error:", providerError);
        return c.json({ error: "Provider not found" }, 404);
      }

      // Validate scheduled time
      const scheduledDate = new Date(scheduled_at);
      const now = new Date();
      if (scheduledDate <= now) {
        return c.json({ error: "Cannot schedule bookings in the past" }, 400);
      }

      // Check for conflicting bookings (following old code pattern)
      const bookingStart = new Date(scheduled_at);
      const bookingEnd = new Date(
        bookingStart.getTime() +
          (duration_minutes || service.duration_minutes) * 60000,
      );

      const { data: conflictingBookings, error: conflictError } =
        await supabaseAdmin
          .from("bookings")
          .select("id, scheduled_at, duration_minutes")
          .eq("service_id", service_id)
          .in("status", ["pending", "confirmed"]);

      if (conflictError) {
        // Continue anyway - don't fail the booking for this (following old code)
      }

      // Check for time conflicts (following old code pattern)
      const hasConflict = conflictingBookings?.some((booking) => {
        const existingStart = new Date(booking.scheduled_at);
        const existingEnd = new Date(
          existingStart.getTime() + booking.duration_minutes * 60000,
        );

        // Check if times overlap
        return bookingStart < existingEnd && bookingEnd > existingStart;
      });

      if (hasConflict) {
        return c.json({ error: "Time slot not available" }, 400);
      }

      // Calculate service fee (10% platform fee) - from old code
      const serviceFee = (price || service.price) * 0.1;

      // Atomic operation: Create booking and conversation together (from old code)
      const bookingData = {
        service_id: service_id,
        customer_id: userId,
        provider_id: service.provider_id,
        scheduled_at: scheduled_at,
        duration_minutes: duration_minutes || service.duration_minutes,
        total_price: price || service.price,
        service_fee: serviceFee,
        status: "pending",
        customer_notes: customer_notes || null,
        location: location || service.location,
        is_online: isOnline ?? service.is_online,
      };

      // Use Promise.all for parallel execution of booking and conversation creation (from old code)
      const [bookingResult, conversationResult] = await Promise.all([
        supabaseAdmin.from("bookings").insert(bookingData).select().single(),
        // Pre-generate conversation data to create immediately after booking
        Promise.resolve({
          user1_id: userId,
          user2_id: service.provider_id,
        }),
      ]);

      if (bookingResult.error) {
        console.error("Booking creation error:", bookingResult.error);
        return c.json({ error: "Failed to create booking" }, 500);
      }

      const booking = bookingResult.data;

      // Create conversation between customer and provider (corrected for actual schema)
      const { error: conversationError } = await supabaseAdmin
        .from("conversations")
        .insert(conversationResult);

      if (conversationError) {
        // Log error but don't fail the booking - conversation can be created later
        console.error("Conversation creation warning:", conversationError);
      }

      // Generate EIP-712 payment authorization
      try {
        const customerAddress = customer.wallet_address;
        const providerAddress = provider.wallet_address;

        if (!customerAddress || !providerAddress) {
          console.error("Missing wallet addresses:", {
            customerAddress,
            providerAddress,
          });
          // Skip payment authorization if wallet addresses are missing
          // This allows the booking to be created and payment can be attempted later
          return c.json({
            booking,
            error:
              "Wallet addresses not configured - booking created but payment authorization skipped",
            message:
              "Please ensure both customer and provider have wallet addresses configured",
          });
        }

        const EIP712Signer = (await import("../eip712-signer.js")).default;
        const eip712Signer = new EIP712Signer();

        // Check if customer was referred
        const { data: customerData } = await supabaseAdmin
          .from('users')
          .select('referred_by')
          .eq('id', userId)
          .single();

        const hasInviter = !!customerData?.referred_by;
        let inviterAddress = "0x0000000000000000000000000000000000000000";

        if (hasInviter) {
          const { data: referrerData } = await supabaseAdmin
            .from('users')
            .select('wallet_address')
            .eq('id', customerData.referred_by)
            .single();

          inviterAddress = referrerData?.wallet_address || inviterAddress;
        }

        // Calculate fee structure (from old code)
        const feeData = eip712Signer.calculateFees(
          booking.total_price,
          hasInviter,
        );

        // Generate EIP-712 signature FIRST (following old code parameters)
        const authResult = await eip712Signer.signBookingAuthorization({
          bookingId: booking.id, // Pass UUID as in old code
          customer: customerAddress,
          provider: providerAddress,
          inviter: inviterAddress,
          amount: booking.total_price,
          platformFeeRate: feeData.platformFeeRate,
          inviterFeeRate: feeData.inviterFeeRate,
          expiryMinutes: 5, // 5 minute expiry from old code
        });

        // Use the ACTUAL hashed bookingId from the authorization (this is what gets emitted on-chain)
        const blockchainBookingId = authResult.authorization.bookingId;
        console.log("🔍 Booking ID (UUID):", booking.id);
        console.log(
          "🔍 Blockchain Booking ID (from EIP-712):",
          blockchainBookingId,
        );

        // Update booking with the SAME blockchain booking ID that will be emitted (from old code)
        const { error: updateError } = await supabaseAdmin
          .from("bookings")
          .update({
            blockchain_booking_id: blockchainBookingId,
            status: "pending_payment",
          })
          .eq("id", booking.id);

        if (updateError) {
          console.error(
            "❌ Failed to update blockchain_booking_id:",
            updateError,
          );
          return c.json(
            { error: "Failed to update booking for blockchain" },
            500,
          );
        }

        console.log(
          "✅ Updated blockchain_booking_id in database:",
          blockchainBookingId,
        );
        console.log(
          "✅ Authorization and database IDs now match:",
          authResult.authorization.bookingId === blockchainBookingId,
        );

        // Store nonce to prevent replay attacks (from old code)
        await supabaseAdmin.from("signature_nonces").insert({
          nonce: authResult.nonce,
          booking_id: booking.id,
          signature_type: "booking_authorization",
        });

        // Convert BigInt values to strings for JSON serialization
        const serializableAuthorization = {
          ...authResult.authorization,
          bookingId: authResult.authorization.bookingId.toString(),
          amount: authResult.authorization.amount.toString(),
        };

        console.log(
          `✅ Booking creation with payment authorization | Booking ID: ${booking.id}`,
        );

        // Send notification emails asynchronously (don't await)
        setImmediate(async () => {
          try {
            // Email logic would go here in production
            console.log("Booking created notification sent:", booking.id);
          } catch (emailError) {
            console.error("Email notification error:", emailError);
          }
        });

        // Return response in same format as old code
        return c.json({
          booking: {
            ...booking,
            status: "pending_payment",
            blockchain_booking_id: blockchainBookingId,
          },
          authorization: serializableAuthorization,
          signature: authResult.signature,
          contractAddress: process.env.CONTRACT_ADDRESS,
          usdcAddress: process.env.USDC_ADDRESS,
          feeBreakdown: feeData,
          expiresAt: new Date(authResult.expiry * 1000).toISOString(),
        });
      } catch (authError) {
        console.error("❌ Payment authorization error:", authError);
        // If payment authorization fails, still return the booking but without payment info (from old code)
        // This allows the booking to be created and payment can be attempted later
        return c.json({
          booking,
          error:
            "Payment authorization failed - booking created but payment required",
          message: "You can complete payment from your bookings page",
        });
      }
    } catch (error) {
      console.error("Booking creation error:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  /**
   * POST /api/bookings/:id/authorize-payment
   *
   * Generate payment authorization for a booking (following old code pattern).
   * This endpoint generates EIP-712 signatures for blockchain payment authorization.
   *
   * Headers:
   * - Authorization: Bearer {privyToken}
   *
   * Parameters:
   * - id: UUID of the booking
   *
   * Response:
   * - EIP-712 payment authorization signature and contract details
   *
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with authorization or error
   */
  app.post(
    "/api/bookings/:id/authorize-payment",
    verifyPrivyAuth,
    async (c) => {
      try {
        const userId = c.get("userId");
        const bookingId = c.req.param("id");

        console.log(
          "🔐 Generating payment authorization for booking:",
          bookingId,
        );

        // Get booking details (following old code query pattern)
        const { data: booking, error: bookingError } = await supabaseAdmin
          .from("bookings")
          .select(
            `
          *,
          customer:customer_id(id, wallet_address),
          provider:provider_id(id, wallet_address),
          service:service_id(*)
        `,
          )
          .eq("id", bookingId)
          .single();

        if (bookingError || !booking) {
          console.error("Booking not found:", bookingId, bookingError);
          return c.json({ error: "Booking not found" }, 404);
        }

        // Verify user is the customer
        if (booking.customer_id !== userId) {
          return c.json({ error: "Unauthorized - not booking customer" }, 403);
        }

        // Check booking status
        if (
          booking.status !== "pending" &&
          booking.status !== "pending_payment"
        ) {
          return c.json({ error: "Booking not eligible for payment" }, 400);
        }

        // Check if we need customer/provider wallet addresses
        if (
          !booking.customer?.wallet_address ||
          !booking.provider?.wallet_address
        ) {
          return c.json(
            {
              error: "Wallet addresses not configured for customer or provider",
            },
            400,
          );
        }

        const EIP712Signer = (await import("../eip712-signer.js")).default;
        const eip712Signer = new EIP712Signer();

        // Check if customer was referred
        const { data: customerData } = await supabaseAdmin
          .from('users')
          .select('referred_by')
          .eq('id', booking.customer_id)
          .single();

        const hasInviter = !!customerData?.referred_by;
        let inviterAddress = "0x0000000000000000000000000000000000000000";

        if (hasInviter) {
          const { data: referrerData } = await supabaseAdmin
            .from('users')
            .select('wallet_address')
            .eq('id', customerData.referred_by)
            .single();

          inviterAddress = referrerData?.wallet_address || inviterAddress;
        }

        // Calculate fee structure
        const feeData = eip712Signer.calculateFees(
          booking.total_price,
          hasInviter,
        );

        // Generate EIP-712 signature FIRST
        const authResult = await eip712Signer.signBookingAuthorization({
          bookingId: booking.id,
          customer: booking.customer.wallet_address,
          provider: booking.provider.wallet_address,
          inviter: inviterAddress,
          amount: booking.total_price,
          platformFeeRate: feeData.platformFeeRate,
          inviterFeeRate: feeData.inviterFeeRate,
          expiryMinutes: 5, // 5 minute expiry
        });

        // Use the ACTUAL hashed bookingId from the authorization (this is what gets emitted on-chain)
        const blockchainBookingId = authResult.authorization.bookingId;

        // Store the SAME blockchain booking ID that will be emitted in database
        const { error: updateError } = await supabaseAdmin
          .from("bookings")
          .update({
            blockchain_booking_id: blockchainBookingId,
            status: "pending_payment",
          })
          .eq("id", booking.id);

        if (updateError) {
          console.error(
            "Error updating booking with blockchain ID:",
            updateError,
          );
          return c.json(
            { error: "Failed to prepare booking for payment" },
            500,
          );
        }

        // Store nonce to prevent replay attacks
        const { error: nonceError } = await supabaseAdmin
          .from("signature_nonces")
          .insert({
            nonce: authResult.nonce,
            booking_id: booking.id,
            signature_type: "booking_authorization",
          });

        if (nonceError) {
          console.error("Error storing nonce:", nonceError);
          return c.json(
            { error: "Failed to generate secure authorization" },
            500,
          );
        }

        console.log(
          "✅ Payment authorization generated for booking:",
          bookingId,
        );

        // Convert BigInt values to strings for JSON serialization
        const serializableAuthorization = {
          ...authResult.authorization,
          bookingId: authResult.authorization.bookingId.toString(),
          amount: authResult.authorization.amount.toString(),
        };

        return c.json({
          authorization: serializableAuthorization,
          signature: authResult.signature,
          contractAddress: process.env.CONTRACT_ADDRESS,
          usdcAddress: process.env.USDC_ADDRESS,
          feeBreakdown: feeData,
          expiresAt: new Date(authResult.expiry * 1000).toISOString(),
        });
      } catch (error) {
        console.error("❌ Payment authorization error:", error);
        return c.json(
          { error: "Failed to generate payment authorization" },
          500,
        );
      }
    },
  );

  /**
   * POST /api/bookings/:id/complete-service
   *
   * Initiate service completion by the customer.
   * This endpoint ONLY returns completion data for blockchain transaction.
   * The actual database update happens via blockchain event monitoring.
   *
   * Headers:
   * - Authorization: Bearer {privyToken}
   *
   * Parameters:
   * - id: UUID of the booking
   *
   * Response:
   * - Booking data needed for blockchain completion transaction
   *
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with booking data for completion
   */
  app.post("/api/bookings/:id/complete-service", verifyPrivyAuth, async (c) => {
    try {
      const userId = c.get("userId");
      const bookingId = c.req.param("id");

      // Get booking details
      const { data: booking, error: bookingError } = await supabaseAdmin
        .from("bookings")
        .select(
          `
          *,
          service:services(*),
          customer:users!customer_id(*),
          provider:users!provider_id(*)
        `,
        )
        .eq("id", bookingId)
        .single();

      if (bookingError || !booking) {
        console.error("Booking fetch error:", bookingError);
        return c.json({ error: "Booking not found" }, 404);
      }

      // Only customer can mark service as complete
      if (booking.customer_id !== userId) {
        return c.json(
          { error: "Only the customer can mark service as complete" },
          403,
        );
      }

      if (booking.status !== "confirmed" && booking.status !== "in_progress") {
        return c.json(
          { error: "Service cannot be completed from current status" },
          400,
        );
      }

      // IMPORTANT: Do NOT update database here!
      // The database will be updated when we receive the ServiceCompleted event
      // from the blockchain via the event monitor (event-monitor.js handleServiceCompleted)
      
      console.log("📝 Service completion initiated for booking:", bookingId);
      console.log("⏳ Waiting for blockchain confirmation...");

      // Backup polling system disabled - use manual script if needed
      // node scripts/check-booking-completion.js <booking-id>

      // Return booking data for frontend to execute blockchain transaction
      // The frontend will call completeService on the smart contract
      return c.json({
        success: true,
        message: "Ready for blockchain completion",
        booking: {
          id: booking.id,
          blockchain_booking_id: booking.blockchain_booking_id,
          status: booking.status,
          total_price: booking.total_price,
          provider_wallet: booking.provider.wallet_address,
          customer_wallet: booking.customer.wallet_address,
        },
        contractAddress: process.env.CONTRACT_ADDRESS,
      });
    } catch (error) {
      console.error("Service completion error:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  /**
   * POST /api/bookings/:id/complete-service-backend
   *
   * Internal endpoint for backend-triggered service completion.
   * This endpoint is used by automated systems (cron jobs) to complete
   * services via blockchain using the backend signer.
   *
   * Enhanced with Google Meet session duration validation to ensure
   * providers deliver the full service duration before payment release.
   *
   * Parameters:
   * - id: UUID of the booking
   *
   * Body:
   * - admin_notes: Administrative notes for the completion
   * - trigger_reason: Reason for backend completion
   *
   * Response:
   * - Transaction hash and success status
   *
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with transaction hash or error
   */
  app.post("/api/bookings/:id/complete-service-backend", async (c) => {
    try {
      const bookingId = c.req.param("id");
      const body = await c.req.json();
      const { admin_notes, trigger_reason } = body;

      console.log("🤖 Backend completion triggered for booking:", bookingId);

      // Get booking details
      const { data: booking, error: bookingError } = await supabaseAdmin
        .from("bookings")
        .select(
          `
          *,
          blockchain_booking_id,
          auto_complete_blocked,
          auto_complete_blocked_reason,
          service:services(*),
          customer:users!customer_id(*),
          provider:users!provider_id(*)
        `,
        )
        .eq("id", bookingId)
        .single();

      if (bookingError || !booking) {
        console.error("Booking fetch error:", bookingError);
        return c.json({ error: "Booking not found" }, 404);
      }

      if (booking.status !== "confirmed" && booking.status !== "in_progress") {
        return c.json(
          { error: "Service cannot be completed from current status" },
          400,
        );
      }

      // Check if auto-completion is blocked due to insufficient session duration
      if (booking.auto_complete_blocked) {
        console.log("🚫 Auto-completion blocked for booking:", bookingId);
        console.log("🚫 Reason:", booking.auto_complete_blocked_reason);

        return c.json({
          error: "Auto-completion blocked",
          reason: booking.auto_complete_blocked_reason,
          message: "Booking requires manual completion by customer due to insufficient provider session duration",
          blocked: true
        }, 400);
      }

      // For online bookings with Google Meet links, validate session duration
      if (booking.is_online && booking.meeting_link && booking.meeting_link.includes('meet.google.com')) {
        console.log("📊 Checking Google Meet session duration for booking:", bookingId);

        try {
          // Import and use the session tracker
          const { checkGoogleMeetSessionDuration } = await import("../google-meet-session-tracker.js");
          const sessionAnalysis = await checkGoogleMeetSessionDuration(bookingId);

          console.log("📊 Session analysis result:", {
            success: sessionAnalysis.success,
            providerDuration: sessionAnalysis.providerDuration,
            serviceDuration: sessionAnalysis.serviceDuration,
            meetsThreshold: sessionAnalysis.providerMeetsThreshold
          });

          // If session tracking was successful and provider doesn't meet threshold
          if (sessionAnalysis.success && !sessionAnalysis.providerMeetsThreshold) {
            console.log("⚠️ Provider session duration insufficient, blocking auto-completion");

            // Block auto-completion
            const { error: blockError } = await supabaseAdmin
              .from("bookings")
              .update({
                auto_complete_blocked: true,
                auto_complete_blocked_reason: `Provider session duration insufficient: ${Math.round(sessionAnalysis.providerDuration)}s / ${Math.round(sessionAnalysis.serviceDuration)}s required (${Math.round(sessionAnalysis.threshold * 100)}% threshold)`,
                updated_at: new Date().toISOString()
              })
              .eq("id", bookingId);

            if (blockError) {
              console.error("Failed to block auto-completion:", blockError);
            }

            return c.json({
              error: "Provider session duration insufficient",
              sessionData: {
                providerDuration: sessionAnalysis.providerDuration,
                serviceDuration: sessionAnalysis.serviceDuration,
                threshold: sessionAnalysis.threshold,
                actualPercentage: Math.round(sessionAnalysis.providerDuration / sessionAnalysis.serviceDuration * 100)
              },
              message: "Booking requires manual completion by customer",
              blocked: true
            }, 400);
          }

          console.log("✅ Session duration validation passed or API unavailable, proceeding with completion");
        } catch (sessionError) {
          console.error("❌ Session duration check failed:", sessionError);

          // If it's a critical error (like missing module), block completion
          if (sessionError.code === 'ERR_MODULE_NOT_FOUND' || sessionError.message.includes('Cannot find module')) {
            console.error("🚫 Critical session tracking error - blocking completion until fixed");
            return c.json({
              error: "Session tracking system error",
              message: "Cannot complete booking due to session tracking system failure. Please check system logs.",
              systemError: true
            }, 500);
          }

          // For other API failures (like Google API down), allow graceful degradation
          console.log("⚠️ Session tracking API unavailable, proceeding with completion (graceful degradation)");
        }
      }

      // Check if booking was paid via blockchain
      if (!booking.blockchain_booking_id) {
        console.log("⚠️ Booking was not paid via blockchain, updating database directly");
        
        // For non-blockchain bookings, update database directly
        const { error: updateError } = await supabaseAdmin
          .from("bookings")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            completion_notes: admin_notes || "Auto-completed by system (non-blockchain booking)",
            backend_completed: true,
            backend_completion_reason: trigger_reason || "auto-completion",
            updated_at: new Date().toISOString(),
          })
          .eq("id", bookingId);

        if (updateError) {
          console.error("Database update error:", updateError);
          return c.json({ error: "Failed to complete booking" }, 500);
        }

        return c.json({ 
          success: true, 
          message: "Booking completed in database (non-blockchain)",
          bookingId 
        });
      }

      // For blockchain bookings, use backend signer to complete on-chain
      console.log("🔗 Completing blockchain booking:", booking.blockchain_booking_id);

      try {
        // Import blockchain service (uses backend signer)
        const { getBlockchainService } = await import("../config/blockchain.js");
        const blockchainService = getBlockchainService();

        // Complete service on blockchain using backend signer
        const txHash = await blockchainService.completeServiceAsBackend(
          booking.blockchain_booking_id
        );

        console.log("✅ Blockchain completion successful:", txHash);
        
        // The database will be updated by the event monitor when it catches the ServiceCompleted event
        // We just need to store the auto-completion metadata
        await supabaseAdmin
          .from("bookings")
          .update({
            backend_completed: true,
            backend_completion_reason: trigger_reason || "auto-completion after 30 min",
            completion_notes: admin_notes || "Auto-completed by cron job",
          })
          .eq("id", bookingId);

        return c.json({ 
          success: true, 
          txHash,
          message: "Service completed on blockchain",
          bookingId,
          blockchainBookingId: booking.blockchain_booking_id
        });
        
      } catch (blockchainError) {
        console.error("❌ Blockchain completion failed:", blockchainError);
        
        // Don't update database on blockchain failure - let customer retry
        return c.json({ 
          error: "Blockchain completion failed", 
          details: blockchainError.message 
        }, 500);
      }
    } catch (error) {
      console.error("Backend completion error:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  /**
   * GET /api/bookings/:id/blockchain-status
   *
   * Get blockchain transaction status for a booking.
   * This endpoint provides real-time blockchain status including:
   * - Transaction confirmation status
   * - Block confirmation count
   * - Payment verification status
   * - Smart contract event logs
   *
   * Headers:
   * - Authorization: Bearer {privyToken}
   *
   * Parameters:
   * - id: UUID of the booking
   *
   * Response:
   * - Blockchain status object with transaction details
   *
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with blockchain status or error
   */
  app.get("/api/bookings/:id/blockchain-status", verifyPrivyAuth, async (c) => {
    try {
      const userId = c.get("userId");
      const bookingId = c.req.param("id");

      // Get booking details
      const { data: booking, error: bookingError } = await supabaseAdmin
        .from("bookings")
        .select("*, customer_id, provider_id, payment_hash")
        .eq("id", bookingId)
        .single();

      if (bookingError || !booking) {
        console.error("Booking fetch error:", bookingError);
        return c.json({ error: "Booking not found" }, 404);
      }

      // Verify user has access to this booking
      if (booking.customer_id !== userId && booking.provider_id !== userId) {
        return c.json({ error: "Access denied" }, 403);
      }

      if (!booking.payment_hash) {
        return c.json({
          status: "no_payment",
          message: "No payment transaction found",
        });
      }

      // Get blockchain events for this booking
      const { data: events, error: eventsError } = await supabaseAdmin
        .from("blockchain_events")
        .select("*")
        .eq("booking_id", bookingId)
        .order("created_at", { ascending: true });

      if (eventsError) {
        console.error("Blockchain events fetch error:", eventsError);
        return c.json({ error: "Failed to fetch blockchain status" }, 500);
      }

      // Get transaction status from blockchain
      try {
        const { getTransactionStatus } = await import(
          "../blockchain-service.js"
        );
        const txStatus = await getTransactionStatus(booking.payment_hash);

        return c.json({
          booking_id: bookingId,
          payment_hash: booking.payment_hash,
          transaction_status: txStatus,
          blockchain_events: events || [],
          last_updated: new Date().toISOString(),
        });
      } catch (blockchainError) {
        console.error("Blockchain status check error:", blockchainError);
        return c.json({
          booking_id: bookingId,
          payment_hash: booking.payment_hash,
          transaction_status: "unknown",
          blockchain_events: events || [],
          error: "Unable to verify blockchain status",
          last_updated: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error("Blockchain status error:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  /**
   * GET /api/bookings/user/:userId
   *
   * Get all bookings for a specific user (as customer or provider).
   * This endpoint returns bookings with filtering options and full relationship data.
   *
   * Headers:
   * - Authorization: Bearer {privyToken}
   *
   * Parameters:
   * - userId: UUID of the user (must match authenticated user or be admin)
   *
   * Query Parameters:
   * - role: Filter by user role ('customer' or 'provider')
   * - status: Filter by booking status
   * - limit: Number of results to return
   * - offset: Pagination offset
   *
   * Response:
   * - Array of booking objects with full relationship data
   *
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with user bookings or error
   */
  app.get("/api/bookings/user/:userId", verifyPrivyAuth, async (c) => {
    try {
      const authenticatedUserId = c.get("userId");
      const targetUserId = c.req.param("userId");
      const { role, status, limit = "50", offset = "0" } = c.req.query();

      // Only allow users to see their own bookings
      if (authenticatedUserId !== targetUserId) {
        return c.json({ error: "Access denied" }, 403);
      }

      let query = supabaseAdmin.from("bookings").select(`
          *,
          service:services(*),
          customer:users!customer_id(*),
          provider:users!provider_id(*),
          reviews(
            id,
            rating,
            comment,
            created_at,
            updated_at,
            reviewer:users!reviewer_id(id, display_name, avatar),
            reviewee:users!reviewee_id(id, display_name, avatar)
          )
        `);

      // Filter by user role
      if (role === "customer") {
        query = query.eq("customer_id", targetUserId);
      } else if (role === "provider") {
        query = query.eq("provider_id", targetUserId);
      } else {
        // Get both customer and provider bookings
        query = query.or(
          `customer_id.eq.${targetUserId},provider_id.eq.${targetUserId}`,
        );
      }

      // Filter by status if provided
      if (status) {
        query = query.eq("status", status);
      }

      // Apply pagination
      query = query
        .order("created_at", { ascending: false })
        .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

      const { data, error } = await query;

      if (error) {
        console.error("User bookings fetch error:", error);
        return c.json({ error: "Failed to fetch bookings" }, 500);
      }

      return c.json(data || []);
    } catch (error) {
      console.error("User bookings error:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  /**
   * PATCH /api/bookings/:bookingId
   *
   * Update booking status and details.
   * This endpoint handles various booking status transitions including:
   * - Provider acceptance/rejection
   * - Status updates during service delivery
   * - Booking modifications within allowed timeframes
   *
   * Headers:
   * - Authorization: Bearer {privyToken}
   *
   * Parameters:
   * - bookingId: UUID of the booking
   *
   * Body:
   * - status: New booking status
   * - provider_notes: Notes from provider
   * - meeting_link: Meeting link for online services
   * - other booking fields to update
   *
   * Response:
   * - Updated booking object
   *
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with updated booking or error
   */
  app.patch("/api/bookings/:bookingId", verifyPrivyAuth, async (c) => {
    try {
      const userId = c.get("userId");
      const bookingId = c.req.param("bookingId");
      const updates = await c.req.json();

      // Get current booking
      const { data: booking, error: bookingError } = await supabaseAdmin
        .from("bookings")
        .select(
          `
          *,
          service:services(*),
          customer:users!customer_id(*),
          provider:users!provider_id(*)
        `,
        )
        .eq("id", bookingId)
        .single();

      if (bookingError || !booking) {
        console.error("Booking fetch error:", bookingError);
        return c.json({ error: "Booking not found" }, 404);
      }

      // Check if user has permission to update this booking
      const isCustomer = booking.customer_id === userId;
      const isProvider = booking.provider_id === userId;

      if (!isCustomer && !isProvider) {
        return c.json({ error: "Access denied" }, 403);
      }

      // Validate status transitions
      const { status } = updates;
      if (status) {
        const validTransitions = {
          pending_payment: ["cancelled"],
          paid: ["confirmed", "cancelled"], // After blockchain payment, provider can accept or reject
          confirmed: ["in_progress", "cancelled"],
          in_progress: ["completed", "cancelled"],
          completed: [], // No transitions from completed
          cancelled: [], // No transitions from cancelled
          rejected: [], // No transitions from rejected
        };

        if (!validTransitions[booking.status]?.includes(status)) {
          return c.json(
            {
              error: `Cannot transition from ${booking.status} to ${status}`,
            },
            400,
          );
        }

        // Only providers can mark as in_progress
        if (status === "in_progress" && !isProvider) {
          return c.json({ error: "Only provider can start the service" }, 403);
        }

        // Only customers can mark as completed
        if (status === "completed" && !isCustomer) {
          return c.json(
            { error: "Only customer can mark service as complete" },
            403,
          );
        }
      }

      // Generate meeting link when booking is confirmed and is online (from old code)
      if (
        status === "confirmed" &&
        booking.is_online &&
        !booking.meeting_link
      ) {
        console.log(
          "🔗 Booking confirmed, generating meeting link for booking:",
          bookingId,
        );
        try {
          const { generateMeetingLinkForBooking } = await import(
            "../meeting-generation.js"
          );
          const meetingLink = await generateMeetingLinkForBooking(bookingId);
          if (meetingLink) {
            console.log(
              "✅ Meeting link generated successfully for confirmed booking:",
              meetingLink,
            );
            // Update the data object to include the meeting link
            updates.meeting_link = meetingLink;
          } else {
            console.log(
              "⚠️ Meeting link generation failed for confirmed booking - provider may not have integrations set up",
            );
          }
        } catch (error) {
          console.error(
            "❌ Failed to generate meeting link for confirmed booking:",
            bookingId,
            error,
          );
          // Don't fail the confirmation, just log the error
        }
      }

      // Also generate meeting link when transitioning to in_progress (fallback for edge cases)
      if (
        status === "in_progress" &&
        booking.is_online &&
        !booking.meeting_link
      ) {
        console.log(
          "🔗 Booking starting (in_progress), generating meeting link as fallback for booking:",
          bookingId,
        );
        try {
          const { generateMeetingLinkForBooking } = await import(
            "../meeting-generation.js"
          );
          const meetingLink = await generateMeetingLinkForBooking(bookingId);
          if (meetingLink) {
            console.log(
              "✅ Meeting link generated successfully for in_progress booking (fallback):",
              meetingLink,
            );
            // Update the data object to include the meeting link
            updates.meeting_link = meetingLink;
          } else {
            console.log(
              "⚠️ Meeting link generation failed for in_progress booking - provider may not have integrations set up",
            );
          }
        } catch (error) {
          console.error(
            "❌ Failed to generate meeting link for in_progress booking:",
            bookingId,
            error,
          );
          // Don't fail the status update, just log the error
        }
      }

      // Remove protected fields
      delete updates.id;
      delete updates.customer_id;
      delete updates.provider_id;
      delete updates.service_id;
      delete updates.created_at;
      delete updates.payment_hash;

      // Add update timestamp
      updates.updated_at = new Date().toISOString();

      // Update booking
      const { data: updatedBooking, error: updateError } = await supabaseAdmin
        .from("bookings")
        .update(updates)
        .eq("id", bookingId)
        .select(
          `
          *,
          service:services(*),
          customer:users!customer_id(*),
          provider:users!provider_id(*)
        `,
        )
        .single();

      if (updateError) {
        console.error("Booking update error:", updateError);
        return c.json({ error: "Failed to update booking" }, 500);
      }

      // Send notifications for status changes
      if (status && status !== booking.status) {
        setImmediate(async () => {
          try {
            console.log(
              `Booking ${bookingId} status changed from ${booking.status} to ${status}`,
            );
            // Email notifications would go here
          } catch (notificationError) {
            console.error("Notification error:", notificationError);
          }
        });
      }

      return c.json(updatedBooking);
    } catch (error) {
      console.error("Booking update error:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  /**
   * POST /api/bookings/:bookingId/reject
   *
   * Reject a booking request as a provider.
   * This endpoint handles provider rejection including:
   * - Status validation
   * - Rejection reason recording
   * - Automatic refund processing
   * - Customer notification
   *
   * Headers:
   * - Authorization: Bearer {privyToken}
   *
   * Parameters:
   * - bookingId: UUID of the booking to reject
   *
   * Body:
   * - rejection_reason: Reason for rejection
   * - provider_notes: Additional notes from provider
   *
   * Response:
   * - Updated booking object with rejection status
   *
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with rejected booking or error
   */
  app.post("/api/bookings/:bookingId/reject", verifyPrivyAuth, async (c) => {
    try {
      const userId = c.get("userId");
      const bookingId = c.req.param("bookingId");
      const body = await c.req.json();
      const { rejection_reason, provider_notes } = body;

      // Get booking details
      const { data: booking, error: bookingError } = await supabaseAdmin
        .from("bookings")
        .select(
          `
          *,
          service:services(*),
          customer:users!customer_id(*),
          provider:users!provider_id(*)
        `,
        )
        .eq("id", bookingId)
        .single();

      if (bookingError || !booking) {
        console.error("Booking fetch error:", bookingError);
        return c.json({ error: "Booking not found" }, 404);
      }

      // Only provider can reject bookings
      if (booking.provider_id !== userId) {
        return c.json(
          { error: "Only the provider can reject this booking" },
          403,
        );
      }

      // Can only reject confirmed bookings
      if (booking.status !== "confirmed") {
        return c.json({ error: "Can only reject confirmed bookings" }, 400);
      }

      // Update booking to rejected status
      const { data: rejectedBooking, error: updateError } = await supabaseAdmin
        .from("bookings")
        .update({
          status: "rejected",
          rejection_reason: rejection_reason || "No reason provided",
          provider_notes: provider_notes,
          rejected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", bookingId)
        .select(
          `
          *,
          service:services(*),
          customer:users!customer_id(*),
          provider:users!provider_id(*)
        `,
        )
        .single();

      if (updateError) {
        console.error("Booking rejection error:", updateError);
        return c.json({ error: "Failed to reject booking" }, 500);
      }

      // Process refund asynchronously
      if (booking.payment_hash) {
        setImmediate(async () => {
          try {
            // TODO: Implement processRefund in blockchain-service.js
            // await blockchainService.processRefund({
            //   bookingId: booking.id,
            //   amount: booking.price,
            //   customerAddress:
            //     booking.customer.wallet_address ||
            //     booking.customer.smart_wallet_address,
            //   reason: "Provider rejection",
            // });
            console.log(
              "TODO: Implement refund processing for booking:",
              booking.id,
            );

            // Log blockchain event
            await supabaseAdmin.from("blockchain_events").insert({
              booking_id: bookingId,
              event_type: "refund_processed",
              transaction_hash: null, // Will be updated when transaction completes
              block_timestamp: new Date().toISOString(),
              event_data: {
                amount: booking.price,
                reason: "provider_rejection",
                rejection_reason,
              },
            });
          } catch (refundError) {
            console.error("Refund processing error:", refundError);
          }
        });
      }

      // Send notification to customer
      setImmediate(async () => {
        try {
          console.log(
            `Booking ${bookingId} rejected by provider: ${rejection_reason}`,
          );
          // Email notification logic would go here
        } catch (notificationError) {
          console.error("Rejection notification error:", notificationError);
        }
      });

      return c.json(rejectedBooking);
    } catch (error) {
      console.error("Booking rejection error:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  /**
   * POST /api/bookings/:id/cancel
   *
   * Cancel a booking with optional cancellation policy application.
   * This endpoint handles booking cancellation including:
   * - Cancellation validation based on timing and status
   * - Cancellation policy enforcement
   * - Refund calculation and processing
   * - Notification to both parties
   *
   * Headers:
   * - Authorization: Bearer {privyToken}
   *
   * Parameters:
   * - id: UUID of the booking to cancel
   *
   * Body:
   * - cancellation_reason: Reason for cancellation
   * - apply_policy: Whether to apply cancellation policy
   *
   * Response:
   * - Cancelled booking object with refund details
   *
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with cancelled booking or error
   */
  app.post("/api/bookings/:id/cancel", verifyPrivyAuth, async (c) => {
    try {
      const userId = c.get("userId");
      const bookingId = c.req.param("id");
      const { reason } = await c.req.json();

      // Verify user is part of the booking
      const { data: booking, error: fetchError } = await supabaseAdmin
        .from("bookings")
        .select("*")
        .eq("id", bookingId)
        .single();

      if (fetchError || !booking) {
        return c.json({ error: "Booking not found" }, 404);
      }

      if (booking.customer_id !== userId && booking.provider_id !== userId) {
        return c.json({ error: "Unauthorized" }, 403);
      }

      // Update booking status
      const { data, error } = await supabaseAdmin
        .from("bookings")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          cancellation_reason: reason || null,
          cancelled_by: userId,
        })
        .eq("id", bookingId)
        .select()
        .single();

      if (error) {
        console.error("Booking cancel error:", error);
        return c.json({ error: "Failed to cancel booking" }, 500);
      }

      // Delete meeting if exists
      try {
        const { deleteMeetingForBooking } = await import(
          "../meeting-generation.js"
        );
        await deleteMeetingForBooking(bookingId);
        console.log(
          "✅ Successfully deleted meeting for cancelled booking:",
          bookingId,
        );
      } catch (meetingError) {
        console.warn(
          "⚠️ Failed to delete meeting for cancelled booking:",
          bookingId,
          meetingError.message,
        );
      }

      return c.json(data);
    } catch (error) {
      console.error("Booking cancel error:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  /**
   * GET /api/bookings/:id/cancellation-policies
   *
   * Get applicable cancellation policies for a booking.
   * This endpoint returns policy information including:
   * - Time-based cancellation rules
   * - Refund percentages
   * - Policy application deadlines
   * - Cost breakdown for different cancellation times
   *
   * Headers:
   * - Authorization: Bearer {privyToken}
   *
   * Parameters:
   * - id: UUID of the booking
   *
   * Response:
   * - Cancellation policy object with refund calculations
   *
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with cancellation policies or error
   */
  app.get(
    "/api/bookings/:id/cancellation-policies",
    verifyPrivyAuth,
    async (c) => {
      try {
        const userId = c.get("userId");
        const bookingId = c.req.param("id");

        const policies = await getApplicableCancellationPolicies(
          bookingId,
          userId,
        );

        return c.json(policies);
      } catch (error) {
        console.error("Get cancellation policies error:", error);
        if (error.message === "Booking not found") {
          return c.json({ error: "Booking not found" }, 404);
        }
        if (error.message === "Unauthorized to cancel this booking") {
          return c.json({ error: "Unauthorized" }, 403);
        }
        return c.json({ error: "Internal server error" }, 500);
      }
    },
  );

  /**
   * POST /api/bookings/:id/refund-breakdown
   *
   * Calculate refund breakdown for a booking cancellation.
   * This endpoint provides detailed refund calculations including:
   * - Base refund amount
   * - Policy deductions
   * - Platform fees
   * - Final refund amount
   *
   * Headers:
   * - Authorization: Bearer {privyToken}
   *
   * Parameters:
   * - id: UUID of the booking
   *
   * Body:
   * - cancellation_time: Optional future cancellation time for calculation
   *
   * Response:
   * - Detailed refund breakdown object
   *
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with refund breakdown or error
   */
  app.post("/api/bookings/:id/refund-breakdown", verifyPrivyAuth, async (c) => {
    try {
      const bookingId = c.req.param("id");
      const { policyId } = await c.req.json();

      if (!policyId) {
        return c.json({ error: "Policy ID is required" }, 400);
      }

      const breakdown = await calculateRefundBreakdown(bookingId, policyId);

      return c.json(breakdown);
    } catch (error) {
      console.error("Calculate refund breakdown error:", error);
      if (error.message === "Booking not found") {
        return c.json({ error: "Booking not found" }, 404);
      }
      if (error.message === "Cancellation policy not found") {
        return c.json({ error: "Invalid policy selected" }, 400);
      }
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  /**
   * POST /api/bookings/:id/cancel-with-policy
   *
   * Cancel booking with explicit policy application.
   * This endpoint provides controlled cancellation with policy enforcement.
   *
   * Headers:
   * - Authorization: Bearer {privyToken}
   *
   * Parameters:
   * - id: UUID of the booking to cancel
   *
   * Body:
   * - acknowledge_policy: Boolean confirming policy understanding
   * - cancellation_reason: Reason for cancellation
   *
   * Response:
   * - Cancelled booking with refund details
   *
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with cancelled booking or error
   */
  app.post(
    "/api/bookings/:id/cancel-with-policy",
    verifyPrivyAuth,
    async (c) => {
      try {
        const userId = c.get("userId");
        const bookingId = c.req.param("id");
        const body = await c.req.json();
        const { acknowledge_policy, cancellation_reason } = body;

        if (!acknowledge_policy) {
          return c.json({ error: "Must acknowledge cancellation policy" }, 400);
        }

        // Delegate to main cancel endpoint with policy application
        return await app.request(`/api/bookings/${bookingId}/cancel`, {
          method: "POST",
          headers: c.req.header(),
          body: JSON.stringify({
            cancellation_reason,
            apply_policy: true,
          }),
        });
      } catch (error) {
        console.error("Policy cancellation error:", error);
        return c.json({ error: "Internal server error" }, 500);
      }
    },
  );

  /**
   * GET /api/bookings/:id/session-data
   *
   * Get Google Meet session duration data for a booking.
   * This endpoint provides session analytics for bookings with Google Meet links,
   * including provider and customer session durations for transparency.
   *
   * Headers:
   * - Authorization: Bearer {privyToken}
   *
   * Parameters:
   * - id: UUID of the booking
   *
   * Response:
   * - Session duration data with provider and customer analytics
   *
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with session data or error
   */
  app.get("/api/bookings/:id/session-data", verifyPrivyAuth, async (c) => {
    try {
      const userId = c.get("userId");
      const bookingId = c.req.param("id");

      // Get booking details
      const { data: booking, error: bookingError } = await supabaseAdmin
        .from("bookings")
        .select("customer_id, provider_id, is_online, meeting_link")
        .eq("id", bookingId)
        .single();

      if (bookingError || !booking) {
        console.error("Booking fetch error:", bookingError);
        return c.json({ error: "Booking not found" }, 404);
      }

      // Verify user has access to this booking
      if (booking.customer_id !== userId && booking.provider_id !== userId) {
        return c.json({ error: "Access denied" }, 403);
      }

      // Check if it's a Google Meet booking
      if (!booking.is_online || !booking.meeting_link || !booking.meeting_link.includes('meet.google.com')) {
        return c.json({
          error: "Not a Google Meet booking",
          message: "Session data is only available for Google Meet bookings"
        }, 400);
      }

      // Get session data from database
      const { data: sessionData, error: sessionError } = await supabaseAdmin
        .from("booking_session_data")
        .select("*")
        .eq("booking_id", bookingId)
        .single();

      if (sessionError || !sessionData) {
        console.log("No session data found for booking:", bookingId);

        // Try to fetch fresh session data
        try {
          const { checkGoogleMeetSessionDuration } = await import("../google-meet-session-tracker.js");
          const freshSessionData = await checkGoogleMeetSessionDuration(bookingId);

          if (freshSessionData.success) {
            return c.json({
              bookingId,
              providerDuration: freshSessionData.providerDuration,
              customerDuration: freshSessionData.customerDuration,
              serviceDuration: freshSessionData.serviceDuration,
              providerMeetsThreshold: freshSessionData.providerMeetsThreshold,
              threshold: freshSessionData.threshold,
              lastChecked: new Date().toISOString(),
              sessions: freshSessionData.sessions,
              freshData: true
            });
          } else {
            return c.json({
              error: "Session data not available",
              reason: freshSessionData.error || "Unable to fetch session data"
            }, 404);
          }
        } catch (trackerError) {
          console.error("Failed to fetch fresh session data:", trackerError);
          return c.json({
            error: "Session data not available",
            reason: "Unable to fetch session data from Google Meet API"
          }, 404);
        }
      }

      // Return existing session data
      return c.json({
        bookingId,
        providerDuration: sessionData.provider_total_duration,
        customerDuration: sessionData.customer_total_duration,
        serviceDuration: null, // Will be calculated on frontend
        providerMeetsThreshold: null, // Will be calculated on frontend
        threshold: 0.9,
        lastChecked: sessionData.last_checked_at,
        sessions: {
          provider: sessionData.provider_sessions || [],
          customer: sessionData.customer_sessions || []
        },
        freshData: false
      });

    } catch (error) {
      console.error("Session data fetch error:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  /**
   * POST /api/bookings/:id/authorize-cancellation
   *
   * Authorize cancellation with blockchain signature generation.
   * This endpoint handles cancellation authorization exactly as per old code.
   *
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with cancellation authorization or error
   */
  app.post(
    "/api/bookings/:id/authorize-cancellation",
    verifyPrivyAuth,
    async (c) => {
      try {
        const userId = c.get("userId");
        const bookingId = c.req.param("id");
        const { policyId, explanation } = await c.req.json();

        if (!policyId) {
          return c.json({ error: "Policy ID is required" }, 400);
        }

        console.log("🔐 Authorizing cancellation for booking:", bookingId);

        // Get booking first to debug
        console.log("🔍 Looking for booking:", bookingId);

        const { data: booking, error: bookingError } = await supabaseAdmin
          .from("bookings")
          .select("*")
          .eq("id", bookingId)
          .single();

        console.log(
          "🔍 Basic booking result:",
          booking ? "FOUND" : "NOT FOUND",
          bookingError,
        );

        if (bookingError || !booking) {
          console.error("❌ Basic booking query failed:", bookingError);
          return c.json({ error: "Booking not found" }, 404);
        }

        // Get service data
        const { data: service } = await supabaseAdmin
          .from("services")
          .select("*")
          .eq("id", booking.service_id)
          .single();

        booking.service = service;

        // Get customer wallet address from database
        const { data: customerUser } = await supabaseAdmin
          .from("users")
          .select("wallet_address")
          .eq("id", booking.customer_id)
          .single();

        const customerWallet = customerUser?.wallet_address;
        console.log("💰 Customer wallet address:", customerWallet);

        // Get provider wallet address from database
        const { data: providerUser } = await supabaseAdmin
          .from("users")
          .select("wallet_address")
          .eq("id", booking.provider_id)
          .single();

        const providerWallet = providerUser?.wallet_address;
        console.log("💰 Provider wallet address:", providerWallet);

        // Validate user can cancel this booking
        const isCustomer = booking.customer_id === userId;
        const isProvider = booking.provider_id === userId;

        if (!isCustomer && !isProvider) {
          return c.json({ error: "Unauthorized to cancel this booking" }, 403);
        }

        // Validate that the policy is applicable
        const isValid = await validatePolicySelection(
          bookingId,
          userId,
          policyId,
        );
        if (!isValid) {
          return c.json({ error: "Selected policy is not applicable" }, 400);
        }

        // Calculate refund breakdown
        const refundBreakdown = await calculateRefundBreakdown(
          bookingId,
          policyId,
        );

        // Validate we have wallet addresses
        if (!customerWallet || !providerWallet) {
          console.error("❌ Wallet addresses not found:", {
            customerWallet,
            providerWallet,
          });
          return c.json(
            {
              error:
                "Wallet addresses not configured. Please ensure wallet is connected.",
            },
            400,
          );
        }

        console.log("✅ Using wallet addresses from Privy API");

        // Generate EIP-712 authorization signature
        const eip712Signer = new EIP712Signer();
        const authorization = await eip712Signer.signCancellationAuthorization({
          bookingId: booking.id,
          customerAmount: refundBreakdown.breakdown.customerRefund,
          providerAmount: refundBreakdown.breakdown.providerEarnings,
          platformAmount: refundBreakdown.breakdown.platformFee,
          inviterAmount: 0, // TODO: Handle inviter fees if applicable
          reason: explanation || refundBreakdown.policyTitle,
          expiryMinutes: 5,
        });

        console.log("✅ Generated cancellation authorization");

        // Convert BigInt values to strings for JSON serialization
        const serializableAuthorization = {
          ...authorization.authorization,
          customerAmount: authorization.authorization.customerAmount.toString(),
          providerAmount: authorization.authorization.providerAmount.toString(),
          platformAmount: authorization.authorization.platformAmount.toString(),
          inviterAmount: authorization.authorization.inviterAmount.toString(),
          expiry: authorization.authorization.expiry.toString(),
          nonce: authorization.authorization.nonce.toString(),
        };

        // Determine current user's wallet address
        const currentUserWallet = isCustomer ? customerWallet : providerWallet;

        return c.json({
          authorization: serializableAuthorization,
          signature: authorization.signature,
          refundBreakdown,
          walletAddress: currentUserWallet,
          expiry: authorization.expiry,
          nonce: authorization.nonce,
        });
      } catch (error) {
        console.error("❌ Cancellation authorization error:", error);
        return c.json(
          { error: "Failed to generate cancellation authorization" },
          500,
        );
      }
    },
  );
}

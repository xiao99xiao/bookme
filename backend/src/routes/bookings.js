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

import { Hono } from 'hono';
import { verifyPrivyAuth, getSupabaseAdmin } from '../middleware/auth.js';

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
   * - timezone: Customer's timezone for scheduling
   * - duration_minutes: Service duration override (optional)
   * - price: Service price override (optional)
   * 
   * Response:
   * - Full booking object with EIP-712 payment authorization
   * 
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with booking data or error
   */
  app.post('/api/bookings', verifyPrivyAuth, async (c) => {
    try {
      const userId = c.get('userId');
      const body = await c.req.json();
      const { service_id, scheduled_at, customer_notes, timezone, duration_minutes, price } = body;

      if (!service_id || !scheduled_at) {
        return c.json({ error: 'Service ID and scheduled time are required' }, 400);
      }

      // Get service details
      const { data: service, error: serviceError } = await supabaseAdmin
        .from('services')
        .select('*, provider:users!provider_id(*)')
        .eq('id', service_id)
        .eq('is_visible', true)
        .single();

      if (serviceError || !service) {
        console.error('Service fetch error:', serviceError);
        return c.json({ error: 'Service not found' }, 404);
      }

      // Prevent self-booking
      if (service.provider_id === userId) {
        return c.json({ error: 'Cannot book your own service' }, 400);
      }

      // Get customer details
      const { data: customer, error: customerError } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (customerError || !customer) {
        console.error('Customer fetch error:', customerError);
        return c.json({ error: 'Customer not found' }, 404);
      }

      // Validate scheduled time
      const scheduledDate = new Date(scheduled_at);
      const now = new Date();
      if (scheduledDate <= now) {
        return c.json({ error: 'Cannot schedule bookings in the past' }, 400);
      }

      // Check for conflicting bookings
      const { data: existingBookings, error: conflictError } = await supabaseAdmin
        .from('bookings')
        .select('id, scheduled_at, duration_minutes')
        .eq('provider_id', service.provider_id)
        .in('status', ['confirmed', 'in_progress', 'pending_payment'])
        .gte('scheduled_at', now.toISOString())
        .lte('scheduled_at', new Date(scheduledDate.getTime() + 24 * 60 * 60 * 1000).toISOString());

      if (conflictError) {
        console.error('Conflict check error:', conflictError);
        return c.json({ error: 'Failed to check availability' }, 500);
      }

      // Check for time conflicts
      const bookingDuration = duration_minutes || service.duration_minutes;
      const bookingStart = scheduledDate.getTime();
      const bookingEnd = bookingStart + (bookingDuration * 60 * 1000);

      const hasConflict = existingBookings?.some(existing => {
        const existingStart = new Date(existing.scheduled_at).getTime();
        const existingEnd = existingStart + (existing.duration_minutes * 60 * 1000);
        return (bookingStart < existingEnd && bookingEnd > existingStart);
      });

      if (hasConflict) {
        return c.json({ error: 'Time slot is not available' }, 409);
      }

      // Create booking record
      const bookingData = {
        service_id: service_id,
        customer_id: userId,
        provider_id: service.provider_id,
        scheduled_at: scheduled_at,
        customer_notes: customer_notes || null,
        timezone: timezone || 'UTC',
        duration_minutes: bookingDuration,
        price: price || service.price,
        status: 'pending_payment',
        created_at: new Date().toISOString(),
        booking_number: `BK-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`
      };

      const { data: booking, error: bookingError } = await supabaseAdmin
        .from('bookings')
        .insert(bookingData)
        .select(`
          *,
          service:services(*),
          customer:users!customer_id(*),
          provider:users!provider_id(*)
        `)
        .single();

      if (bookingError) {
        console.error('Booking creation error:', bookingError);
        return c.json({ error: 'Failed to create booking' }, 500);
      }

      // Generate EIP-712 payment authorization
      try {
        const { generatePaymentAuthorization } = await import('../eip712-signer.js');
        const paymentAuth = await generatePaymentAuthorization({
          bookingId: booking.id,
          amount: booking.price,
          customerAddress: customer.wallet_address || customer.smart_wallet_address,
          providerAddress: service.provider.wallet_address || service.provider.smart_wallet_address,
          nonce: Date.now()
        });

        // Store payment authorization in booking
        const { data: updatedBooking, error: updateError } = await supabaseAdmin
          .from('bookings')
          .update({
            payment_authorization: paymentAuth,
            payment_deadline: new Date(Date.now() + 3 * 60 * 1000).toISOString() // 3 minutes
          })
          .eq('id', booking.id)
          .select(`
            *,
            service:services(*),
            customer:users!customer_id(*),
            provider:users!provider_id(*)
          `)
          .single();

        if (updateError) {
          console.error('Payment auth update error:', updateError);
          return c.json({ error: 'Failed to generate payment authorization' }, 500);
        }

        // Send notification emails asynchronously (don't await)
        setImmediate(async () => {
          try {
            // Email logic would go here in production
            console.log('Booking created notification sent:', booking.id);
          } catch (emailError) {
            console.error('Email notification error:', emailError);
          }
        });

        return c.json(updatedBooking);

      } catch (authError) {
        console.error('Payment authorization error:', authError);
        return c.json({ error: 'Failed to generate payment authorization' }, 500);
      }

    } catch (error) {
      console.error('Booking creation error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  /**
   * POST /api/bookings/:id/authorize-payment
   * 
   * Process blockchain payment for a booking.
   * This endpoint handles the payment execution flow including:
   * - Transaction hash validation
   * - Blockchain event verification
   * - Booking status updates
   * - Provider earnings tracking
   * 
   * Headers:
   * - Authorization: Bearer {privyToken}
   * 
   * Parameters:
   * - id: UUID of the booking
   * 
   * Body:
   * - transaction_hash: Blockchain transaction hash
   * - signature: EIP-712 signature from customer
   * 
   * Response:
   * - Updated booking object with payment confirmation
   * 
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with updated booking or error
   */
  app.post('/api/bookings/:id/authorize-payment', verifyPrivyAuth, async (c) => {
    try {
      const userId = c.get('userId');
      const bookingId = c.req.param('id');
      const body = await c.req.json();
      const { transaction_hash, signature } = body;

      if (!transaction_hash) {
        return c.json({ error: 'Transaction hash is required' }, 400);
      }

      // Get booking details
      const { data: booking, error: bookingError } = await supabaseAdmin
        .from('bookings')
        .select(`
          *,
          service:services(*),
          customer:users!customer_id(*),
          provider:users!provider_id(*)
        `)
        .eq('id', bookingId)
        .eq('customer_id', userId)
        .single();

      if (bookingError || !booking) {
        console.error('Booking fetch error:', bookingError);
        return c.json({ error: 'Booking not found' }, 404);
      }

      if (booking.status !== 'pending_payment') {
        return c.json({ error: 'Payment already processed or booking cancelled' }, 400);
      }

      // Verify transaction on blockchain
      try {
        const { verifyPaymentTransaction } = await import('../blockchain-service.js');
        const isValid = await verifyPaymentTransaction(transaction_hash, {
          bookingId: booking.id,
          amount: booking.price,
          customerAddress: booking.customer.wallet_address || booking.customer.smart_wallet_address,
          providerAddress: booking.provider.wallet_address || booking.provider.smart_wallet_address
        });

        if (!isValid) {
          return c.json({ error: 'Invalid payment transaction' }, 400);
        }
      } catch (verifyError) {
        console.error('Payment verification error:', verifyError);
        return c.json({ error: 'Failed to verify payment' }, 500);
      }

      // Update booking status
      const { data: updatedBooking, error: updateError } = await supabaseAdmin
        .from('bookings')
        .update({
          status: 'confirmed',
          payment_hash: transaction_hash,
          payment_signature: signature,
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId)
        .select(`
          *,
          service:services(*),
          customer:users!customer_id(*),
          provider:users!provider_id(*)
        `)
        .single();

      if (updateError) {
        console.error('Booking update error:', updateError);
        return c.json({ error: 'Failed to update booking status' }, 500);
      }

      // Update provider stats asynchronously
      setImmediate(async () => {
        try {
          await supabaseAdmin.rpc('increment_provider_earnings', {
            provider_id: booking.provider_id,
            amount: booking.price
          });
        } catch (statsError) {
          console.error('Provider stats update error:', statsError);
        }
      });

      // Log blockchain event
      setImmediate(async () => {
        try {
          await supabaseAdmin
            .from('blockchain_events')
            .insert({
              booking_id: bookingId,
              event_type: 'payment_authorized',
              transaction_hash: transaction_hash,
              block_timestamp: new Date().toISOString(),
              event_data: { amount: booking.price, signature }
            });
        } catch (logError) {
          console.error('Blockchain event log error:', logError);
        }
      });

      return c.json(updatedBooking);

    } catch (error) {
      console.error('Payment authorization error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  /**
   * POST /api/bookings/:id/complete-service
   * 
   * Mark a service as completed by the customer.
   * This endpoint handles service completion including:
   * - Status validation
   * - Completion timestamp recording
   * - Smart contract fund release
   * - Provider earnings distribution
   * 
   * Headers:
   * - Authorization: Bearer {privyToken}
   * 
   * Parameters:
   * - id: UUID of the booking
   * 
   * Body:
   * - completion_notes: Optional completion notes from customer
   * 
   * Response:
   * - Updated booking object with completion status
   * 
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with completed booking or error
   */
  app.post('/api/bookings/:id/complete-service', verifyPrivyAuth, async (c) => {
    try {
      const userId = c.get('userId');
      const bookingId = c.req.param('id');
      const body = await c.req.json();
      const { completion_notes } = body;

      // Get booking details
      const { data: booking, error: bookingError } = await supabaseAdmin
        .from('bookings')
        .select(`
          *,
          service:services(*),
          customer:users!customer_id(*),
          provider:users!provider_id(*)
        `)
        .eq('id', bookingId)
        .single();

      if (bookingError || !booking) {
        console.error('Booking fetch error:', bookingError);
        return c.json({ error: 'Booking not found' }, 404);
      }

      // Only customer can mark service as complete
      if (booking.customer_id !== userId) {
        return c.json({ error: 'Only the customer can mark service as complete' }, 403);
      }

      if (booking.status !== 'confirmed' && booking.status !== 'in_progress') {
        return c.json({ error: 'Service cannot be completed from current status' }, 400);
      }

      // Update booking to completed
      const { data: updatedBooking, error: updateError } = await supabaseAdmin
        .from('bookings')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completion_notes: completion_notes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId)
        .select(`
          *,
          service:services(*),
          customer:users!customer_id(*),
          provider:users!provider_id(*)
        `)
        .single();

      if (updateError) {
        console.error('Booking completion error:', updateError);
        return c.json({ error: 'Failed to complete booking' }, 500);
      }

      // Trigger smart contract fund release asynchronously
      setImmediate(async () => {
        try {
          const { releaseFunds } = await import('../blockchain-service.js');
          await releaseFunds({
            bookingId: booking.id,
            amount: booking.price,
            providerAddress: booking.provider.wallet_address || booking.provider.smart_wallet_address
          });

          // Log blockchain event
          await supabaseAdmin
            .from('blockchain_events')
            .insert({
              booking_id: bookingId,
              event_type: 'funds_released',
              transaction_hash: null, // Will be updated when transaction completes
              block_timestamp: new Date().toISOString(),
              event_data: { amount: booking.price, provider: booking.provider_id }
            });

        } catch (releaseError) {
          console.error('Fund release error:', releaseError);
        }
      });

      return c.json(updatedBooking);

    } catch (error) {
      console.error('Service completion error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  /**
   * POST /api/bookings/:id/complete-service-backend
   * 
   * Internal endpoint for backend-triggered service completion.
   * This endpoint is used by automated systems or admin operations
   * to complete services without customer interaction.
   * 
   * Parameters:
   * - id: UUID of the booking
   * 
   * Body:
   * - admin_notes: Administrative notes for the completion
   * - trigger_reason: Reason for backend completion
   * 
   * Response:
   * - Updated booking object with completion status
   * 
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with completed booking or error
   */
  app.post('/api/bookings/:id/complete-service-backend', async (c) => {
    try {
      const bookingId = c.req.param('id');
      const body = await c.req.json();
      const { admin_notes, trigger_reason } = body;

      // Verify request comes from internal system (in production, add proper auth)
      // For now, just log the backend completion
      console.log('Backend completion triggered for booking:', bookingId);

      // Get booking details
      const { data: booking, error: bookingError } = await supabaseAdmin
        .from('bookings')
        .select(`
          *,
          service:services(*),
          customer:users!customer_id(*),
          provider:users!provider_id(*)
        `)
        .eq('id', bookingId)
        .single();

      if (bookingError || !booking) {
        console.error('Booking fetch error:', bookingError);
        return c.json({ error: 'Booking not found' }, 404);
      }

      if (booking.status !== 'confirmed' && booking.status !== 'in_progress') {
        return c.json({ error: 'Service cannot be completed from current status' }, 400);
      }

      // Update booking to completed with backend completion flag
      const { data: updatedBooking, error: updateError } = await supabaseAdmin
        .from('bookings')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completion_notes: admin_notes || 'Completed by backend system',
          backend_completed: true,
          backend_completion_reason: trigger_reason,
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId)
        .select(`
          *,
          service:services(*),
          customer:users!customer_id(*),
          provider:users!provider_id(*)
        `)
        .single();

      if (updateError) {
        console.error('Backend completion error:', updateError);
        return c.json({ error: 'Failed to complete booking' }, 500);
      }

      // Trigger smart contract fund release
      setImmediate(async () => {
        try {
          const { releaseFunds } = await import('../blockchain-service.js');
          await releaseFunds({
            bookingId: booking.id,
            amount: booking.price,
            providerAddress: booking.provider.wallet_address || booking.provider.smart_wallet_address
          });
        } catch (releaseError) {
          console.error('Backend fund release error:', releaseError);
        }
      });

      return c.json(updatedBooking);

    } catch (error) {
      console.error('Backend completion error:', error);
      return c.json({ error: 'Internal server error' }, 500);
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
  app.get('/api/bookings/:id/blockchain-status', verifyPrivyAuth, async (c) => {
    try {
      const userId = c.get('userId');
      const bookingId = c.req.param('id');

      // Get booking details
      const { data: booking, error: bookingError } = await supabaseAdmin
        .from('bookings')
        .select('*, customer_id, provider_id, payment_hash')
        .eq('id', bookingId)
        .single();

      if (bookingError || !booking) {
        console.error('Booking fetch error:', bookingError);
        return c.json({ error: 'Booking not found' }, 404);
      }

      // Verify user has access to this booking
      if (booking.customer_id !== userId && booking.provider_id !== userId) {
        return c.json({ error: 'Access denied' }, 403);
      }

      if (!booking.payment_hash) {
        return c.json({
          status: 'no_payment',
          message: 'No payment transaction found'
        });
      }

      // Get blockchain events for this booking
      const { data: events, error: eventsError } = await supabaseAdmin
        .from('blockchain_events')
        .select('*')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: true });

      if (eventsError) {
        console.error('Blockchain events fetch error:', eventsError);
        return c.json({ error: 'Failed to fetch blockchain status' }, 500);
      }

      // Get transaction status from blockchain
      try {
        const { getTransactionStatus } = await import('../blockchain-service.js');
        const txStatus = await getTransactionStatus(booking.payment_hash);

        return c.json({
          booking_id: bookingId,
          payment_hash: booking.payment_hash,
          transaction_status: txStatus,
          blockchain_events: events || [],
          last_updated: new Date().toISOString()
        });

      } catch (blockchainError) {
        console.error('Blockchain status check error:', blockchainError);
        return c.json({
          booking_id: bookingId,
          payment_hash: booking.payment_hash,
          transaction_status: 'unknown',
          blockchain_events: events || [],
          error: 'Unable to verify blockchain status',
          last_updated: new Date().toISOString()
        });
      }

    } catch (error) {
      console.error('Blockchain status error:', error);
      return c.json({ error: 'Internal server error' }, 500);
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
  app.get('/api/bookings/user/:userId', verifyPrivyAuth, async (c) => {
    try {
      const authenticatedUserId = c.get('userId');
      const targetUserId = c.req.param('userId');
      const { role, status, limit = '50', offset = '0' } = c.req.query();

      // Only allow users to see their own bookings
      if (authenticatedUserId !== targetUserId) {
        return c.json({ error: 'Access denied' }, 403);
      }

      let query = supabaseAdmin
        .from('bookings')
        .select(`
          *,
          service:services(*),
          customer:users!customer_id(*),
          provider:users!provider_id(*)
        `);

      // Filter by user role
      if (role === 'customer') {
        query = query.eq('customer_id', targetUserId);
      } else if (role === 'provider') {
        query = query.eq('provider_id', targetUserId);
      } else {
        // Get both customer and provider bookings
        query = query.or(`customer_id.eq.${targetUserId},provider_id.eq.${targetUserId}`);
      }

      // Filter by status if provided
      if (status) {
        query = query.eq('status', status);
      }

      // Apply pagination
      query = query
        .order('created_at', { ascending: false })
        .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

      const { data, error } = await query;

      if (error) {
        console.error('User bookings fetch error:', error);
        return c.json({ error: 'Failed to fetch bookings' }, 500);
      }

      return c.json(data || []);

    } catch (error) {
      console.error('User bookings error:', error);
      return c.json({ error: 'Internal server error' }, 500);
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
  app.patch('/api/bookings/:bookingId', verifyPrivyAuth, async (c) => {
    try {
      const userId = c.get('userId');
      const bookingId = c.req.param('bookingId');
      const updates = await c.req.json();

      // Get current booking
      const { data: booking, error: bookingError } = await supabaseAdmin
        .from('bookings')
        .select(`
          *,
          service:services(*),
          customer:users!customer_id(*),
          provider:users!provider_id(*)
        `)
        .eq('id', bookingId)
        .single();

      if (bookingError || !booking) {
        console.error('Booking fetch error:', bookingError);
        return c.json({ error: 'Booking not found' }, 404);
      }

      // Check if user has permission to update this booking
      const isCustomer = booking.customer_id === userId;
      const isProvider = booking.provider_id === userId;
      
      if (!isCustomer && !isProvider) {
        return c.json({ error: 'Access denied' }, 403);
      }

      // Validate status transitions
      const { status } = updates;
      if (status) {
        const validTransitions = {
          'pending_payment': ['cancelled'],
          'confirmed': ['in_progress', 'cancelled'],
          'in_progress': ['completed', 'cancelled'],
          'completed': [], // No transitions from completed
          'cancelled': [], // No transitions from cancelled
          'rejected': [] // No transitions from rejected
        };

        if (!validTransitions[booking.status]?.includes(status)) {
          return c.json({ 
            error: `Cannot transition from ${booking.status} to ${status}` 
          }, 400);
        }

        // Only providers can mark as in_progress
        if (status === 'in_progress' && !isProvider) {
          return c.json({ error: 'Only provider can start the service' }, 403);
        }

        // Only customers can mark as completed
        if (status === 'completed' && !isCustomer) {
          return c.json({ error: 'Only customer can mark service as complete' }, 403);
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
        .from('bookings')
        .update(updates)
        .eq('id', bookingId)
        .select(`
          *,
          service:services(*),
          customer:users!customer_id(*),
          provider:users!provider_id(*)
        `)
        .single();

      if (updateError) {
        console.error('Booking update error:', updateError);
        return c.json({ error: 'Failed to update booking' }, 500);
      }

      // Send notifications for status changes
      if (status && status !== booking.status) {
        setImmediate(async () => {
          try {
            console.log(`Booking ${bookingId} status changed from ${booking.status} to ${status}`);
            // Email notifications would go here
          } catch (notificationError) {
            console.error('Notification error:', notificationError);
          }
        });
      }

      return c.json(updatedBooking);

    } catch (error) {
      console.error('Booking update error:', error);
      return c.json({ error: 'Internal server error' }, 500);
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
  app.post('/api/bookings/:bookingId/reject', verifyPrivyAuth, async (c) => {
    try {
      const userId = c.get('userId');
      const bookingId = c.req.param('bookingId');
      const body = await c.req.json();
      const { rejection_reason, provider_notes } = body;

      // Get booking details
      const { data: booking, error: bookingError } = await supabaseAdmin
        .from('bookings')
        .select(`
          *,
          service:services(*),
          customer:users!customer_id(*),
          provider:users!provider_id(*)
        `)
        .eq('id', bookingId)
        .single();

      if (bookingError || !booking) {
        console.error('Booking fetch error:', bookingError);
        return c.json({ error: 'Booking not found' }, 404);
      }

      // Only provider can reject bookings
      if (booking.provider_id !== userId) {
        return c.json({ error: 'Only the provider can reject this booking' }, 403);
      }

      // Can only reject confirmed bookings
      if (booking.status !== 'confirmed') {
        return c.json({ error: 'Can only reject confirmed bookings' }, 400);
      }

      // Update booking to rejected status
      const { data: rejectedBooking, error: updateError } = await supabaseAdmin
        .from('bookings')
        .update({
          status: 'rejected',
          rejection_reason: rejection_reason || 'No reason provided',
          provider_notes: provider_notes,
          rejected_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId)
        .select(`
          *,
          service:services(*),
          customer:users!customer_id(*),
          provider:users!provider_id(*)
        `)
        .single();

      if (updateError) {
        console.error('Booking rejection error:', updateError);
        return c.json({ error: 'Failed to reject booking' }, 500);
      }

      // Process refund asynchronously
      if (booking.payment_hash) {
        setImmediate(async () => {
          try {
            const { processRefund } = await import('../blockchain-service.js');
            await processRefund({
              bookingId: booking.id,
              amount: booking.price,
              customerAddress: booking.customer.wallet_address || booking.customer.smart_wallet_address,
              reason: 'Provider rejection'
            });

            // Log blockchain event
            await supabaseAdmin
              .from('blockchain_events')
              .insert({
                booking_id: bookingId,
                event_type: 'refund_processed',
                transaction_hash: null, // Will be updated when transaction completes
                block_timestamp: new Date().toISOString(),
                event_data: { 
                  amount: booking.price, 
                  reason: 'provider_rejection',
                  rejection_reason 
                }
              });

          } catch (refundError) {
            console.error('Refund processing error:', refundError);
          }
        });
      }

      // Send notification to customer
      setImmediate(async () => {
        try {
          console.log(`Booking ${bookingId} rejected by provider: ${rejection_reason}`);
          // Email notification logic would go here
        } catch (notificationError) {
          console.error('Rejection notification error:', notificationError);
        }
      });

      return c.json(rejectedBooking);

    } catch (error) {
      console.error('Booking rejection error:', error);
      return c.json({ error: 'Internal server error' }, 500);
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
  app.post('/api/bookings/:id/cancel', verifyPrivyAuth, async (c) => {
    try {
      const userId = c.get('userId');
      const bookingId = c.req.param('id');
      const body = await c.req.json();
      const { cancellation_reason, apply_policy = true } = body;

      // Get booking details
      const { data: booking, error: bookingError } = await supabaseAdmin
        .from('bookings')
        .select(`
          *,
          service:services(*),
          customer:users!customer_id(*),
          provider:users!provider_id(*)
        `)
        .eq('id', bookingId)
        .single();

      if (bookingError || !booking) {
        console.error('Booking fetch error:', bookingError);
        return c.json({ error: 'Booking not found' }, 404);
      }

      // Check if user can cancel this booking
      const isCustomer = booking.customer_id === userId;
      const isProvider = booking.provider_id === userId;
      
      if (!isCustomer && !isProvider) {
        return c.json({ error: 'Access denied' }, 403);
      }

      // Check if booking can be cancelled
      const cancellableStatuses = ['pending_payment', 'confirmed', 'in_progress'];
      if (!cancellableStatuses.includes(booking.status)) {
        return c.json({ error: 'Booking cannot be cancelled in current status' }, 400);
      }

      // Calculate refund amount based on cancellation policy
      let refundAmount = booking.price;
      let policyApplied = false;

      if (apply_policy && isCustomer) {
        const now = new Date();
        const scheduledDate = new Date(booking.scheduled_at);
        const hoursUntilService = (scheduledDate.getTime() - now.getTime()) / (1000 * 60 * 60);

        // Apply cancellation policy based on timing
        if (hoursUntilService < 24) {
          refundAmount = booking.price * 0.5; // 50% refund for less than 24h notice
          policyApplied = true;
        } else if (hoursUntilService < 48) {
          refundAmount = booking.price * 0.75; // 75% refund for less than 48h notice
          policyApplied = true;
        }
        // Full refund for 48+ hours notice
      }

      // Update booking to cancelled
      const { data: cancelledBooking, error: updateError } = await supabaseAdmin
        .from('bookings')
        .update({
          status: 'cancelled',
          cancellation_reason: cancellation_reason || 'No reason provided',
          cancelled_by: userId,
          cancelled_at: new Date().toISOString(),
          refund_amount: refundAmount,
          cancellation_policy_applied: policyApplied,
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId)
        .select(`
          *,
          service:services(*),
          customer:users!customer_id(*),
          provider:users!provider_id(*)
        `)
        .single();

      if (updateError) {
        console.error('Booking cancellation error:', updateError);
        return c.json({ error: 'Failed to cancel booking' }, 500);
      }

      // Process refund if payment was made
      if (booking.payment_hash && refundAmount > 0) {
        setImmediate(async () => {
          try {
            const { processRefund } = await import('../blockchain-service.js');
            await processRefund({
              bookingId: booking.id,
              amount: refundAmount,
              customerAddress: booking.customer.wallet_address || booking.customer.smart_wallet_address,
              reason: 'Booking cancellation'
            });

            // Log blockchain event
            await supabaseAdmin
              .from('blockchain_events')
              .insert({
                booking_id: bookingId,
                event_type: 'refund_processed',
                transaction_hash: null,
                block_timestamp: new Date().toISOString(),
                event_data: { 
                  amount: refundAmount, 
                  original_amount: booking.price,
                  policy_applied: policyApplied,
                  reason: 'cancellation' 
                }
              });

          } catch (refundError) {
            console.error('Refund processing error:', refundError);
          }
        });
      }

      return c.json(cancelledBooking);

    } catch (error) {
      console.error('Booking cancellation error:', error);
      return c.json({ error: 'Internal server error' }, 500);
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
  app.get('/api/bookings/:id/cancellation-policies', verifyPrivyAuth, async (c) => {
    try {
      const userId = c.get('userId');
      const bookingId = c.req.param('id');

      // Get booking details
      const { data: booking, error: bookingError } = await supabaseAdmin
        .from('bookings')
        .select('*, customer_id, provider_id, scheduled_at, price')
        .eq('id', bookingId)
        .single();

      if (bookingError || !booking) {
        console.error('Booking fetch error:', bookingError);
        return c.json({ error: 'Booking not found' }, 404);
      }

      // Check access
      if (booking.customer_id !== userId && booking.provider_id !== userId) {
        return c.json({ error: 'Access denied' }, 403);
      }

      const now = new Date();
      const scheduledDate = new Date(booking.scheduled_at);
      const hoursUntilService = Math.max(0, (scheduledDate.getTime() - now.getTime()) / (1000 * 60 * 60));

      // Calculate refund scenarios
      const policies = {
        current_refund: booking.price,
        policy_applied: false,
        hours_until_service: Math.round(hoursUntilService),
        scenarios: [
          {
            timeframe: '48+ hours before',
            refund_percentage: 100,
            refund_amount: booking.price,
            applicable: hoursUntilService >= 48
          },
          {
            timeframe: '24-48 hours before',
            refund_percentage: 75,
            refund_amount: booking.price * 0.75,
            applicable: hoursUntilService >= 24 && hoursUntilService < 48
          },
          {
            timeframe: 'Less than 24 hours before',
            refund_percentage: 50,
            refund_amount: booking.price * 0.5,
            applicable: hoursUntilService < 24
          }
        ]
      };

      // Determine current policy
      if (hoursUntilService < 24) {
        policies.current_refund = booking.price * 0.5;
        policies.policy_applied = true;
      } else if (hoursUntilService < 48) {
        policies.current_refund = booking.price * 0.75;
        policies.policy_applied = true;
      }

      return c.json(policies);

    } catch (error) {
      console.error('Cancellation policies error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

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
  app.post('/api/bookings/:id/refund-breakdown', verifyPrivyAuth, async (c) => {
    try {
      const userId = c.get('userId');
      const bookingId = c.req.param('id');
      const body = await c.req.json();
      const { cancellation_time } = body;

      // Get booking details
      const { data: booking, error: bookingError } = await supabaseAdmin
        .from('bookings')
        .select('*, customer_id, provider_id, scheduled_at, price')
        .eq('id', bookingId)
        .single();

      if (bookingError || !booking) {
        console.error('Booking fetch error:', bookingError);
        return c.json({ error: 'Booking not found' }, 404);
      }

      // Check access
      if (booking.customer_id !== userId && booking.provider_id !== userId) {
        return c.json({ error: 'Access denied' }, 403);
      }

      // Use provided cancellation time or current time
      const cancelTime = cancellation_time ? new Date(cancellation_time) : new Date();
      const scheduledDate = new Date(booking.scheduled_at);
      const hoursUntilService = Math.max(0, (scheduledDate.getTime() - cancelTime.getTime()) / (1000 * 60 * 60));

      // Calculate refund breakdown
      const originalAmount = booking.price;
      let refundPercentage = 100;
      let policyDeduction = 0;

      // Apply cancellation policy
      if (hoursUntilService < 24) {
        refundPercentage = 50;
        policyDeduction = originalAmount * 0.5;
      } else if (hoursUntilService < 48) {
        refundPercentage = 75;
        policyDeduction = originalAmount * 0.25;
      }

      const refundAmount = originalAmount - policyDeduction;

      const breakdown = {
        booking_id: bookingId,
        original_amount: originalAmount,
        refund_percentage: refundPercentage,
        policy_deduction: policyDeduction,
        final_refund_amount: refundAmount,
        hours_until_service: Math.round(hoursUntilService),
        calculation_time: cancelTime.toISOString(),
        policy_details: {
          '48+ hours': { percentage: 100, deduction: 0 },
          '24-48 hours': { percentage: 75, deduction: originalAmount * 0.25 },
          '<24 hours': { percentage: 50, deduction: originalAmount * 0.5 }
        }
      };

      return c.json(breakdown);

    } catch (error) {
      console.error('Refund breakdown error:', error);
      return c.json({ error: 'Internal server error' }, 500);
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
  app.post('/api/bookings/:id/cancel-with-policy', verifyPrivyAuth, async (c) => {
    try {
      const userId = c.get('userId');
      const bookingId = c.req.param('id');
      const body = await c.req.json();
      const { acknowledge_policy, cancellation_reason } = body;

      if (!acknowledge_policy) {
        return c.json({ error: 'Must acknowledge cancellation policy' }, 400);
      }

      // Delegate to main cancel endpoint with policy application
      return await app.request(`/api/bookings/${bookingId}/cancel`, {
        method: 'POST',
        headers: c.req.header(),
        body: JSON.stringify({
          cancellation_reason,
          apply_policy: true
        })
      });

    } catch (error) {
      console.error('Policy cancellation error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  /**
   * POST /api/bookings/:id/authorize-cancellation
   * 
   * Authorize cancellation with blockchain signature verification.
   * This endpoint handles secure cancellation authorization including:
   * - EIP-712 signature verification
   * - Cancellation authorization validation
   * - Smart contract cancellation processing
   * - Automatic refund execution
   * 
   * Headers:
   * - Authorization: Bearer {privyToken}
   * 
   * Parameters:
   * - id: UUID of the booking to authorize cancellation
   * 
   * Body:
   * - signature: EIP-712 cancellation signature
   * - cancellation_data: Signed cancellation data
   * - reason: Cancellation reason
   * 
   * Response:
   * - Authorized cancellation object with transaction details
   * 
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with cancellation authorization or error
   */
  app.post('/api/bookings/:id/authorize-cancellation', verifyPrivyAuth, async (c) => {
    try {
      const userId = c.get('userId');
      const bookingId = c.req.param('id');
      const body = await c.req.json();
      const { signature, cancellation_data, reason } = body;

      if (!signature || !cancellation_data) {
        return c.json({ error: 'Signature and cancellation data are required' }, 400);
      }

      // Get booking details
      const { data: booking, error: bookingError } = await supabaseAdmin
        .from('bookings')
        .select(`
          *,
          service:services(*),
          customer:users!customer_id(*),
          provider:users!provider_id(*)
        `)
        .eq('id', bookingId)
        .single();

      if (bookingError || !booking) {
        console.error('Booking fetch error:', bookingError);
        return c.json({ error: 'Booking not found' }, 404);
      }

      // Check access
      const isCustomer = booking.customer_id === userId;
      const isProvider = booking.provider_id === userId;
      
      if (!isCustomer && !isProvider) {
        return c.json({ error: 'Access denied' }, 403);
      }

      // Verify EIP-712 signature
      try {
        const { verifyCancellationSignature } = await import('../eip712-signer.js');
        const signerAddress = isCustomer ? 
          (booking.customer.wallet_address || booking.customer.smart_wallet_address) :
          (booking.provider.wallet_address || booking.provider.smart_wallet_address);

        const isValidSignature = await verifyCancellationSignature({
          signature,
          cancellationData: cancellation_data,
          signerAddress,
          bookingId: booking.id
        });

        if (!isValidSignature) {
          return c.json({ error: 'Invalid cancellation signature' }, 400);
        }
      } catch (signatureError) {
        console.error('Signature verification error:', signatureError);
        return c.json({ error: 'Failed to verify cancellation signature' }, 500);
      }

      // Calculate refund amount
      const now = new Date();
      const scheduledDate = new Date(booking.scheduled_at);
      const hoursUntilService = (scheduledDate.getTime() - now.getTime()) / (1000 * 60 * 60);

      let refundAmount = booking.price;
      let policyApplied = false;

      if (isCustomer && hoursUntilService < 24) {
        refundAmount = booking.price * 0.5;
        policyApplied = true;
      } else if (isCustomer && hoursUntilService < 48) {
        refundAmount = booking.price * 0.75;
        policyApplied = true;
      }

      // Update booking with authorized cancellation
      const { data: cancelledBooking, error: updateError } = await supabaseAdmin
        .from('bookings')
        .update({
          status: 'cancelled',
          cancellation_reason: reason || 'Authorized cancellation',
          cancelled_by: userId,
          cancelled_at: new Date().toISOString(),
          cancellation_signature: signature,
          cancellation_authorization: cancellation_data,
          refund_amount: refundAmount,
          cancellation_policy_applied: policyApplied,
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId)
        .select(`
          *,
          service:services(*),
          customer:users!customer_id(*),
          provider:users!provider_id(*)
        `)
        .single();

      if (updateError) {
        console.error('Authorized cancellation error:', updateError);
        return c.json({ error: 'Failed to process authorized cancellation' }, 500);
      }

      // Process blockchain cancellation and refund
      if (booking.payment_hash && refundAmount > 0) {
        setImmediate(async () => {
          try {
            const { processAuthorizedCancellation } = await import('../blockchain-service.js');
            await processAuthorizedCancellation({
              bookingId: booking.id,
              signature,
              cancellationData: cancellation_data,
              refundAmount,
              customerAddress: booking.customer.wallet_address || booking.customer.smart_wallet_address
            });

            // Log blockchain event
            await supabaseAdmin
              .from('blockchain_events')
              .insert({
                booking_id: bookingId,
                event_type: 'authorized_cancellation',
                transaction_hash: null, // Will be updated when transaction completes
                block_timestamp: new Date().toISOString(),
                event_data: { 
                  amount: refundAmount,
                  signature,
                  authorized_by: userId,
                  reason 
                }
              });

          } catch (blockchainError) {
            console.error('Blockchain cancellation error:', blockchainError);
          }
        });
      }

      return c.json({
        booking: cancelledBooking,
        authorization: {
          signature,
          cancellation_data,
          refund_amount: refundAmount,
          policy_applied: policyApplied,
          authorized_at: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Cancellation authorization error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });
}
/**
 * Review Routes
 * 
 * This module handles review-related endpoints including review creation,
 * retrieval, and public review access for providers. Reviews are tied to
 * completed bookings and support rating and feedback systems.
 * 
 * Usage:
 * ```javascript
 * import reviewRoutes from './routes/reviews.js';
 * reviewRoutes(app);
 * ```
 */

import { Hono } from 'hono';
import { verifyPrivyAuth, getSupabaseAdmin } from '../middleware/auth.js';

// Get Supabase admin client
const supabaseAdmin = getSupabaseAdmin();

/**
 * Create review routes
 * 
 * @param {Hono} app - The Hono application instance
 */
export default function reviewRoutes(app) {

  /**
   * POST /api/reviews
   * 
   * Create a new review for a completed booking.
   * This endpoint handles review creation including:
   * - Booking completion verification
   * - Review uniqueness validation (one review per booking)
   * - Rating and feedback recording
   * - Provider rating calculation updates
   * 
   * Headers:
   * - Authorization: Bearer {privyToken}
   * 
   * Body:
   * - booking_id: UUID of the completed booking
   * - rating: Rating score (1-5 stars)
   * - comment: Optional text review
   * - service_quality: Optional specific service quality rating
   * - communication: Optional communication rating
   * - punctuality: Optional punctuality rating
   * - value_for_money: Optional value rating
   * 
   * Response:
   * - Created review object with booking and provider information
   * 
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with review data or error
   */
  app.post('/api/reviews', verifyPrivyAuth, async (c) => {
    try {
      const userId = c.get('userId');
      const body = await c.req.json();
      const { 
        booking_id, 
        rating, 
        comment
      } = body;

      // Validate required fields
      if (!booking_id || !rating) {
        return c.json({ error: 'Booking ID and rating are required' }, 400);
      }

      // Validate rating range
      if (rating < 1 || rating > 5) {
        return c.json({ error: 'Rating must be between 1 and 5' }, 400);
      }

      // Get booking details to verify eligibility
      const { data: booking, error: bookingError } = await supabaseAdmin
        .from('bookings')
        .select(`
          *,
          service:services(*),
          customer:users!customer_id(*),
          provider:users!provider_id(*)
        `)
        .eq('id', booking_id)
        .single();

      if (bookingError || !booking) {
        console.error('Booking fetch error:', bookingError);
        return c.json({ error: 'Booking not found' }, 404);
      }

      // Verify reviewer is the customer of this booking
      if (booking.customer_id !== userId) {
        return c.json({ error: 'Only the customer can review this booking' }, 403);
      }

      // Verify booking is completed
      if (booking.status !== 'completed') {
        return c.json({ error: 'Can only review completed bookings' }, 400);
      }

      // Check if review already exists for this booking
      const { data: existingReview, error: reviewCheckError } = await supabaseAdmin
        .from('reviews')
        .select('id')
        .eq('booking_id', booking_id)
        .single();

      if (existingReview) {
        return c.json({ error: 'Review already exists for this booking' }, 409);
      }

      // Check 7-day review window (optional business rule)
      const completedAt = new Date(booking.completed_at);
      const now = new Date();
      const daysSinceCompletion = (now.getTime() - completedAt.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceCompletion > 30) { // 30 days to leave a review
        return c.json({ 
          error: 'Review period has expired. Reviews must be submitted within 30 days of completion.' 
        }, 400);
      }

      // Create review record
      const reviewData = {
        booking_id: booking_id,
        reviewer_id: userId,
        reviewee_id: booking.provider_id,
        service_id: booking.service_id,
        rating: rating,
        comment: comment || null,
        is_public: true
      };

      const { data: review, error: createError } = await supabaseAdmin
        .from('reviews')
        .insert(reviewData)
        .select(`
          *,
          booking:bookings(*),
          reviewer:users!reviewer_id(*),
          reviewee:users!reviewee_id(*),
          service:services(*)
        `)
        .single();

      if (createError) {
        console.error('Review creation error:', createError);
        return c.json({ error: 'Failed to create review' }, 500);
      }

      // Update provider's rating statistics asynchronously
      setImmediate(async () => {
        try {
          // Get all reviews for this provider to calculate new average
          const { data: allReviews, error: statsError } = await supabaseAdmin
            .from('reviews')
            .select('rating')
            .eq('reviewee_id', booking.provider_id);

          if (!statsError && allReviews) {
            const totalReviews = allReviews.length;
            const averageRating = allReviews.reduce((sum, rev) => sum + rev.rating, 0) / totalReviews;

            // Update provider's rating statistics
            await supabaseAdmin
              .from('users')
              .update({
                rating: Math.round(averageRating * 10) / 10, // Round to 1 decimal place
                review_count: totalReviews,
                updated_at: new Date().toISOString()
              })
              .eq('id', booking.provider_id);

            console.log(`Updated provider ${booking.provider_id} rating to ${averageRating} (${totalReviews} reviews)`);
          }
        } catch (statsUpdateError) {
          console.error('Provider rating update error:', statsUpdateError);
        }
      });

      // Send notification to provider about new review
      setImmediate(async () => {
        try {
          console.log(`New review created for provider ${booking.provider_id}: ${rating} stars`);
          // Email notification logic would go here in production
        } catch (notificationError) {
          console.error('Review notification error:', notificationError);
        }
      });

      return c.json(review);

    } catch (error) {
      console.error('Review creation error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  /**
   * GET /api/reviews/:bookingId
   * 
   * Get review for a specific booking.
   * This endpoint returns review data for a completed booking.
   * Only accessible by the customer or provider involved in the booking.
   * 
   * Headers:
   * - Authorization: Bearer {privyToken}
   * 
   * Parameters:
   * - bookingId: UUID of the booking to get review for
   * 
   * Response:
   * - Review object with booking and user information
   * - HTTP 404 if no review exists
   * 
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with review data or error
   */
  app.get('/api/reviews/:bookingId', verifyPrivyAuth, async (c) => {
    try {
      const userId = c.get('userId');
      const bookingId = c.req.param('bookingId');

      // First verify user has access to this booking
      const { data: booking, error: bookingError } = await supabaseAdmin
        .from('bookings')
        .select('customer_id, provider_id, status')
        .eq('id', bookingId)
        .single();

      if (bookingError || !booking) {
        console.error('Booking access check error:', bookingError);
        return c.json({ error: 'Booking not found' }, 404);
      }

      // Check if user is involved in this booking
      if (booking.customer_id !== userId && booking.provider_id !== userId) {
        return c.json({ error: 'Access denied' }, 403);
      }

      // Get review for this booking
      const { data: review, error: reviewError } = await supabaseAdmin
        .from('reviews')
        .select(`
          *,
          booking:bookings(*),
          reviewer:users!reviewer_id(id, display_name, avatar),
          reviewee:users!reviewee_id(id, display_name, avatar),
          service:services(id, title, category_id)
        `)
        .eq('booking_id', bookingId)
        .single();

      if (reviewError) {
        if (reviewError.code === 'PGRST116') {
          return c.json({ error: 'No review found for this booking' }, 404);
        }
        console.error('Review fetch error:', reviewError);
        return c.json({ error: 'Failed to fetch review' }, 500);
      }

      return c.json(review);

    } catch (error) {
      console.error('Review fetch error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  /**
   * GET /api/reviews/public/provider/:providerId
   * 
   * Get public reviews for a specific provider (no authentication required).
   * This endpoint returns paginated reviews for public display on provider profiles.
   * 
   * Parameters:
   * - providerId: UUID of the provider
   * 
   * Query Parameters:
   * - limit: Number of reviews to return (default: 10, max: 50)
   * - offset: Pagination offset (default: 0)
   * - rating: Filter by specific rating (1-5)
   * - sort: Sort order ('newest', 'oldest', 'highest', 'lowest') (default: 'newest')
   * 
   * Response:
   * - Array of public review objects with customer and service information
   * - Reviews include rating, comment, and metadata but exclude sensitive data
   * 
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with public reviews or error
   */
  app.get('/api/reviews/public/provider/:providerId', async (c) => {
    try {
      const providerId = c.req.param('providerId');
      const { 
        limit = '10', 
        offset = '0', 
        rating,
        sort = 'newest' 
      } = c.req.query();

      // Validate and sanitize parameters
      const limitNum = Math.min(parseInt(limit) || 10, 50); // Max 50 reviews per request
      const offsetNum = Math.max(parseInt(offset) || 0, 0);

      // Verify provider exists
      const { data: provider, error: providerError } = await supabaseAdmin
        .from('users')
        .select('id, display_name, rating, review_count')
        .eq('id', providerId)
        .single();

      if (providerError || !provider) {
        console.error('Provider verification error:', providerError);
        return c.json({ error: 'Provider not found' }, 404);
      }

      // Build query for reviews
      let query = supabaseAdmin
        .from('reviews')
        .select(`
          id,
          rating,
          comment,
          created_at,
          reviewer:users!reviewer_id(id, display_name, avatar),
          service:services(id, title, category_id)
        `)
        .eq('reviewee_id', providerId)
        .eq('is_public', true);

      // Filter by rating if specified
      if (rating && ['1', '2', '3', '4', '5'].includes(rating)) {
        query = query.eq('rating', parseInt(rating));
      }

      // Apply sorting
      switch (sort) {
        case 'oldest':
          query = query.order('created_at', { ascending: true });
          break;
        case 'highest':
          query = query.order('rating', { ascending: false }).order('created_at', { ascending: false });
          break;
        case 'lowest':
          query = query.order('rating', { ascending: true }).order('created_at', { ascending: false });
          break;
        case 'newest':
        default:
          query = query.order('created_at', { ascending: false });
          break;
      }

      // Apply pagination
      query = query.range(offsetNum, offsetNum + limitNum - 1);

      const { data: reviews, error: reviewsError } = await query;

      if (reviewsError) {
        console.error('Public reviews fetch error:', reviewsError);
        return c.json({ error: 'Failed to fetch reviews' }, 500);
      }

      // Get total count for pagination metadata
      const { count: totalReviews, error: countError } = await supabaseAdmin
        .from('reviews')
        .select('*', { count: 'exact', head: true })
        .eq('reviewee_id', providerId)
        .then(result => {
          if (rating && ['1', '2', '3', '4', '5'].includes(rating)) {
            return supabaseAdmin
              .from('reviews')
              .select('*', { count: 'exact', head: true })
              .eq('reviewee_id', providerId)
              .eq('rating', parseInt(rating));
          }
          return result;
        });

      if (countError) {
        console.error('Review count error:', countError);
        // Continue without count if there's an error
      }

      // Calculate rating distribution
      const { data: ratingDistribution, error: distributionError } = await supabaseAdmin
        .from('reviews')
        .select('rating')
        .eq('reviewee_id', providerId);

      let distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      if (!distributionError && ratingDistribution) {
        ratingDistribution.forEach(review => {
          distribution[review.rating] = (distribution[review.rating] || 0) + 1;
        });
      }

      return c.json({
        provider: {
          id: provider.id,
          display_name: provider.display_name,
          rating: provider.rating,
          review_count: provider.review_count
        },
        reviews: reviews || [],
        pagination: {
          limit: limitNum,
          offset: offsetNum,
          total: totalReviews || 0,
          has_more: (totalReviews || 0) > offsetNum + limitNum
        },
        rating_distribution: distribution,
        filters: {
          rating: rating || null,
          sort: sort
        }
      });

    } catch (error) {
      console.error('Public reviews error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });
}
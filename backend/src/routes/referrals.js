/**
 * Referral Routes
 *
 * This module handles referral system endpoints including:
 * - Referral code generation and management
 * - Referral statistics and earnings tracking
 * - Referral registration and validation
 *
 * Usage:
 * ```javascript
 * import referralRoutes from './routes/referrals.js';
 * referralRoutes(app);
 * ```
 */

import { Hono } from 'hono';
import { verifyPrivyAuth, getDb } from '../middleware/auth.js';

// Get database client (Railway PostgreSQL)
const db = getDb();

/**
 * Create referral routes
 *
 * @param {Hono} app - The Hono application instance
 */
export default function referralRoutes(app) {

  /**
   * GET /api/referrals/my-code
   * Get or create user's referral code
   *
   * Headers:
   * - Authorization: Bearer {privyToken}
   *
   * Response:
   * - code: User's referral code
   * - referralUrl: Complete referral URL
   * - usageCount: Number of times code has been used
   * - activeReferrals: Number of successful referrals
   */
  app.get('/api/referrals/my-code', verifyPrivyAuth, async (c) => {
    try {
      const userId = c.get('userId');

      // Check for existing referral code
      let { data: existingCode, error: fetchError } = await db
        .from('referral_codes')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      // Create code if doesn't exist
      if (!existingCode) {
        const code = generateReferralCode(userId);

        const { data: newCode, error: insertError } = await db
          .from('referral_codes')
          .insert({
            code,
            user_id: userId
          })
          .select()
          .single();

        if (insertError) {
          throw insertError;
        }

        existingCode = newCode;
      }

      // Get referral statistics
      const { data: stats } = await db
        .from('referrals')
        .select('id')
        .eq('referrer_id', userId);

      return c.json({
        code: existingCode.code,
        referralUrl: `${process.env.FRONTEND_URL || 'http://localhost:8080'}?ref=${existingCode.code}`,
        usageCount: existingCode.usage_count,
        activeReferrals: stats?.length || 0
      });

    } catch (error) {
      console.error('Get referral code error:', error);
      return c.json({ error: 'Failed to get referral code' }, 500);
    }
  });

  /**
   * GET /api/referrals/stats
   * Get referral statistics and earnings
   *
   * Headers:
   * - Authorization: Bearer {privyToken}
   *
   * Response:
   * - totalReferrals: Total number of referrals made
   * - totalEarnings: Total referral earnings
   * - pendingEarnings: Estimated pending earnings from active bookings
   * - recentEarnings: Recent earnings transactions
   */
  app.get('/api/referrals/stats', verifyPrivyAuth, async (c) => {
    try {
      const userId = c.get('userId');

      // Get user referral data
      const { data: user, error: userError } = await db
        .from('users')
        .select('referral_count, referral_earnings')
        .eq('id', userId)
        .single();

      if (userError) {
        throw userError;
      }

      // Get recent earnings transactions
      const { data: recentEarnings } = await db
        .from('transactions')
        .select('amount, created_at, booking_id')
        .eq('provider_id', userId)
        .eq('type', 'inviter_fee')
        .order('created_at', { ascending: false })
        .limit(10);

      // Calculate pending earnings from active bookings
      const { data: pendingBookings } = await db
        .from('bookings')
        .select(`
          total_price,
          customer:users!customer_id(referred_by)
        `)
        .eq('status', 'paid')
        .eq('users.referred_by', userId);

      const pendingEarnings = pendingBookings
        ?.filter(b => b.customer?.referred_by === userId)
        .reduce((sum, b) => sum + (b.total_price * 0.05), 0) || 0;

      return c.json({
        totalReferrals: user?.referral_count || 0,
        totalEarnings: user?.referral_earnings || 0,
        pendingEarnings,
        recentEarnings: recentEarnings || []
      });

    } catch (error) {
      console.error('Get referral stats error:', error);
      return c.json({ error: 'Failed to get referral statistics' }, 500);
    }
  });

  /**
   * POST /api/referrals/register
   * Apply referral code during user registration
   *
   * Headers:
   * - Authorization: Bearer {privyToken}
   *
   * Body:
   * - referralCode: The referral code to apply
   *
   * Response:
   * - success: true if applied successfully
   */
  app.post('/api/referrals/register', verifyPrivyAuth, async (c) => {
    try {
      const userId = c.get('userId');
      const { referralCode } = await c.req.json();

      if (!referralCode) {
        return c.json({ error: 'Referral code is required' }, 400);
      }

      // Validate referral code exists
      const { data: codeData, error: codeError } = await db
        .from('referral_codes')
        .select('user_id, usage_count')
        .eq('code', referralCode)
        .single();

      if (codeError || !codeData) {
        return c.json({ error: 'Invalid referral code' }, 400);
      }

      // Prevent self-referral
      if (codeData.user_id === userId) {
        return c.json({ error: 'Cannot use your own referral code' }, 400);
      }

      // Check if user already has a referrer
      const { data: existingUser } = await db
        .from('users')
        .select('referred_by')
        .eq('id', userId)
        .single();

      if (existingUser?.referred_by) {
        return c.json({ error: 'User already has a referrer' }, 400);
      }

      // Apply referral code using database function
      const { error: applyError } = await db.rpc('apply_referral_code', {
        referee_user_id: userId,
        referrer_user_id: codeData.user_id,
        referral_code: referralCode
      });

      if (applyError) {
        throw applyError;
      }

      return c.json({ success: true });

    } catch (error) {
      console.error('Apply referral code error:', error);
      return c.json({ error: 'Failed to apply referral code' }, 500);
    }
  });

  /**
   * GET /api/referrals/validate/:code
   * Validate referral code (public endpoint)
   *
   * Params:
   * - code: The referral code to validate
   *
   * Response:
   * - valid: true if code is valid
   * - referrerName: Display name of the referrer
   * - error: Error message if validation fails
   */
  app.get('/api/referrals/validate/:code', async (c) => {
    try {
      const code = c.req.param('code');

      const { data: codeData, error } = await db
        .from('referral_codes')
        .select(`
          code,
          usage_count,
          user:users(display_name)
        `)
        .eq('code', code)
        .single();

      if (error || !codeData) {
        return c.json({ valid: false, error: 'Code not found' });
      }

      // All codes are valid in simplified system
      return c.json({
        valid: true,
        referrerName: codeData.user?.display_name,
        error: null
      });

    } catch (error) {
      console.error('Validate referral code error:', error);
      return c.json({ valid: false, error: 'Validation failed' });
    }
  });

  /**
   * GET /api/referrals/earnings
   * Get detailed earnings history
   *
   * Headers:
   * - Authorization: Bearer {privyToken}
   *
   * Query:
   * - limit: Number of records to return (default: 20)
   * - offset: Number of records to skip (default: 0)
   *
   * Response:
   * Array of earnings transactions with booking and user details
   */
  app.get('/api/referrals/earnings', verifyPrivyAuth, async (c) => {
    try {
      const userId = c.get('userId');
      const { limit = '20', offset = '0' } = c.req.query();

      const { data: earnings, error } = await db
        .from('transactions')
        .select(`
          *,
          booking:bookings(
            id,
            scheduled_at,
            total_price,
            service:services(title)
          ),
          source_user:users!source_user_id(display_name)
        `)
        .eq('provider_id', userId)
        .eq('type', 'inviter_fee')
        .order('created_at', { ascending: false })
        .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

      if (error) {
        throw error;
      }

      return c.json(earnings || []);

    } catch (error) {
      console.error('Get earnings history error:', error);
      return c.json({ error: 'Failed to get earnings history' }, 500);
    }
  });
}

/**
 * Generate unique referral code based on user ID
 * Uses user ID as seed for consistent but unpredictable codes
 *
 * @param {string} userId - UUID of the user
 * @returns {string} 8-character referral code
 */
function generateReferralCode(userId) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const codeLength = 8;
  let result = '';

  // Use last 8 characters of user ID as seed
  const seed = userId.replace(/-/g, '').substr(-8);

  for (let i = 0; i < codeLength; i++) {
    const index = (parseInt(seed.charAt(i % seed.length), 16) + i) % chars.length;
    result += chars.charAt(index);
  }

  return result;
}
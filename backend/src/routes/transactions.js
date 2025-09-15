/**
 * Transaction Routes
 * 
 * This module handles transaction-related endpoints for providers to view
 * their income from completed bookings.
 */

import { Hono } from 'hono';
import { verifyPrivyAuth, getSupabaseAdmin } from '../middleware/auth.js';

// Get Supabase admin client
const supabaseAdmin = getSupabaseAdmin();

/**
 * Create transaction routes
 * 
 * @param {Hono} app - The Hono application instance
 */
export default function transactionRoutes(app) {

  /**
   * GET /api/transactions/income
   * 
   * Get provider income transactions - earnings from completed bookings.
   * Only returns transactions for the authenticated provider.
   * 
   * Headers:
   * - Authorization: Bearer {privyToken}
   * 
   * Query Parameters:
   * - limit: Number of transactions to return (default: 50, max: 100)
   * - offset: Number of transactions to skip for pagination (default: 0)
   * 
   * Response:
   * - Array of income transaction objects with service and customer details
   * 
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with income transactions or error
   */
  app.get('/api/transactions/income', verifyPrivyAuth, async (c) => {
    try {
      const userId = c.get('userId');
      
      // Get query parameters for pagination
      const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
      const offset = parseInt(c.req.query('offset') || '0');

      console.log(`📊 Fetching income transactions for provider ${userId}`);

      // Fetch income transactions for this provider with related data
      const { data: transactions, error } = await supabaseAdmin
        .from('transactions')
        .select(`
          *,
          provider:provider_id(
            id,
            display_name,
            username
          ),
          source_user:source_user_id(
            id,
            display_name,
            username
          ),
          service:service_id(
            id,
            title,
            price,
            duration_minutes
          ),
          booking:booking_id(
            id,
            scheduled_at,
            duration_minutes,
            location,
            is_online
          )
        `)
        .eq('provider_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('Error fetching income transactions:', error);
        return c.json({ error: 'Failed to fetch income transactions' }, 500);
      }

      // Calculate total income for this provider
      const { data: totalData, error: totalError } = await supabaseAdmin
        .from('transactions')
        .select('amount')
        .eq('provider_id', userId);

      if (totalError) {
        console.error('Error calculating total income:', totalError);
        return c.json({ error: 'Failed to calculate total income' }, 500);
      }

      const totalIncome = totalData?.reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0) || 0;

      console.log(`✅ Retrieved ${transactions?.length || 0} income transactions for provider ${userId}`);

      return c.json({
        transactions: transactions || [],
        totalIncome: parseFloat(totalIncome.toFixed(2)),
        pagination: {
          limit,
          offset,
          hasMore: (transactions?.length || 0) === limit
        }
      });

    } catch (error) {
      console.error('Error in GET /api/transactions/income:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  /**
   * GET /api/transactions/income/summary
   * 
   * Get income summary statistics for the authenticated provider.
   * Returns total income, transaction count, and recent activity.
   * 
   * Headers:
   * - Authorization: Bearer {privyToken}
   * 
   * Response:
   * - Summary statistics object
   * 
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with income summary or error
   */
  app.get('/api/transactions/income/summary', verifyPrivyAuth, async (c) => {
    try {
      const userId = c.get('userId');

      console.log(`📊 Fetching income summary for provider ${userId}`);

      // Get all transactions for statistics
      const { data: transactions, error } = await supabaseAdmin
        .from('transactions')
        .select('amount, type, created_at')
        .eq('provider_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching transaction summary:', error);
        return c.json({ error: 'Failed to fetch income summary' }, 500);
      }

      const summary = {
        totalIncome: 0,
        transactionCount: transactions?.length || 0,
        averageTransactionValue: 0,
        thisMonthIncome: 0,
        lastTransactionDate: null,
        transactionsByType: {}
      };

      if (transactions && transactions.length > 0) {
        const now = new Date();
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        summary.totalIncome = transactions.reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);
        summary.averageTransactionValue = summary.totalIncome / transactions.length;

        // Calculate this month's income
        summary.thisMonthIncome = transactions
          .filter(tx => new Date(tx.created_at) >= thisMonthStart)
          .reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);

        // Group by transaction type
        summary.transactionsByType = transactions.reduce((acc, tx) => {
          acc[tx.type] = (acc[tx.type] || 0) + 1;
          return acc;
        }, {});

        // Get most recent transaction date
        summary.lastTransactionDate = transactions[0]?.created_at;

        // Round to 2 decimal places
        summary.totalIncome = parseFloat(summary.totalIncome.toFixed(2));
        summary.averageTransactionValue = parseFloat(summary.averageTransactionValue.toFixed(2));
        summary.thisMonthIncome = parseFloat(summary.thisMonthIncome.toFixed(2));
      }

      console.log(`✅ Income summary calculated for provider ${userId}:`, summary);

      return c.json(summary);

    } catch (error) {
      console.error('Error in GET /api/transactions/income/summary:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });
}
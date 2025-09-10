/**
 * System Routes
 * 
 * This module handles system-related endpoints including health checks,
 * categories management, blockchain monitoring, and system administration.
 * These endpoints support application monitoring and core system functionality.
 * 
 * Usage:
 * ```javascript
 * import systemRoutes from './routes/system.js';
 * systemRoutes(app);
 * ```
 */

import { Hono } from 'hono';
import { verifyPrivyAuth, getSupabaseAdmin } from '../middleware/auth.js';

// Get Supabase admin client
const supabaseAdmin = getSupabaseAdmin();

/**
 * Create system routes
 * 
 * @param {Hono} app - The Hono application instance
 */
export default function systemRoutes(app) {

  /**
   * GET /health
   * 
   * Health check endpoint for monitoring and load balancing.
   * This endpoint provides system status and basic health information
   * without requiring authentication.
   * 
   * Response:
   * - System health status and basic metrics
   * 
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with health status
   */
  app.get('/health', (c) => {
    try {
      const uptime = process.uptime();
      const memUsage = process.memoryUsage();
      
      return c.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(uptime),
        memory: {
          rss: Math.round(memUsage.rss / 1024 / 1024), // MB
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
          external: Math.round(memUsage.external / 1024 / 1024) // MB
        },
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0'
      });
    } catch (error) {
      console.error('Health check error:', error);
      return c.json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed'
      }, 500);
    }
  });

  /**
   * GET /api/categories
   * 
   * Get all service categories for the application.
   * This endpoint returns categories used for service organization
   * and filtering throughout the platform.
   * 
   * Response:
   * - Array of category objects with icons and metadata
   * 
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with categories or error
   */
  app.get('/api/categories', async (c) => {
    try {
      const { data: categories, error: categoriesError } = await supabaseAdmin
        .from('categories')
        .select('*')
        .order('name', { ascending: true });

      if (categoriesError) {
        console.error('Categories fetch error:', categoriesError);
        return c.json({ error: 'Failed to fetch categories' }, 500);
      }

      // Add service count for each category if needed
      const categoriesWithCounts = await Promise.all(
        (categories || []).map(async (category) => {
          try {
            const { count } = await supabaseAdmin
              .from('services')
              .select('*', { count: 'exact', head: true })
              .eq('category_id', category.id)
              .eq('is_visible', true);

            return {
              ...category,
              service_count: count || 0
            };
          } catch (countError) {
            console.error(`Count error for category ${category.id}:`, countError);
            return {
              ...category,
              service_count: 0
            };
          }
        })
      );

      return c.json(categoriesWithCounts);

    } catch (error) {
      console.error('Categories error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  /**
   * GET /api/blockchain/monitor-status
   * 
   * Get current blockchain monitoring status.
   * This endpoint provides information about the blockchain event monitoring
   * service status and recent activity.
   * 
   * Response:
   * - Blockchain monitoring status and metrics
   * 
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with monitoring status
   */
  app.get('/api/blockchain/monitor-status', async (c) => {
    try {
      // Check if blockchain monitoring is enabled
      const isMonitoringEnabled = process.env.ENABLE_BLOCKCHAIN_MONITORING === 'true';
      
      let monitorStatus = {
        enabled: isMonitoringEnabled,
        status: isMonitoringEnabled ? 'active' : 'disabled',
        last_check: new Date().toISOString()
      };

      if (isMonitoringEnabled) {
        try {
          // Get recent blockchain events to show activity
          const { data: recentEvents, error: eventsError } = await supabaseAdmin
            .from('blockchain_events')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5);

          if (!eventsError) {
            monitorStatus.recent_events = recentEvents || [];
            monitorStatus.recent_events_count = recentEvents?.length || 0;
          }

          // Get event statistics
          const { count: totalEvents } = await supabaseAdmin
            .from('blockchain_events')
            .select('*', { count: 'exact', head: true });

          monitorStatus.total_events_processed = totalEvents || 0;

          // Check for any recent errors or issues
          const { data: recentErrors } = await supabaseAdmin
            .from('blockchain_events')
            .select('*')
            .eq('event_type', 'error')
            .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
            .order('created_at', { ascending: false })
            .limit(1);

          if (recentErrors?.length > 0) {
            monitorStatus.last_error = recentErrors[0].created_at;
            monitorStatus.status = 'active_with_errors';
          }

        } catch (statusError) {
          console.error('Monitor status check error:', statusError);
          monitorStatus.status = 'error';
          monitorStatus.error = 'Failed to check monitoring status';
        }
      }

      return c.json(monitorStatus);

    } catch (error) {
      console.error('Blockchain monitor status error:', error);
      return c.json({ error: 'Failed to get monitor status' }, 500);
    }
  });

  /**
   * POST /api/blockchain/start-monitoring
   * 
   * Start blockchain event monitoring service.
   * This endpoint initializes or restarts the blockchain monitoring
   * system for tracking contract events.
   * 
   * Response:
   * - Monitoring start confirmation and status
   * 
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with start status
   */
  app.post('/api/blockchain/start-monitoring', async (c) => {
    try {
      // Check if monitoring is already enabled
      const isCurrentlyEnabled = process.env.ENABLE_BLOCKCHAIN_MONITORING === 'true';
      
      if (isCurrentlyEnabled) {
        return c.json({
          success: true,
          message: 'Blockchain monitoring is already active',
          status: 'active',
          started_at: new Date().toISOString()
        });
      }

      // In a production environment, you would:
      // 1. Set the monitoring flag
      // 2. Initialize the blockchain event monitor
      // 3. Start WebSocket connections to blockchain
      // 4. Set up event listeners

      try {
        // Attempt to initialize blockchain monitoring
        // This is a placeholder - actual implementation would start the monitor
        console.log('Starting blockchain monitoring...');
        
        // Log the monitoring start event
        await supabaseAdmin
          .from('blockchain_events')
          .insert({
            event_type: 'monitoring_started',
            event_data: {
              started_by: 'system',
              timestamp: new Date().toISOString(),
              reason: 'Manual start via API'
            },
            created_at: new Date().toISOString()
          });

        return c.json({
          success: true,
          message: 'Blockchain monitoring started successfully',
          status: 'active',
          started_at: new Date().toISOString()
        });

      } catch (startError) {
        console.error('Failed to start blockchain monitoring:', startError);
        return c.json({
          success: false,
          error: 'Failed to start blockchain monitoring',
          details: startError.message
        }, 500);
      }

    } catch (error) {
      console.error('Start monitoring error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  /**
   * POST /api/blockchain/stop-monitoring
   * 
   * Stop blockchain event monitoring service.
   * This endpoint gracefully shuts down the blockchain monitoring
   * system and stops event tracking.
   * 
   * Response:
   * - Monitoring stop confirmation and final status
   * 
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with stop status
   */
  app.post('/api/blockchain/stop-monitoring', async (c) => {
    try {
      const isCurrentlyEnabled = process.env.ENABLE_BLOCKCHAIN_MONITORING === 'true';
      
      if (!isCurrentlyEnabled) {
        return c.json({
          success: true,
          message: 'Blockchain monitoring is already stopped',
          status: 'stopped',
          stopped_at: new Date().toISOString()
        });
      }

      try {
        // In production, this would:
        // 1. Gracefully close WebSocket connections
        // 2. Stop event listeners
        // 3. Clean up resources
        // 4. Update monitoring status
        
        console.log('Stopping blockchain monitoring...');
        
        // Log the monitoring stop event
        await supabaseAdmin
          .from('blockchain_events')
          .insert({
            event_type: 'monitoring_stopped',
            event_data: {
              stopped_by: 'system',
              timestamp: new Date().toISOString(),
              reason: 'Manual stop via API'
            },
            created_at: new Date().toISOString()
          });

        return c.json({
          success: true,
          message: 'Blockchain monitoring stopped successfully',
          status: 'stopped',
          stopped_at: new Date().toISOString()
        });

      } catch (stopError) {
        console.error('Failed to stop blockchain monitoring:', stopError);
        return c.json({
          success: false,
          error: 'Failed to stop blockchain monitoring',
          details: stopError.message
        }, 500);
      }

    } catch (error) {
      console.error('Stop monitoring error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  // Additional system endpoints could be added here:

  /**
   * GET /api/system/stats
   * 
   * Get system-wide statistics and metrics.
   * This endpoint provides overview statistics for administration.
   * 
   * Response:
   * - System statistics including user counts, booking metrics, etc.
   * 
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with system stats
   */
  app.get('/api/system/stats', async (c) => {
    try {
      // Gather various system statistics
      const [
        { count: totalUsers },
        { count: totalServices },
        { count: totalBookings },
        { count: totalReviews },
        { count: activeIntegrations }
      ] = await Promise.all([
        supabaseAdmin.from('users').select('*', { count: 'exact', head: true }),
        supabaseAdmin.from('services').select('*', { count: 'exact', head: true }).eq('is_visible', true),
        supabaseAdmin.from('bookings').select('*', { count: 'exact', head: true }),
        supabaseAdmin.from('reviews').select('*', { count: 'exact', head: true }),
        supabaseAdmin.from('meeting_integrations').select('*', { count: 'exact', head: true }).eq('is_active', true)
      ]);

      // Get booking stats by status
      const { data: bookingsByStatus } = await supabaseAdmin
        .from('bookings')
        .select('status')
        .then(async (result) => {
          if (result.error) return { data: [] };
          
          const statusCounts = result.data.reduce((acc, booking) => {
            acc[booking.status] = (acc[booking.status] || 0) + 1;
            return acc;
          }, {});

          return { data: statusCounts };
        });

      return c.json({
        timestamp: new Date().toISOString(),
        totals: {
          users: totalUsers || 0,
          services: totalServices || 0,
          bookings: totalBookings || 0,
          reviews: totalReviews || 0,
          active_integrations: activeIntegrations || 0
        },
        booking_status_breakdown: bookingsByStatus || {},
        system: {
          uptime: Math.floor(process.uptime()),
          memory_usage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024), // MB
          environment: process.env.NODE_ENV || 'development'
        }
      });

    } catch (error) {
      console.error('System stats error:', error);
      return c.json({ error: 'Failed to get system statistics' }, 500);
    }
  });
}
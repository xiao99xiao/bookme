/**
 * Service Routes
 * 
 * This module handles service management endpoints for both authenticated
 * users and public access. Includes CRUD operations, visibility controls,
 * search functionality, and public service discovery.
 * 
 * Usage:
 * ```javascript
 * import serviceRoutes from './routes/services.js';
 * serviceRoutes(app);
 * ```
 */

import { Hono } from 'hono';
import { verifyPrivyAuth, getSupabaseAdmin } from '../middleware/auth.js';
import availabilityService from '../services/availability-service.js';

// Get Supabase admin client
const supabaseAdmin = getSupabaseAdmin();

/**
 * Create service routes
 * 
 * @param {Hono} app - The Hono application instance
 */
export default function serviceRoutes(app) {

  /**
   * GET /api/services
   * 
   * Get services with optional filtering for authenticated users.
   * Supports filtering by provider_id, category, and visibility status.
   * 
   * Headers:
   * - Authorization: Bearer {privyToken}
   * 
   * Query Parameters:
   * - provider_id: Filter by specific provider
   * - category: Filter by category ID
   * - is_visible: Filter by visibility (true/false)
   * 
   * Response:
   * - Array of service objects
   * 
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with services or error
   */
  app.get('/api/services', verifyPrivyAuth, async (c) => {
    try {
      const userId = c.get('userId');
      const { provider_id, category, is_visible } = c.req.query();
      
      let query = supabaseAdmin.from('services').select('*');
      
      if (provider_id) query = query.eq('provider_id', provider_id);
      if (category) query = query.eq('category_id', category);
      if (is_visible !== undefined) query = query.eq('is_visible', is_visible === 'true');
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Services fetch error:', error);
        return c.json({ error: 'Failed to fetch services' }, 500);
      }
      
      return c.json(data);
    } catch (error) {
      console.error('Services error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  /**
   * GET /api/services/user/:userId
   * 
   * Get all services for a specific provider (authenticated endpoint).
   * Returns services ordered by creation date (newest first).
   * 
   * Headers:
   * - Authorization: Bearer {privyToken}
   * 
   * Parameters:
   * - userId: UUID of the provider
   * 
   * Response:
   * - Array of service objects for the specified provider
   * 
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with user services or error
   */
  app.get('/api/services/user/:userId', verifyPrivyAuth, async (c) => {
    try {
      const userId = c.get('userId');
      const targetUserId = c.req.param('userId');
      
      const { data, error } = await supabaseAdmin
        .from('services')
        .select('*')
        .eq('provider_id', targetUserId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Services fetch error:', error);
        return c.json({ error: 'Failed to fetch services' }, 500);
      }
      
      return c.json(data || []);
    } catch (error) {
      console.error('Services error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  /**
   * POST /api/services
   * 
   * Create a new service or update an existing one.
   * Automatically sets provider_id to the authenticated user.
   * If body contains an id, updates existing service; otherwise creates new one.
   * 
   * Headers:
   * - Authorization: Bearer {privyToken}
   * 
   * Body:
   * - Service data (title, description, price, duration_minutes, etc.)
   * - id (optional): If provided, updates existing service
   * 
   * Response:
   * - Created or updated service object
   * 
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with service data or error
   */
  app.post('/api/services', verifyPrivyAuth, async (c) => {
    try {
      const userId = c.get('userId');
      const body = await c.req.json();
      
      // Remove any fields that don't exist in the database
      delete body.time_slots; // Remove if accidentally sent
      delete body.timeSlots; // Remove if accidentally sent (camelCase version)
      delete body.user_id; // Remove if accidentally sent - database uses provider_id
      
      // Ensure provider_id matches authenticated user
      const serviceData = {
        ...body,
        provider_id: userId
      };
      
      if (body.id) {
        // Update existing service
        const { data, error } = await supabaseAdmin
          .from('services')
          .update(serviceData)
          .eq('id', body.id)
          .eq('provider_id', userId) // Ensure user owns the service
          .select()
          .single();
        
        if (error) {
          console.error('Service update error:', error);
          return c.json({ error: 'Failed to update service' }, 500);
        }
        
        return c.json(data);
      } else {
        // Create new service
        const { data, error } = await supabaseAdmin
          .from('services')
          .insert(serviceData)
          .select()
          .single();
        
        if (error) {
          console.error('Service creation error:', error);
          return c.json({ error: 'Failed to create service' }, 500);
        }
        
        return c.json(data);
      }
    } catch (error) {
      console.error('Service error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  /**
   * DELETE /api/services/:serviceId
   * 
   * Delete a service (only if user owns it).
   * Enforces ownership by checking provider_id matches authenticated user.
   * 
   * Headers:
   * - Authorization: Bearer {privyToken}
   * 
   * Parameters:
   * - serviceId: UUID of the service to delete
   * 
   * Response:
   * - Success confirmation
   * 
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with success status or error
   */
  app.delete('/api/services/:serviceId', verifyPrivyAuth, async (c) => {
    try {
      const userId = c.get('userId');
      const serviceId = c.req.param('serviceId');
      
      const { error } = await supabaseAdmin
        .from('services')
        .delete()
        .eq('id', serviceId)
        .eq('provider_id', userId); // Ensure user owns the service
      
      if (error) {
        console.error('Service deletion error:', error);
        return c.json({ error: 'Failed to delete service' }, 500);
      }
      
      return c.json({ success: true });
    } catch (error) {
      console.error('Service deletion error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  /**
   * PATCH /api/services/:serviceId/visibility
   * 
   * Toggle service visibility (only if user owns it).
   * Changes the is_visible flag for the specified service.
   * 
   * Headers:
   * - Authorization: Bearer {privyToken}
   * 
   * Parameters:
   * - serviceId: UUID of the service to update
   * 
   * Body:
   * - is_visible: Boolean visibility status
   * 
   * Response:
   * - Updated service object
   * 
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with updated service or error
   */
  app.patch('/api/services/:serviceId/visibility', verifyPrivyAuth, async (c) => {
    try {
      const userId = c.get('userId');
      const serviceId = c.req.param('serviceId');
      const body = await c.req.json();
      const { is_visible } = body;
      
      if (typeof is_visible !== 'boolean') {
        return c.json({ error: 'is_visible must be a boolean' }, 400);
      }
      
      const { data, error } = await supabaseAdmin
        .from('services')
        .update({ is_visible })
        .eq('id', serviceId)
        .eq('provider_id', userId) // Ensure user owns the service
        .select()
        .single();
      
      if (error) {
        console.error('Service visibility toggle error:', error);
        return c.json({ error: 'Failed to update service visibility' }, 500);
      }
      
      if (!data) {
        return c.json({ error: 'Service not found' }, 404);
      }
      
      return c.json(data);
    } catch (error) {
      console.error('Service visibility toggle error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  /**
   * GET /api/services/public/user/:userId
   * 
   * Get public services for a specific provider (no authentication required).
   * Only returns visible services with category information.
   * 
   * Parameters:
   * - userId: UUID of the provider
   * 
   * Response:
   * - Array of visible services with category details
   * 
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with public services or error
   */
  app.get('/api/services/public/user/:userId', async (c) => {
    try {
      const userId = c.req.param('userId');
      
      const { data, error } = await supabaseAdmin
        .from('services')
        .select(`
          *,
          categories(name, icon, color)
        `)
        .eq('provider_id', userId)
        .eq('is_visible', true)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Public services fetch error:', error);
        return c.json({ error: 'Failed to fetch services' }, 500);
      }
      
      return c.json(data || []);
    } catch (error) {
      console.error('Public services error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  /**
   * GET /api/services/public
   * 
   * Search and filter public services (no authentication required).
   * Supports multiple filtering options for service discovery.
   * 
   * Query Parameters:
   * - search: Text search in title and description
   * - category: Filter by category ID
   * - minPrice: Minimum price filter
   * - maxPrice: Maximum price filter
   * - location: Location-based search
   * 
   * Response:
   * - Object with services array and provider information
   * 
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with filtered services or error
   */
  app.get('/api/services/public', async (c) => {
    try {
      const { search, category, minPrice, maxPrice, location } = c.req.query();
      
      let query = supabaseAdmin
        .from('services')
        .select(`
          *,
          provider:users!provider_id(display_name, avatar, rating, review_count)
        `)
        .eq('is_visible', true);
      
      // Only apply filters if they have valid values
      if (search && search !== 'undefined' && search.trim()) {
        query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
      }
      if (category && category !== 'undefined' && category !== 'all') {
        query = query.eq('category_id', category);
      }
      if (minPrice && minPrice !== 'undefined') {
        query = query.gte('price', parseFloat(minPrice));
      }
      if (maxPrice && maxPrice !== 'undefined') {
        query = query.lte('price', parseFloat(maxPrice));
      }
      if (location && location !== 'undefined' && location.trim()) {
        query = query.ilike('location', `%${location}%`);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) {
        console.error('Public services fetch error:', error);
        return c.json({ error: 'Failed to fetch services' }, 500);
      }
      
      return c.json({ services: data || [] });
    } catch (error) {
      console.error('Public services error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  /**
   * GET /api/services/public/:providerId
   * 
   * Get public services for a specific provider with enhanced formatting.
   * Returns services with category and provider information.
   * 
   * Parameters:
   * - providerId: UUID of the provider
   * 
   * Query Parameters:
   * - timezone: User's timezone for scheduling (optional)
   * 
   * Response:
   * - Array of services with transformed category data
   * 
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with provider services or error
   */
  app.get('/api/services/public/:providerId', async (c) => {
    try {
      const providerId = c.req.param('providerId');
      const { timezone } = c.req.query();
      
      console.log('Getting public services for provider:', providerId);
      
      let query = supabaseAdmin
        .from('services')
        .select(`
          *,
          categories(name, icon, color),
          provider:users!provider_id(display_name, avatar, rating)
        `)
        .eq('provider_id', providerId)
        .eq('is_visible', true)
        .order('created_at', { ascending: false });
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Services fetch error:', error);
        return c.json({ error: 'Failed to fetch services' }, 500);
      }
      
      return c.json(data || []);
    } catch (error) {
      console.error('Services error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  /**
   * GET /api/services/:id
   * 
   * Get a single service by ID with provider information.
   * Requires authentication to access service details.
   * 
   * Headers:
   * - Authorization: Bearer {privyToken}
   * 
   * Parameters:
   * - id: UUID of the service
   * 
   * Response:
   * - Service object with provider details
   * 
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with service data or error
   */
  app.get('/api/services/:id', verifyPrivyAuth, async (c) => {
    try {
      const serviceId = c.req.param('id');
      
      const { data, error } = await supabaseAdmin
        .from('services')
        .select(`
          *,
          provider:users!provider_id(*)
        `)
        .eq('id', serviceId)
        .single();
      
      if (error) {
        console.error('Service fetch error:', error);
        return c.json({ error: 'Service not found' }, 404);
      }
      
      return c.json(data);
    } catch (error) {
      console.error('Service error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  /**
   * GET /api/services/search
   * 
   * Advanced service search with multiple filtering options.
   * Requires authentication and returns services with provider information.
   * 
   * Headers:
   * - Authorization: Bearer {privyToken}
   * 
   * Query Parameters:
   * - query: Text search in title and description
   * - category: Filter by category ID
   * - minPrice: Minimum price filter
   * - maxPrice: Maximum price filter
   * - location: Location-based search
   * 
   * Response:
   * - Array of matching services with provider details
   * 
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with search results or error
   */
  app.get('/api/services/search', verifyPrivyAuth, async (c) => {
    try {
      const { query, category, minPrice, maxPrice, location } = c.req.query();
      
      let dbQuery = supabaseAdmin
        .from('services')
        .select(`
          *,
          provider:users!provider_id(display_name, avatar, rating, review_count)
        `)
        .eq('is_visible', true);
      
      if (query) {
        dbQuery = dbQuery.or(`title.ilike.%${query}%,description.ilike.%${query}%`);
      }
      if (category) {
        dbQuery = dbQuery.eq('category_id', category);
      }
      if (minPrice) {
        dbQuery = dbQuery.gte('price', parseFloat(minPrice));
      }
      if (maxPrice) {
        dbQuery = dbQuery.lte('price', parseFloat(maxPrice));
      }
      if (location) {
        dbQuery = dbQuery.ilike('location', `%${location}%`);
      }
      
      const { data, error } = await dbQuery.order('created_at', { ascending: false });
      
      if (error) {
        console.error('Search error:', error);
        return c.json({ error: 'Search failed' }, 500);
      }
      
      return c.json(data || []);
    } catch (error) {
      console.error('Search error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  /**
   * GET /api/services/:serviceId/calendar-availability
   * 
   * Get month availability for calendar view (public endpoint).
   * Returns available and unavailable dates for the specified service and month.
   * 
   * Parameters:
   * - serviceId: UUID of the service
   * 
   * Query Parameters:
   * - month: Month in format 'YYYY-MM' (e.g., '2024-01')
   * - timezone: User's timezone for calculations (optional, defaults to 'UTC')
   * 
   * Response:
   * - availableDates: Array of dates with available slots
   * - unavailableDates: Array of dates with reasons for unavailability
   * - nextAvailableDate: Next available date if current month has no availability
   * 
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with calendar availability or error
   */
  app.get('/api/services/:serviceId/calendar-availability', async (c) => {
    try {
      const serviceId = c.req.param('serviceId');
      const { month, timezone } = c.req.query();
      
      console.log(`📅 Calendar availability request for service ${serviceId}, month ${month}`);
      
      if (!month) {
        return c.json({ error: 'Month parameter is required (format: YYYY-MM)' }, 400);
      }
      
      // Validate month format
      if (!/^\d{4}-\d{2}$/.test(month)) {
        return c.json({ error: 'Invalid month format. Use YYYY-MM' }, 400);
      }
      
      const availability = await availabilityService.getMonthAvailability(
        serviceId, 
        month, 
        timezone || 'UTC'
      );
      
      console.log(`✅ Calendar availability calculated for ${serviceId}: ${availability.availableDates.length} available days`);
      
      return c.json(availability);
      
    } catch (error) {
      console.error('❌ Calendar availability error:', error);
      
      if (error.message === 'Service not found') {
        return c.json({ error: 'Service not found' }, 404);
      }
      
      return c.json({ error: 'Failed to calculate calendar availability' }, 500);
    }
  });

  /**
   * POST /api/services/:serviceId/availability
   * 
   * Get detailed day availability with time slots (public endpoint).
   * Returns available and unavailable time slots for a specific service and date.
   * 
   * Parameters:
   * - serviceId: UUID of the service
   * 
   * Body:
   * - date: Date in ISO format (YYYY-MM-DD)
   * - timezone: User's timezone for calculations (optional, defaults to 'UTC')
   * 
   * Response:
   * - availableSlots: Array of available time slots (HH:MM format)
   * - unavailableSlots: Array of unavailable slots with reasons
   * - serviceSchedule: Service operating hours for the day
   * 
   * @param {Context} c - Hono context
   * @returns {Response} JSON response with day availability or error
   */
  app.post('/api/services/:serviceId/availability', async (c) => {
    try {
      const serviceId = c.req.param('serviceId');
      const body = await c.req.json();
      const { date, timezone } = body;
      
      console.log(`🕐 Day availability request for service ${serviceId}, date ${date}`);
      
      if (!date) {
        return c.json({ error: 'Date is required in request body' }, 400);
      }
      
      // Validate date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return c.json({ error: 'Invalid date format. Use YYYY-MM-DD' }, 400);
      }
      
      const availability = await availabilityService.getDayAvailability(
        serviceId, 
        date, 
        timezone || 'UTC'
      );
      
      console.log(`✅ Day availability calculated for ${serviceId} on ${date}: ${availability.availableSlots.length} available slots`);
      
      return c.json(availability);
      
    } catch (error) {
      console.error('❌ Day availability error:', error);
      
      if (error.message === 'Service not found') {
        return c.json({ error: 'Service not found' }, 404);
      }
      
      return c.json({ error: 'Failed to calculate day availability' }, 500);
    }
  });
}
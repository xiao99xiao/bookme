import { supabase, supabaseAdmin } from './supabase';

export class ApiClient {
  // User Profile APIs
  static async getCurrentUserProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) throw error;
    return data;
  }

  static async getUserProfileById(userId: string) {
    try {
      console.log('Fetching profile for userId:', userId);
      
      // Use admin client to bypass RLS for profile fetching
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Profile fetch error:', error.code, error.message);
        throw new Error(`Failed to fetch profile: ${error.message}`);
      }
      
      console.log('Profile fetched successfully:', data);
      return data;
    } catch (error) {
      console.error('getUserProfileById failed:', error);
      throw error;
    }
  }

  static async updateUserProfile(userId: string, updates: {
    display_name?: string;
    bio?: string;
    location?: string;
    phone?: string;
    avatar?: string;
    is_provider?: boolean;
  }) {
    if (!userId) throw new Error('User ID is required');

    // Use admin client to bypass RLS for profile updates
    const { data, error } = await supabaseAdmin
      .from('users')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Services APIs
  static async getUserServices(userId: string) {
    try {
      if (!userId) throw new Error('User ID is required');

      console.log('Fetching services for user:', userId);

      // Use admin client to bypass RLS for service fetching
      const { data, error } = await supabaseAdmin
        .from('services')
        .select(`
          *,
          categories(name, icon, color)
        `)
        .eq('provider_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Services fetch error:', error);
        throw error;
      }
      
      console.log('Services fetched successfully:', data?.length || 0);
      // Map availability_schedule back to timeSlots for frontend compatibility
      const servicesWithTimeSlots = (data || []).map(service => ({
        ...service,
        timeSlots: service.availability_schedule || {}
      }));
      return servicesWithTimeSlots;
    } catch (error) {
      console.error('getUserServices failed:', error);
      throw error;
    }
  }

  static async getUserServicesById(userId: string) {
    const { data, error } = await supabase
      .from('services')
      .select(`
        *,
        categories(name, icon, color)
      `)
      .eq('provider_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    // Map availability_schedule back to timeSlots for frontend compatibility
    const servicesWithTimeSlots = (data || []).map(service => ({
      ...service,
      timeSlots: service.availability_schedule || {}
    }));
    return servicesWithTimeSlots;
  }

  static async createService(userId: string, service: {
    title: string;
    description: string;
    short_description?: string;
    price: number;
    duration_minutes: number;
    category_id?: string;
    location?: string;
    is_online: boolean;
    images?: string[];
    tags?: string[];
    requirements?: string;
    cancellation_policy?: string;
    timeSlots?: { [key: string]: boolean };
  }) {
    if (!userId) throw new Error('User ID is required');

    // Use admin client to bypass RLS for service creation
    const { data, error } = await supabaseAdmin
      .from('services')
      .insert({
        ...service,
        availability_schedule: service.timeSlots || {}, // Map timeSlots to availability_schedule
        provider_id: userId,
        is_active: true,
        rating: 0,
        review_count: 0,
        total_bookings: 0,
        timeSlots: undefined // Remove timeSlots from the insert data
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async updateService(serviceId: string, updates: {
    title?: string;
    description?: string;
    short_description?: string;
    price?: number;
    duration_minutes?: number;
    category_id?: string;
    location?: string;
    is_online?: boolean;
    is_active?: boolean;
    images?: string[];
    tags?: string[];
    requirements?: string;
    cancellation_policy?: string;
    timeSlots?: { [key: string]: boolean };
  }) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('services')
      .update({
        ...updates,
        availability_schedule: updates.timeSlots || {}, // Map timeSlots to availability_schedule
        updated_at: new Date().toISOString(),
        timeSlots: undefined // Remove timeSlots from the update data
      })
      .eq('id', serviceId)
      .eq('provider_id', user.id) // Ensure user owns the service
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async deleteService(serviceId: string, userId: string) {
    if (!userId) throw new Error('User ID is required');

    // Use admin client to bypass RLS for service deletion
    // Soft delete by setting is_active to false
    const { error } = await supabaseAdmin
      .from('services')
      .update({ 
        is_active: false, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', serviceId)
      .eq('provider_id', userId); // Ensure user owns the service

    if (error) throw error;
  }

  // Categories APIs
  static async getCategories() {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');

      if (error) {
        console.warn('Categories fetch error:', error);
        // Return empty array if categories table doesn't exist or has issues
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.warn('Categories fetch failed:', error);
      return [];
    }
  }

  // Discovery APIs
  static async getServices(params?: {
    category?: string;
    location?: string;
    minPrice?: number;
    maxPrice?: number;
    isOnline?: boolean;
    search?: string;
    sortBy?: 'created_at' | 'price' | 'rating' | 'title';
    sortOrder?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  }) {
    let query = supabase
      .from('services')
      .select(`
        *,
        categories(name, icon, color),
        users!services_provider_id_fkey(display_name, avatar, rating, review_count)
      `)
      .eq('is_active', true);

    // Apply filters
    if (params?.category) {
      query = query.eq('categories.name', params.category);
    }
    if (params?.location) {
      query = query.ilike('location', `%${params.location}%`);
    }
    if (params?.minPrice !== undefined) {
      query = query.gte('price', params.minPrice);
    }
    if (params?.maxPrice !== undefined) {
      query = query.lte('price', params.maxPrice);
    }
    if (params?.isOnline !== undefined) {
      query = query.eq('is_online', params.isOnline);
    }
    if (params?.search) {
      query = query.or(`title.ilike.%${params.search}%,description.ilike.%${params.search}%`);
    }

    // Apply sorting
    const sortBy = params?.sortBy || 'created_at';
    const sortOrder = params?.sortOrder || 'desc';
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // Apply pagination
    const page = params?.page || 1;
    const limit = params?.limit || 12;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) throw error;
    // Map availability_schedule back to timeSlots for frontend compatibility
    const servicesWithTimeSlots = (data || []).map(service => ({
      ...service,
      timeSlots: service.availability_schedule || {}
    }));
    return {
      services: servicesWithTimeSlots,
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit)
      }
    };
  }

  // Bookings APIs
  static async getUserBookings(userId: string, role?: 'customer' | 'provider') {
    if (!userId) throw new Error('User ID is required');

    let query = supabase
      .from('bookings')
      .select(`
        *,
        service:services(
          id, title, short_description, price, duration_minutes, images,
          provider:users!services_provider_id_fkey(display_name, avatar)
        ),
        customer:users!bookings_customer_id_fkey(display_name, avatar, email),
        provider:users!bookings_provider_id_fkey(display_name, avatar, email)
      `);

    // Filter by role
    if (role === 'customer') {
      query = query.eq('customer_id', userId);
    } else if (role === 'provider') {
      query = query.eq('provider_id', userId);
    } else {
      // Show all bookings for the user (both as customer and provider)
      query = query.or(`customer_id.eq.${userId},provider_id.eq.${userId}`);
    }

    query = query.order('scheduled_at', { ascending: false });

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  // File Upload API
  static async uploadFile(file: File, type: 'avatar' | 'service_image' | 'document' = 'avatar') {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Create a unique filename
    const fileExtension = file.name.split('.').pop();
    const fileName = `${user.id}/${type}/${Date.now()}.${fileExtension}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('uploads')
      .upload(fileName, file, {
        contentType: file.type,
        upsert: false
      });

    if (uploadError) throw uploadError;

    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from('uploads')
      .getPublicUrl(fileName);

    // Save file record to database
    const { data: fileRecord, error: dbError } = await supabase
      .from('file_uploads')
      .insert({
        user_id: user.id,
        file_name: file.name,
        file_url: publicUrl,
        file_size: file.size,
        mime_type: file.type,
        upload_type: type
      })
      .select()
      .single();

    if (dbError) {
      // Clean up uploaded file if database insert fails
      await supabase.storage.from('uploads').remove([fileName]);
      throw dbError;
    }

    return {
      id: fileRecord.id,
      url: publicUrl,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      uploadType: type
    };
  }

  // Booking APIs
  static async createBooking(bookingData: {
    service_id: string;
    provider_id: string;
    scheduled_at: string; // ISO date string
    duration_minutes: number;
    total_price: number;
    customer_notes?: string;
    location?: string;
    is_online: boolean;
  }) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('bookings')
      .insert({
        ...bookingData,
        customer_id: user.id,
        service_fee: Math.round(bookingData.total_price * 0.05 * 100) / 100, // 5% service fee
        status: 'pending'
      })
      .select(`
        *,
        services(title, description, categories(name)),
        provider:provider_id(display_name, email, avatar),
        customer:customer_id(display_name, email, avatar)
      `)
      .single();

    if (error) throw error;
    return data;
  }

  static async getUserBookingsLegacy(userId: string, type: 'customer' | 'provider' = 'customer') {
    if (!userId) throw new Error('User ID is required');

    const column = type === 'customer' ? 'customer_id' : 'provider_id';
    
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        services(title, description, price, duration_minutes, categories(name)),
        provider:provider_id(display_name, email, avatar),
        customer:customer_id(display_name, email, avatar)
      `)
      .eq(column, userId)
      .order('scheduled_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  static async getBookingById(bookingId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        services(title, description, price, duration_minutes, categories(name), is_online),
        provider:provider_id(display_name, email, avatar, phone),
        customer:customer_id(display_name, email, avatar, phone)
      `)
      .eq('id', bookingId)
      .single();

    if (error) throw error;
    
    // Check if user is involved in this booking
    if (data.customer_id !== user.id && data.provider_id !== user.id) {
      throw new Error('Not authorized to view this booking');
    }
    
    return data;
  }

  static async updateBookingStatus(bookingId: string, status: 'confirmed' | 'cancelled' | 'completed', notes?: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const updates: any = { status };
    
    if (status === 'cancelled') {
      updates.cancelled_at = new Date().toISOString();
      updates.cancelled_by = user.id;
      updates.cancellation_reason = notes;
    } else if (status === 'completed') {
      updates.completed_at = new Date().toISOString();
    }

    if (notes && status !== 'cancelled') {
      updates.provider_notes = notes;
    }

    const { data, error } = await supabase
      .from('bookings')
      .update(updates)
      .eq('id', bookingId)
      .select(`
        *,
        services(title, description, categories(name)),
        provider:provider_id(display_name, email, avatar),
        customer:customer_id(display_name, email, avatar)
      `)
      .single();

    if (error) throw error;
    return data;
  }

  static async addCustomerNotes(bookingId: string, notes: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('bookings')
      .update({ customer_notes: notes })
      .eq('id', bookingId)
      .eq('customer_id', user.id) // Ensure only customer can update their notes
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}
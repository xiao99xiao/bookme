import { supabase, supabaseAdmin } from './supabase';
import { calculatePlatformFee } from './config';
import { generateMeetingLinkForBooking, deleteMeetingForBooking } from './meeting-generation';

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
    meeting_platform?: string;
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
        title: service.title,
        description: service.description,
        short_description: service.short_description,
        price: service.price,
        duration_minutes: service.duration_minutes,
        category_id: service.category_id,
        location: service.location,
        is_online: service.is_online,
        meeting_platform: service.meeting_platform,
        images: service.images,
        tags: service.tags,
        requirements: service.requirements,
        cancellation_policy: service.cancellation_policy,
        availability_schedule: service.timeSlots || {}, // Map timeSlots to availability_schedule
        provider_id: userId,
        is_active: true,
        rating: 0,
        review_count: 0,
        total_bookings: 0
      })
      .select()
      .single();

    if (error) throw error;

    // After successfully creating a service, ensure the user is marked as a provider
    await supabaseAdmin
      .from('users')
      .update({ is_provider: true })
      .eq('id', userId);

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

    const updateData: any = {
      updated_at: new Date().toISOString()
    };
    
    // Only include fields that are defined in updates
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.short_description !== undefined) updateData.short_description = updates.short_description;
    if (updates.price !== undefined) updateData.price = updates.price;
    if (updates.duration_minutes !== undefined) updateData.duration_minutes = updates.duration_minutes;
    if (updates.category_id !== undefined) updateData.category_id = updates.category_id;
    if (updates.location !== undefined) updateData.location = updates.location;
    if (updates.is_online !== undefined) updateData.is_online = updates.is_online;
    if (updates.is_active !== undefined) updateData.is_active = updates.is_active;
    if (updates.images !== undefined) updateData.images = updates.images;
    if (updates.tags !== undefined) updateData.tags = updates.tags;
    if (updates.requirements !== undefined) updateData.requirements = updates.requirements;
    if (updates.cancellation_policy !== undefined) updateData.cancellation_policy = updates.cancellation_policy;
    if (updates.timeSlots !== undefined) updateData.availability_schedule = updates.timeSlots;
    
    const { data, error } = await supabase
      .from('services')
      .update(updateData)
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

    // Use admin client for Privy users (assume they are if no Supabase session)
    let useAdminClient = false;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      useAdminClient = !user;
    } catch {
      useAdminClient = true;
    }

    const dbClient = useAdminClient ? supabaseAdmin : supabase;

    let query = dbClient
      .from('bookings')
      .select(`
        *,
        services(
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

    // Try scheduled_at first, fallback to created_at if that doesn't exist
    query = query.order('scheduled_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('Bookings query error:', error);
      throw error;
    }
    return data || [];
  }

  // File Upload API
  static async uploadFile(file: File, type: 'avatar' | 'service_image' | 'document' = 'avatar', userId?: string) {
    // Try to get userId from parameter first (for Privy users), then fall back to Supabase auth
    let effectiveUserId = userId;
    let useAdminClient = false;
    
    if (!effectiveUserId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      effectiveUserId = user.id;
    } else {
      // If userId was provided (Privy user), use admin client to bypass RLS
      useAdminClient = true;
    }

    // Create a unique filename
    const fileExtension = file.name.split('.').pop();
    const fileName = `${effectiveUserId}/${type}/${Date.now()}.${fileExtension}`;

    // Choose the appropriate client based on auth type
    const storageClient = useAdminClient ? supabaseAdmin : supabase;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await storageClient.storage
      .from('uploads')
      .upload(fileName, file, {
        contentType: file.type,
        upsert: false
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      throw uploadError;
    }

    // Get the public URL
    const { data: { publicUrl } } = storageClient.storage
      .from('uploads')
      .getPublicUrl(fileName);

    // Try to save file record to database (if table exists)
    try {
      const dbClient = useAdminClient ? supabaseAdmin : supabase;
      const { data: fileRecord, error: dbError } = await dbClient
        .from('file_uploads')
        .insert({
          user_id: effectiveUserId,
          file_name: file.name,
          file_url: publicUrl,
          file_size: file.size,
          mime_type: file.type,
          upload_type: type
        })
        .select()
        .single();

      if (dbError) {
        // If file_uploads table doesn't exist, just return the URL
        if (dbError.code === '42P01') {
          console.log('file_uploads table does not exist, skipping database record');
          return {
            id: fileName,
            url: publicUrl,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
            uploadType: type
          };
        }
        // Clean up uploaded file if database insert fails for other reasons
        await storageClient.storage.from('uploads').remove([fileName]);
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
    } catch (error: any) {
      // If file_uploads table doesn't exist, just return the URL
      if (error.code === '42P01' || error.message?.includes('file_uploads')) {
        console.log('file_uploads table issue, returning URL only');
        return {
          id: fileName,
          url: publicUrl,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          uploadType: type
        };
      }
      throw error;
    }
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
  }, customerId?: string) {
    // Try to get customerId from parameter first (for Privy users), then fall back to Supabase auth
    let effectiveCustomerId = customerId;
    
    if (!effectiveCustomerId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      effectiveCustomerId = user.id;
    }

    // Use admin client for Privy users to bypass RLS
    const dbClient = customerId ? supabaseAdmin : supabase;

    const { data, error } = await dbClient
      .from('bookings')
      .insert({
        ...bookingData,
        customer_id: effectiveCustomerId,
        service_fee: calculatePlatformFee(bookingData.total_price),
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

  static async getBookingById(bookingId: string, userId?: string) {
    // Try to get userId from parameter first (for Privy users), then fall back to Supabase auth
    let effectiveUserId = userId;
    
    if (!effectiveUserId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      effectiveUserId = user.id;
    }

    // Use admin client for Privy users
    const dbClient = userId ? supabaseAdmin : supabase;

    const { data, error } = await dbClient
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
    if (data.customer_id !== effectiveUserId && data.provider_id !== effectiveUserId) {
      throw new Error('Not authorized to view this booking');
    }
    
    return data;
  }

  static async updateBookingStatus(bookingId: string, status: 'confirmed' | 'cancelled' | 'completed', notes?: string, userId?: string) {
    // Try to get userId from parameter first (for Privy users), then fall back to Supabase auth
    let effectiveUserId = userId;
    
    if (!effectiveUserId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      effectiveUserId = user.id;
    }

    // Use admin client for Privy users
    const dbClient = userId ? supabaseAdmin : supabase;

    const updates: any = { status };
    
    if (status === 'cancelled') {
      updates.cancelled_at = new Date().toISOString();
      updates.cancelled_by = effectiveUserId;
      updates.cancellation_reason = notes;
    } else if (status === 'completed') {
      updates.completed_at = new Date().toISOString();
    }

    if (notes && status !== 'cancelled') {
      updates.provider_notes = notes;
    }

    const { data, error } = await dbClient
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

    // Handle meeting generation/deletion based on status
    if (status === 'confirmed') {
      // Generate meeting link for confirmed bookings
      try {
        await generateMeetingLinkForBooking(bookingId);
      } catch (meetingError) {
        console.error('Failed to generate meeting link:', meetingError);
        // Don't fail the booking confirmation if meeting generation fails
      }
    } else if (status === 'cancelled') {
      // Delete meeting for cancelled bookings
      try {
        await deleteMeetingForBooking(bookingId);
      } catch (meetingError) {
        console.error('Failed to delete meeting:', meetingError);
      }
    }

    return data;
  }

  static async addCustomerNotes(bookingId: string, notes: string, userId?: string) {
    // Try to get userId from parameter first (for Privy users), then fall back to Supabase auth
    let effectiveUserId = userId;
    
    if (!effectiveUserId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      effectiveUserId = user.id;
    }

    // Use admin client for Privy users
    const dbClient = userId ? supabaseAdmin : supabase;

    const { data, error } = await dbClient
      .from('bookings')
      .update({ customer_notes: notes })
      .eq('id', bookingId)
      .eq('customer_id', effectiveUserId) // Ensure only customer can update their notes
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async getMyBookings(userId: string) {
    return await this.getUserBookings(userId, 'customer');
  }

  static async getProviderBookings(userId: string) {
    return await this.getUserBookings(userId, 'provider');
  }

  // Chat APIs
  static async getOrCreateConversation(otherUserId: string, currentUserId?: string) {
    // Try to get currentUserId from parameter first (for Privy users), then fall back to Supabase auth
    let effectiveUserId = currentUserId;
    
    if (!effectiveUserId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      effectiveUserId = user.id;
    }

    // Use admin client for Privy users
    const dbClient = currentUserId ? supabaseAdmin : supabase;

    // Order user IDs consistently
    const user1Id = effectiveUserId < otherUserId ? effectiveUserId : otherUserId;
    const user2Id = effectiveUserId < otherUserId ? otherUserId : effectiveUserId;

    // Check if conversation already exists
    const { data: existingConversation } = await dbClient
      .from('conversations')
      .select('*')
      .eq('user1_id', user1Id)
      .eq('user2_id', user2Id)
      .single();

    if (existingConversation) {
      return existingConversation;
    }

    // Check if there's an active booking between these users
    const { data: booking } = await dbClient
      .from('bookings')
      .select('id')
      .or(`customer_id.eq.${effectiveUserId},provider_id.eq.${effectiveUserId}`)
      .or(`customer_id.eq.${otherUserId},provider_id.eq.${otherUserId}`)
      .in('status', ['pending', 'confirmed', 'completed'])
      .limit(1)
      .single();

    if (!booking) {
      throw new Error('No active booking exists between these users');
    }

    // Create new conversation
    const { data, error } = await dbClient
      .from('conversations')
      .insert({
        user1_id: user1Id,
        user2_id: user2Id
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async getConversations(userId: string) {
    if (!userId) throw new Error('User ID is required');

    // Use admin client for Privy users
    let useAdminClient = false;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      useAdminClient = !user;
    } catch {
      useAdminClient = true;
    }

    const dbClient = useAdminClient ? supabaseAdmin : supabase;

    const { data, error } = await dbClient
      .from('conversations')
      .select(`
        *,
        user1:users!conversations_user1_id_fkey(display_name, avatar),
        user2:users!conversations_user2_id_fkey(display_name, avatar),
        messages(
          content,
          created_at,
          sender_id,
          is_read
        )
      `)
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .order('last_message_at', { ascending: false });

    if (error) throw error;

    // Get the latest message and other user info for each conversation
    return (data || []).map(conversation => {
      const otherUser = conversation.user1_id === userId ? conversation.user2 : conversation.user1;
      return {
        ...conversation,
        other_user: otherUser,
        latest_message: conversation.messages?.[0] || null,
        unread_count: conversation.messages?.filter(
          (m: any) => !m.is_read && m.sender_id !== userId
        ).length || 0
      };
    });
  }

  static async getConversation(conversationId: string, userId?: string) {
    // Try to get userId from parameter first (for Privy users), then fall back to Supabase auth
    let effectiveUserId = userId;
    
    if (!effectiveUserId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      effectiveUserId = user.id;
    }

    // Use admin client for Privy users
    const dbClient = userId ? supabaseAdmin : supabase;

    const { data, error } = await dbClient
      .from('conversations')
      .select(`
        *,
        user1:users!conversations_user1_id_fkey(display_name, avatar),
        user2:users!conversations_user2_id_fkey(display_name, avatar)
      `)
      .eq('id', conversationId)
      .single();

    if (error) throw error;
    
    // Add other_user for convenience
    const otherUser = data.user1_id === effectiveUserId ? data.user2 : data.user1;
    return {
      ...data,
      other_user: otherUser
    };
  }

  static async getMessages(conversationId: string, limit: number = 30, before?: string) {
    // Use admin client for Privy users
    let useAdminClient = false;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      useAdminClient = !user;
    } catch {
      useAdminClient = true;
    }

    const dbClient = useAdminClient ? supabaseAdmin : supabase;

    let query = dbClient
      .from('messages')
      .select(`
        *,
        sender:users!messages_sender_id_fkey(display_name, avatar)
      `)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false }) // Get newest first for pagination
      .limit(limit);

    // If before timestamp is provided, get messages before that time
    if (before) {
      query = query.lt('created_at', before);
    }

    const { data, error } = await query;

    if (error) throw error;
    
    // Reverse to show chronological order (oldest to newest)
    return (data || []).reverse();
  }

  static async sendMessage(conversationId: string, content: string, senderId?: string) {
    // Try to get senderId from parameter first (for Privy users), then fall back to Supabase auth
    let effectiveSenderId = senderId;
    
    if (!effectiveSenderId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      effectiveSenderId = user.id;
    }

    // Use admin client for Privy users
    const dbClient = senderId ? supabaseAdmin : supabase;

    const { data, error } = await dbClient
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: effectiveSenderId,
        content: content.trim()
      })
      .select(`
        *,
        sender:users!messages_sender_id_fkey(display_name, avatar)
      `)
      .single();

    if (error) throw error;
    return data;
  }

  static async markMessagesAsRead(conversationId: string, userId?: string) {
    // Try to get userId from parameter first (for Privy users), then fall back to Supabase auth
    let effectiveUserId = userId;
    
    if (!effectiveUserId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      effectiveUserId = user.id;
    }

    // Use admin client for Privy users
    const dbClient = userId ? supabaseAdmin : supabase;

    const { error } = await dbClient
      .from('messages')
      .update({ is_read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', effectiveUserId); // Don't mark own messages as read

    if (error) throw error;
  }

  static async getUnreadMessageCount(userId: string) {
    if (!userId) throw new Error('User ID is required');

    const { data, error } = await supabase
      .from('messages')
      .select('id', { count: 'exact' })
      .eq('is_read', false)
      .neq('sender_id', userId)
      .in('conversation_id', 
        supabase
          .from('conversations')
          .select('id')
          .or(`customer_id.eq.${userId},provider_id.eq.${userId}`)
      );

    if (error) throw error;
    return data?.length || 0;
  }

  // Meeting Integration APIs
  static async getMeetingIntegrations(userId?: string) {
    // For Privy users, we need userId passed in
    if (!userId) {
      // Try to get from Supabase auth if not provided (fallback for non-Privy users)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User ID required');
      userId = user.id;
    }

    // Always use admin client for meeting integrations to bypass RLS
    const { data, error } = await supabaseAdmin
      .from('user_meeting_integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  static async getMeetingOAuthUrl(platform: string) {
    // This will be implemented when we add the backend OAuth endpoints
    // For now, return a placeholder
    return {
      authUrl: `${window.location.origin}/api/auth/${platform}/connect`
    };
  }

  static async deleteMeetingIntegration(integrationId: string) {
    // Use admin client for Privy users
    let useAdminClient = false;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      useAdminClient = !user;
    } catch {
      useAdminClient = true;
    }

    const dbClient = useAdminClient ? supabaseAdmin : supabase;

    const { error } = await dbClient
      .from('user_meeting_integrations')
      .update({ is_active: false })
      .eq('id', integrationId);

    if (error) throw error;
  }
}
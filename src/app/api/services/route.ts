import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    // Create Supabase client bypassing RLS for API operations
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const data = await req.json();
    const { 
      title, 
      description, 
      category, 
      duration, 
      price, 
      location, 
      providerId, 
      availabilitySlots 
    } = data;

    // Validate required fields
    if (!title || !description || !category || !duration || !price || !location || !providerId || !availabilitySlots) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create the service
    const { data: service, error } = await supabase
      .from('services')
      .insert({
        title,
        description,
        category,
        duration: parseInt(duration),
        price: parseFloat(price),
        location,
        provider_id: providerId,
        availability_slots: typeof availabilitySlots === 'string' ? availabilitySlots : JSON.stringify(availabilitySlots),
      })
      .select(`
        *,
        provider:users(
          id,
          display_name,
          bio,
          location,
          hobbies,
          interests,
          avatar,
          rating,
          review_count
        )
      `)
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to create service' },
        { status: 500 }
      );
    }

    // Parse JSON fields for response
    const serviceResponse = {
      ...service,
      provider: {
        ...service.provider,
        hobbies: service.provider.hobbies ? JSON.parse(service.provider.hobbies) : [],
        interests: service.provider.interests ? JSON.parse(service.provider.interests) : [],
      },
      availabilitySlots: JSON.parse(service.availability_slots),
    };

    return NextResponse.json({ service: serviceResponse });
  } catch (error) {
    console.error('Create service error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    // Create Supabase client for API operations
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const { searchParams } = new URL(req.url);
    const providerId = searchParams.get('providerId');
    const category = searchParams.get('category');
    const location = searchParams.get('location');
    const search = searchParams.get('search');

    let query = supabase
      .from('services')
      .select(`
        *,
        provider:users(
          id,
          display_name,
          bio,
          location,
          hobbies,
          interests,
          avatar,
          rating,
          review_count
        )
      `)
      .order('created_at', { ascending: false });

    // Only filter by is_active if this is not a provider's own dashboard request
    if (!providerId) {
      query = query.eq('is_active', true);
    }

    if (providerId) {
      query = query.eq('provider_id', providerId);
    }

    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    if (location && location !== 'all') {
      query = query.eq('location', location);
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    console.log('API Query params:', { providerId, category, location, search });
    
    const { data: services, error } = await query;

    console.log('Services query result:', { 
      servicesCount: services?.length || 0, 
      error: error?.message,
      services: services 
    });

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch services' },
        { status: 500 }
      );
    }

    // Parse JSON fields for response
    const servicesResponse = services?.map(service => ({
      ...service,
      provider: {
        ...service.provider,
        hobbies: service.provider.hobbies ? JSON.parse(service.provider.hobbies) : [],
        interests: service.provider.interests ? JSON.parse(service.provider.interests) : [],
      },
      availabilitySlots: JSON.parse(service.availability_slots),
    })) || [];

    return NextResponse.json({ services: servicesResponse });
  } catch (error) {
    console.error('Get services error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
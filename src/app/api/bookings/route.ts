import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const providerId = searchParams.get('providerId');

    let query = supabase
      .from('bookings')
      .select(`
        *,
        service:services(
          *,
          provider:users(
            id,
            display_name,
            avatar,
            rating,
            review_count
          )
        ),
        requester:users(
          id,
          display_name,
          avatar,
          rating,
          review_count
        )
      `)
      .order('created_at', { ascending: false });

    if (userId) {
      query = query.eq('requester_id', userId);
    }

    if (providerId) {
      query = query.eq('service.provider_id', providerId);
    }

    const { data: bookings, error } = await query;

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch bookings' },
        { status: 500 }
      );
    }

    return NextResponse.json({ bookings });
  } catch (error) {
    console.error('Get bookings error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { serviceId, requesterId, message } = await req.json();

    // Check if service exists and is available
    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('*')
      .eq('id', serviceId)
      .single();

    if (serviceError || !service) {
      return NextResponse.json(
        { error: 'Service not found' },
        { status: 404 }
      );
    }

    if (!service.is_active) {
      return NextResponse.json(
        { error: 'Service is not available' },
        { status: 400 }
      );
    }

    // Check if user already has a pending booking for this service
    const { data: existingBooking } = await supabase
      .from('bookings')
      .select('id')
      .eq('service_id', serviceId)
      .eq('requester_id', requesterId)
      .eq('status', 'pending')
      .single();

    if (existingBooking) {
      return NextResponse.json(
        { error: 'You already have a pending booking for this service' },
        { status: 400 }
      );
    }

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        service_id: serviceId,
        requester_id: requesterId,
        message,
      })
      .select(`
        *,
        service:services(
          *,
          provider:users(
            id,
            display_name,
            avatar,
            rating,
            review_count
          )
        ),
        requester:users(
          id,
          display_name,
          avatar,
          rating,
          review_count
        )
      `)
      .single();

    if (bookingError) {
      console.error('Supabase error:', bookingError);
      return NextResponse.json(
        { error: 'Failed to create booking' },
        { status: 500 }
      );
    }

    return NextResponse.json({ booking }, { status: 201 });
  } catch (error) {
    console.error('Create booking error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ serviceId: string }> }
) {
  try {
    const { serviceId } = await params;
    const data = await req.json();
    const { 
      title, 
      description, 
      category, 
      duration, 
      price, 
      location, 
      availabilitySlots 
    } = data;

    // Validate required fields
    if (!title || !description || !category || !duration || !price || !location || !availabilitySlots) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Update the service
    const { data: service, error } = await supabase
      .from('services')
      .update({
        title,
        description,
        category,
        duration: parseInt(duration),
        price: parseFloat(price),
        location,
        availability_slots: typeof availabilitySlots === 'string' ? availabilitySlots : JSON.stringify(availabilitySlots),
        updated_at: new Date().toISOString(),
      })
      .eq('id', serviceId)
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
        { error: 'Failed to update service' },
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
    console.error('Update service error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ serviceId: string }> }
) {
  try {
    const { serviceId } = await params;

    // Delete the service
    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', serviceId);

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to delete service' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete service error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { data: user, error } = await supabase
      .from('users')
      .select(`
        id,
        display_name,
        bio,
        location,
        hobbies,
        interests,
        avatar,
        rating,
        review_count,
        is_active,
        created_at
      `)
      .eq('id', id)
      .single();

    if (error || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Parse JSON fields
    const userResponse = {
      ...user,
      hobbies: user.hobbies ? JSON.parse(user.hobbies) : [],
      interests: user.interests ? JSON.parse(user.interests) : [],
    };

    return NextResponse.json({ user: userResponse });
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        displayName: true,
        bio: true,
        location: true,
        hobbies: true,
        interests: true,
        avatar: true,
        rating: true,
        reviewCount: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!user) {
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
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
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
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Check password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Remove password from response
    const { password: _, ...userResponse } = user;

    // Parse JSON fields for response
    const userWithParsedFields = {
      ...userResponse,
      hobbies: user.hobbies ? JSON.parse(user.hobbies) : [],
      interests: user.interests ? JSON.parse(user.interests) : [],
    };

    return NextResponse.json({ user: userWithParsedFields });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
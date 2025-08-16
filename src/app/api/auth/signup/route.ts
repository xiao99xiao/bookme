import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const { email, password, displayName, bio, location, hobbies, interests } = await req.json();

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        displayName,
        bio: bio || null,
        location: location || null,
        hobbies: hobbies ? JSON.stringify(hobbies) : null,
        interests: interests ? JSON.stringify(interests) : null,
      },
      select: {
        id: true,
        email: true,
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

    // Parse JSON fields for response
    const userResponse = {
      ...user,
      hobbies: user.hobbies ? JSON.parse(user.hobbies) : [],
      interests: user.interests ? JSON.parse(user.interests) : [],
    };

    return NextResponse.json({ user: userResponse }, { status: 201 });
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
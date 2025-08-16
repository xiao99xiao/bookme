import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const location = searchParams.get('location');
    const search = searchParams.get('search');
    const providerId = searchParams.get('providerId');

    let whereClause: any = {
      isActive: true,
    };

    // If providerId is specified, filter by provider (for dashboard)
    if (providerId) {
      whereClause.providerId = providerId;
    } else {
      // Only show future slots for discovery
      whereClause.OR = [
        {
          date: {
            gt: new Date().toISOString().split('T')[0]
          }
        },
        {
          AND: [
            {
              date: new Date().toISOString().split('T')[0]
            },
            {
              time: {
                gt: new Date().toTimeString().split(' ')[0].substring(0, 5)
              }
            }
          ]
        }
      ];
    }

    if (category && category !== 'all') {
      whereClause.category = category;
    }

    if (location && location !== 'all') {
      whereClause.location = location;
    }

    if (search) {
      whereClause.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { provider: { displayName: { contains: search, mode: 'insensitive' } } }
      ];
    }

    const slots = await prisma.slot.findMany({
      where: whereClause,
      include: {
        provider: {
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
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Parse JSON fields and format response
    const slotsResponse = slots.map(slot => ({
      ...slot,
      provider: {
        ...slot.provider,
        hobbies: slot.provider.hobbies ? JSON.parse(slot.provider.hobbies) : [],
        interests: slot.provider.interests ? JSON.parse(slot.provider.interests) : [],
      }
    }));

    return NextResponse.json({ slots: slotsResponse });
  } catch (error) {
    console.error('Get slots error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { title, description, category, date, time, duration, price, location, providerId } = await req.json();

    const slot = await prisma.slot.create({
      data: {
        title,
        description,
        category,
        date,
        time,
        duration,
        price,
        location,
        providerId,
      },
      include: {
        provider: {
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
          }
        }
      }
    });

    // Parse JSON fields
    const slotResponse = {
      ...slot,
      provider: {
        ...slot.provider,
        hobbies: slot.provider.hobbies ? JSON.parse(slot.provider.hobbies) : [],
        interests: slot.provider.interests ? JSON.parse(slot.provider.interests) : [],
      }
    };

    return NextResponse.json({ slot: slotResponse }, { status: 201 });
  } catch (error) {
    console.error('Create slot error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
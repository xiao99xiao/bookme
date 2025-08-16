import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
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
    const service = await prisma.service.create({
      data: {
        title,
        description,
        category,
        duration: parseInt(duration),
        price: parseFloat(price),
        location,
        providerId,
        availabilitySlots: typeof availabilitySlots === 'string' ? availabilitySlots : JSON.stringify(availabilitySlots),
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
          },
        },
      },
    });

    // Parse JSON fields for response
    const serviceResponse = {
      ...service,
      provider: {
        ...service.provider,
        hobbies: service.provider.hobbies ? JSON.parse(service.provider.hobbies) : [],
        interests: service.provider.interests ? JSON.parse(service.provider.interests) : [],
      },
      availabilitySlots: JSON.parse(service.availabilitySlots),
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
    const { searchParams } = new URL(req.url);
    const providerId = searchParams.get('providerId');
    const category = searchParams.get('category');
    const location = searchParams.get('location');
    const search = searchParams.get('search');

    const where: any = {
      isActive: true,
    };

    if (providerId) {
      where.providerId = providerId;
    }

    if (category && category !== 'all') {
      where.category = category;
    }

    if (location && location !== 'all') {
      where.location = location;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const services = await prisma.service.findMany({
      where,
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
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Parse JSON fields for response
    const servicesResponse = services.map(service => ({
      ...service,
      provider: {
        ...service.provider,
        hobbies: service.provider.hobbies ? JSON.parse(service.provider.hobbies) : [],
        interests: service.provider.interests ? JSON.parse(service.provider.interests) : [],
      },
      availabilitySlots: JSON.parse(service.availabilitySlots),
    }));

    return NextResponse.json({ services: servicesResponse });
  } catch (error) {
    console.error('Get services error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
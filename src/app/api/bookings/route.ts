import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const providerId = searchParams.get('providerId');

    let whereClause: any = {};

    if (userId) {
      whereClause.requesterId = userId;
    }

    if (providerId) {
      whereClause.service = {
        providerId: providerId
      };
    }

    const bookings = await prisma.booking.findMany({
      where: whereClause,
      include: {
        service: {
          include: {
            provider: {
              select: {
                id: true,
                displayName: true,
                avatar: true,
                rating: true,
                reviewCount: true,
              }
            }
          }
        },
        requester: {
          select: {
            id: true,
            displayName: true,
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
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      return NextResponse.json(
        { error: 'Service not found' },
        { status: 404 }
      );
    }

    if (!service.isActive) {
      return NextResponse.json(
        { error: 'Service is not available' },
        { status: 400 }
      );
    }

    // Check if user already has a pending booking for this service
    const existingBooking = await prisma.booking.findFirst({
      where: {
        serviceId,
        requesterId,
        status: 'pending'
      }
    });

    if (existingBooking) {
      return NextResponse.json(
        { error: 'You already have a pending booking for this service' },
        { status: 400 }
      );
    }

    const booking = await prisma.booking.create({
      data: {
        serviceId,
        requesterId,
        message,
      },
      include: {
        service: {
          include: {
            provider: {
              select: {
                id: true,
                displayName: true,
                avatar: true,
                rating: true,
                reviewCount: true,
              }
            }
          }
        },
        requester: {
          select: {
            id: true,
            displayName: true,
            avatar: true,
            rating: true,
            reviewCount: true,
          }
        }
      }
    });

    return NextResponse.json({ booking }, { status: 201 });
  } catch (error) {
    console.error('Create booking error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/bookings/[id]/conversation - Get conversation for booking
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bookingId } = await context.params
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Verify booking exists and user has access
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        service: {
          include: {
            provider: true
          }
        },
        requester: true,
        conversation: {
          include: {
            provider: {
              select: {
                id: true,
                displayName: true,
                avatar: true,
                isActive: true
              }
            },
            customer: {
              select: {
                id: true,
                displayName: true,
                avatar: true,
                isActive: true
              }
            }
          }
        }
      }
    })

    if (!booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      )
    }

    // Check if user has access to this booking
    const hasAccess = booking.requesterId === userId || booking.service.providerId === userId
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Check if booking is confirmed
    if (booking.status !== 'confirmed') {
      return NextResponse.json(
        { error: 'Conversation only available for confirmed bookings' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      conversation: booking.conversation,
      booking: {
        id: booking.id,
        status: booking.status,
        service: {
          id: booking.service.id,
          title: booking.service.title,
          provider: booking.service.provider
        },
        requester: booking.requester
      }
    })
  } catch (error) {
    console.error('Error fetching booking conversation:', error)
    return NextResponse.json(
      { error: 'Failed to fetch conversation' },
      { status: 500 }
    )
  }
}

// POST /api/bookings/[id]/conversation - Create conversation for booking
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bookingId } = await context.params
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Get booking details
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        service: {
          include: {
            provider: true
          }
        },
        requester: true,
        conversation: true
      }
    })

    if (!booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      )
    }

    // Check if user has access to this booking
    const hasAccess = booking.requesterId === userId || booking.service.providerId === userId
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Check if booking is confirmed
    if (booking.status !== 'confirmed') {
      return NextResponse.json(
        { error: 'Conversation can only be created for confirmed bookings' },
        { status: 400 }
      )
    }

    // Check if conversation already exists
    if (booking.conversation) {
      return NextResponse.json({
        conversation: booking.conversation,
        message: 'Conversation already exists'
      })
    }

    // Generate Agora channel ID
    const agoraChannelId = `bookme_${bookingId}`

    // Create conversation
    const conversation = await prisma.conversation.create({
      data: {
        bookingId,
        agoraChannelId,
        providerId: booking.service.providerId,
        customerId: booking.requesterId
      },
      include: {
        booking: {
          include: {
            service: true
          }
        },
        provider: {
          select: {
            id: true,
            displayName: true,
            avatar: true,
            isActive: true
          }
        },
        customer: {
          select: {
            id: true,
            displayName: true,
            avatar: true,
            isActive: true
          }
        }
      }
    })

    return NextResponse.json({
      conversation,
      message: 'Conversation created successfully'
    })
  } catch (error) {
    console.error('Error creating conversation:', error)
    return NextResponse.json(
      { error: 'Failed to create conversation' },
      { status: 500 }
    )
  }
}
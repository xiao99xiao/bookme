import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/conversations - Get user's conversations
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Get conversations where user is either provider or customer
    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [
          { providerId: userId },
          { customerId: userId }
        ],
        isActive: true
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
      },
      orderBy: {
        lastMessageAt: 'desc'
      }
    })

    return NextResponse.json({ conversations })
  } catch (error) {
    console.error('Error fetching conversations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch conversations' },
      { status: 500 }
    )
  }
}

// POST /api/conversations - Create conversation for booking
export async function POST(request: NextRequest) {
  try {
    const { bookingId } = await request.json()

    if (!bookingId) {
      return NextResponse.json(
        { error: 'Booking ID is required' },
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
        requester: true
      }
    })

    if (!booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
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
    const existingConversation = await prisma.conversation.findUnique({
      where: { bookingId }
    })

    if (existingConversation) {
      return NextResponse.json({ 
        conversation: existingConversation,
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
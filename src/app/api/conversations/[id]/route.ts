import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/conversations/[id] - Get conversation details
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await context.params
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
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

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      )
    }

    // Check if user has access to this conversation
    if (conversation.providerId !== userId && conversation.customerId !== userId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    return NextResponse.json({ conversation })
  } catch (error) {
    console.error('Error fetching conversation:', error)
    return NextResponse.json(
      { error: 'Failed to fetch conversation' },
      { status: 500 }
    )
  }
}

// PATCH /api/conversations/[id] - Update conversation metadata
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await context.params
    const updates = await request.json()
    const { userId, lastMessageText, lastMessageSender } = updates

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Verify user has access to this conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId }
    })

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      )
    }

    if (conversation.providerId !== userId && conversation.customerId !== userId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Update conversation metadata
    const updatedConversation = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: new Date(),
        lastMessageText,
        lastMessageSender,
        updatedAt: new Date()
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
      conversation: updatedConversation,
      message: 'Conversation updated successfully'
    })
  } catch (error) {
    console.error('Error updating conversation:', error)
    return NextResponse.json(
      { error: 'Failed to update conversation' },
      { status: 500 }
    )
  }
}

// DELETE /api/conversations/[id] - Archive conversation
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await context.params
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Verify user has access to this conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId }
    })

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      )
    }

    if (conversation.providerId !== userId && conversation.customerId !== userId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Archive conversation (don't delete, just mark as inactive)
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        isActive: false,
        updatedAt: new Date()
      }
    })

    return NextResponse.json({ 
      message: 'Conversation archived successfully'
    })
  } catch (error) {
    console.error('Error archiving conversation:', error)
    return NextResponse.json(
      { error: 'Failed to archive conversation' },
      { status: 500 }
    )
  }
}
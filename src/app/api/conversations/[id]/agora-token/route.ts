import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AgoraChatToken } from '@/lib/agora'

// GET /api/conversations/[id]/agora-token - Generate Agora token for conversation
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

    // Verify conversation exists and user has access
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId }
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

    // Get Agora configuration from environment
    const appId = process.env.AGORA_APP_ID
    const appCertificate = process.env.AGORA_APP_CERTIFICATE

    if (!appId || !appCertificate) {
      return NextResponse.json(
        { error: 'Agora configuration not found' },
        { status: 500 }
      )
    }

    // Generate Agora user ID (format: user_${userId})
    const agoraUserId = `user_${userId}`
    
    // Generate token (expires in 24 hours)
    const expireTime = Math.floor(Date.now() / 1000) + (24 * 60 * 60)
    const token = AgoraChatToken.generateToken(
      appId,
      appCertificate,
      agoraUserId,
      expireTime
    )

    return NextResponse.json({
      token,
      agoraUserId,
      agoraChannelId: conversation.agoraChannelId,
      appId,
      expireTime,
      message: 'Token generated successfully'
    })
  } catch (error) {
    console.error('Error generating Agora token:', error)
    return NextResponse.json(
      { error: 'Failed to generate token' },
      { status: 500 }
    )
  }
}
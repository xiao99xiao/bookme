import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: bookingId } = await params;
    const { status } = await req.json();

    // Validate status
    const validStatuses = ['pending', 'confirmed', 'declined', 'cancelled', 'completed'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      );
    }

    // Check if booking exists
    const existingBooking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!existingBooking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: any = { status };
    
    // Add timestamp fields based on status
    if (status === 'confirmed') {
      updateData.confirmedAt = new Date();
    } else if (status === 'declined') {
      updateData.declinedAt = new Date();
    } else if (status === 'cancelled') {
      updateData.cancelledAt = new Date();
    } else if (status === 'completed') {
      updateData.completedAt = new Date();
    }

    // Update the booking
    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: updateData,
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
        },
        conversation: true
      }
    });

    // Auto-create conversation when booking is confirmed
    if (status === 'confirmed' && existingBooking.status !== 'confirmed' && !updatedBooking.conversation) {
      try {
        const agoraChannelId = `bookme_${bookingId}`;
        
        await prisma.conversation.create({
          data: {
            bookingId,
            agoraChannelId,
            providerId: updatedBooking.service.provider.id,
            customerId: updatedBooking.requester.id
          }
        });
        
        console.log(`Conversation created for booking ${bookingId}`);
      } catch (conversationError) {
        console.error('Error creating conversation:', conversationError);
        // Don't fail the booking update if conversation creation fails
      }
    }

    return NextResponse.json({ booking: updatedBooking });
  } catch (error) {
    console.error('Update booking error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: bookingId } = await params;

    // Check if booking exists
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    // Delete the booking
    await prisma.booking.delete({
      where: { id: bookingId },
    });

    return NextResponse.json({ message: 'Booking deleted successfully' });
  } catch (error) {
    console.error('Delete booking error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
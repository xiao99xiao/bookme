import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const slotId = params.id;

    // Check if slot exists
    const slot = await prisma.slot.findUnique({
      where: { id: slotId },
    });

    if (!slot) {
      return NextResponse.json(
        { error: 'Slot not found' },
        { status: 404 }
      );
    }

    // Delete the slot (this will cascade delete related bookings)
    await prisma.slot.delete({
      where: { id: slotId },
    });

    return NextResponse.json({ message: 'Slot deleted successfully' });
  } catch (error) {
    console.error('Delete slot error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const slotId = params.id;
    const updates = await req.json();

    // Check if slot exists
    const existingSlot = await prisma.slot.findUnique({
      where: { id: slotId },
    });

    if (!existingSlot) {
      return NextResponse.json(
        { error: 'Slot not found' },
        { status: 404 }
      );
    }

    // Update the slot
    const updatedSlot = await prisma.slot.update({
      where: { id: slotId },
      data: updates,
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
      ...updatedSlot,
      provider: {
        ...updatedSlot.provider,
        hobbies: updatedSlot.provider.hobbies ? JSON.parse(updatedSlot.provider.hobbies) : [],
        interests: updatedSlot.provider.interests ? JSON.parse(updatedSlot.provider.interests) : [],
      }
    };

    return NextResponse.json({ slot: slotResponse });
  } catch (error) {
    console.error('Update slot error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
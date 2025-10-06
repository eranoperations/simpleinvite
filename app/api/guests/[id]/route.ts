import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import GuestModel from '@/models/Guest';
import { auth } from '@/auth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    await dbConnect();
    const updates = await request.json();
    
    // Only allow users to update their own guests
    const updatedGuest = await GuestModel.findOneAndUpdate(
      { id: params.id, userId: session.user.id },
      updates,
      { new: true }
    );
    
    if (!updatedGuest) {
      return NextResponse.json(
        { error: 'Guest not found or access denied' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(updatedGuest);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update guest' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    await dbConnect();
    
    // Only allow users to delete their own guests
    const deletedGuest = await GuestModel.findOneAndDelete({
      id: params.id,
      userId: session.user.id
    });
    
    if (!deletedGuest) {
      return NextResponse.json(
        { error: 'Guest not found or access denied' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ message: 'Guest deleted successfully' });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete guest' },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import GuestModel from '@/models/Guest';
import { auth } from '@/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    await dbConnect();
    const guests = await request.json();
    
    // Associate all guests with the authenticated user
    const guestsWithUserId = guests.map((guest: any) => ({
      ...guest,
      userId: session.user.id
    }));
    
    const createdGuests = await GuestModel.insertMany(guestsWithUserId);
    return NextResponse.json(createdGuests, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create guests' },
      { status: 500 }
    );
  }
}
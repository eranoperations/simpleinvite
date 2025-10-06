import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import GuestModel from '@/models/Guest';
import { auth } from '@/auth';

export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    await dbConnect();
    // Only fetch guests belonging to the authenticated user
    const guests = await GuestModel.find({ userId: session.user.id });
    return NextResponse.json(guests);
  } catch (error) {
    console.error('Error fetching guests:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch guests',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

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
    const data = await request.json();
    
    // Associate the guest with the authenticated user
    const guestData = {
      ...data,
      userId: session.user.id
    };
    
    const guest = await GuestModel.create(guestData);
    return NextResponse.json(guest, { status: 201 });
  } catch (error) {
    console.error('Error creating guest:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create guest',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
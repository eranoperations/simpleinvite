import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import GuestModel from '@/models/Guest';

export async function GET(request: NextRequest) {
  try {
    const phone = request.nextUrl.searchParams.get('phone');
    
    if (!phone) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    await dbConnect();
    const existingGuest = await GuestModel.findOne({ phone });
    
    return NextResponse.json({ exists: !!existingGuest });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to check phone number' },
      { status: 500 }
    );
  }
}
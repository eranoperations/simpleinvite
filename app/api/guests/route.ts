import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import GuestModel from '@/models/Guest';

export async function GET() {
  try {
    await dbConnect();
    const guests = await GuestModel.find({});
    return NextResponse.json(guests);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch guests' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    const data = await request.json();
    const guest = await GuestModel.create(data);
    return NextResponse.json(guest, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create guest' },
      { status: 500 }
    );
  }
}
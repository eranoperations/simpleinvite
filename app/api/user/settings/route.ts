import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import UserSettingsModel from '@/models/UserSettings';
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
    let userSettings = await UserSettingsModel.findOne({ userId: session.user.id });
    
    // Create default settings if none exist
    if (!userSettings) {
      userSettings = await UserSettingsModel.create({
        userId: session.user.id,
        appName: 'SimpleInvite',
        defaultMealPreference: 'other',
        maxGuestsPerInvite: 10
      });
    }
    
    return NextResponse.json(userSettings);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch user settings' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
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
    
    const userSettings = await UserSettingsModel.findOneAndUpdate(
      { userId: session.user.id },
      { ...updates, userId: session.user.id },
      { new: true, upsert: true }
    );
    
    return NextResponse.json(userSettings);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update user settings' },
      { status: 500 }
    );
  }
}
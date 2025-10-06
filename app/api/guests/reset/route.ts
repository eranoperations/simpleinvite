import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import GuestModel from '@/models/Guest';
import { auth } from '@/auth';

// This is a development-only endpoint to help with database issues
export async function POST() {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'Not available in production' },
      { status: 403 }
    );
  }

  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    await dbConnect();
    
    console.log('Current user ID from session:', session.user.id);
    
    // Drop existing indexes and recreate the collection with proper schema
    try {
      const existingIndexes = await GuestModel.collection.indexes();
      console.log('Existing indexes:', existingIndexes);
      
      // Specifically drop the problematic phone_1 index
      try {
        await GuestModel.collection.dropIndex('phone_1');
        console.log('Dropped problematic phone_1 index');
      } catch (error) {
        console.log('phone_1 index not found or already dropped:', error);
      }
      
      // Drop all other indexes except _id
      await GuestModel.collection.dropIndexes();
      console.log('Dropped all indexes');
    } catch (error) {
      console.log('Error dropping indexes (might not exist):', error);
    }
    
    // Delete all guests for this user to start fresh
    const result = await GuestModel.deleteMany({ userId: session.user.id });
    console.log(`Deleted ${result.deletedCount} guests for user ${session.user.id}`);
    
    // Recreate proper indexes
    await GuestModel.collection.createIndex({ userId: 1 });
    await GuestModel.collection.createIndex({ userId: 1, phone: 1 }, { unique: true });
    await GuestModel.collection.createIndex({ userId: 1, id: 1 }, { unique: true });
    console.log('Recreated indexes with proper constraints');
    
    return NextResponse.json({ 
      message: `Reset complete. Deleted ${result.deletedCount} guests for user ${session.user.id}`,
      userId: session.user.id,
      userEmail: session.user.email
    });
  } catch (error) {
    console.error('Error resetting user data:', error);
    return NextResponse.json(
      { 
        error: 'Failed to reset user data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
'use client';

import { Guest, GuestStatus } from '@/app/types/guest';
import { useGuests } from '@/app/contexts/GuestContext';
import Link from 'next/link';

export default function Dashboard() {
  const { guests } = useGuests();
  
  // Statistics calculation
  const stats = {
    total: guests.length,
    confirmed: guests.filter(g => g.status === 'confirmed').length,
    declined: guests.filter(g => g.status === 'declined').length,
    pending: guests.filter(g => g.status === 'pending').length,
    notSent: guests.filter(g => g.status === 'not_sent').length,
  };

  const mealCounts = guests.reduce((acc, guest) => {
    if (guest.status === 'confirmed') {
      acc[guest.mealPreference] = (acc[guest.mealPreference] || 0) + guest.numberOfAttendees;
    }
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">Wedding Dashboard</h1>
      
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatCard title="Total Guests" value={stats.total} />
        <StatCard title="Confirmed" value={stats.confirmed} color="green" />
        <StatCard title="Declined" value={stats.declined} color="red" />
        <StatCard title="Pending" value={stats.pending} color="yellow" />
      </div>

      {/* Meal Count Section */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-2xl font-semibold mb-4">Meal Counts</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {Object.entries(mealCounts).map(([meal, count]) => (
            <div key={meal} className="bg-gray-50 p-4 rounded-md">
              <h3 className="text-lg font-medium capitalize">{meal}</h3>
              <p className="text-2xl font-bold">{count}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-4">
          <Link
            href="/dashboard/guest-management"
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Manage Guests
          </Link>
          <Link
            href="/dashboard/guest-management?tab=add"
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Add New Guest
          </Link>
          <Link
            href="/dashboard/guest-management?tab=import"
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Import Guests
          </Link>
          <Link
            href="/dashboard/invitations"
            className="bg-pink-600 hover:bg-pink-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Create Invitations
          </Link>
          <Link
            href="/dashboard/invitation-preview"
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Preview Invitation
          </Link>
        </div>
      </div>
    </div>
  );
}

// Helper component for stats cards
function StatCard({ title, value, color = 'blue' }: { title: string; value: number; color?: string }) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-800',
    green: 'bg-green-100 text-green-800',
    red: 'bg-red-100 text-red-800',
    yellow: 'bg-yellow-100 text-yellow-800',
  };

  return (
    <div className={`${colorClasses[color as keyof typeof colorClasses]} p-6 rounded-lg`}>
      <h3 className="text-lg font-medium">{title}</h3>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
}
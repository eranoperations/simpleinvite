'use client';

import { Guest, GuestStatus } from '@/types/guest';
import { useGuests } from '@/app/contexts/GuestContext';

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

      {/* Guest List Section */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold mb-4">Guest List</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Meal</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Attendees</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {guests.map((guest) => (
                <tr key={guest.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {guest.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      guest.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                      guest.status === 'declined' ? 'bg-red-100 text-red-800' :
                      guest.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {guest.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {guest.mealPreference}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {guest.numberOfAttendees}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {guest.email || guest.phone || 'No contact info'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
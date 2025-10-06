'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { GuestStatus, Guest } from '@/app/types/guest';
import { useGuests } from '@/app/contexts/GuestContext';
import GuestEntryForm from '@/app/components/GuestEntryForm';
import GuestImport from '@/app/components/GuestImport';

export default function GuestManagement() {
  const { data: session } = useSession();
  const { guests, updateGuest, deleteGuest, isLoading } = useGuests();
  const [activeTab, setActiveTab] = useState<'list' | 'add' | 'import'>('list');
  const [showClearPopup, setShowClearPopup] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState('');
  const [clearError, setClearError] = useState('');
  const [isClearing, setIsClearing] = useState(false);
  const searchParams = useSearchParams();

  // Handle URL tab parameter
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['list', 'add', 'import'].includes(tab)) {
      setActiveTab(tab as 'list' | 'add' | 'import');
    }
  }, [searchParams]);

  const getStatusColor = (status: GuestStatus) => {
    switch (status) {
      case 'confirmed':
        return 'text-green-600 bg-green-100';
      case 'declined':
        return 'text-red-600 bg-red-100';
      case 'pending':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  // Function to get meal choices for a guest (only non-zero values)
  const getMealChoices = (guest: Guest) => {
    if (!guest.mealCounts) return 'Not specified';
    
    const choices: string[] = [];
    Object.entries(guest.mealCounts).forEach(([mealType, count]) => {
      if (typeof count === 'number' && count > 0) {
        choices.push(`${count} ${mealType}`);
      }
    });
    
    return choices.length > 0 ? choices.join(', ') : 'Not specified';
  };

  const handleStatusChange = async (guestId: string, newStatus: GuestStatus) => {
    try {
      await updateGuest(guestId, { status: newStatus });
    } catch (error) {
      console.error('Failed to update guest status:', error);
    }
  };

  const handleDeleteGuest = async (guestId: string) => {
    if (confirm('Are you sure you want to delete this guest?')) {
      try {
        await deleteGuest(guestId);
      } catch (error) {
        console.error('Failed to delete guest:', error);
      }
    }
  };

  const handleOpenClearPopup = () => {
    setShowClearPopup(true);
    setClearConfirmText('');
    setClearError('');
  };

  const handleCloseClearPopup = () => {
    setShowClearPopup(false);
    setClearConfirmText('');
    setClearError('');
  };

  const handleClearAllGuests = async () => {
    if (clearConfirmText.toLowerCase() !== 'yes') {
      setClearError('Please type "yes" to confirm deletion');
      return;
    }

    setIsClearing(true);
    setClearError('');

    try {
      // Delete all guests one by one
      for (const guest of guests) {
        await deleteGuest(guest.id);
      }
      
      // Close popup and reset form
      handleCloseClearPopup();
      alert('All guests have been successfully deleted.');
    } catch (error) {
      console.error('Error clearing guest list:', error);
      setClearError('Failed to delete all guests. Please try again.');
    } finally {
      setIsClearing(false);
    }
  };

  if (!session?.user) {
    return (
      <div className="p-8">
        <div className="bg-yellow-50 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
          <div className="flex items-center">
            <svg
              className="w-4 h-4 mr-2"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            Please sign in to access guest management.
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">Guest Management</h1>
      
      {/* Tab Navigation */}
      <div className="mb-8">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('list')}
              className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'list'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Guest List ({guests.length})
            </button>
            <button
              onClick={() => setActiveTab('add')}
              className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'add'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Add Guest
            </button>
            <button
              onClick={() => setActiveTab('import')}
              className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'import'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Import Guests
            </button>
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'list' && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                All Guests
              </h3>
              {guests.length > 0 && (
                <button
                  onClick={handleOpenClearPopup}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Clear Guest List
                </button>
              )}
            </div>
            {guests.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No guests added yet.</p>
                <button
                  onClick={() => setActiveTab('add')}
                  className="mt-2 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  Add Your First Guest
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Phone
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Attendees
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Meal Choices
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {guests.map((guest) => (
                      <tr key={guest.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {guest.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {guest.phone}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {guest.numberOfAttendees}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {getMealChoices(guest)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <select
                            value={guest.status}
                            onChange={(e) => handleStatusChange(guest.id, e.target.value as GuestStatus)}
                            className={`text-xs px-2 py-1 rounded-full border-0 ${getStatusColor(guest.status)}`}
                          >
                            <option value="not_sent">Not Sent</option>
                            <option value="pending">Pending</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="declined">Declined</option>
                          </select>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => handleDeleteGuest(guest.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'add' && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Add New Guest
            </h3>
            <GuestEntryForm />
          </div>
        </div>
      )}

      {activeTab === 'import' && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Import Guests from CSV
            </h3>
            <GuestImport />
          </div>
        </div>
      )}

      {/* Clear Guest List Popup */}
      {showClearPopup && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              {/* Header with X button */}
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Clear Guest List</h3>
                <button
                  onClick={handleCloseClearPopup}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Warning message */}
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <div className="flex">
                  <svg className="w-5 h-5 text-red-400 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <h4 className="text-sm font-medium text-red-800">Warning</h4>
                    <p className="text-sm text-red-700 mt-1">
                      This action will permanently delete all {guests.length} guests from your list. This cannot be undone.
                    </p>
                  </div>
                </div>
              </div>

              {/* Confirmation input */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type &quot;yes&quot; to confirm deletion:
                </label>
                <input
                  type="text"
                  value={clearConfirmText}
                  onChange={(e) => setClearConfirmText(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  placeholder="Type 'yes' to confirm"
                  disabled={isClearing}
                />
              </div>

              {/* Error message */}
              {clearError && (
                <div className="mb-4 p-2 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
                  {clearError}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex justify-end space-x-3">
                <button
                  onClick={handleCloseClearPopup}
                  disabled={isClearing}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearAllGuests}
                  disabled={isClearing || clearConfirmText.toLowerCase() !== 'yes'}
                  className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isClearing ? 'Deleting...' : 'Delete All Guests'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
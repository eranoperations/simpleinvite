'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Guest, GuestStatus, MealPreference } from '@/app/types/guest';
import { useGuests } from '@/app/contexts/GuestContext';

export default function GuestEntryForm() {
  const { data: session } = useSession();
  const { addGuest } = useGuests();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showAuthError, setShowAuthError] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    status: 'not_sent' as GuestStatus,
    mealPreference: 'other' as MealPreference,
    numberOfAttendees: 1,
    specialRequests: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if user is logged in
    if (!session?.user) {
      setShowAuthError(true);
      setSubmitError('You must be logged in to add guests');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setShowAuthError(false);

    try {
      // Check if phone number already exists
      const response = await fetch(`/api/guests/check-phone?phone=${encodeURIComponent(formData.phone)}`);
      const { exists } = await response.json();
      
      if (exists) {
        setSubmitError('A guest with this phone number already exists');
        return;
      }

      const newGuest: Guest = {
        id: crypto.randomUUID(),
        userId: session.user.id!, // Add userId from session
        ...formData,
        dateInvited: new Date(),
      };
      
      await addGuest(newGuest);
      
      // Reset form on success
      setFormData({
        name: '',
        phone: '',
        status: 'not_sent',
        mealPreference: 'other',
        numberOfAttendees: 1,
        specialRequests: '',
      });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to add guest');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Add New Guest</h2>
      
      {/* Authentication Warning */}
      {!session?.user && (
        <div className="bg-yellow-50 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">Login required to add guests</span>
          </div>
          <p className="mt-1 text-sm">
            You can browse the guest list without logging in, but you need to{' '}
            <a href="/login" className="underline hover:text-yellow-800">
              login with your Google account
            </a>{' '}
            to add or modify guests.
          </p>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="max-w-lg space-y-4">
        {submitError && (
          <div className={`border px-4 py-3 rounded ${
            showAuthError 
              ? 'bg-red-50 border-red-400 text-red-700' 
              : 'bg-red-50 border-red-400 text-red-700'
          }`}>
            {showAuthError && (
              <div className="flex items-center mb-2">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <span className="font-medium">Authentication Required</span>
              </div>
            )}
            <p>{submitError}</p>
            {showAuthError && (
              <a 
                href="/login" 
                className="inline-block mt-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
              >
                Login to Continue
              </a>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Name *</label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={e => setFormData({...formData, name: e.target.value})}
            className="w-full p-2 border rounded"
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Phone *</label>
          <input
            type="tel"
            required
            value={formData.phone}
            onChange={e => setFormData({...formData, phone: e.target.value})}
            className="w-full p-2 border rounded"
            placeholder="Enter phone number"
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Number of Attendees</label>
          <input
            type="number"
            min="1"
            value={formData.numberOfAttendees}
            onChange={e => setFormData({...formData, numberOfAttendees: parseInt(e.target.value)})}
            className="w-full p-2 border rounded"
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Meal Preference</label>
          <select
            value={formData.mealPreference}
            onChange={e => setFormData({...formData, mealPreference: e.target.value as MealPreference})}
            className="w-full p-2 border rounded"
            disabled={isSubmitting}
          >
            <option value="meat">Meat</option>
            <option value="vegetarian">Vegetarian</option>
            <option value="vegan">Vegan</option>
            <option value="kosher">Kosher</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Special Requests</label>
          <textarea
            value={formData.specialRequests}
            onChange={e => setFormData({...formData, specialRequests: e.target.value})}
            className="w-full p-2 border rounded"
            rows={3}
            disabled={isSubmitting}
          />
        </div>

        <button
          type="submit"
          className={`w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed`}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Adding Guest...' : 'Add Guest'}
        </button>
      </form>
    </div>
  );
}
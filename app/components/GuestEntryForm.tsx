'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { GuestStatus, MealPreference, MealCounts } from '@/app/types/guest';
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
    mealCounts: {
      meat: 0,
      vegetarian: 0,
      vegan: 0,
      kosher: 0,
      other: 1,
    },
  });

  // Calculate total meals selected
  const totalMeals = Object.values(formData.mealCounts).reduce((sum, count) => sum + count, 0);
  
  // Validation function
  const isMealCountValid = totalMeals === formData.numberOfAttendees;

  // Handle number of attendees change
  const handleAttendeesChange = (newCount: number) => {
    const currentTotal = totalMeals;
    const difference = newCount - currentTotal;
    
    // Auto-adjust meal counts when attendees change
    const newMealCounts = { ...formData.mealCounts };
    
    if (difference > 0) {
      // Add meals to the default preference (other)
      newMealCounts.other += difference;
    } else if (difference < 0) {
      // Remove meals starting from other, then working backwards
      let toRemove = Math.abs(difference);
      const mealTypes: (keyof MealCounts)[] = ['other', 'kosher', 'vegan', 'vegetarian', 'meat'];
      
      for (const mealType of mealTypes) {
        if (toRemove <= 0) break;
        const canRemove = Math.min(newMealCounts[mealType], toRemove);
        newMealCounts[mealType] -= canRemove;
        toRemove -= canRemove;
      }
    }
    
    setFormData({
      ...formData,
      numberOfAttendees: newCount,
      mealCounts: newMealCounts
    });
  };

  // Handle meal count change
  const handleMealCountChange = (mealType: keyof MealCounts, count: number) => {
    setFormData({
      ...formData,
      mealCounts: {
        ...formData.mealCounts,
        [mealType]: Math.max(0, count)
      }
    });
  };

    const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!session?.user?.id) {
      alert('You must be logged in to add guests');
      return;
    }

    // Validate meal counts match number of attendees
    if (!isMealCountValid) {
      alert(`Total meals (${totalMeals}) must equal number of attendees (${formData.numberOfAttendees})`);
      return;
    }

    try {
      await addGuest({
        ...formData,
        userId: session.user.id,
        id: `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      });
      
      alert('Guest added successfully!');
      
      // Reset form on success
      setFormData({
        name: '',
        phone: '',
        status: 'not_sent',
        mealPreference: 'other',
        numberOfAttendees: 1,
        specialRequests: '',
        mealCounts: {
          meat: 0,
          vegetarian: 0,
          vegan: 0,
          kosher: 0,
          other: 1,
        },
      });
    } catch (error) {
      console.error('Error adding guest:', error);
      alert('Failed to add guest. Please try again.');
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
            onChange={e => handleAttendeesChange(parseInt(e.target.value) || 1)}
            className="w-full p-2 border rounded"
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Meal Counts 
            <span className={`ml-2 text-sm ${isMealCountValid ? 'text-green-600' : 'text-red-600'}`}>
              (Total: {totalMeals}/{formData.numberOfAttendees})
            </span>
          </label>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Meat</label>
              <input
                type="number"
                min="0"
                max={formData.numberOfAttendees}
                value={formData.mealCounts.meat}
                onChange={e => handleMealCountChange('meat', parseInt(e.target.value) || 0)}
                className="w-full p-2 border rounded text-sm"
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Vegetarian</label>
              <input
                type="number"
                min="0"
                max={formData.numberOfAttendees}
                value={formData.mealCounts.vegetarian}
                onChange={e => handleMealCountChange('vegetarian', parseInt(e.target.value) || 0)}
                className="w-full p-2 border rounded text-sm"
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Vegan</label>
              <input
                type="number"
                min="0"
                max={formData.numberOfAttendees}
                value={formData.mealCounts.vegan}
                onChange={e => handleMealCountChange('vegan', parseInt(e.target.value) || 0)}
                className="w-full p-2 border rounded text-sm"
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Kosher</label>
              <input
                type="number"
                min="0"
                max={formData.numberOfAttendees}
                value={formData.mealCounts.kosher}
                onChange={e => handleMealCountChange('kosher', parseInt(e.target.value) || 0)}
                className="w-full p-2 border rounded text-sm"
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Other</label>
              <input
                type="number"
                min="0"
                max={formData.numberOfAttendees}
                value={formData.mealCounts.other}
                onChange={e => handleMealCountChange('other', parseInt(e.target.value) || 0)}
                className="w-full p-2 border rounded text-sm"
                disabled={isSubmitting}
              />
            </div>
          </div>
          {!isMealCountValid && (
            <p className="text-red-600 text-sm mt-1">
              Total meals must equal number of attendees
            </p>
          )}
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
          className={`w-full py-2 px-4 rounded font-medium transition-colors ${
            isSubmitting || !isMealCountValid
              ? 'bg-gray-400 text-gray-700 cursor-not-allowed' 
              : 'bg-blue-500 text-white hover:bg-blue-600'
          }`}
          disabled={isSubmitting || !isMealCountValid}
        >
          {isSubmitting ? 'Adding Guest...' : 'Add Guest'}
        </button>
      </form>
    </div>
  );
}
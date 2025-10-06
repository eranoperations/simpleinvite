'use client';

import { useState } from 'react';
import { Guest, GuestStatus, MealPreference } from '@/app/types/guest';
import { useGuests } from '@/app/contexts/GuestContext';

export default function GuestEntryForm() {
  const { addGuest } = useGuests();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    status: 'not_sent' as GuestStatus,
    mealPreference: 'meat' as MealPreference,
    numberOfAttendees: 1,
    specialRequests: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

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
        ...formData,
        dateInvited: new Date(),
      };
      
      await addGuest(newGuest);
      
      // Reset form on success
      setFormData({
        name: '',
        phone: '',
        status: 'not_sent',
        mealPreference: 'meat',
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
      
      <form onSubmit={handleSubmit} className="max-w-lg space-y-4">
        {submitError && (
          <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded">
            {submitError}
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
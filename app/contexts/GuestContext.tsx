'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Guest } from '@/app/types/guest';

interface GuestContextType {
  guests: Guest[];
  addGuest: (guest: Guest) => Promise<void>;
  addGuests: (guests: Guest[]) => Promise<void>;
  updateGuest: (guestId: string, updates: Partial<Guest>) => Promise<void>;
  deleteGuest: (guestId: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

const GuestContext = createContext<GuestContextType | undefined>(undefined);

export function GuestProvider({ children }: { children: React.ReactNode }) {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch guests on mount
  useEffect(() => {
    const fetchGuests = async () => {
      try {
        const response = await fetch('/api/guests');
        if (!response.ok) throw new Error('Failed to fetch guests');
        const data = await response.json();
        setGuests(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch guests');
      } finally {
        setIsLoading(false);
      }
    };

    fetchGuests();
  }, []);

  const addGuest = useCallback(async (guest: Guest) => {
    try {
      const response = await fetch('/api/guests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(guest),
      });

      if (!response.ok) throw new Error('Failed to add guest');
      const newGuest = await response.json();
      setGuests(prev => [...prev, newGuest]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add guest');
      throw err;
    }
  }, []);

  const addGuests = useCallback(async (newGuests: Guest[]) => {
    try {
      const response = await fetch('/api/guests/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newGuests),
      });

      if (!response.ok) throw new Error('Failed to add guests');
      const addedGuests = await response.json();
      setGuests(prev => [...prev, ...addedGuests]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add guests');
      throw err;
    }
  }, []);

  const updateGuest = useCallback(async (guestId: string, updates: Partial<Guest>) => {
    try {
      const response = await fetch(`/api/guests/${guestId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) throw new Error('Failed to update guest');
      const updatedGuest = await response.json();
      setGuests(prev => 
        prev.map(guest => 
          guest.id === guestId ? { ...guest, ...updatedGuest } : guest
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update guest');
      throw err;
    }
  }, []);

  const deleteGuest = useCallback(async (guestId: string) => {
    try {
      const response = await fetch(`/api/guests/${guestId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete guest');
      setGuests(prev => prev.filter(guest => guest.id !== guestId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete guest');
      throw err;
    }
  }, []);

  return (
    <GuestContext.Provider value={{ guests, addGuest, addGuests, updateGuest, deleteGuest, isLoading, error }}>
      {children}
    </GuestContext.Provider>
  );
}

export function useGuests() {
  const context = useContext(GuestContext);
  if (context === undefined) {
    throw new Error('useGuests must be used within a GuestProvider');
  }
  return context;
}
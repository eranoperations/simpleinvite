'use client';

import { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';
import { Guest, GuestStatus, MealPreference } from '@/types/guest';

export default function GuestImport() {
  const { data: session } = useSession();
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    // Check authentication before processing
    if (!session?.user) {
      setError('You must be logged in to import guests');
      return;
    }

    const file = acceptedFiles[0];
    if (file) {
      setImporting(true);
      setError(null);

        Papa.parse(file, {
          complete: (results) => {
            try {
              if (!session?.user?.id) {
                setError('Session expired. Please log in again.');
                setImporting(false);
                return;
              }

              const guests = results.data.map((row: any) => ({
                id: crypto.randomUUID(),
                userId: session.user!.id, // Add userId from session (checked above)
                name: row.name,
                email: row.email || undefined,
                phone: row.phone || undefined,
                status: (row.status as GuestStatus) || 'not_sent',
                mealPreference: (row.mealPreference as MealPreference) || 'other',
                numberOfAttendees: parseInt(row.numberOfAttendees) || 1,
                dateInvited: row.dateInvited ? new Date(row.dateInvited) : undefined,
              }));            // Here you would typically save the guests to your database
            console.log('Imported guests:', guests);
            
            setImporting(false);
          } catch (err) {
            setError('Error processing file. Please check the format.');
            setImporting(false);
          }
        },
        header: true,
        skipEmptyLines: true,
      });
    }
  }, [session?.user]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    multiple: false,
  });

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Import Guest List</h2>
      
      {/* Authentication Warning */}
      {!session?.user && (
        <div className="bg-yellow-50 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">Login required to import guests</span>
          </div>
          <p className="mt-1 text-sm">
            You need to{' '}
            <a href="/login" className="underline hover:text-yellow-800">
              login with your Google account
            </a>{' '}
            to import guest lists.
          </p>
        </div>
      )}
      
      <div 
        {...getRootProps()} 
        className={`border-2 border-dashed p-8 rounded-lg text-center cursor-pointer
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
          ${!session?.user ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input {...getInputProps()} disabled={!session?.user} />
        {importing ? (
          <p>Processing file...</p>
        ) : isDragActive ? (
          <p>Drop the file here...</p>
        ) : (
          <div>
            <p>Drag and drop a CSV or Excel file here, or click to select a file</p>
            <p className="text-sm text-gray-500 mt-2">
              File should contain columns: name, email, phone, status, mealPreference, numberOfAttendees
            </p>
            {!session?.user && (
              <p className="text-sm text-red-500 mt-2 font-medium">
                Login required to use this feature
              </p>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}
    </div>
  );
}
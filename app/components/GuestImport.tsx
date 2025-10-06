'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';
import { Guest, GuestStatus, MealPreference } from '@/types/guest';

export default function GuestImport() {
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setImporting(true);
      setError(null);

      Papa.parse(file, {
        complete: (results) => {
          try {
            const guests = results.data.map((row: any) => ({
              id: crypto.randomUUID(),
              name: row.name,
              email: row.email || undefined,
              phone: row.phone || undefined,
              status: (row.status as GuestStatus) || 'not_sent',
              mealPreference: (row.mealPreference as MealPreference) || 'meat',
              numberOfAttendees: parseInt(row.numberOfAttendees) || 1,
              dateInvited: row.dateInvited ? new Date(row.dateInvited) : undefined,
            }));
            
            // Here you would typically save the guests to your database
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
  }, []);

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
      
      <div 
        {...getRootProps()} 
        className={`border-2 border-dashed p-8 rounded-lg text-center cursor-pointer
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
      >
        <input {...getInputProps()} />
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
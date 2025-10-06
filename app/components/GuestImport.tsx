'use client';

import { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { GuestStatus, MealPreference } from '@/app/types/guest';
import { useGuests } from '@/app/contexts/GuestContext';

interface ImportRow {
  name: string;
  phone?: string;
  status?: string;
  numberOfAttendees?: string;
}

export default function GuestImport() {
  const { data: session } = useSession();
  const { addGuest, guests } = useGuests();
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [detailedErrors, setDetailedErrors] = useState<string[]>([]);

  // Function to download Excel template
  const downloadTemplate = () => {
    const templateData = [
      {
        name: 'John Doe',
        phone: '+1234567890',
        status: 'pending',
        numberOfAttendees: 2
      },
      {
        name: 'Jane Smith',
        phone: '+0987654321',
        status: 'confirmed',
        numberOfAttendees: 1
      },
      {
        name: 'Mike Johnson',
        phone: '+1122334455',
        status: 'not_sent',
        numberOfAttendees: 3
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Guest Template');
    
    // Auto-size columns
    const cols = Object.keys(templateData[0]).map(() => ({ wch: 20 }));
    worksheet['!cols'] = cols;
    
    XLSX.writeFile(workbook, 'guest_import_template.xlsx');
  };

  const processGuestData = useCallback(async (parsedData: ImportRow[]) => {
    try {
      setDetailedErrors([]);
      
      const guestsToImport = parsedData.map((row) => ({
        id: crypto.randomUUID(),
        userId: session!.user!.id!, // Add userId from session (checked above)
        name: row.name,
        phone: row.phone || '',
        status: (row.status as GuestStatus) || 'not_sent',
        mealPreference: 'other' as MealPreference, // Default value
        numberOfAttendees: parseInt(row.numberOfAttendees || '1') || 1,
        specialRequests: '', // Default empty value
        mealCounts: {
          meat: 0,
          vegetarian: 0,
          vegan: 0,
          kosher: 0,
          other: parseInt(row.numberOfAttendees || '1') || 1, // Default all meals to 'other'
        },
        originalRowData: row, // Keep original data for error reporting
      }));

      // Save each guest to the database and track detailed errors
      let successCount = 0;
      let errorCount = 0;
      const errorDetails: string[] = [];

      // Get existing guest phone numbers for duplicate checking
      const existingPhones = new Set(guests.map(guest => guest.phone));

      for (const guest of guestsToImport) {
        try {
          // Check for duplicate phone numbers
          if (existingPhones.has(guest.phone)) {
            errorCount++;
            errorDetails.push(`${guest.name} (${guest.phone}) - Guest with this phone number already exists`);
            continue;
          }

          // Check for missing required fields
          if (!guest.name || !guest.phone) {
            errorCount++;
            errorDetails.push(`${guest.name || 'Unknown'} - Missing required fields (name or phone)`);
            continue;
          }

          await addGuest(guest);
          successCount++;
          
          // Add to existing phones set to prevent duplicates within the same import
          existingPhones.add(guest.phone);
          
        } catch (error) {
          console.error('Error adding guest:', guest.name, error);
          errorCount++;
          errorDetails.push(`${guest.name} (${guest.phone}) - Database error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      setImporting(false);
      setDetailedErrors(errorDetails);
      
      if (successCount > 0) {
        setSuccessMessage(`Successfully imported ${successCount} guest(s)${errorCount > 0 ? ` (${errorCount} failed)` : ''}`);
      }
      
      if (errorCount > 0 && successCount === 0) {
        setError(`Failed to import all ${errorCount} guest(s). See details below.`);
      } else if (errorCount > 0) {
        setError(`${errorCount} guest(s) could not be imported. See details below.`);
      }

    } catch (error) {
      console.error('Error processing guest data:', error);
      setError('Error processing guest data. Please check the format.');
      setImporting(false);
    }
  }, [session, addGuest, guests, setImporting, setSuccessMessage, setError, setDetailedErrors]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    // Check authentication before processing
    if (!session?.user) {
      setError('You must be logged in to import guests');
      return;
    }

    const file = acceptedFiles[0];
    if (file) {
      setImporting(true);
      setError(null);
      setSuccessMessage(null);
      setDetailedErrors([]);

      try {
        if (!session?.user?.id) {
          setError('Session expired. Please log in again.');
          setImporting(false);
          return;
        }

        let parsedData: ImportRow[] = [];

        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
          // Handle Excel files
          const arrayBuffer = await file.arrayBuffer();
          const workbook = XLSX.read(arrayBuffer, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          parsedData = XLSX.utils.sheet_to_json(worksheet) as ImportRow[];
        } else if (file.name.endsWith('.csv')) {
          // Handle CSV files
          return new Promise((resolve) => {
            Papa.parse(file, {
              complete: async (results) => {
                parsedData = results.data as ImportRow[];
                await processGuestData(parsedData);
                resolve(undefined);
              },
              header: true,
              skipEmptyLines: true,
            });
          });
        } else {
          setError('Unsupported file format. Please use CSV or Excel (.xlsx) files.');
          setImporting(false);
          return;
        }

        await processGuestData(parsedData);

      } catch (error) {
        console.error('Error processing file:', error);
        setError('Error processing file. Please check the format.');
        setImporting(false);
      }
    }
  }, [session?.user, processGuestData]);

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
      
      {/* Download Template Section */}
      <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h3 className="text-lg font-semibold mb-2 text-blue-800">Download Template</h3>
        <p className="text-sm text-blue-700 mb-3">
          Download our Excel template with example data to see the correct format for importing guests.
        </p>
        <button
          onClick={downloadTemplate}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Download Excel Template
        </button>
      </div>
      
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
              Required columns: name, phone, numberOfAttendees
            </p>
            <p className="text-sm text-gray-500">
              Optional columns: status
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

      {detailedErrors.length > 0 && (
        <div className="mt-4 p-4 bg-orange-100 border border-orange-400 rounded">
          <h4 className="font-semibold text-orange-800 mb-2">Import Details:</h4>
          <ul className="text-sm text-orange-700 space-y-1">
            {detailedErrors.map((errorDetail, index) => (
              <li key={index} className="flex items-start">
                <span className="text-orange-500 mr-2">•</span>
                <span>{errorDetail}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {successMessage && (
        <div className="mt-4 p-4 bg-green-100 text-green-700 rounded">
          {successMessage}
        </div>
      )}
    </div>
  );
}
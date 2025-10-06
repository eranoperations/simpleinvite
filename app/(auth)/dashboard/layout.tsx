'use client';

import { useState } from 'react';
import GuestImport from '../../components/GuestImport';
import GuestEntryForm from '../../components/GuestEntryForm';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [activeTab, setActiveTab] = useState<'overview' | 'import' | 'add'>('overview');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex space-x-8">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium
                    ${activeTab === 'overview' 
                      ? 'border-blue-500 text-blue-600' 
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                  Overview
                </button>
                <button
                  onClick={() => setActiveTab('import')}
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium
                    ${activeTab === 'import' 
                      ? 'border-blue-500 text-blue-600' 
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                  Import Guests
                </button>
                <button
                  onClick={() => setActiveTab('add')}
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium
                    ${activeTab === 'add' 
                      ? 'border-blue-500 text-blue-600' 
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                  Add Guest
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {activeTab === 'overview' && children}
        {activeTab === 'import' && <GuestImport />}
        {activeTab === 'add' && <GuestEntryForm />}
      </main>
    </div>
  );
}
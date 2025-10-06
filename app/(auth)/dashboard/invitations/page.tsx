'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';

interface InvitationData {
  coupleNames: string;
  weddingDate: string;
  venue: string;
  address: string;
  time: string;
  rsvpDate: string;
  additionalInfo: string;
  theme: 'classic' | 'rustic' | 'elegant';
  backgroundColor: string;
  textColor: string;
}

export default function Invitations() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<'create' | 'upload'>('create');
  const [invitationData, setInvitationData] = useState<InvitationData>({
    coupleNames: '',
    weddingDate: '',
    venue: '',
    address: '',
    time: '',
    rsvpDate: '',
    additionalInfo: '',
    theme: 'classic',
    backgroundColor: '#ffffff',
    textColor: '#000000'
  });
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (field: keyof InvitationData, value: string) => {
    setInvitationData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && (file.type === 'application/pdf' || file.type === 'image/png')) {
      setUploadedFile(file);
      
      // Create preview for PNG files
      if (file.type === 'image/png') {
        const reader = new FileReader();
        reader.onload = (e) => {
          setUploadPreview(e.target?.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setUploadPreview(null);
      }
    } else {
      alert('Please upload a PDF or PNG file only.');
    }
  };

  const handleSaveInvitation = async () => {
    if (!session?.user?.id) {
      alert('Please log in to save invitation');
      return;
    }

    setIsSubmitting(true);
    try {
      // Here you would typically save to database
      console.log('Saving invitation:', invitationData);
      alert('Invitation saved successfully!');
    } catch (error) {
      console.error('Error saving invitation:', error);
      alert('Failed to save invitation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUploadPDF = async () => {
    if (!uploadedFile || !session?.user?.id) {
      alert('Please select a PDF file and ensure you are logged in');
      return;
    }

    setIsSubmitting(true);
    try {
      // Here you would typically upload to server/storage
      console.log('Uploading PDF:', uploadedFile.name);
      alert('PDF invitation uploaded successfully!');
    } catch (error) {
      console.error('Error uploading PDF:', error);
      alert('Failed to upload PDF');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getThemeStyles = (theme: string) => {
    switch (theme) {
      case 'classic':
        return 'border-gray-200 bg-gray-50';
      case 'modern':
        return 'border-blue-200 bg-blue-50';
      case 'rustic':
        return 'border-yellow-200 bg-yellow-50';
      case 'elegant':
        return 'border-purple-200 bg-purple-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  if (!session?.user) {
    return (
      <div className="p-8">
        <div className="bg-yellow-50 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
          <div className="flex items-center">
            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Please sign in to create invitations.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Wedding Invitations</h1>
        <Link
          href="/dashboard/invitation-preview"
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          Preview Invitation
        </Link>
      </div>
      
      {/* Tab Navigation */}
      <div className="mb-8">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('create')}
              className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'create'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Create Invitation
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'upload'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Upload PDF
            </button>
          </nav>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Form Section */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            {activeTab === 'create' && (
              <>
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  Create Your Invitation
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Couple Names
                    </label>
                    <input
                      type="text"
                      value={invitationData.coupleNames}
                      onChange={(e) => handleInputChange('coupleNames', e.target.value)}
                      placeholder="John & Jane Doe"
                      className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Wedding Date
                      </label>
                      <input
                        type="date"
                        value={invitationData.weddingDate}
                        onChange={(e) => handleInputChange('weddingDate', e.target.value)}
                        className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Time
                      </label>
                      <input
                        type="time"
                        value={invitationData.time}
                        onChange={(e) => handleInputChange('time', e.target.value)}
                        className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Venue
                    </label>
                    <input
                      type="text"
                      value={invitationData.venue}
                      onChange={(e) => handleInputChange('venue', e.target.value)}
                      placeholder="The Grand Ballroom"
                      className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Address
                    </label>
                    <textarea
                      value={invitationData.address}
                      onChange={(e) => handleInputChange('address', e.target.value)}
                      placeholder="123 Wedding St, City, State 12345"
                      rows={2}
                      className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      RSVP Date
                    </label>
                    <input
                      type="date"
                      value={invitationData.rsvpDate}
                      onChange={(e) => handleInputChange('rsvpDate', e.target.value)}
                      className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Theme
                    </label>
                    <select
                      value={invitationData.theme}
                      onChange={(e) => handleInputChange('theme', e.target.value)}
                      className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="classic">Classic</option>
                      <option value="modern">Modern</option>
                      <option value="rustic">Rustic</option>
                      <option value="elegant">Elegant</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Background Color
                      </label>
                      <input
                        type="color"
                        value={invitationData.backgroundColor}
                        onChange={(e) => handleInputChange('backgroundColor', e.target.value)}
                        className="w-full h-10 border rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Text Color
                      </label>
                      <input
                        type="color"
                        value={invitationData.textColor}
                        onChange={(e) => handleInputChange('textColor', e.target.value)}
                        className="w-full h-10 border rounded"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Additional Information
                    </label>
                    <textarea
                      value={invitationData.additionalInfo}
                      onChange={(e) => handleInputChange('additionalInfo', e.target.value)}
                      placeholder="Reception to follow, Dress code: Cocktail attire, etc."
                      rows={3}
                      className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <button
                    onClick={handleSaveInvitation}
                    disabled={isSubmitting}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium disabled:opacity-50"
                  >
                    {isSubmitting ? 'Saving...' : 'Save Invitation'}
                  </button>
                </div>
              </>
            )}

            {activeTab === 'upload' && (
              <>
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  Upload Invitation
                </h3>
                
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                      <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <div className="mt-4">
                      <label htmlFor="pdf-upload" className="cursor-pointer">
                        <span className="mt-2 block text-sm font-medium text-gray-900">
                          {uploadedFile ? uploadedFile.name : 'Upload your invitation (PDF or PNG)'}
                        </span>
                        <span className="mt-1 block text-xs text-gray-500">
                          PDF or PNG files only, up to 10MB
                        </span>
                      </label>
                      <input
                        id="pdf-upload"
                        type="file"
                        accept=".pdf,.png"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </div>
                  </div>

                  {uploadedFile && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded">
                      <p className="text-sm text-green-700">
                        ✓ File selected: {uploadedFile.name}
                      </p>
                    </div>
                  )}

                  {uploadPreview && (
                    <div className="mt-4 p-4 border border-gray-200 rounded-lg">
                      <p className="text-sm text-gray-700 mb-2">Preview:</p>
                      <div className="flex justify-center">
                        <Image 
                          src={uploadPreview} 
                          alt="Invitation Preview" 
                          width={400}
                          height={300}
                          className="max-w-full max-h-64 object-contain rounded-lg shadow-md"
                        />
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleUploadPDF}
                    disabled={!uploadedFile || isSubmitting}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium disabled:opacity-50"
                  >
                    {isSubmitting ? 'Uploading...' : 'Upload Invitation'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Preview Section */}
        {activeTab === 'create' && (
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Preview
              </h3>
              
              <div 
                className={`p-8 border-2 rounded-lg ${getThemeStyles(invitationData.theme)}`}
                style={{ 
                  backgroundColor: invitationData.backgroundColor,
                  color: invitationData.textColor 
                }}
              >
                <div className="text-center space-y-4">
                  <h2 className="text-2xl font-bold">
                    {invitationData.coupleNames || 'Your Names Here'}
                  </h2>
                  
                  <div className="text-lg">
                    Request the pleasure of your company
                  </div>
                  
                  <div className="text-lg font-semibold">
                    {invitationData.weddingDate ? new Date(invitationData.weddingDate).toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    }) : 'Wedding Date'}
                  </div>
                  
                  {invitationData.time && (
                    <div className="text-lg">
                      at {invitationData.time}
                    </div>
                  )}
                  
                  <div className="text-lg font-medium">
                    {invitationData.venue || 'Venue Name'}
                  </div>
                  
                  {invitationData.address && (
                    <div className="text-sm">
                      {invitationData.address}
                    </div>
                  )}
                  
                  {invitationData.rsvpDate && (
                    <div className="text-sm pt-4">
                      RSVP by {new Date(invitationData.rsvpDate).toLocaleDateString()}
                    </div>
                  )}
                  
                  {invitationData.additionalInfo && (
                    <div className="text-sm pt-2 border-t">
                      {invitationData.additionalInfo}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
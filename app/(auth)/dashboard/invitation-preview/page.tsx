'use client';

import { useState, useEffect } from 'react';
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
  theme: 'classic' | 'modern' | 'rustic' | 'elegant';
  backgroundColor: string;
  textColor: string;
}

export default function InvitationPreview() {
  const { data: session } = useSession();
  const [invitationData, setInvitationData] = useState<InvitationData>({
    coupleNames: 'John & Jane Doe',
    weddingDate: '2025-06-15',
    venue: 'The Grand Ballroom',
    address: '123 Wedding Street, City, State 12345',
    time: '16:00',
    rsvpDate: '2025-05-15',
    additionalInfo: 'Reception to follow • Cocktail attire requested',
    theme: 'classic',
    backgroundColor: '#ffffff',
    textColor: '#000000'
  });
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);

  // Load saved invitation data (in a real app, this would come from your database)
  useEffect(() => {
    // Here you would fetch the user's saved invitation data
    // For now, we'll use default data
  }, [session]);

  const getThemeStyles = (theme: string) => {
    switch (theme) {
      case 'classic':
        return 'border-gray-200 bg-gray-50 font-serif';
      case 'modern':
        return 'border-blue-200 bg-blue-50 font-sans';
      case 'rustic':
        return 'border-yellow-200 bg-yellow-50 font-mono';
      case 'elegant':
        return 'border-purple-200 bg-purple-50 font-serif';
      default:
        return 'border-gray-200 bg-gray-50 font-serif';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Wedding Date';
    return new Date(dateString).toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    const time = new Date(`2000-01-01T${timeString}`);
    return time.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    });
  };

  if (!session?.user) {
    return (
      <div className="p-8">
        <div className="bg-yellow-50 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
          <div className="flex items-center">
            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Please sign in to view your invitation.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Invitation Preview</h1>
            <p className="text-gray-600">Preview your wedding invitation</p>
          </div>
          <div className="flex space-x-4">
            <Link
              href="/dashboard/invitations"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Edit Invitation
            </Link>
            <Link
              href="/dashboard"
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>

        {/* Preview Container */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="flex justify-center">
            {uploadedImage ? (
              /* Display uploaded image */
              <div className="max-w-md w-full">
                <Image
                  src={uploadedImage}
                  alt="Wedding Invitation"
                  width={400}
                  height={600}
                  className="w-full h-auto rounded-lg shadow-md"
                />
              </div>
            ) : (
              /* Display created invitation */
              <div className="max-w-md w-full">
                <div 
                  className={`p-12 border-2 rounded-lg shadow-lg ${getThemeStyles(invitationData.theme)}`}
                  style={{ 
                    backgroundColor: invitationData.backgroundColor,
                    color: invitationData.textColor,
                    minHeight: '600px'
                  }}
                >
                  <div className="text-center space-y-6">
                    {/* Decorative Header */}
                    <div className="text-center">
                      <div className="text-4xl mb-2">💐</div>
                      <div className="border-t border-current w-24 mx-auto mb-4"></div>
                    </div>

                    {/* Couple Names */}
                    <h1 className="text-3xl font-bold leading-tight">
                      {invitationData.coupleNames}
                    </h1>
                    
                    {/* Request Line */}
                    <div className="text-lg italic">
                      Request the pleasure of your company
                    </div>
                    
                    {/* Wedding Date */}
                    <div className="text-xl font-semibold">
                      {formatDate(invitationData.weddingDate)}
                    </div>
                    
                    {/* Time */}
                    {invitationData.time && (
                      <div className="text-lg">
                        at {formatTime(invitationData.time)}
                      </div>
                    )}
                    
                    {/* Venue */}
                    <div className="text-xl font-medium">
                      {invitationData.venue}
                    </div>
                    
                    {/* Address */}
                    {invitationData.address && (
                      <div className="text-sm leading-relaxed">
                        {invitationData.address}
                      </div>
                    )}
                    
                    {/* Decorative Divider */}
                    <div className="py-4">
                      <div className="border-t border-current w-32 mx-auto"></div>
                      <div className="text-2xl my-2">♡</div>
                      <div className="border-t border-current w-32 mx-auto"></div>
                    </div>
                    
                    {/* RSVP */}
                    {invitationData.rsvpDate && (
                      <div className="text-sm">
                        RSVP by {new Date(invitationData.rsvpDate).toLocaleDateString()}
                      </div>
                    )}
                    
                    {/* Additional Info */}
                    {invitationData.additionalInfo && (
                      <div className="text-sm leading-relaxed border-t border-current pt-4">
                        {invitationData.additionalInfo}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-center space-x-4 mt-8">
            <button
              onClick={() => window.print()}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print Invitation
            </button>
            
            <button
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center"
              onClick={() => {
                // Here you would implement sharing functionality
                alert('Sharing functionality would be implemented here');
              }}
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
              </svg>
              Share Invitation
            </button>
          </div>
        </div>

        {/* Information Panel */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">Invitation Details</h3>
          <div className="text-sm text-blue-800 space-y-1">
            <p><strong>Theme:</strong> {invitationData.theme.charAt(0).toUpperCase() + invitationData.theme.slice(1)}</p>
            <p><strong>Background:</strong> {invitationData.backgroundColor}</p>
            <p><strong>Text Color:</strong> {invitationData.textColor}</p>
            {uploadedImage && <p><strong>Type:</strong> Uploaded Image</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
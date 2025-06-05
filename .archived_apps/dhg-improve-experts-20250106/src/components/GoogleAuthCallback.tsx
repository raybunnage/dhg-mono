import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { handleGoogleAuthCallback } from '@/services/googleAuth';
import { toast } from 'react-hot-toast';

export const GoogleAuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const processAuth = async () => {
      try {
        const code = searchParams.get('code');
        
        if (!code) {
          const error = searchParams.get('error');
          throw new Error(error || 'No authorization code received');
        }
        
        // Process the authorization code
        const result = await handleGoogleAuthCallback(code);
        
        if (!result.success) {
          throw new Error(result.error || 'Failed to authenticate with Google');
        }
        
        // Set success state
        setStatus('success');
        toast.success('Successfully connected to Google Drive');
        
        // Redirect back to the original page after a short delay
        setTimeout(() => {
          const returnUrl = localStorage.getItem('auth_return_url') || '/sync';
          navigate(returnUrl);
        }, 2000);
        
      } catch (error) {
        console.error('Authentication error:', error);
        setStatus('error');
        setErrorMessage(error.message);
        toast.error('Google authentication failed');
      }
    };
    
    processAuth();
  }, [searchParams, navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        {status === 'processing' && (
          <>
            <h1 className="text-2xl font-bold mb-4 text-center">Connecting to Google Drive</h1>
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
            <p className="text-center mt-4 text-gray-600">Please wait while we connect your account...</p>
          </>
        )}
        
        {status === 'success' && (
          <>
            <h1 className="text-2xl font-bold mb-4 text-center text-green-600">Successfully Connected!</h1>
            <div className="flex justify-center text-green-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-center mt-4 text-gray-600">
              Your Google Drive account has been connected. Redirecting you back...
            </p>
          </>
        )}
        
        {status === 'error' && (
          <>
            <h1 className="text-2xl font-bold mb-4 text-center text-red-600">Connection Failed</h1>
            <div className="flex justify-center text-red-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-center mt-4 text-gray-600">
              {errorMessage || 'There was an error connecting your Google Drive account'}
            </p>
            <div className="mt-6 text-center">
              <button
                onClick={() => navigate('/sync')}
                className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded"
              >
                Return to Sync Page
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}; 
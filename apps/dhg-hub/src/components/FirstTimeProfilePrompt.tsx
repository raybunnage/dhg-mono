import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface FirstTimeProfilePromptProps {
  onDismiss: () => void;
}

export const FirstTimeProfilePrompt: React.FC<FirstTimeProfilePromptProps> = ({ onDismiss }) => {
  const [isVisible, setIsVisible] = useState(true);
  const navigate = useNavigate();

  const handleStartProfile = () => {
    navigate('/profile');
  };

  const handleSkipForNow = () => {
    setIsVisible(false);
    onDismiss();
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <div className="flex items-center mb-4">
          <div className="flex-shrink-0">
            <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-lg font-medium text-gray-900">Welcome to DHG Hub!</h3>
          </div>
        </div>
        
        <div className="mt-2">
          <p className="text-sm text-gray-500 mb-4">
            We'd love to learn more about your learning preferences to provide you with personalized content recommendations. 
            Would you like to complete your learning profile now?
          </p>
          
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-blue-700">
                  Your learning profile helps us understand your professional background, interests, and goals. 
                  You can always complete or update it later from the Profile page.
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
          <button
            type="button"
            className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:col-start-2 sm:text-sm"
            onClick={handleStartProfile}
          >
            Complete Profile
          </button>
          <button
            type="button"
            className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:col-start-1 sm:text-sm"
            onClick={handleSkipForNow}
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
};
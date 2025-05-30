import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  // Redirect directly to the explorer page
  useEffect(() => {
    navigate('/explorer');
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">Redirecting to Google Drive Explorer...</div>
      </div>
    </div>
  );
};
console.log('[LoginPage] Module loading...');

import React from 'react';
import { LightEmailAuth } from './LightEmailAuth';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

console.log('[LoginPage] Imports complete');

export const LoginPage: React.FC = () => {
  console.log('[LoginPage] Component rendering...');
  const { user } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
  React.useEffect(() => {
    console.log('[LoginPage] useEffect - user:', !!user);
    if (user) {
      console.log('[LoginPage] User exists, navigating to home...');
      navigate('/');
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h1 className="text-center text-3xl font-extrabold text-gray-900 mb-8">
          DHG Audio
        </h1>
      </div>

      <LightEmailAuth />
    </div>
  );
};
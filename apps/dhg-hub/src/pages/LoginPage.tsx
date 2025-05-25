import React from 'react';
import { LightEmailAuth } from '../components/LightEmailAuth';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

export const LoginPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in and has profile
  React.useEffect(() => {
    if (user && user.profile) {
      navigate('/');
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h1 className="text-center text-3xl font-extrabold text-gray-900 mb-8">
          DHG Hub
        </h1>
      </div>

      <LightEmailAuth />
    </div>
  );
};
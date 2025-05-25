import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { EmailAuth } from '../components/EmailAuth';
import { useAuth } from '../hooks/useAuth';

export const LoginPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const from = (location.state as any)?.from?.pathname || '/';

  useEffect(() => {
    if (user) {
      navigate(from, { replace: true });
    }
  }, [user, navigate, from]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold text-gray-900 mb-2">
            DHG Audio Magic
          </h1>
          <p className="text-lg text-gray-600">
            Experience audio content with magic link authentication
          </p>
        </div>
      </div>

      <div className="mt-8">
        <EmailAuth 
          onSuccess={() => navigate(from, { replace: true })}
          redirectTo={window.location.origin + from}
        />
      </div>

      <div className="mt-8 text-center">
        <p className="text-sm text-gray-500">
          Protected by email allowlist • No passwords required
        </p>
      </div>
    </div>
  );
};
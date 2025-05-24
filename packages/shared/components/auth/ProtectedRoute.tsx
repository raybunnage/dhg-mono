import React from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

export interface ProtectedRouteProps {
  isAuthenticated: boolean;
  isLoading?: boolean;
  redirectTo?: string;
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  isAuthenticated,
  isLoading = false,
  redirectTo = '/login',
  children
}) => {
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
};
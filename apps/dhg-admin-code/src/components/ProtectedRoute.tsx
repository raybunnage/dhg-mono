import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requireAdmin = false 
}) => {
  const { user, isAdmin, isLoading } = useAuth();
  
  // Only log in development when there's a state change
  if (process.env.NODE_ENV === 'development' && !isLoading) {
    console.debug('ProtectedRoute - user:', !!user, 'isAdmin:', isAdmin, 'requireAdmin:', requireAdmin);
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && !isAdmin) {
    // Redirect to login page for non-admin users
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};
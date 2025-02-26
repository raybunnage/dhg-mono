import React, { useState, useEffect } from 'react';
import { checkGoogleTokenStatus, refreshGoogleToken, initiateGoogleAuth } from '@/services/googleAuth';
import { toast } from 'react-hot-toast';

interface TokenStatusProps {
  onTokenExpired?: () => void;
  onStatusChange?: (isValid: boolean) => void;
  useMockData?: boolean;
}

export const GoogleTokenStatus: React.FC<TokenStatusProps> = ({ 
  onTokenExpired, 
  onStatusChange,
  useMockData = true
}) => {
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Check token status
  useEffect(() => {
    const checkTokenStatus = async () => {
      try {
        setLoading(true);
        
        // Use mock data if enabled
        if (useMockData) {
          // Create a mock expiration time 30 minutes from now
          const mockExpiryTime = new Date();
          mockExpiryTime.setMinutes(mockExpiryTime.getMinutes() + 30);
          
          setExpiresAt(mockExpiryTime);
          setIsValid(true);
          
          if (onStatusChange) {
            onStatusChange(true);
          }
          
          setLoading(false);
          return;
        }
        
        // Check token status using the service
        const status = await checkGoogleTokenStatus();
        
        if (status.isValid) {
          setExpiresAt(status.expiresAt);
          setIsValid(true);
          
          // Notify parent component
          if (onStatusChange) {
            onStatusChange(true);
          }
          
          // Check if token needs refresh
          if (status.needsRefresh) {
            console.log('Token needs refresh, refreshing...');
            await handleRefreshToken();
          }
        } else {
          setIsValid(false);
          
          // Notify parent component
          if (onStatusChange) {
            onStatusChange(false);
          }
          
          if (onTokenExpired) {
            onTokenExpired();
          }
        }
      } catch (err) {
        console.error('Error checking token status:', err);
        setIsValid(false);
        
        // Notify parent component
        if (onStatusChange) {
          onStatusChange(false);
        }
        
        if (onTokenExpired) {
          onTokenExpired();
        }
      } finally {
        setLoading(false);
      }
    };
    
    checkTokenStatus();
    
    // Refresh token status every minute
    const intervalId = setInterval(checkTokenStatus, 60000);
    
    return () => clearInterval(intervalId);
  }, [onTokenExpired, onStatusChange, useMockData]);
  
  // Update the time remaining display
  useEffect(() => {
    if (!expiresAt || !isValid) return;
    
    const updateTimeRemaining = () => {
      const now = new Date();
      const diffMs = expiresAt.getTime() - now.getTime();
      
      if (diffMs <= 0) {
        setIsValid(false);
        setTimeRemaining('Expired');
        if (onTokenExpired) onTokenExpired();
        return;
      }
      
      const diffMins = Math.floor(diffMs / 60000);
      const diffSecs = Math.floor((diffMs % 60000) / 1000);
      
      setTimeRemaining(`${diffMins}m ${diffSecs}s`);
    };
    
    updateTimeRemaining();
    
    // Update countdown every second
    const intervalId = setInterval(updateTimeRemaining, 1000);
    
    return () => clearInterval(intervalId);
  }, [expiresAt, isValid, onTokenExpired]);
  
  // Handle token refresh
  const handleRefreshToken = async () => {
    try {
      setLoading(true);
      
      // Use the service to refresh token
      const result = await refreshGoogleToken();
      if (!result.success) {
        toast.error('Failed to refresh token. Please login again.');
        setIsValid(false);
        if (onStatusChange) onStatusChange(false);
        return;
      }
      if (result) {
        setIsValid(true);
        setExpiresAt(new Date(result.expires_at));
        toast.success('Token refreshed successfully');
        if (onStatusChange) onStatusChange(true);
      }
    } catch (err) {
      console.error('Error refreshing token:', err);
      toast.error('Error refreshing token');
    } finally {
      setLoading(false);
    }
  };

  // Handle login button click
  const handleLogin = () => {
    if (useMockData) {
      // For mock data, just simulate a successful login
      const mockExpiryTime = new Date();
      mockExpiryTime.setHours(mockExpiryTime.getHours() + 1);
      setExpiresAt(mockExpiryTime);
      setIsValid(true);
      if (onStatusChange) onStatusChange(true);
      return;
    }
    
    // Initiate the Google OAuth flow
    initiateGoogleAuth();
  };

  // Add a mock function to simulate token expiration for testing
  const handleMockExpire = () => {
    if (useMockData) {
      setIsValid(false);
      setTimeRemaining('Expired');
      if (onTokenExpired) onTokenExpired();
      if (onStatusChange) onStatusChange(false);
    }
  };
  
  return (
    <div className="flex items-center space-x-2">
      <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-gray-100">
        <span className="font-medium text-xs text-gray-800">Google Auth:</span>
        
        {loading ? (
          <span className="text-xs text-gray-500">Checking...</span>
        ) : isValid ? (
          <>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className="text-xs text-green-700">Valid</span>
            <span className="text-xs text-gray-600">({timeRemaining})</span>
          </>
        ) : (
          <>
            <span className="h-2 w-2 rounded-full bg-red-500"></span>
            <span className="text-xs text-red-700">Invalid</span>
          </>
        )}
      </div>
      
      {!loading && (
        <button
          onClick={isValid ? handleRefreshToken : handleLogin}
          disabled={loading}
          className={`text-xs px-2 py-1 rounded ${
            isValid 
              ? 'text-blue-600 hover:text-blue-800' 
              : 'bg-blue-500 text-white hover:bg-blue-600'
          }`}
        >
          {isValid ? 'Refresh' : 'Login'}
        </button>
      )}
      
      {/* Add mock controls when in development mode */}
      {process.env.NODE_ENV === 'development' && useMockData && (
        <button
          onClick={handleMockExpire}
          className="text-xs px-2 py-1 rounded bg-red-500 text-white hover:bg-red-600 ml-2"
        >
          Mock Expire
        </button>
      )}
      
      {isValid && (
        <div className="mt-2 text-xs text-gray-600 p-2 bg-gray-50 rounded">
          <div><strong>Token Info:</strong></div>
          <div>
            Token: {localStorage.getItem('google_access_token')?.substring(0, 15)}...
          </div>
          <div>
            Expires: {new Date(localStorage.getItem('google_token_expires_at') || '').toLocaleString()}
          </div>
          {localStorage.getItem('google_refresh_token') && (
            <div>Refresh Token: Available</div>
          )}
        </div>
      )}
    </div>
  );
}; 
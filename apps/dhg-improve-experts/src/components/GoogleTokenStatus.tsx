import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
        
        // Fetch token info from your Supabase or local storage
        // This is a placeholder - you'll need to adapt this to your actual token storage method
        const { data, error } = await supabase
          .from('google_auth_tokens')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        if (error) throw error;
        
        if (data) {
          // Convert expiration timestamp to Date object
          const expiry = new Date(data.expires_at);
          setExpiresAt(expiry);
          
          // Check if token is still valid
          const now = new Date();
          const isTokenValid = expiry > now;
          setIsValid(isTokenValid);
          
          // Notify parent component of status change
          if (onStatusChange) {
            onStatusChange(isTokenValid);
          }
          
          if (!isTokenValid && onTokenExpired) {
            onTokenExpired();
          }
        } else {
          setIsValid(false);
        }
      } catch (err) {
        console.error('Error checking token status:', err);
        setIsValid(false);
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
      
      // For mock data, just extend the token by another hour
      if (useMockData) {
        const newExpiryTime = new Date();
        newExpiryTime.setHours(newExpiryTime.getHours() + 1);
        
        setExpiresAt(newExpiryTime);
        setIsValid(true);
        
        if (onStatusChange) {
          onStatusChange(true);
        }
        
        setLoading(false);
        return;
      }
      
      // Call your token refresh endpoint/function
      const { data, error } = await supabase.functions.invoke('refresh-google-token');
      
      if (error) throw error;
      
      if (data) {
        setIsValid(true);
        setExpiresAt(new Date(data.expires_at));
      }
    } catch (err) {
      console.error('Error refreshing token:', err);
    } finally {
      setLoading(false);
    }
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
          onClick={handleRefreshToken}
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
    </div>
  );
}; 
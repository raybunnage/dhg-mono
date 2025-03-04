import React, { useState, useEffect } from 'react';
import { checkGoogleTokenStatus, refreshGoogleToken, initiateGoogleAuth } from '@/services/googleAuth';
import { toast } from 'react-hot-toast';
import { supabase } from '@/integrations/supabase/client';

interface TokenStatusProps {
  onTokenExpired?: () => void;
  onStatusChange?: (isValid: boolean, token?: string) => void;
  useMockData?: boolean;
}

export const GoogleTokenStatus: React.FC<TokenStatusProps> = ({ 
  onTokenExpired, 
  onStatusChange,
  useMockData = true
}) => {
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [acquiredAt, setAcquiredAt] = useState<Date | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [remainingPercentage, setRemainingPercentage] = useState<number>(100);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [tokenInfo, setTokenInfo] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [wasTokenTested, setWasTokenTested] = useState<boolean>(false);

  // Check token status
  useEffect(() => {
    const checkTokenStatus = async () => {
      try {
        setLoading(true);
        
        // For development - check if token validation should be skipped
        const skipValidation = process.env.NODE_ENV === 'development' && 
                              localStorage.getItem('skip_token_validation') === 'true';
        
        if (skipValidation) {
          console.log('DEV MODE: Using cached token without validation');
          
          // Use stored token info from localStorage without validation
          const token = localStorage.getItem('google_access_token');
          const expiresAtStr = localStorage.getItem('google_token_expires_at');
          const acquiredAtStr = localStorage.getItem('google_token_acquired_at');
          
          if (token && expiresAtStr) {
            // We have a token, treat it as valid in development mode
            const expiry = new Date(expiresAtStr);
            setExpiresAt(expiry);
            
            // Get acquisition time or default to 1 hour before expiry
            let acquired;
            if (acquiredAtStr) {
              acquired = new Date(acquiredAtStr);
            } else {
              acquired = new Date(expiry);
              acquired.setHours(acquired.getHours() - 1);
              localStorage.setItem('google_token_acquired_at', acquired.toISOString());
            }
            setAcquiredAt(acquired);
            
            // Calculate remaining time
            const now = new Date();
            const totalDuration = expiry.getTime() - acquired.getTime();
            const elapsed = now.getTime() - acquired.getTime();
            const percentage = 100 - Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
            setRemainingPercentage(percentage);
            
            setIsValid(true);
            setWasTokenTested(true);
            
            // Notify parent
            if (onStatusChange) {
              onStatusChange(true, token);
            }
            
            setLoading(false);
            return;
          }
        }
        
        // Use mock data if enabled
        if (useMockData) {
          // Create a mock expiration time 30 minutes from now
          const mockExpiryTime = new Date();
          mockExpiryTime.setMinutes(mockExpiryTime.getMinutes() + 30);
          
          // Create a mock acquisition time 30 minutes ago
          const mockAcquiredTime = new Date();
          mockAcquiredTime.setMinutes(mockAcquiredTime.getMinutes() - 30);
          
          setExpiresAt(mockExpiryTime);
          setAcquiredAt(mockAcquiredTime);
          setRemainingPercentage(50); // 50% of time remaining
          setIsValid(true);
          setWasTokenTested(true);
          
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
          
          // Set acquisition time if available
          if (status.acquiredAt) {
            setAcquiredAt(status.acquiredAt);
          }
          
          // Set remaining percentage if available
          if (status.remainingPercentage !== undefined) {
            setRemainingPercentage(status.remainingPercentage);
          }
          
          setIsValid(true);
          setWasTokenTested(true);
          
          // Notify parent component
          if (onStatusChange) {
            // Pass the token along with the status
            const token = localStorage.getItem('google_access_token');
            onStatusChange(true, token || undefined);
          }
          
          // Check if token needs refresh
          if (status.needsRefresh) {
            console.log('Token needs refresh, refreshing...');
            await handleRefreshToken();
          }
        } else {
          setIsValid(false);
          setWasTokenTested(true);
          
          // In development with skip validation, don't clear token if validation fails
          if (!(process.env.NODE_ENV === 'development' && 
                localStorage.getItem('skip_token_validation') === 'true')) {
            // Only clear token if not in dev mode with skip validation
            localStorage.removeItem('google_access_token');
          }
          
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
        setWasTokenTested(true);
        
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
      
      // Always read the latest expiration time from localStorage to ensure consistency
      // This is critical for accurate display after page refresh
      const storedExpiresAt = localStorage.getItem('google_token_expires_at');
      const storedAcquiredAt = localStorage.getItem('google_token_acquired_at');
      
      // Use the stored values if available
      const currentExpiresAt = storedExpiresAt ? new Date(storedExpiresAt) : expiresAt;
      const currentAcquiredAt = storedAcquiredAt ? new Date(storedAcquiredAt) : acquiredAt;
      
      // Update state with the latest values from localStorage
      if (storedExpiresAt && currentExpiresAt.getTime() !== expiresAt?.getTime()) {
        setExpiresAt(currentExpiresAt);
      }
      
      if (storedAcquiredAt && (!acquiredAt || currentAcquiredAt.getTime() !== acquiredAt.getTime())) {
        setAcquiredAt(currentAcquiredAt);
      }
      
      // Calculate time remaining
      const diffMs = currentExpiresAt.getTime() - now.getTime();
      
      // Calculate time elapsed since acquisition
      let elapsedPercentage = 0;
      if (currentAcquiredAt) {
        const totalDuration = currentExpiresAt.getTime() - currentAcquiredAt.getTime();
        const elapsed = now.getTime() - currentAcquiredAt.getTime();
        elapsedPercentage = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
        setRemainingPercentage(100 - elapsedPercentage);
      }
      
      // Log time remaining info for debugging
      if (process.env.NODE_ENV === 'development' && Math.floor(diffMs / 1000) % 60 === 0) {
        console.log(`Token expires in ${Math.floor(diffMs / 60000)} minutes and ${Math.floor((diffMs % 60000) / 1000)} seconds`);
        console.log(`Current time: ${now.toLocaleTimeString()}, Expires at: ${currentExpiresAt.toLocaleTimeString()}`);
        if (currentAcquiredAt) {
          console.log(`Token acquired at: ${currentAcquiredAt.toLocaleTimeString()}, Elapsed: ${elapsedPercentage.toFixed(1)}%`);
        }
      }
      
      if (diffMs <= 0) {
        setIsValid(false);
        setTimeRemaining('Expired');
        setRemainingPercentage(0);
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
  }, [expiresAt, acquiredAt, isValid, onTokenExpired]);
  
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
        
        // Update acquisition time if available
        if (result.acquired_at) {
          setAcquiredAt(new Date(result.acquired_at));
        } else {
          // If not provided, set to now
          setAcquiredAt(new Date());
        }
        
        // Reset remaining percentage to 100%
        setRemainingPercentage(100);
        
        toast.success('Token refreshed successfully');
        
        // Store the new token in localStorage and pass to parent
        if (result.access_token) {
          localStorage.setItem('google_access_token', result.access_token);
          
          if (onStatusChange) onStatusChange(true, result.access_token);
        } else {
          if (onStatusChange) onStatusChange(true);
        }
      }
    } catch (err) {
      console.error('Error refreshing token:', err);
      toast.error('Error refreshing token');
    } finally {
      setLoading(false);
    }
  };

  // Handle login button click
  const handleLogin = async () => {
    // For development mode - ALWAYS enable token validation skip
    if (process.env.NODE_ENV === 'development') {
      console.log('DEV MODE: Enabling token validation skip to make development easier');
      // Set skip flag before doing anything else
      localStorage.setItem('skip_token_validation', 'true');
    }
    
    if (useMockData) {
      // For mock data, just simulate a successful login
      const mockExpiryTime = new Date();
      mockExpiryTime.setHours(mockExpiryTime.getHours() + 1);
      setExpiresAt(mockExpiryTime);
      
      // Set acquisition time to now
      const mockAcquiredTime = new Date();
      setAcquiredAt(mockAcquiredTime);
      
      setRemainingPercentage(100);
      setIsValid(true);
      setWasTokenTested(true);
      
      if (onStatusChange) {
        // For mock data, create a fake token
        const mockToken = 'mock_token_' + Date.now();
        localStorage.setItem('google_access_token', mockToken);
        localStorage.setItem('google_token_acquired_at', mockAcquiredTime.toISOString());
        localStorage.setItem('google_token_expires_at', mockExpiryTime.toISOString());
        onStatusChange(true, mockToken);
      }
      
      // Force immediate refresh of token status to avoid validation checks
      setTimeout(() => {
        if (onStatusChange) onStatusChange(true, localStorage.getItem('google_access_token') || '');
      }, 100);
      
      return;
    }
    
    // For real token - manually enter it
    const manualToken = prompt('Enter your Google Drive access token:');
    if (manualToken) {
      // Store the token
      localStorage.setItem('google_access_token', manualToken);
      
      // Set expiration to 1 hour from now
      const expiryTime = new Date();
      expiryTime.setHours(expiryTime.getHours() + 1);
      localStorage.setItem('google_token_expires_at', expiryTime.toISOString());
      
      // Set acquisition time to now
      const acquiredTime = new Date();
      localStorage.setItem('google_token_acquired_at', acquiredTime.toISOString());
      
      // Update state
      setExpiresAt(expiryTime);
      setAcquiredAt(acquiredTime);
      setRemainingPercentage(100);
      setIsValid(true);
      setWasTokenTested(true);
      
      // Notify parent
      if (onStatusChange) onStatusChange(true, manualToken);
      
      // Trigger refresh
      window.location.reload();
      return;
    }
  };

  // Add a mock function to simulate token expiration for testing
  const handleMockExpire = () => {
    if (useMockData) {
      setIsValid(false);
      setTimeRemaining('Expired');
      setRemainingPercentage(0);
      localStorage.removeItem('google_access_token'); // Remove the token
      if (onTokenExpired) onTokenExpired();
      if (onStatusChange) onStatusChange(false);
    }
  };

  const checkAndRefreshToken = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Get current token
      const { data: tokenData, error: tokenError } = await supabase
        .from('google_auth_tokens')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);
      
      // Handle the case when no tokens are found (don't use .single())
      if (tokenError || !tokenData || tokenData.length === 0) {
        console.log('No Google auth tokens found in database');
        setIsAuthenticated(false);
        if (onStatusChange) onStatusChange(false);
        setError(tokenError?.message || 'No Google authentication found');
        setLoading(false);
        return;
      }
      
      // Use the first token from the result array
      const token = tokenData[0];
      
      // Check if token is expired
      const expiresAt = new Date(token.expires_at);
      const now = new Date();
      const timeUntilExpiry = expiresAt.getTime() - now.getTime();
      
      // Calculate acquisition time - use creation time or default to 1 hour before expiry
      const acquiredAt = token.created_at 
        ? new Date(token.created_at) 
        : new Date(expiresAt.getTime() - 60 * 60 * 1000);
      
      // Store it in localStorage
      localStorage.setItem('google_token_acquired_at', acquiredAt.toISOString());
      
      // If token expires in less than 5 minutes, attempt to refresh it
      if (timeUntilExpiry < 5 * 60 * 1000) {
        console.log('Token expires soon, refreshing...');
        
        if (!token.refresh_token) {
          setError('No refresh token available');
          setIsAuthenticated(false);
          if (onStatusChange) onStatusChange(false);
          if (onTokenExpired) onTokenExpired();
          setLoading(false);
          return;
        }
        
        // Call token refresh endpoint
        const { data: refreshData, error: refreshError } = await supabase.functions.invoke('refresh-google-token', {
          body: { 
            refreshToken: token.refresh_token
          }
        });
        
        if (refreshError) {
          console.error('Error refreshing token:', refreshError);
          throw new Error('Failed to refresh token: ' + refreshError.message);
        }
        
        // Update token in database
        if (refreshData && refreshData.access_token) {
          const newExpiresAt = new Date(Date.now() + refreshData.expires_in * 1000);
          const newAcquiredAt = new Date();
          
          const { error: updateError } = await supabase
            .from('google_auth_tokens')
            .update({
              access_token: refreshData.access_token,
              expires_at: newExpiresAt.toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', token.id);
          
          if (updateError) throw updateError;
          
          setTokenInfo({
            ...token,
            access_token: refreshData.access_token,
            expires_at: newExpiresAt.toISOString()
          });
          
          // Store acquisition time
          localStorage.setItem('google_token_acquired_at', newAcquiredAt.toISOString());
          
          setIsAuthenticated(true);
          if (onStatusChange) {
            // Pass the token along with the status
            const token = refreshData.access_token;
            localStorage.setItem('google_access_token', token);
            onStatusChange(true, token);
          }
        } else {
          throw new Error('Failed to refresh token: No access token returned');
        }
      } else {
        // Token is still valid
        setTokenInfo(token);
        setIsAuthenticated(true);
        if (onStatusChange) {
          onStatusChange(true, token.access_token);
          // Also store in localStorage for other components to use
          localStorage.setItem('google_access_token', token.access_token);
        }
      }
    } catch (err) {
      console.error('Error checking token:', err);
      setError(err instanceof Error ? err.message : 'Unknown error checking Google token');
      setIsAuthenticated(false);
      if (onStatusChange) onStatusChange(false);
      if (onTokenExpired) onTokenExpired();
    } finally {
      setLoading(false);
    }
  };
  
  // Check token on component mount and every 5 minutes
  useEffect(() => {
    checkAndRefreshToken();
    
    // Refresh check every 5 minutes
    const interval = setInterval(checkAndRefreshToken, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  // Function to get a color based on the remaining percentage
  const getRemainingColor = (percentage: number) => {
    if (percentage > 66) return 'bg-green-500';
    if (percentage > 33) return 'bg-yellow-500';
    return 'bg-red-500';
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
              <span className={`relative inline-flex rounded-full h-2 w-2 ${getRemainingColor(remainingPercentage)}`}></span>
            </span>
            <span className="text-xs text-green-700">Valid</span>
            <span className="text-xs text-gray-600">({timeRemaining})</span>
            
            {/* Token health indicator */}
            <div className="ml-2 w-16 h-2 bg-gray-200 rounded overflow-hidden">
              <div 
                className={`h-full ${getRemainingColor(remainingPercentage)}`} 
                style={{ width: `${remainingPercentage}%` }}
              ></div>
            </div>
            <span className="text-xs text-gray-500">{Math.round(remainingPercentage)}%</span>
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
      
      {/* Test API button */}
      {isValid && !loading && (
        <button
          onClick={async () => {
            try {
              const response = await fetch('https://www.googleapis.com/drive/v3/files?pageSize=1', {
                headers: {
                  'Authorization': `Bearer ${localStorage.getItem('google_access_token')}`
                }
              });
              
              if (response.ok) {
                toast.success('API test successful!');
                setWasTokenTested(true);
              } else {
                toast.error(`API test failed: ${response.status}`);
              }
            } catch (error) {
              toast.error('API test failed');
              console.error('API test error:', error);
            }
          }}
          className="text-xs px-2 py-1 rounded bg-purple-500 text-white hover:bg-purple-600"
        >
          Test API
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
            Acquired: {acquiredAt ? acquiredAt.toLocaleString() : 'Unknown'}
          </div>
          <div>
            Expires: {expiresAt ? expiresAt.toLocaleString() : 'Unknown'}
          </div>
          <div>
            API Tested: {wasTokenTested ? '✅' : '❌'}
          </div>
          {localStorage.getItem('google_refresh_token') && (
            <div>Refresh Token: Available</div>
          )}
        </div>
      )}
    </div>
  );
}; 
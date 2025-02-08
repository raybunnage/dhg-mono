import { useState, useEffect } from 'react';

const LoadingSpinner = ({ size = 'md' }) => {
  const [dots, setDots] = useState('.');
  
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(d => d.length >= 3 ? '.' : d + '.');
    }, 500);
    
    return () => clearInterval(interval);
  }, []);

  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-2xl'
  };

  return (
    <div 
      className={`animate-pulse font-mono ${sizeClasses[size]} text-blue-500 dark:text-purple-400`}
      role="status"
      aria-label="Loading"
    >
      Loading{dots}
    </div>
  );
};

export default LoadingSpinner; 
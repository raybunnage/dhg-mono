/**
 * Theme Toggle Component
 * 
 * Reusable component for toggling between light and dark themes
 */

import React from 'react';
import { useTheme } from '../../hooks/useTheme';

export interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
  lightIcon?: React.ReactNode;
  darkIcon?: React.ReactNode;
  systemIcon?: React.ReactNode;
  variant?: 'button' | 'switch' | 'dropdown';
}

/**
 * Theme toggle component
 */
export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  className = '',
  showLabel = true,
  lightIcon = '☀️',
  darkIcon = '🌙',
  systemIcon = '💻',
  variant = 'button'
}) => {
  const { theme, actualTheme, setTheme, toggleTheme } = useTheme();
  
  if (variant === 'button') {
    return (
      <button
        onClick={toggleTheme}
        className={`px-4 py-2 rounded-md transition-colors
          bg-blue-500 hover:bg-blue-600 text-white
          dark:bg-purple-600 dark:hover:bg-purple-700 ${className}`}
        aria-label={actualTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      >
        {actualTheme === 'dark' ? lightIcon : darkIcon}
        {showLabel && (
          <span className="ml-2">
            {actualTheme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </span>
        )}
      </button>
    );
  }
  
  if (variant === 'switch') {
    return (
      <label className={`relative inline-flex items-center cursor-pointer ${className}`}>
        <input
          type="checkbox"
          checked={actualTheme === 'dark'}
          onChange={toggleTheme}
          className="sr-only peer"
          aria-label="Toggle theme"
        />
        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 
          peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer 
          dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white 
          after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white 
          after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 
          after:transition-all dark:border-gray-600 peer-checked:bg-blue-600">
        </div>
        {showLabel && (
          <span className="ml-3 text-sm font-medium text-gray-900 dark:text-gray-300">
            {actualTheme === 'dark' ? 'Dark' : 'Light'}
          </span>
        )}
      </label>
    );
  }
  
  if (variant === 'dropdown') {
    return (
      <select
        value={theme}
        onChange={(e) => setTheme(e.target.value as Theme)}
        className={`px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600
          bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
          focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
        aria-label="Select theme"
      >
        <option value="light">{lightIcon} Light</option>
        <option value="dark">{darkIcon} Dark</option>
        <option value="system">{systemIcon} System</option>
      </select>
    );
  }
  
  return null;
};

export default ThemeToggle;
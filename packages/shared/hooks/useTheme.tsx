/**
 * React hook for theme management
 * 
 * Provides easy integration with the theme service for React components
 */

import { useState, useEffect, useCallback } from 'react';
import { themeService, Theme } from '../services/theme-service';

export interface UseThemeReturn {
  theme: Theme;
  actualTheme: 'light' | 'dark';
  isDarkMode: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

/**
 * React hook for theme management
 */
export function useTheme(): UseThemeReturn {
  const [theme, setThemeState] = useState<Theme>(themeService.getTheme());
  const [actualTheme, setActualTheme] = useState<'light' | 'dark'>(themeService.getActualTheme());
  
  useEffect(() => {
    // Subscribe to theme changes
    const unsubscribe = themeService.subscribe((newActualTheme) => {
      setThemeState(themeService.getTheme());
      setActualTheme(newActualTheme);
    });
    
    // Cleanup
    return unsubscribe;
  }, []);
  
  const setTheme = useCallback((newTheme: Theme) => {
    themeService.setTheme(newTheme);
    setThemeState(newTheme);
    setActualTheme(themeService.getActualTheme());
  }, []);
  
  const toggleTheme = useCallback(() => {
    themeService.toggleTheme();
    setThemeState(themeService.getTheme());
    setActualTheme(themeService.getActualTheme());
  }, []);
  
  return {
    theme,
    actualTheme,
    isDarkMode: actualTheme === 'dark',
    setTheme,
    toggleTheme
  };
}
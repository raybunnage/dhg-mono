/**
 * Theme Service
 * 
 * Provides unified theme management across applications
 * Supports dark/light mode with persistence and system preference detection
 */

export type Theme = 'light' | 'dark' | 'system';

export interface ThemeConfig {
  defaultTheme?: Theme;
  storageKey?: string;
  darkClassName?: string;
  lightClassName?: string;
  rootElement?: HTMLElement;
}

/**
 * Theme Service for managing application themes
 */
export class ThemeService {
  private static instance: ThemeService;
  private currentTheme: Theme = 'system';
  private actualTheme: 'light' | 'dark' = 'light';
  private config: Required<ThemeConfig>;
  private listeners: Set<(theme: 'light' | 'dark') => void> = new Set();
  private mediaQueryList?: MediaQueryList;
  
  private constructor(config?: ThemeConfig) {
    this.config = {
      defaultTheme: config?.defaultTheme || 'system',
      storageKey: config?.storageKey || 'app-theme',
      darkClassName: config?.darkClassName || 'dark',
      lightClassName: config?.lightClassName || 'light',
      rootElement: config?.rootElement || document.documentElement
    };
    
    this.initialize();
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(config?: ThemeConfig): ThemeService {
    if (!ThemeService.instance) {
      ThemeService.instance = new ThemeService(config);
    }
    return ThemeService.instance;
  }
  
  /**
   * Initialize theme service
   */
  private initialize(): void {
    // Load saved theme or use default
    const savedTheme = this.loadTheme();
    this.currentTheme = savedTheme || this.config.defaultTheme;
    
    // Set up system theme detection
    if (window.matchMedia) {
      this.mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');
      this.mediaQueryList.addEventListener('change', this.handleSystemThemeChange);
    }
    
    // Apply initial theme
    this.applyTheme();
  }
  
  /**
   * Get current theme setting
   */
  public getTheme(): Theme {
    return this.currentTheme;
  }
  
  /**
   * Get actual applied theme (resolved from system if needed)
   */
  public getActualTheme(): 'light' | 'dark' {
    return this.actualTheme;
  }
  
  /**
   * Set theme
   */
  public setTheme(theme: Theme): void {
    this.currentTheme = theme;
    this.saveTheme(theme);
    this.applyTheme();
  }
  
  /**
   * Toggle between light and dark
   */
  public toggleTheme(): void {
    const newTheme = this.actualTheme === 'dark' ? 'light' : 'dark';
    this.setTheme(newTheme);
  }
  
  /**
   * Check if dark mode is active
   */
  public isDarkMode(): boolean {
    return this.actualTheme === 'dark';
  }
  
  /**
   * Subscribe to theme changes
   */
  public subscribe(callback: (theme: 'light' | 'dark') => void): () => void {
    this.listeners.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }
  
  /**
   * Apply theme to DOM
   */
  private applyTheme(): void {
    const systemTheme = this.getSystemTheme();
    this.actualTheme = this.currentTheme === 'system' ? systemTheme : this.currentTheme;
    
    // Update classes on root element
    const { rootElement, darkClassName, lightClassName } = this.config;
    
    if (this.actualTheme === 'dark') {
      rootElement.classList.add(darkClassName);
      rootElement.classList.remove(lightClassName);
      rootElement.setAttribute('data-theme', 'dark');
    } else {
      rootElement.classList.add(lightClassName);
      rootElement.classList.remove(darkClassName);
      rootElement.setAttribute('data-theme', 'light');
    }
    
    // Also update body classes for backward compatibility
    if (document.body) {
      if (this.actualTheme === 'dark') {
        document.body.classList.add('dark-mode');
      } else {
        document.body.classList.remove('dark-mode');
      }
    }
    
    // Notify listeners
    this.notifyListeners();
  }
  
  /**
   * Get system theme preference
   */
  private getSystemTheme(): 'light' | 'dark' {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }
  
  /**
   * Handle system theme change
   */
  private handleSystemThemeChange = (): void => {
    if (this.currentTheme === 'system') {
      this.applyTheme();
    }
  };
  
  /**
   * Load theme from storage
   */
  private loadTheme(): Theme | null {
    try {
      const saved = localStorage.getItem(this.config.storageKey);
      if (saved && ['light', 'dark', 'system'].includes(saved)) {
        return saved as Theme;
      }
    } catch (error) {
      console.warn('Failed to load theme from storage:', error);
    }
    return null;
  }
  
  /**
   * Save theme to storage
   */
  private saveTheme(theme: Theme): void {
    try {
      localStorage.setItem(this.config.storageKey, theme);
    } catch (error) {
      console.warn('Failed to save theme to storage:', error);
    }
  }
  
  /**
   * Notify all listeners of theme change
   */
  private notifyListeners(): void {
    this.listeners.forEach(callback => {
      try {
        callback(this.actualTheme);
      } catch (error) {
        console.error('Theme listener error:', error);
      }
    });
  }
  
  /**
   * Clean up resources
   */
  public destroy(): void {
    if (this.mediaQueryList) {
      this.mediaQueryList.removeEventListener('change', this.handleSystemThemeChange);
    }
    this.listeners.clear();
  }
}

// Export singleton instance with default config
export const themeService = ThemeService.getInstance();
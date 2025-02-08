import { useState, useEffect } from 'react';

const ThemeToggle = () => {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Check initial theme
    const isDarkMode = document.body.classList.contains('dark-mode');
    setIsDark(isDarkMode);
  }, []);

  const toggleTheme = () => {
    document.body.classList.toggle('dark-mode');
    setIsDark(!isDark);
  };

  return (
    <button 
      onClick={toggleTheme}
      className="px-4 py-2 rounded-md transition-colors
        bg-blue-500 hover:bg-blue-600 text-white
        dark:bg-purple-600 dark:hover:bg-purple-700"
      aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    >
      {isDark ? '☀️ Light Mode' : '🌙 Dark Mode'}
    </button>
  );
};

export default ThemeToggle; 
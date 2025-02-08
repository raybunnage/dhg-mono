const ThemeToggle = () => {
  const toggleTheme = () => {
    document.body.classList.toggle('dark-mode');
  };

  return (
    <button 
      onClick={toggleTheme}
      className="px-4 py-2 bg-blue-500 text-white rounded"
    >
      Toggle Theme
    </button>
  );
};

export default ThemeToggle; 
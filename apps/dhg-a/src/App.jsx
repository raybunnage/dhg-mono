import Header from './components/Header/Header'
import Button from './components/Button/Button'
import ThemeToggle from './components/ThemeToggle/ThemeToggle'
import LoadingSpinner from './components/LoadingSpinner/LoadingSpinner'
import { useState } from 'react'

function App() {
  const [isLoading, setIsLoading] = useState(false);
  
  const handleClick = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 2000);
  };

  return (
    <>
      <Header />
      <main className="min-h-screen p-8">
        <h1>DHG App A</h1>
        <Button onClick={handleClick}>
          {isLoading ? <LoadingSpinner size="sm" /> : 'Click Me'}
        </Button>
        <div className="mt-8 space-y-4">
          <ThemeToggle />
          <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold mb-2">Current Environment</h2>
            <p className="mt-2">Environment: {import.meta.env.VITE_ENV}</p>
          </div>
        </div>
      </main>
      <footer role="contentinfo">
        <p>© 2024 DHG App A</p>
      </footer>
    </>
  )
}

export default App 
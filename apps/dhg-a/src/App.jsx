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

  const getEnvColor = (env) => {
    // Debug environment variables
    console.log('Environment Variables:', {
      currentEnv: env,
      appName: import.meta.env.VITE_APP_NAME,
      featureFlags: import.meta.env.VITE_FEATURE_FLAGS,
      allEnv: import.meta.env
    });

    switch(env) {
      case 'production': return 'bg-green-100 text-green-800 border-green-200';
      case 'development': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  // Default values for testing environment
  const ENV = {
    VITE_ENV: import.meta.env.VITE_ENV || 'test',
    VITE_APP_NAME: import.meta.env.VITE_APP_NAME || 'DHG Hub (Test)',
    VITE_API_URL: import.meta.env.VITE_API_URL || 'https://test-api.dhg-hub.org',
    VITE_FEATURE_FLAGS: import.meta.env.VITE_FEATURE_FLAGS || 'test'
  };

  const featureFlags = import.meta.env.VITE_FEATURE_FLAGS?.split(',') || [];

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
            <h2 className="text-lg font-semibold mb-2 bg-blue-500">Environment Info</h2>
            <div className="space-y-3">
              <div>
                <span className="font-medium">Status: </span>
                <span className={`inline-block px-2 py-1 rounded-md border ${getEnvColor(import.meta.env.VITE_ENV)}`}>
                  {/* Debug output */}
                  <span className="hidden">
                    ENV: {JSON.stringify(import.meta.env, null, 2)}
                  </span>
                  {ENV.VITE_ENV.toUpperCase()}
                </span>
              </div>
              <div>
                <span className="font-medium">App Name: </span>
                <span>{ENV.VITE_APP_NAME}</span>
              </div>
              <div>
                <span className="font-medium">API URL: </span>
                <span className="font-mono text-sm">{ENV.VITE_API_URL}</span>
              </div>
              {featureFlags.length > 0 && (
                <div>
                  <span className="font-medium">Feature Flags: </span>
                  <div className="flex gap-2 mt-1">
                    {featureFlags.map(flag => (
                      <span key={flag} className="px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-sm">
                        {flag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
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
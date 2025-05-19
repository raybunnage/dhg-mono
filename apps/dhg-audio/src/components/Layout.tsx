import { Outlet, Link, useLocation } from 'react-router-dom';

export const Layout = () => {
  const location = useLocation();
  
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-screen-lg mx-auto py-4 px-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Link to="/" className="flex items-center">
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  viewBox="0 0 24 24" 
                  fill="currentColor" 
                  className="w-8 h-8 text-blue-600"
                >
                  <path fillRule="evenodd" d="M19.952 1.651a.75.75 0 0 1 .298.599V16.303a3 3 0 0 1-2.176 2.884l-1.32.377a2.553 2.553 0 0 1-1.403-.14L4.56 15.765A2.25 2.25 0 0 1 3 13.655V7.105a2.25 2.25 0 0 1 1.92-2.227l10.52-1.699a.75.75 0 0 1 .662.175 3.001 3.001 0 0 1 3.85.026zM15 9.75a.75.75 0 0 0-1.5 0v5.63a2.25 2.25 0 0 0 1.5 0V9.75z" clipRule="evenodd" />
                </svg>
                <span className="ml-2 text-lg font-semibold text-gray-900">DHG Audio</span>
              </Link>
            </div>
            <nav className="flex space-x-4">
              <Link
                to="/"
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  location.pathname === '/'
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Home
              </Link>
              <Link
                to="/about"
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  location.pathname === '/about'
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                About
              </Link>
            </nav>
          </div>
        </div>
      </header>
      
      {/* Main content */}
      <main className="flex-grow">
        <div className="max-w-screen-lg mx-auto py-6 px-4 sm:px-6">
          <Outlet />
        </div>
      </main>
      
      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-6">
        <div className="max-w-screen-lg mx-auto px-4 sm:px-6">
          <p className="text-center text-sm text-gray-500">
            &copy; {new Date().getFullYear()} Dynamic Healing Group
          </p>
        </div>
      </footer>
    </div>
  );
};
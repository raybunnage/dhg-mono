import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

export function MainNavbar() {
  const location = useLocation();
  const currentPath = location.pathname;
  const { user, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  
  const navigation = [
    { name: 'Home', href: '/' },
    { name: 'Easy', href: '/easy' }
    // Add more navigation items as the app grows
  ]

  const handleLogout = async () => {
    await logout();
    setShowUserMenu(false);
  };

  return (
    <nav className="bg-white shadow-sm mb-4">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between h-16">
          <div className="flex space-x-4 items-center">
            <div className="font-semibold text-blue-600 mr-4">DHG Hub</div>
            {navigation.map((item) => (
              <Link 
                key={item.name} 
                to={item.href} 
                className={`${currentPath === item.href ? 'text-blue-600 font-medium' : 'text-gray-700'} hover:text-gray-900`}
              >
                {item.name}
              </Link>
            ))}
          </div>
          
          {/* User menu */}
          {user && (
            <div className="flex items-center">
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white">
                    {user.email?.charAt(0).toUpperCase()}
                  </div>
                  <span className="ml-2 text-gray-700">{user.profile?.display_name || user.email}</span>
                </button>
                
                {showUserMenu && (
                  <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5">
                    <div className="py-1">
                      <div className="px-4 py-2 text-sm text-gray-700 border-b">
                        {user.email}
                      </div>
                      <button
                        onClick={handleLogout}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
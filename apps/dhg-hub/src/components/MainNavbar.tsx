import { Link, useLocation } from 'react-router-dom';

let navbarRenderCount = 0;

export function MainNavbar() {
  navbarRenderCount++;
  console.log(`🧭 NAVBAR RENDER #${navbarRenderCount} at ${new Date().toLocaleTimeString()}`);
  
  const location = useLocation();
  const currentPath = location.pathname;
  
  console.log(`📍 NAVBAR: Current path = ${currentPath}`);
  console.log(`📍 NAVBAR: Location object:`, location);
  
  const navigation = [
    { name: 'Home', href: '/' },
    { name: 'Easy', href: '/easy' }
    // Add more navigation items as the app grows
  ]

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
        </div>
      </div>
    </nav>
  );
}
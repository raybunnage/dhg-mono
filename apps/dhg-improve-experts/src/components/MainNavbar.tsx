import { Link, useLocation } from 'react-router-dom';

export function MainNavbar() {
  const location = useLocation();
  const currentPath = location.pathname;
  
  const navigation = [
    { name: 'Home', href: '/' },
    { name: 'Viewer', href: '/viewer' },
    { name: 'Show', href: '/show' },
    { name: 'Sync', href: '/sync' },
    { name: 'Docs', href: '/docs' },
    // { name: 'Docs Explorer', href: '/docs-explorer' }, // Replaced by Docs
    // { name: 'Doc Tables Test', href: '/documentation-test' }, // Archived on 2025-03-04
    { name: 'AI', href: '/ai' },
    { name: 'Classify', href: '/classify' },
    { name: 'Transcribe', href: '/transcribe' },
    { name: 'Supabase', href: '/supabase' },
    { name: 'Write', href: '/write' },
    { name: 'Experts', href: '/experts' },
    { name: 'Code', href: '/code' },
    { name: 'Cmds', href: '/cmds' },
    { name: 'Guts Example', href: '/guts-example' },
  ]

  return (
    <nav className="bg-white shadow-sm mb-4">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between h-16">
          <div className="flex space-x-4 items-center">
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
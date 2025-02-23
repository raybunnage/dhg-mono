import { Link } from 'react-router-dom';

export function MainNavbar() {
  const navigation = [
    { name: 'Home', href: '/' },
    { name: 'Sources', href: '/source-management' },
    { name: 'Buttons', href: '/source-buttons' },
    { name: 'Transcribe', href: '/transcribe' },
    { name: 'Supabase', href: '/supabase' },
    { name: 'Classify', href: '/classify' },
    { name: 'Analyze', href: '/analyze' },
    { name: 'Registry', href: '/registry' },
  ]

  return (
    <nav className="bg-white shadow-sm mb-4">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between h-16">
          <div className="flex space-x-4 items-center">
            {navigation.map((item) => (
              <Link key={item.name} to={item.href} className="text-gray-700 hover:text-gray-900">
                {item.name}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
} 
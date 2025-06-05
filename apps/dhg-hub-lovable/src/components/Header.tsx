import { Link } from 'react-router-dom';

export default function Header() {
  return (
    <header className="bg-white shadow-sm">
      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-8">
            <h1 className="text-2xl font-serif text-primary-900">
              Dynamic Healing Network
            </h1>
            <nav className="hidden md:flex space-x-6">
              <Link to="/" className="text-gray-600 hover:text-primary-600">
                Home
              </Link>
              <Link to="/experts" className="text-gray-600 hover:text-primary-600">
                Experts
              </Link>
              <Link to="/document-types" className="text-gray-600 hover:text-primary-600">
                Document Types
              </Link>
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
} 
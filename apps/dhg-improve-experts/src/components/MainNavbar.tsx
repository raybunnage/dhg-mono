import { Link } from 'react-router-dom';

export function MainNavbar() {
  return (
    <nav className="bg-white shadow-sm mb-4">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between h-16">
          <div className="flex space-x-4 items-center">
            <Link to="/" className="text-gray-700 hover:text-gray-900">
              Home
            </Link>
            <Link to="/source-management" className="text-gray-700 hover:text-gray-900">
              Source Management
            </Link>
            <Link to="/classify" className="text-gray-700 hover:text-gray-900">
              Classify
            </Link>
            <Link to="/analyze" className="text-gray-700 hover:text-gray-900">
              Analysis
            </Link>
            <Link to="/transcribe" className="text-gray-700 hover:text-gray-900">
              Transcribe
            </Link>
            <Link to="/registry" className="text-gray-700 hover:text-gray-900">
              Function Registry
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
} 
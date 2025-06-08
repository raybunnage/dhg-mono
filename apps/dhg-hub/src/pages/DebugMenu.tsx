import { Link } from 'react-router-dom';

export function DebugMenu() {
  return (
    <div className="fixed top-20 left-4 bg-white shadow-lg rounded-lg p-4 z-50 border-2 border-red-500">
      <h3 className="text-lg font-bold mb-3 text-red-600">🔍 Debug Menu</h3>
      
      <div className="space-y-2">
        <Link to="/" className="block p-2 bg-gray-100 hover:bg-gray-200 rounded">
          Home (Full)
        </Link>
        
        <Link to="/test" className="block p-2 bg-gray-100 hover:bg-gray-200 rounded">
          Home (Minimal)
        </Link>
        
        <Link to="/super" className="block p-2 bg-gray-100 hover:bg-gray-200 rounded">
          Super Minimal
        </Link>
        
        <Link to="/network" className="block p-2 bg-gray-100 hover:bg-gray-200 rounded">
          Network Test
        </Link>
        
        <Link to="/hooks" className="block p-2 bg-gray-100 hover:bg-gray-200 rounded">
          Hook Tests
        </Link>
        
        <Link to="/query" className="block p-2 bg-gray-100 hover:bg-gray-200 rounded">
          React Query Test
        </Link>
        
        <div className="mt-3 pt-3 border-t">
          <button
            onClick={() => {
              // Disable HMR
              if (import.meta.hot) {
                import.meta.hot.dispose(() => {
                  console.log('HMR disabled');
                });
              }
            }}
            className="w-full p-2 bg-orange-500 text-white rounded hover:bg-orange-600 text-sm"
          >
            Disable HMR
          </button>
        </div>
        
        <div className="text-xs text-gray-600 mt-2">
          <p>Tests to run:</p>
          <ul className="list-disc list-inside">
            <li>Check each route for flashing</li>
            <li>Use Network Test to block requests</li>
            <li>Try Hook Tests (especially Timer)</li>
            <li>Check if React Query is polling</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
import { useState } from 'react';
import { TestCoreServices } from './components/TestCoreServices';
import { TestSupabaseConsolidation } from './components/TestSupabaseConsolidation';

function App() {
  const [view, setView] = useState<'basic' | 'services' | 'supabase'>('supabase');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-4 bg-white shadow-sm mb-4">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <h1 className="text-xl font-bold mr-4">DHG Service Test</h1>
          
          <button
            onClick={() => setView('basic')}
            className={`px-4 py-2 rounded ${
              view === 'basic' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Basic UI
          </button>
          
          <button
            onClick={() => setView('services')}
            className={`px-4 py-2 rounded ${
              view === 'services' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Core Services
          </button>
          
          <button
            onClick={() => setView('supabase')}
            className={`px-4 py-2 rounded ${
              view === 'supabase' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Supabase Consolidation
          </button>
        </div>
      </div>
      
      <div className="max-w-6xl mx-auto p-4">
        {view === 'basic' && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">Basic UI Test</h2>
            <p>App is running successfully!</p>
          </div>
        )}
        {view === 'services' && <TestCoreServices />}
        {view === 'supabase' && <TestSupabaseConsolidation />}
      </div>
    </div>
  );
}

export default App;
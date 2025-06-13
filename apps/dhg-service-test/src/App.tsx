import { useState } from 'react';
// Temporarily comment out all components with import issues
// import { ServiceMonitor } from './components/ServiceMonitor';
// import { ServiceTester } from './components/ServiceTester';
// import { ServiceTesterFixed } from './components/ServiceTesterFixed';
// import { ServiceTesterMinimal } from './components/ServiceTesterMinimal';
// import { ServiceTesterIncremental } from './components/ServiceTesterIncremental';
// import { ServiceTesterIncremental2 } from './components/ServiceTesterIncremental2';
// import { ServiceTesterIncremental3 } from './components/ServiceTesterIncremental3';
// import { ServiceTesterIncremental4 } from './components/ServiceTesterIncremental4';
// import { ServiceTesterIncremental5 } from './components/ServiceTesterIncremental5';
// import { ServiceTesterDocClassification } from './components/ServiceTesterDocClassification';
// import { ServiceTesterNewCandidates } from './components/ServiceTesterNewCandidates';
import { Welcome } from './components/Welcome';
import { TestSupabaseAdapter } from './components/TestSupabaseAdapter';
import { TestLogger } from './components/TestLogger';
import { ServiceStatus } from './components/ServiceStatus';
import { TestSupabaseConsolidation } from './components/TestSupabaseConsolidation';

function App() {
  const [view, setView] = useState<'welcome' | 'supabase' | 'logger' | 'status' | 'consolidation'>('consolidation');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-4 bg-white shadow-sm mb-4">
        <div className="max-w-6xl mx-auto flex gap-4">
          <h1 className="text-xl font-bold mr-4">DHG Service Test</h1>
          <button
            onClick={() => setView('welcome')}
            className={`px-4 py-2 rounded ${
              view === 'welcome' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Welcome
          </button>
          <button
            onClick={() => setView('supabase')}
            className={`px-4 py-2 rounded ${
              view === 'supabase' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Supabase Adapter
          </button>
          <button
            onClick={() => setView('logger')}
            className={`px-4 py-2 rounded ${
              view === 'logger' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Logger
          </button>
          <button
            onClick={() => setView('status')}
            className={`px-4 py-2 rounded ${
              view === 'status' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Service Status
          </button>
          <button
            onClick={() => setView('consolidation')}
            className={`px-4 py-2 rounded ${
              view === 'consolidation' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Supabase Consolidation
          </button>
        </div>
      </div>
      
      <div className="max-w-6xl mx-auto p-4">
        {view === 'welcome' && <Welcome />}
        {view === 'supabase' && <TestSupabaseAdapter />}
        {view === 'logger' && <TestLogger />}
        {view === 'status' && <ServiceStatus />}
        {view === 'consolidation' && <TestSupabaseConsolidation />}
      </div>
    </div>
  );
}

export default App;
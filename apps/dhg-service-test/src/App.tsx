import { useState } from 'react';
import { ServiceMonitor } from './components/ServiceMonitor';
// Comment out problematic imports
// import { ServiceTester } from './components/ServiceTester';
// import { ServiceTesterFixed } from './components/ServiceTesterFixed';
import { ServiceTesterMinimal } from './components/ServiceTesterMinimal';
import { ServiceTesterIncremental } from './components/ServiceTesterIncremental';
import { ServiceTesterIncremental2 } from './components/ServiceTesterIncremental2';
import { ServiceTesterIncremental3 } from './components/ServiceTesterIncremental3';
import { ServiceTesterIncremental4 } from './components/ServiceTesterIncremental4';
import { ServiceTesterIncremental5 } from './components/ServiceTesterIncremental5';
import { ServiceTesterDocClassification } from './components/ServiceTesterDocClassification';
import { ServiceTesterNewCandidates } from './components/ServiceTesterNewCandidates';

function App() {
  const [view, setView] = useState<'monitor' | 'minimal' | 'incremental' | 'incremental2' | 'incremental3' | 'incremental4' | 'incremental5' | 'docclass' | 'newcandidates'>('newcandidates');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-4 bg-white shadow-sm mb-4">
        <div className="max-w-6xl mx-auto flex gap-4">
          <button
            onClick={() => setView('monitor')}
            className={`px-4 py-2 rounded ${
              view === 'monitor' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Service Monitor
          </button>
          <button
            onClick={() => setView('minimal')}
            className={`px-4 py-2 rounded ${
              view === 'minimal' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Minimal Tester
          </button>
          <button
            onClick={() => setView('incremental')}
            className={`px-4 py-2 rounded ${
              view === 'incremental' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Incremental 1
          </button>
          <button
            onClick={() => setView('incremental2')}
            className={`px-4 py-2 rounded ${
              view === 'incremental2' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Incremental 2
          </button>
          <button
            onClick={() => setView('incremental3')}
            className={`px-4 py-2 rounded ${
              view === 'incremental3' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Incremental 3
          </button>
          <button
            onClick={() => setView('incremental4')}
            className={`px-4 py-2 rounded ${
              view === 'incremental4' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            ALL SERVICES
          </button>
          <button
            onClick={() => setView('incremental5')}
            className={`px-4 py-2 rounded ${
              view === 'incremental5' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Extra Services
          </button>
          <button
            onClick={() => setView('docclass')}
            className={`px-4 py-2 rounded ${
              view === 'docclass' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Doc Classification Test
          </button>
          <button
            onClick={() => setView('newcandidates')}
            className={`px-4 py-2 rounded ${
              view === 'newcandidates' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            NEW CANDIDATES
          </button>
        </div>
      </div>
      
      {view === 'monitor' ? <ServiceMonitor /> : 
       view === 'minimal' ? <ServiceTesterMinimal /> :
       view === 'incremental' ? <ServiceTesterIncremental /> :
       view === 'incremental2' ? <ServiceTesterIncremental2 /> :
       view === 'incremental3' ? <ServiceTesterIncremental3 /> :
       view === 'incremental4' ? <ServiceTesterIncremental4 /> :
       view === 'incremental5' ? <ServiceTesterIncremental5 /> :
       view === 'docclass' ? <ServiceTesterDocClassification /> :
       <ServiceTesterNewCandidates />}
    </div>
  );
}

export default App;
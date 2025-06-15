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
import { TestSupabaseServices } from './components/TestSupabaseServices';
import { EnvDebug } from './components/EnvDebug';
import { DebugSupabaseAdapter } from './components/DebugSupabaseAdapter';
import { TestClaudeService } from './components/TestClaudeService';
import { ViteEnvFixPage } from './components/ViteEnvFixPage';
import { TestGitOperationsProxy } from './components/TestGitOperationsProxy';
import { TestFileBrowserProxy } from './components/TestFileBrowserProxy';
import { TestContinuousDocsProxy } from './components/TestContinuousDocsProxy';
import { TestAudioStreamingProxy } from './components/TestAudioStreamingProxy';
import { TestHtmlFileBrowserProxy } from './components/TestHtmlFileBrowserProxy';
import { ProxyServerDashboard } from './components/ProxyServerDashboard';
import { CLIPipelineTestRunner } from './components/CLIPipelineTestRunner';

function App() {
  const [view, setView] = useState<'welcome' | 'supabase' | 'logger' | 'status' | 'consolidation' | 'services' | 'claude' | 'env-fix' | 'git-proxy' | 'file-browser' | 'continuous-docs' | 'audio-streaming' | 'html-browser' | 'proxy-dashboard' | 'cli-tests'>('cli-tests');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-4 bg-white shadow-sm mb-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex gap-4 items-center mb-2">
            <h1 className="text-xl font-bold mr-4">DHG Service Test</h1>
            <button
              onClick={() => setView('env-fix')}
              className={`px-4 py-2 rounded font-semibold ${
                view === 'env-fix' 
                  ? 'bg-red-600 text-white animate-pulse' 
                  : 'bg-red-500 text-white hover:bg-red-600'
              }`}
            >
              🚨 Fix Env Issues
            </button>
          </div>
          <div className="flex gap-2 flex-wrap">
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
          <button
            onClick={() => setView('services')}
            className={`px-4 py-2 rounded ${
              view === 'services' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            All Supabase Services
          </button>
          <button
            onClick={() => setView('claude')}
            className={`px-4 py-2 rounded ${
              view === 'claude' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Claude Service
          </button>
          <button
            onClick={() => setView('git-proxy')}
            className={`px-4 py-2 rounded ${
              view === 'git-proxy' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Git Proxy
          </button>
          <button
            onClick={() => setView('file-browser')}
            className={`px-4 py-2 rounded ${
              view === 'file-browser' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            File Browser
          </button>
          <button
            onClick={() => setView('continuous-docs')}
            className={`px-4 py-2 rounded ${
              view === 'continuous-docs' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Continuous Docs
          </button>
          <button
            onClick={() => setView('audio-streaming')}
            className={`px-4 py-2 rounded ${
              view === 'audio-streaming' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Audio Streaming
          </button>
          <button
            onClick={() => setView('html-browser')}
            className={`px-4 py-2 rounded ${
              view === 'html-browser' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            HTML Browser
          </button>
          <button
            onClick={() => setView('proxy-dashboard')}
            className={`px-4 py-2 rounded ${
              view === 'proxy-dashboard' 
                ? 'bg-green-600 text-white' 
                : 'bg-green-200 text-green-700 hover:bg-green-300'
            }`}
          >
            🚀 Proxy Dashboard
          </button>
          <button
            onClick={() => setView('cli-tests')}
            className={`px-4 py-2 rounded ${
              view === 'cli-tests' 
                ? 'bg-purple-600 text-white' 
                : 'bg-purple-200 text-purple-700 hover:bg-purple-300'
            }`}
          >
            🧪 CLI Pipeline Tests
          </button>
          </div>
        </div>
      </div>
      
      <div className="max-w-6xl mx-auto p-4">
        {view !== 'env-fix' && (
          <>
            <EnvDebug />
            <DebugSupabaseAdapter />
          </>
        )}
        {view === 'env-fix' && <ViteEnvFixPage />}
        {view === 'welcome' && <Welcome />}
        {view === 'supabase' && <TestSupabaseAdapter />}
        {view === 'logger' && <TestLogger />}
        {view === 'status' && <ServiceStatus />}
        {view === 'consolidation' && <TestSupabaseConsolidation />}
        {view === 'services' && <TestSupabaseServices />}
        {view === 'claude' && <TestClaudeService />}
        {view === 'git-proxy' && <TestGitOperationsProxy />}
        {view === 'file-browser' && <TestFileBrowserProxy />}
        {view === 'continuous-docs' && <TestContinuousDocsProxy />}
        {view === 'audio-streaming' && <TestAudioStreamingProxy />}
        {view === 'html-browser' && <TestHtmlFileBrowserProxy />}
        {view === 'proxy-dashboard' && <ProxyServerDashboard />}
        {view === 'cli-tests' && <CLIPipelineTestRunner />}
      </div>
    </div>
  );
}

export default App;
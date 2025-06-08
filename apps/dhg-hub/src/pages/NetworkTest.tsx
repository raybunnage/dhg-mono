import { useState, useEffect } from 'react';

// Test component that completely disables all network requests
export function NetworkTest() {
  const [renderCount, setRenderCount] = useState(0);
  const [time, setTime] = useState(new Date().toLocaleTimeString());
  const [networkBlocked, setNetworkBlocked] = useState(false);
  
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  
  useEffect(() => {
    setRenderCount(c => c + 1);
  });
  
  const blockNetwork = () => {
    // Override fetch to block all requests
    window.fetch = () => Promise.reject(new Error('Network blocked for testing'));
    setNetworkBlocked(true);
  };
  
  const restoreNetwork = () => {
    // This would need the original fetch stored somewhere
    window.location.reload();
  };
  
  return (
    <div className="p-8">
      <h1 className="text-2xl mb-4">Network Isolation Test</h1>
      
      <div className="bg-gray-100 p-4 rounded mb-4">
        <p>Render count: {renderCount}</p>
        <p>Time: {time}</p>
        <p>Network: {networkBlocked ? '🔴 BLOCKED' : '🟢 ACTIVE'}</p>
      </div>
      
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold mb-2">Test 1: Block All Network</h2>
          <p className="mb-2">If flashing stops after blocking network, it's a network issue.</p>
          <button
            onClick={blockNetwork}
            disabled={networkBlocked}
            className="bg-red-500 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            Block All Network Requests
          </button>
        </div>
        
        <div>
          <h2 className="text-lg font-bold mb-2">Test 2: Static Content</h2>
          <p className="mb-2">This div has no state, no effects, just static HTML:</p>
          <div className="border-2 border-blue-500 p-4">
            <p>If this area flashes, it's a global/browser issue.</p>
            <p>If only other areas flash, it's component-specific.</p>
          </div>
        </div>
        
        <div>
          <h2 className="text-lg font-bold mb-2">Test 3: Restore</h2>
          <button
            onClick={restoreNetwork}
            className="bg-green-500 text-white px-4 py-2 rounded"
          >
            Reload Page (Restore Network)
          </button>
        </div>
      </div>
    </div>
  );
}
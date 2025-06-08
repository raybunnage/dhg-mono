import { useEffect, useRef, useState } from 'react';

export function StrictModeTest() {
  const [mountCount, setMountCount] = useState(0);
  const [effectCount, setEffectCount] = useState(0);
  const [cleanupCount, setCleanupCount] = useState(0);
  const mountTime = useRef(Date.now());
  
  // Constructor-like behavior
  const instanceId = useRef(Math.random().toString(36).substring(7));
  console.log(`🔨 Component CONSTRUCTED - Instance: ${instanceId.current}`);
  
  // Track mounts
  useEffect(() => {
    const timestamp = Date.now() - mountTime.current;
    console.log(`🟢 useEffect MOUNT - Instance: ${instanceId.current} at ${timestamp}ms`);
    setMountCount(prev => prev + 1);
    setEffectCount(prev => prev + 1);
    
    return () => {
      console.log(`🔴 useEffect CLEANUP - Instance: ${instanceId.current}`);
      setCleanupCount(prev => prev + 1);
    };
  }, []);
  
  // Monitor document changes during mount/unmount cycle
  useEffect(() => {
    console.log(`📸 Document state on mount:`, {
      bodyClasses: document.body.className,
      htmlClasses: document.documentElement.className,
      bodyStyle: document.body.getAttribute('style'),
      htmlStyle: document.documentElement.getAttribute('style'),
    });
    
    // Create a mutation observer to catch any changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        if (mutation.type === 'attributes' && 
            (mutation.target === document.body || mutation.target === document.documentElement)) {
          console.log(`⚡ MUTATION during StrictMode cycle:`, {
            target: mutation.target.tagName,
            attribute: mutation.attributeName,
            oldValue: mutation.oldValue,
            newValue: (mutation.target as HTMLElement).getAttribute(mutation.attributeName!)
          });
        }
      });
    });
    
    observer.observe(document.body, { 
      attributes: true, 
      attributeOldValue: true,
      attributeFilter: ['class', 'style']
    });
    
    observer.observe(document.documentElement, { 
      attributes: true, 
      attributeOldValue: true,
      attributeFilter: ['class', 'style']
    });
    
    return () => {
      observer.disconnect();
    };
  }, []);
  
  const isStrictMode = window.location.search.includes('no-strict') ? false : true;
  
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">StrictMode Double-Mount Test</h1>
        
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Current Mode</h2>
          <div className={`text-2xl font-bold ${isStrictMode ? 'text-orange-600' : 'text-green-600'}`}>
            {isStrictMode ? 'StrictMode ENABLED' : 'StrictMode DISABLED'}
          </div>
          <p className="text-sm text-gray-600 mt-2">
            {isStrictMode 
              ? 'Components will mount → unmount → mount in development'
              : 'Components will mount only once'}
          </p>
          <button
            onClick={() => {
              const newUrl = isStrictMode 
                ? window.location.href + '?no-strict'
                : window.location.href.replace('?no-strict', '');
              window.location.href = newUrl;
            }}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            {isStrictMode ? 'Disable StrictMode' : 'Enable StrictMode'}
          </button>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Mount Statistics</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-gray-600">Mount Count</div>
              <div className="text-2xl font-bold">{mountCount}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Effect Count</div>
              <div className="text-2xl font-bold">{effectCount}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Cleanup Count</div>
              <div className="text-2xl font-bold">{cleanupCount}</div>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">What's Happening?</h2>
          <div className="space-y-4 text-sm">
            <div>
              <h3 className="font-semibold">In StrictMode (Development):</h3>
              <ol className="list-decimal list-inside ml-4 space-y-1">
                <li>Component mounts (constructor + effects run)</li>
                <li>Component immediately unmounts (cleanup runs)</li>
                <li>Component mounts again (constructor + effects run again)</li>
              </ol>
            </div>
            <div>
              <h3 className="font-semibold">This can cause flashing if:</h3>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Theme initialization happens in useEffect</li>
                <li>Global styles are applied/removed during mount/unmount</li>
                <li>DOM mutations occur in cleanup functions</li>
                <li>External libraries initialize on mount</li>
              </ul>
            </div>
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
              <p className="font-semibold">Check the console for mutation logs!</p>
              <p>If you see style/class changes during the mount cycle, that's likely causing the flash.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
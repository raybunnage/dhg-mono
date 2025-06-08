import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';

// Component to test which hooks might be causing issues
export function HookTest() {
  const [testMode, setTestMode] = useState('none');
  const [log, setLog] = useState<string[]>([]);
  const renderRef = useRef(0);
  
  renderRef.current++;
  
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLog(prev => [...prev.slice(-20), `${timestamp} - ${message}`]);
  };
  
  // Test 1: useState only
  const StateOnlyTest = () => {
    const [count, setCount] = useState(0);
    addLog(`StateOnlyTest render #${renderRef.current}`);
    
    return (
      <div className="p-4 border rounded">
        <h3 className="font-bold">useState Only</h3>
        <p>Count: {count}</p>
        <button onClick={() => setCount(c => c + 1)} className="bg-blue-500 text-white px-2 py-1 rounded">
          Increment
        </button>
      </div>
    );
  };
  
  // Test 2: useEffect with dependencies
  const EffectTest = () => {
    const [count, setCount] = useState(0);
    
    useEffect(() => {
      addLog('EffectTest: useEffect fired');
      return () => addLog('EffectTest: cleanup');
    }, [count]);
    
    return (
      <div className="p-4 border rounded">
        <h3 className="font-bold">useEffect Test</h3>
        <p>Count: {count}</p>
        <button onClick={() => setCount(c => c + 1)} className="bg-blue-500 text-white px-2 py-1 rounded">
          Increment
        </button>
      </div>
    );
  };
  
  // Test 3: useLayoutEffect
  const LayoutEffectTest = () => {
    const [count, setCount] = useState(0);
    
    useLayoutEffect(() => {
      addLog('LayoutEffectTest: useLayoutEffect fired (sync)');
      return () => addLog('LayoutEffectTest: cleanup');
    });
    
    return (
      <div className="p-4 border rounded">
        <h3 className="font-bold">useLayoutEffect Test</h3>
        <p>If this flashes, useLayoutEffect might be the issue</p>
      </div>
    );
  };
  
  // Test 4: Timer in useEffect
  const TimerTest = () => {
    const [time, setTime] = useState(Date.now());
    
    useEffect(() => {
      addLog('TimerTest: Starting timer');
      const timer = setInterval(() => {
        setTime(Date.now());
        addLog('TimerTest: Timer tick');
      }, 2000); // 2 second interval matching the issue
      
      return () => {
        addLog('TimerTest: Clearing timer');
        clearInterval(timer);
      };
    }, []);
    
    return (
      <div className="p-4 border rounded">
        <h3 className="font-bold">2-Second Timer Test</h3>
        <p>Time: {new Date(time).toLocaleTimeString()}</p>
        <p className="text-red-600">If this causes flashing, timers are the issue!</p>
      </div>
    );
  };
  
  // Test 5: External dependencies
  const ExternalTest = () => {
    useEffect(() => {
      addLog('ExternalTest: Checking window events');
      
      const handleResize = () => addLog('Window resize');
      const handleFocus = () => addLog('Window focus');
      const handleBlur = () => addLog('Window blur');
      
      window.addEventListener('resize', handleResize);
      window.addEventListener('focus', handleFocus);
      window.addEventListener('blur', handleBlur);
      
      return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('focus', handleFocus);
        window.removeEventListener('blur', handleBlur);
      };
    }, []);
    
    return (
      <div className="p-4 border rounded">
        <h3 className="font-bold">External Events Test</h3>
        <p>Monitoring window events</p>
      </div>
    );
  };
  
  const tests = {
    none: null,
    state: StateOnlyTest,
    effect: EffectTest,
    layout: LayoutEffectTest,
    timer: TimerTest,
    external: ExternalTest,
  };
  
  const TestComponent = tests[testMode as keyof typeof tests];
  
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">React Hook Isolation Tests</h1>
      
      <div className="mb-6 space-x-2">
        {Object.keys(tests).map(mode => (
          <button
            key={mode}
            onClick={() => {
              setTestMode(mode);
              addLog(`Switched to ${mode} test`);
            }}
            className={`px-4 py-2 rounded ${
              testMode === mode ? 'bg-blue-600 text-white' : 'bg-gray-200'
            }`}
          >
            {mode.charAt(0).toUpperCase() + mode.slice(1)}
          </button>
        ))}
      </div>
      
      <div className="mb-6">
        {TestComponent && <TestComponent />}
      </div>
      
      <div className="bg-black text-green-400 p-4 rounded font-mono text-sm max-h-64 overflow-y-auto">
        <h3 className="text-yellow-400 mb-2">Event Log:</h3>
        {log.map((entry, i) => (
          <div key={i}>{entry}</div>
        ))}
      </div>
      
      <div className="mt-4 p-4 bg-yellow-100 rounded">
        <h3 className="font-bold">Instructions:</h3>
        <ul className="list-disc list-inside space-y-1">
          <li>Test each mode and watch for flashing</li>
          <li>Check the log for patterns every ~2 seconds</li>
          <li>Timer test specifically uses 2-second interval</li>
          <li>If only certain tests flash, we've found the culprit</li>
        </ul>
      </div>
    </div>
  );
}
import { useState, useEffect } from 'react';

let renderCount = 0;

export function HomeMinimal() {
  renderCount++;
  console.log(`🔄 HOME MINIMAL RENDER #${renderCount} at ${new Date().toLocaleTimeString()}`);
  
  const [count, setCount] = useState(0);
  
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl mb-4">Minimal Home Component</h1>
      <p>Render count: {renderCount}</p>
      <p>State count: {count}</p>
      <button 
        onClick={() => setCount(c => c + 1)}
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        Increment
      </button>
      <div className="mt-4 p-4 bg-gray-100 rounded">
        <p>If this component doesn't flash, the issue is in the Home component logic.</p>
        <p>Time: {new Date().toLocaleTimeString()}</p>
      </div>
    </div>
  );
}
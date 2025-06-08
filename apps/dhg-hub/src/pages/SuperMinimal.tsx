import { useState } from 'react';

let renderCount = 0;

export function SuperMinimal() {
  renderCount++;
  console.log(`🟢 SUPER MINIMAL RENDER #${renderCount} at ${new Date().toLocaleTimeString()}`);
  
  const [count, setCount] = useState(0);
  
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h1>Super Minimal Component</h1>
      <p>Render: {renderCount}</p>
      <p>State: {count}</p>
      <button onClick={() => setCount(c => c + 1)}>+1</button>
      <p>If this flashes, the issue is global (React/browser level)</p>
      <p>Time: {new Date().toLocaleTimeString()}</p>
    </div>
  );
}
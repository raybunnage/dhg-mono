import { useEffect, useRef, useState } from 'react';

// Global debug state
interface DebugEvent {
  timestamp: number;
  type: string;
  details: any;
  stack?: string;
}

class DebugMonitor {
  private events: DebugEvent[] = [];
  private listeners: ((events: DebugEvent[]) => void)[] = [];
  private originalFetch: typeof fetch;
  private networkRequests = 0;
  private renderCycles = new Map<string, number>();
  
  constructor() {
    // Intercept fetch to monitor network requests
    this.originalFetch = window.fetch;
    window.fetch = this.interceptedFetch.bind(this);
    
    // Monitor DOM mutations
    if (typeof MutationObserver !== 'undefined') {
      const observer = new MutationObserver((mutations) => {
        this.addEvent({
          type: 'DOM_MUTATION',
          details: {
            count: mutations.length,
            types: mutations.map(m => m.type)
          }
        });
      });
      
      // Start observing after a delay to avoid initial render
      setTimeout(() => {
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          characterData: true
        });
      }, 1000);
    }
  }
  
  private interceptedFetch(...args: Parameters<typeof fetch>) {
    this.networkRequests++;
    const url = args[0].toString();
    
    this.addEvent({
      type: 'NETWORK_REQUEST',
      details: {
        url,
        method: args[1]?.method || 'GET',
        requestNumber: this.networkRequests
      }
    });
    
    return this.originalFetch(...args);
  }
  
  addEvent(event: Omit<DebugEvent, 'timestamp'>) {
    const fullEvent: DebugEvent = {
      ...event,
      timestamp: Date.now(),
      stack: new Error().stack
    };
    
    this.events.push(fullEvent);
    if (this.events.length > 100) {
      this.events.shift(); // Keep only last 100 events
    }
    
    this.notifyListeners();
  }
  
  trackRender(componentName: string) {
    const count = (this.renderCycles.get(componentName) || 0) + 1;
    this.renderCycles.set(componentName, count);
    
    this.addEvent({
      type: 'COMPONENT_RENDER',
      details: {
        component: componentName,
        renderCount: count
      }
    });
  }
  
  subscribe(callback: (events: DebugEvent[]) => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }
  
  private notifyListeners() {
    this.listeners.forEach(l => l(this.events));
  }
  
  getEvents() {
    return this.events;
  }
  
  getRenderStats() {
    return Array.from(this.renderCycles.entries());
  }
}

// Create global instance
if (typeof window !== 'undefined' && !window.debugMonitor) {
  window.debugMonitor = new DebugMonitor();
}

declare global {
  interface Window {
    debugMonitor?: DebugMonitor;
  }
}

// Hook to track component renders
export function useDebugRender(componentName: string) {
  useEffect(() => {
    window.debugMonitor?.trackRender(componentName);
  });
}

// Main debug panel component
export function DebugSystem() {
  const [events, setEvents] = useState<DebugEvent[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isPaused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  
  useEffect(() => {
    pausedRef.current = isPaused;
  }, [isPaused]);
  
  useEffect(() => {
    const unsubscribe = window.debugMonitor?.subscribe((newEvents) => {
      if (!pausedRef.current) {
        setEvents([...newEvents]);
      }
    });
    
    return () => unsubscribe?.();
  }, []);
  
  // Group events by type
  const eventCounts = events.reduce((acc, event) => {
    acc[event.type] = (acc[event.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  // Find patterns
  const recentEvents = events.slice(-20);
  const pattern = detectPattern(recentEvents);
  
  return (
    <div className="fixed bottom-4 left-4 bg-black text-white p-4 rounded-lg shadow-xl z-50 max-w-md font-mono text-xs">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-yellow-300 font-bold">🔍 Debug Monitor</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setPaused(!isPaused)}
            className={`px-2 py-1 rounded ${isPaused ? 'bg-red-600' : 'bg-green-600'}`}
          >
            {isPaused ? 'PAUSED' : 'LIVE'}
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-white hover:text-yellow-300"
          >
            {isExpanded ? '−' : '+'}
          </button>
        </div>
      </div>
      
      {isExpanded && (
        <>
          <div className="mb-2 p-2 bg-gray-800 rounded">
            <div className="text-yellow-300 mb-1">Event Summary:</div>
            {Object.entries(eventCounts).map(([type, count]) => (
              <div key={type} className="flex justify-between">
                <span>{type}:</span>
                <span className={count > 10 ? 'text-red-400' : ''}>{count}</span>
              </div>
            ))}
          </div>
          
          {pattern && (
            <div className="mb-2 p-2 bg-red-900 rounded">
              <div className="text-yellow-300">⚠️ Pattern Detected:</div>
              <div>{pattern}</div>
            </div>
          )}
          
          <div className="mb-2 p-2 bg-gray-800 rounded">
            <div className="text-yellow-300 mb-1">Render Stats:</div>
            {window.debugMonitor?.getRenderStats().map(([comp, count]) => (
              <div key={comp} className="flex justify-between">
                <span>{comp}:</span>
                <span className={count > 5 ? 'text-red-400' : ''}>{count}</span>
              </div>
            ))}
          </div>
          
          <div className="max-h-40 overflow-y-auto bg-gray-900 p-2 rounded">
            <div className="text-yellow-300 mb-1">Recent Events:</div>
            {recentEvents.reverse().map((event, i) => (
              <div key={i} className="mb-1 text-xs">
                <span className="text-gray-400">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </span>
                {' '}
                <span className={getEventColor(event.type)}>
                  {event.type}
                </span>
                {event.details.url && (
                  <span className="text-gray-500 ml-1">
                    {event.details.url.substring(0, 30)}...
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function detectPattern(events: DebugEvent[]): string | null {
  if (events.length < 5) return null;
  
  // Check for repeating sequences
  const types = events.map(e => e.type);
  
  // Check for 2-second pattern
  const timeDiffs = events.slice(1).map((e, i) => e.timestamp - events[i].timestamp);
  const avgDiff = timeDiffs.reduce((a, b) => a + b, 0) / timeDiffs.length;
  
  if (avgDiff > 1800 && avgDiff < 2200) {
    return `Events repeating every ~${Math.round(avgDiff)}ms (2 second cycle)`;
  }
  
  // Check for render loops
  const renderEvents = events.filter(e => e.type === 'COMPONENT_RENDER');
  if (renderEvents.length > events.length * 0.7) {
    return 'Excessive component renders detected';
  }
  
  // Check for network loops
  const networkEvents = events.filter(e => e.type === 'NETWORK_REQUEST');
  if (networkEvents.length > 5) {
    const urls = networkEvents.map(e => e.details.url);
    const uniqueUrls = new Set(urls);
    if (uniqueUrls.size === 1) {
      return `Repeated requests to: ${urls[0]}`;
    }
  }
  
  return null;
}

function getEventColor(type: string): string {
  switch (type) {
    case 'NETWORK_REQUEST': return 'text-blue-400';
    case 'COMPONENT_RENDER': return 'text-green-400';
    case 'DOM_MUTATION': return 'text-purple-400';
    default: return 'text-gray-400';
  }
}
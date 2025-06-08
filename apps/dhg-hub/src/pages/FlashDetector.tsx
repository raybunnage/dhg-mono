import { useEffect, useState, useRef } from 'react';

interface FlashEvent {
  timestamp: number;
  type: string;
  details: string;
  element?: string;
  stackTrace?: string;
}

export function FlashDetector() {
  const [events, setEvents] = useState<FlashEvent[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(true);
  const startTime = useRef(Date.now());
  
  const addEvent = (type: string, details: string, element?: string) => {
    const event: FlashEvent = {
      timestamp: Date.now() - startTime.current,
      type,
      details,
      element,
      stackTrace: new Error().stack
    };
    
    console.log(`🔍 Flash Detector: ${type} - ${details}`);
    setEvents(prev => [...prev, event]);
  };
  
  useEffect(() => {
    if (!isMonitoring) return;
    
    // 1. Monitor DOM mutations
    const mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        if (mutation.type === 'attributes') {
          const target = mutation.target as HTMLElement;
          const tagName = target.tagName.toLowerCase();
          
          if (mutation.attributeName === 'style' || mutation.attributeName === 'class') {
            if (tagName === 'body' || tagName === 'html') {
              addEvent('DOM_MUTATION', `${mutation.attributeName} changed on ${tagName}`, tagName);
            }
          }
        }
      });
    });
    
    mutationObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style', 'class'],
      subtree: true
    });
    
    // 2. Monitor CSS transitions
    const transitionHandler = (e: TransitionEvent) => {
      const target = e.target as HTMLElement;
      if (target === document.body || target === document.documentElement) {
        addEvent('CSS_TRANSITION', `${e.propertyName} transition on ${target.tagName}`, target.tagName);
      }
    };
    
    document.addEventListener('transitionstart', transitionHandler, true);
    document.addEventListener('transitionend', transitionHandler, true);
    
    // 3. Monitor theme changes
    const originalSetAttribute = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function(name: string, value: string) {
      if (this === document.documentElement && (name === 'class' || name === 'data-theme')) {
        addEvent('THEME_CHANGE', `setAttribute(${name}, ${value})`, 'html');
      }
      return originalSetAttribute.call(this, name, value);
    };
    
    // 4. Monitor localStorage changes
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key: string, value: string) {
      if (key.includes('theme') || key.includes('color') || key.includes('mode')) {
        addEvent('STORAGE_CHANGE', `localStorage.setItem(${key}, ${value})`);
      }
      return originalSetItem.call(this, key, value);
    };
    
    // 5. Monitor style.backgroundColor changes
    const bodyStyle = document.body.style;
    const htmlStyle = document.documentElement.style;
    
    const createStyleProxy = (target: CSSStyleDeclaration, elementName: string) => {
      return new Proxy(target, {
        set(obj, prop, value) {
          if (prop === 'backgroundColor' || prop === 'background') {
            addEvent('STYLE_CHANGE', `${elementName}.style.${String(prop)} = ${value}`, elementName);
          }
          return Reflect.set(obj, prop, value);
        }
      });
    };
    
    Object.defineProperty(document.body, 'style', {
      get() { return createStyleProxy(bodyStyle, 'body'); },
      configurable: true
    });
    
    Object.defineProperty(document.documentElement, 'style', {
      get() { return createStyleProxy(htmlStyle, 'html'); },
      configurable: true
    });
    
    // 6. Monitor classList changes
    const originalAdd = DOMTokenList.prototype.add;
    const originalRemove = DOMTokenList.prototype.remove;
    const originalToggle = DOMTokenList.prototype.toggle;
    
    DOMTokenList.prototype.add = function(...tokens: string[]) {
      const element = (this as any).element || this;
      if (element === document.body.classList || element === document.documentElement.classList) {
        addEvent('CLASSLIST_CHANGE', `classList.add(${tokens.join(', ')})`, element === document.body.classList ? 'body' : 'html');
      }
      return originalAdd.apply(this, tokens);
    };
    
    DOMTokenList.prototype.remove = function(...tokens: string[]) {
      const element = (this as any).element || this;
      if (element === document.body.classList || element === document.documentElement.classList) {
        addEvent('CLASSLIST_CHANGE', `classList.remove(${tokens.join(', ')})`, element === document.body.classList ? 'body' : 'html');
      }
      return originalRemove.apply(this, tokens);
    };
    
    DOMTokenList.prototype.toggle = function(token: string, force?: boolean) {
      const element = (this as any).element || this;
      if (element === document.body.classList || element === document.documentElement.classList) {
        addEvent('CLASSLIST_CHANGE', `classList.toggle(${token}, ${force})`, element === document.body.classList ? 'body' : 'html');
      }
      return originalToggle.call(this, token, force);
    };
    
    // Initial state capture
    addEvent('INITIAL_STATE', `body classes: ${document.body.className}, html classes: ${document.documentElement.className}`);
    addEvent('INITIAL_STATE', `body style: ${document.body.getAttribute('style') || 'none'}, html style: ${document.documentElement.getAttribute('style') || 'none'}`);
    
    return () => {
      mutationObserver.disconnect();
      document.removeEventListener('transitionstart', transitionHandler, true);
      document.removeEventListener('transitionend', transitionHandler, true);
      // Restore original methods
      Element.prototype.setAttribute = originalSetAttribute;
      Storage.prototype.setItem = originalSetItem;
      DOMTokenList.prototype.add = originalAdd;
      DOMTokenList.prototype.remove = originalRemove;
      DOMTokenList.prototype.toggle = originalToggle;
    };
  }, [isMonitoring]);
  
  const suspiciousEvents = events.filter(e => 
    e.type === 'DOM_MUTATION' || 
    e.type === 'THEME_CHANGE' || 
    e.type === 'STYLE_CHANGE' ||
    e.type === 'CLASSLIST_CHANGE'
  );
  
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Flash Detector - Comprehensive Monitoring</h1>
        
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Monitoring Status</h2>
            <button
              onClick={() => setIsMonitoring(!isMonitoring)}
              className={`px-4 py-2 rounded ${isMonitoring ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}
            >
              {isMonitoring ? 'Stop Monitoring' : 'Start Monitoring'}
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-600">Total Events</div>
              <div className="text-2xl font-bold">{events.length}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Suspicious Events</div>
              <div className="text-2xl font-bold text-red-600">{suspiciousEvents.length}</div>
            </div>
          </div>
        </div>
        
        {/* Suspicious Events */}
        {suspiciousEvents.length > 0 && (
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-red-800 mb-4">⚠️ Suspicious Events (Likely Flash Causes)</h2>
            <div className="space-y-2">
              {suspiciousEvents.map((event, i) => (
                <div key={i} className="bg-white p-3 rounded border border-red-200">
                  <div className="font-mono text-sm">
                    <span className="text-red-600">[{event.timestamp}ms]</span> {event.type}: {event.details}
                  </div>
                  {event.stackTrace && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-gray-600">Stack trace</summary>
                      <pre className="text-xs mt-1 overflow-x-auto">{event.stackTrace}</pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* All Events Timeline */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">All Events Timeline</h2>
          <div className="space-y-1 font-mono text-sm max-h-96 overflow-y-auto">
            {events.map((event, i) => (
              <div 
                key={i} 
                className={`py-1 ${suspiciousEvents.includes(event) ? 'text-red-600 font-bold' : ''}`}
              >
                [{event.timestamp}ms] {event.type}: {event.details}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
# Lazy Initialization Pattern Example

This document demonstrates how to implement lazy initialization to improve startup performance.

## Problem: Early Service Initialization

Services that export singleton instances directly initialize at module load time:

```typescript
// ❌ BAD: Initializes immediately when any file imports this module
export const serverRegistry = ServerRegistryService.getInstance();
```

## Solution: Lazy Initialization

### Option 1: Export a getter function

```typescript
// ✅ GOOD: Only initializes when the function is called
let _serverRegistryInstance: ServerRegistryService | null = null;

export const getServerRegistry = (): ServerRegistryService => {
  if (!_serverRegistryInstance) {
    _serverRegistryInstance = ServerRegistryService.getInstance();
  }
  return _serverRegistryInstance;
};

// Usage in components:
const registry = getServerRegistry(); // Initialization happens here
```

### Option 2: Lazy initialization in components

```typescript
// In your React component
import { ServerRegistryService } from '@shared/services/server-registry-service';

function MyComponent() {
  const [registry, setRegistry] = useState<ServerRegistryService | null>(null);
  
  useEffect(() => {
    // Initialize only when component mounts
    const instance = ServerRegistryService.getInstance();
    setRegistry(instance);
    
    // Cleanup if needed
    return () => {
      instance.stopHealthMonitoring();
    };
  }, []);
  
  // Use registry...
}
```

### Option 3: React Context for shared instances

```typescript
// Create a context provider
const ServerRegistryContext = React.createContext<ServerRegistryService | null>(null);

export function ServerRegistryProvider({ children }: { children: React.ReactNode }) {
  const [registry] = useState(() => ServerRegistryService.getInstance());
  
  return (
    <ServerRegistryContext.Provider value={registry}>
      {children}
    </ServerRegistryContext.Provider>
  );
}

// Use in components
function MyComponent() {
  const registry = useContext(ServerRegistryContext);
  // Use registry...
}
```

## Migration Strategy

1. **Keep backward compatibility**: Leave the old export in place but mark as deprecated
2. **Add new lazy pattern**: Export the getter function alongside
3. **Update imports gradually**: Change imports one at a time
4. **Test thoroughly**: Ensure services still work after changes

## Benefits

1. **Faster startup**: Services only initialize when actually used
2. **Better debugging**: Console logs show exact initialization order
3. **Memory efficiency**: Unused services never get created
4. **Flexibility**: Can add initialization parameters later

## Example Migration

```typescript
// Before (immediate initialization)
import { serverRegistry } from '@shared/services/server-registry-service';

async function fetchData() {
  const url = await serverRegistry.getServerUrl('api-server');
  // ...
}

// After (lazy initialization)
import { getServerRegistry } from '@shared/services/server-registry-service';

async function fetchData() {
  const registry = getServerRegistry();
  const url = await registry.getServerUrl('api-server');
  // ...
}
```

## Verification

With the logging added, you can now see the initialization order in the console:

```
[SupabaseAdapter] Creating adapter at 2025-01-06T12:00:00.000Z Browser: true
[BrowserAuthService] Initializing at 2025-01-06T12:00:00.100Z
[ServerRegistryService] Initializing at 2025-01-06T12:00:00.200Z
```

This helps identify which services are initializing too early and in what order.
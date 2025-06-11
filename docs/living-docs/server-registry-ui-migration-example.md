# Server Registry UI Migration Example

This document shows how to migrate UI components from hardcoded ports to the dynamic server registry system.

## Example: Migrating AIPage.tsx

### Before (Hardcoded):
```typescript
// AIPage.tsx - OLD VERSION
const runCLICommand = async (command: string, docId?: string) => {
  try {
    const response = await fetch(`http://localhost:3008/api/cli-command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, docId })
    });
    // ... rest of function
  } catch (error) {
    console.error('Failed to run CLI command:', error);
  }
};
```

### After (Dynamic with Connection Status):
```typescript
// AIPage.tsx - NEW VERSION
import { serverRegistry } from '@shared/services/server-registry-service';
import { ServerConnectionStatus } from '@shared/components/ServerConnectionStatus';

export function AIPage() {
  const [serverUrls, setServerUrls] = useState({
    continuousDocs: '',
    gitApi: ''
  });
  const [serversReady, setServersReady] = useState(false);

  useEffect(() => {
    loadServerUrls();
  }, []);

  const loadServerUrls = async () => {
    try {
      const urls = {
        continuousDocs: await serverRegistry.getServerUrl('continuous-docs-server'),
        gitApi: await serverRegistry.getServerUrl('git-api-server')
      };
      setServerUrls(urls);
      
      // Check if servers are connected
      const docsConnected = await serverRegistry.isServerConnected('continuous-docs-server');
      const gitConnected = await serverRegistry.isServerConnected('git-api-server');
      setServersReady(docsConnected && gitConnected);
    } catch (error) {
      console.error('Failed to load server URLs:', error);
    }
  };

  const runCLICommand = async (command: string, docId?: string) => {
    if (!serverUrls.continuousDocs) {
      toast.error('Continuous docs server not available');
      return;
    }

    try {
      const response = await fetch(`${serverUrls.continuousDocs}/api/cli-command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, docId })
      });
      
      if (!response.ok) {
        // Check if server is still connected
        const isConnected = await serverRegistry.isServerConnected('continuous-docs-server');
        if (!isConnected) {
          toast.error('Lost connection to continuous docs server');
          loadServerUrls(); // Try to reconnect
        }
      }
      // ... rest of function
    } catch (error) {
      console.error('Failed to run CLI command:', error);
      toast.error('Failed to connect to server. Please run: pnpm servers');
    }
  };

  return (
    <div className="p-6">
      {/* Server Status Panel */}
      <div className="mb-4">
        <ServerConnectionStatus 
          serviceName="continuous-docs-server" 
          displayName="Continuous Docs Server"
          showDetails={true}
        />
        <ServerConnectionStatus 
          serviceName="git-api-server" 
          displayName="Git API Server"
          showDetails={true}
        />
      </div>

      {/* Warning if servers not ready */}
      {!serversReady && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                Server Connection Required
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>Some features require backend servers to be running.</p>
                <p className="mt-1">Run <code className="bg-yellow-100 px-1 py-0.5 rounded">pnpm servers</code> to start all servers.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rest of your page content */}
    </div>
  );
}
```

## Complete Migration Pattern

### 1. Import Required Dependencies
```typescript
import { serverRegistry } from '@shared/services/server-registry-service';
import { ServerConnectionStatus, MultiServerStatus } from '@shared/components/ServerConnectionStatus';
import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast'; // or your toast library
```

### 2. Add State for Server URLs and Status
```typescript
const [serverUrls, setServerUrls] = useState<Record<string, string>>({});
const [serverStatus, setServerStatus] = useState<Record<string, boolean>>({});
```

### 3. Load Server URLs on Mount
```typescript
useEffect(() => {
  const loadServers = async () => {
    const services = ['git-server', 'continuous-docs-server', 'md-server'];
    const urls: Record<string, string> = {};
    const status: Record<string, boolean> = {};
    
    for (const service of services) {
      urls[service] = await serverRegistry.getServerUrl(service);
      status[service] = await serverRegistry.isServerConnected(service);
    }
    
    setServerUrls(urls);
    setServerStatus(status);
  };
  
  loadServers();
}, []);
```

### 4. Update Fetch Calls
```typescript
// Replace hardcoded URLs
const response = await fetch(`${serverUrls['git-server']}/api/git/branches`);

// Add error handling for disconnected servers
if (!serverStatus['git-server']) {
  toast.error('Git server is not connected');
  return;
}
```

### 5. Add Visual Connection Status
```typescript
// Single server status
<ServerConnectionStatus 
  serviceName="git-server" 
  displayName="Git Server"
  className="mb-2"
/>

// Multiple servers in a panel
<MultiServerStatus 
  services={[
    { name: 'git-server', displayName: 'Git Server' },
    { name: 'continuous-docs-server', displayName: 'Docs Server' },
    { name: 'md-server', displayName: 'Markdown Server' }
  ]}
  title="Required Services"
  className="mb-4"
/>
```

## Benefits of This Approach

1. **No Hardcoded Ports**: Servers can run on any available port
2. **Visual Feedback**: Users see which servers are connected
3. **Better Error Messages**: Clear guidance when servers are down
4. **Auto-Recovery**: Can detect and handle reconnections
5. **Environment Flexibility**: Different ports for dev/staging/prod

## Migration Checklist

- [ ] Import server registry service
- [ ] Import connection status components
- [ ] Add state for server URLs
- [ ] Load URLs on component mount
- [ ] Replace all hardcoded localhost URLs
- [ ] Add connection status UI
- [ ] Add error handling for disconnected servers
- [ ] Test with servers on different ports
- [ ] Test with servers stopped
- [ ] Verify reconnection works
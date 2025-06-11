# Server Health Monitoring System

## Overview

The dhg-admin-code app now uses a dynamic server registry system with integrated health monitoring. This replaces all hardcoded server URLs with runtime discovery and provides real-time server status indicators.

## Key Components

### 1. ServerRegistryService (`@shared/services/server-registry-service`)
- Singleton service that manages server discovery
- Fetches server configurations from `sys_server_ports_registry` table
- Provides health monitoring with configurable intervals
- Caches server information for performance

### 2. ServerStatusIndicator Component
- Visual indicator showing server connection status
- Green checkmark = connected, Red alert = offline
- Shows spinning loader while checking status

### 3. useServerConnection Hook
- React hook for easy server connection management
- Returns `{ isConnected, url, loading }` for any service
- Automatically subscribes to health status changes

### 4. ServerHealthMonitor Component
- Dashboard widget showing all server statuses
- Grid view with connection indicators
- Updates every 30 seconds

## Implementation

### Basic Usage

```typescript
// In a React component
import { ServerStatusIndicator } from '../components/ServerStatusIndicator';

// Show server status with label
<ServerStatusIndicator serviceName="git-server" />

// Show just the icon
<ServerStatusIndicator serviceName="git-server" showLabel={false} />
```

### Using the Hook

```typescript
import { useServerConnection } from '../hooks/useServerConnection';

function MyComponent() {
  const { isConnected, url, loading } = useServerConnection('git-server');
  
  if (!isConnected) {
    return <div>Server is offline</div>;
  }
  
  // Use the dynamic URL
  const response = await fetch(`${url}/api/endpoint`);
}
```

### Direct Service Usage

```typescript
import { serverRegistry } from '@shared/services/server-registry-service';

// Get server URL
const url = await serverRegistry.getServerUrl('git-server');

// Check if connected
const isConnected = await serverRegistry.isServerConnected('git-server');

// Subscribe to changes
const unsubscribe = serverRegistry.onConnectionChange('git-server', (status) => {
  console.log('Server is', status ? 'connected' : 'offline');
});
```

## Server Configuration

Servers are configured in the `sys_server_ports_registry` table:

| Service Name | Port | Display Name | Health Check |
|--------------|------|--------------|--------------|
| md-server | 3001 | Markdown Server | /health |
| git-server | 3005 | Git Server | /health |
| web-google-drive-audio | 3006 | Web Google Drive Audio | /health |
| local-google-drive-audio | 3007 | Local Google Drive Audio | /health |
| living-docs-server | 3008 | Living Docs Server | /health |
| git-api-server | 3009 | Git API Server | /health |

## Migration from Hardcoded URLs

All hardcoded server URLs have been replaced:

| Old | New |
|-----|-----|
| `http://localhost:3001/api/...` | `${await serverRegistry.getServerUrl('md-server')}/api/...` |
| `http://localhost:3005/api/...` | `${await serverRegistry.getServerUrl('git-server')}/api/...` |
| `http://localhost:3008/api/...` | `${await serverRegistry.getServerUrl('living-docs-server')}/api/...` |
| `http://localhost:3009/api/...` | `${await serverRegistry.getServerUrl('git-api-server')}/api/...` |

## Health Check Implementation

All servers must implement a `/health` endpoint:

```javascript
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    service: 'service-name',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});
```

## Benefits

1. **Dynamic Port Discovery** - No more hardcoded ports
2. **Real-time Health Monitoring** - Know when servers are down
3. **Better User Experience** - Visual indicators of server status
4. **Easier Deployment** - Ports can be changed in database
5. **Fallback Support** - Graceful degradation when registry unavailable

## Troubleshooting

### Server Shows as Offline
1. Check if server is running: `pnpm servers`
2. Verify health endpoint: `curl http://localhost:PORT/health`
3. Check database entry: `SELECT * FROM sys_server_ports_registry WHERE service_name = 'SERVICE_NAME'`

### Registry Not Loading
1. Check Supabase connection
2. Verify RLS policies on `sys_server_ports_registry`
3. Check browser console for errors

### Health Checks Failing
1. Ensure server implements `/health` endpoint
2. Check `health_check_enabled` in database
3. Verify no CORS issues
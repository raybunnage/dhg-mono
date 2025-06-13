# Proxy Servers Infrastructure

Standardized proxy server infrastructure for the DHG monorepo.

## Overview

This package provides:
- **Base classes** for creating consistent proxy servers
- **Registry** for managing all proxy servers
- **Manager** for controlling proxy lifecycle
- **Pre-built proxies** for common needs

## Architecture

```
packages/proxy-servers/
├── base/                    # Core infrastructure
│   ├── ProxyServerBase.ts   # Base class all proxies extend
│   ├── ProxyRegistry.ts     # Central registry of all proxies
│   └── ProxyManager.ts      # Lifecycle management
├── servers/                 # Proxy implementations
│   ├── vite-fix-proxy/      # Vite environment fixes
│   ├── proxy-manager/       # Controls other proxies
│   └── continuous-monitoring/ # System health monitoring
└── types/                   # TypeScript types
```

## Creating a New Proxy Server

```typescript
import { ProxyServerBase } from '@shared/proxy-servers';

export class MyProxy extends ProxyServerBase {
  constructor() {
    super({
      name: 'my-proxy',
      port: 9890  // Check CLAUDE.md for available ports
    });
  }

  protected getServiceDescription(): string {
    return 'My custom proxy server';
  }

  protected setupRoutes(): void {
    this.app.get('/my-endpoint', (req, res) => {
      res.json({ message: 'Hello from MyProxy!' });
    });
  }
}
```

## Using Proxy Servers

### Individual Proxy

```typescript
import { ViteFixProxy } from '@shared/proxy-servers';

const proxy = new ViteFixProxy();
await proxy.start();

// Later...
await proxy.stop();
```

### With Registry

```typescript
import { ProxyRegistry, ViteFixProxy } from '@shared/proxy-servers';

const registry = ProxyRegistry.getInstance();
const proxy = new ViteFixProxy();

registry.register(proxy, 'infrastructure');
await proxy.start();

// Get status of all proxies
const status = registry.getStatus();
```

### With Manager

```typescript
import { ProxyManager } from '@shared/proxy-servers';

const manager = new ProxyManager();

// Start/stop individual proxies
await manager.startProxy('vite-fix-proxy');
await manager.stopProxy('vite-fix-proxy');

// Batch operations
await manager.startAll();
await manager.stopCategory('development');
```

## Available Proxies

### ViteFixProxy (Port 9876)
Fixes Vite environment variable loading issues.

**Endpoints:**
- `POST /fix` - Execute fix commands
- `GET /apps` - List available apps
- `GET /apps/:appName` - Check specific app

### ProxyManagerProxy (Port 9878)
Controls other proxy servers.

**Endpoints:**
- `GET /proxies` - List all proxies and status
- `POST /proxies/:name/start` - Start a proxy
- `POST /proxies/:name/stop` - Stop a proxy
- `GET /dashboard` - Web UI for management

### ContinuousMonitoringProxy (Port 9877)
Monitors system health and performance.

**Endpoints:**
- `GET /metrics` - Current system metrics
- `GET /metrics/history` - Historical data
- `GET /alerts` - Active system alerts
- `GET /dashboard` - Monitoring dashboard

## Common Features

All proxy servers include:
- Health check endpoint (`GET /health`)
- Server info endpoint (`GET /info`)
- Graceful shutdown support
- CORS enabled for local development
- Request logging
- Error handling

## Port Registry

Ports are defined in `CLAUDE.md`:
- **9876-9899**: Reserved for proxy servers
- **3000-3999**: Legacy ports (being migrated)

Always check CLAUDE.md before choosing a port!

## Categories

Proxies are organized into categories:
- **infrastructure**: Core system proxies (vite-fix, monitoring)
- **development**: Code-related proxies (git, file browser)
- **media**: Content proxies (audio, google drive)
- **testing**: Test-related proxies

## Migration Guide

To migrate an existing server:

1. Create new proxy extending `ProxyServerBase`
2. Move route logic to `setupRoutes()`
3. Extract business logic to a service
4. Register with appropriate category
5. Update port in CLAUDE.md
6. Archive old implementation

## Future Proxies

Planned proxies:
- git-operations-proxy (9879)
- file-browser-proxy (9880)
- audio-streaming-proxy (9882)
- google-drive-proxy (9883)

## CLI Integration

Future CLI commands:
```bash
./proxy list                 # List all registered proxies
./proxy start vite-fix      # Start specific proxy
./proxy stop-all            # Stop all proxies
./proxy status              # Check proxy status
```
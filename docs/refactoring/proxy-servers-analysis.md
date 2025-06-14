# Proxy Servers Analysis - Code Extraction to Shared Services

## Overview

This document analyzes 12 proxy servers in the dhg-mono repository to identify duplicate code and functionality that should be extracted to shared services.

## Server List and Analysis

### 1. Markdown Server (3001) - `scripts/cli-pipeline/viewers/simple-md-server.js`
**Purpose**: Serves markdown files for all apps
**Common Patterns**:
- CORS handling
- Health check endpoint
- File path resolution and security checks
- File listing with `find` command
- Archive functionality
- JSON response helpers
- Request body parsing

### 2. Script Server (3002) - `scripts/cli-pipeline/viewers/simple-script-server.js`
**Purpose**: Serves script files (.sh, .js, .ts, .py)
**Common Patterns**:
- CORS handling (identical to markdown server)
- Health check endpoint (identical pattern)
- File path resolution and security checks (identical pattern)
- File listing with `find` command (identical pattern)
- Archive functionality (identical pattern)
- JSON response helpers (identical)
- Request body parsing (identical)

### 3. Docs Archive Server (3003) - `scripts/cli-pipeline/viewers/docs-archive-server.js`
**Purpose**: Document archiving and retrieval
**Common Patterns**:
- CORS handling (identical)
- Health check endpoint (identical pattern)
- File path resolution and security checks (similar pattern)
- File listing with `find` command (similar pattern)
- Archive functionality (similar pattern)
- JSON response helpers (identical)
- Request body parsing (identical)

### 4. Git Server (3005) - `apps/dhg-admin-code/git-server.cjs`
**Purpose**: Git worktree management
**Common Patterns**:
- CORS handling with specific origins
- Health check endpoint
- Async command execution with `execAsync`
- Error handling patterns
- Response formatting

### 5. Web Audio Server (3006) - `apps/dhg-audio/server.js`
**Purpose**: Web Google Drive audio API
**Unique Patterns**:
- Google Drive API integration
- Service account authentication
- Stream handling
- Range requests for audio
**Common Patterns**:
- CORS handling
- Health check endpoint

### 6. Local Audio Server (3007) - `apps/dhg-audio/server-enhanced.js`
**Purpose**: Local Google Drive audio (faster when files are synced)
**Note**: File not analyzed, but likely shares patterns with Web Audio Server

### 7. Living Docs Server (3008) - `apps/dhg-admin-code/living-docs-server.cjs`
**Purpose**: Living documentation tracking
**Common Patterns**:
- CORS handling with specific origins
- Health check endpoint
- Async command execution for CLI scripts
- File operations (read/write JSON)
- Error handling patterns

### 8. Git API Server (3009) - `apps/dhg-admin-code/git-api-server.cjs`
**Purpose**: Git branch management API
**Common Patterns**:
- CORS handling
- Health check endpoint
- Async command execution with `execAsync`
- Git operations patterns
- Response formatting

### 9. Worktree Switcher (3010) - `scripts/cli-pipeline/viewers/worktree-switcher-server.js`
**Purpose**: Visual worktree switcher for Cursor instances
**Unique Patterns**:
- HTML interface generation
- Process detection (Cursor/VS Code)
- Peacock color integration
**Common Patterns**:
- CORS handling
- HTTP server creation pattern

### 10. Git History Server (3011) - `scripts/cli-pipeline/dev_tasks/git-history-server.js`
**Purpose**: Git history analysis and worktree assignment
**Unique Patterns**:
- HTML interface with embedded JavaScript
- Database integration (Supabase)
**Common Patterns**:
- CORS handling
- Health check endpoint (missing but should have)
- Async command execution
- Git operations

### 11. Test Runner Server (3012) - `apps/dhg-admin-code/test-runner-server.cjs`
**Purpose**: Test execution API
**Common Patterns**:
- CORS handling with specific origins
- Health check endpoint
- Async command execution
- Error handling patterns

### 12. Deployment Server (3015) - `apps/dhg-admin-code/deployment-server.cjs`
**Purpose**: Deployment management
**Common Patterns**:
- CORS handling with specific origins
- Health check endpoint
- Async command execution for CLI scripts
- Error handling patterns

## Identified Patterns for Extraction

### 1. **Server Base Class/Factory**
Almost all servers share:
- Express app setup
- CORS configuration
- Health check endpoints
- Port configuration from environment variables
- Basic error handling

**Proposed Service**: `@shared/services/proxy-server-base`
```typescript
interface ProxyServerConfig {
  serviceName: string;
  port: number;
  corsOrigins?: string[];
  healthEndpoint?: string;
}

class ProxyServerBase {
  constructor(config: ProxyServerConfig);
  start(): Promise<void>;
  addHealthCheck(): void;
  setupCORS(): void;
}
```

### 2. **File Operations Service**
Multiple servers (markdown, script, docs-archive) share:
- File path resolution
- Security checks for file extensions
- File listing with find command
- Archive/delete operations
- Multiple path attempts

**Proposed Service**: `@shared/services/file-operations`
```typescript
interface FileOperationsConfig {
  allowedExtensions: string[];
  archiveFolderName: string;
  basePaths: string[];
}

class FileOperationsService {
  findFile(relativePath: string): Promise<string | null>;
  listFiles(pattern: string): Promise<string[]>;
  archiveFile(path: string): Promise<string>;
  deleteFile(path: string): Promise<void>;
  readFileWithMetadata(path: string): Promise<FileData>;
}
```

### 3. **CLI Execution Service**
Many servers execute CLI commands:
- Git operations
- Script execution
- Command output parsing

**Proposed Service**: `@shared/services/cli-executor`
```typescript
interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

class CLIExecutorService {
  execute(command: string, options?: ExecOptions): Promise<CommandResult>;
  executeWithTimeout(command: string, timeout: number): Promise<CommandResult>;
  parseGitOutput(output: string): any;
}
```

### 4. **Response Helpers**
All servers use similar JSON response patterns:

**Proposed Service**: `@shared/services/http-response-helpers`
```typescript
class ResponseHelpers {
  static sendJson(res: Response, statusCode: number, data: any): void;
  static sendError(res: Response, error: Error): void;
  static readRequestBody(req: Request): Promise<any>;
}
```

### 5. **Git Operations Service**
Multiple servers perform git operations:

**Proposed Service**: `@shared/services/git-operations`
```typescript
class GitOperationsService {
  getWorktrees(): Promise<Worktree[]>;
  getBranches(): Promise<Branch[]>;
  getCommits(options?: CommitOptions): Promise<Commit[]>;
  deleteBranch(name: string, force?: boolean): Promise<void>;
}
```

## Specific Duplications Found

### 1. **Identical CORS Setup** (11 servers)
```javascript
// Found in almost all servers
res.setHeader('Access-Control-Allow-Origin', '*');
res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
```

### 2. **Identical Health Check Pattern** (10 servers)
```javascript
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'service-name',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});
```

### 3. **Identical Request Body Parser** (3 servers)
The markdown, script, and docs-archive servers have identical `readRequestBody` function.

### 4. **Similar File Finding Logic** (3 servers)
All file servers attempt multiple paths to find files.

### 5. **Git Command Execution** (4 servers)
Git-related servers all use similar patterns for executing git commands.

## Business Logic to Extract

### 1. **Worktree Management**
- Currently duplicated between git-server and git-api-server
- Should be in `@shared/services/worktree-service`

### 2. **File Archiving Logic**
- Duplicated across file servers
- Business rules for archive folder naming
- Should be in `@shared/services/document-archiving`

### 3. **CLI Command Tracking**
- Several servers execute CLI commands but don't track them
- Should integrate with existing command tracking

### 4. **Server Registry Integration**
- Only some servers properly register with sys_server_ports_registry
- Should be automatic in base class

## Database Queries to Centralize

### 1. **Server Registration**
- Direct database updates for server status
- Should use ServerRegistryService

### 2. **Command Tracking**
- Direct inserts to command_executions
- Should use existing tracking utilities

## Security Concerns

### 1. **Path Traversal**
- File servers do path normalization but inconsistently
- Should have centralized path validation

### 2. **Command Injection**
- Git servers execute commands with user input
- Need centralized command sanitization

### 3. **CORS Configuration**
- Some servers use '*' while others restrict origins
- Should have environment-based CORS config

## Recommendations

### Priority 1: Create Base Server Class
1. Extract common Express setup
2. Standardize health checks
3. Centralize CORS configuration
4. Automatic server registry integration

### Priority 2: Extract File Operations
1. Create FileOperationsService
2. Migrate markdown, script, and docs-archive servers
3. Standardize security checks

### Priority 3: Centralize CLI Execution
1. Create CLIExecutorService
2. Add command tracking integration
3. Implement timeout handling

### Priority 4: Extract Git Operations
1. Create GitOperationsService
2. Consolidate worktree management
3. Standardize git command parsing

### Priority 5: Create Response Utilities
1. Extract response helpers
2. Standardize error responses
3. Add request validation

## Migration Strategy

1. **Phase 1**: Create shared services without breaking existing servers
2. **Phase 2**: Migrate one server at a time to use shared services
3. **Phase 3**: Remove duplicate code
4. **Phase 4**: Add missing features (tracking, registry, etc.)

## Estimated Impact

- **Code Reduction**: ~60-70% reduction in server code
- **Maintenance**: Single place to fix bugs/add features
- **Consistency**: Standardized behavior across all servers
- **Security**: Centralized security validations
- **Monitoring**: Unified health checks and logging
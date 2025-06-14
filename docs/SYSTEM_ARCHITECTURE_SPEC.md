# DHG Monorepo System Architecture Specification

## Executive Summary

The DHG monorepo represents a sophisticated, service-oriented architecture that enables rapid, safe development across multiple applications, CLI pipelines, and server components. By centralizing business logic in environment-aware singleton services, the system achieves zero code duplication while maintaining flexibility across browser, CLI, and server contexts.

## Table of Contents

1. [Core Architecture Philosophy](#core-architecture-philosophy)
2. [Service Layer Architecture](#service-layer-architecture)
3. [File Registry System](#file-registry-system)
4. [Three-Tier Execution Model](#three-tier-execution-model)
5. [Database Architecture](#database-architecture)
6. [Testing Strategy](#testing-strategy)
7. [Security & Browser Limitations](#security--browser-limitations)
8. [Development Workflow](#development-workflow)
9. [System Benefits](#system-benefits)

## Core Architecture Philosophy

### Principles

1. **Single Source of Truth**: All business logic resides in shared services
2. **Environment Adaptability**: Services detect and adapt to their execution context
3. **Zero Duplication**: Singleton patterns ensure code is written once, used everywhere
4. **Registry-Based Organization**: Different file types have specialized management systems
5. **Database-Driven Configuration**: Tables track everything from scripts to archived files

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        SHARED SERVICES LAYER                      │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │Environment  │  │  Singleton   │  │  Database-Backed       │ │
│  │Detection    │  │  Instances   │  │  Registries            │ │
│  │- Browser    │  │  Per Client  │  │  - Scripts             │ │
│  │- CLI/Node   │  │  or Global   │  │  - Documents           │ │
│  │- Server     │  │              │  │  - Archives            │ │
│  └─────────────┘  └──────────────┘  └────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                               ↓
        ┌──────────────────────┼──────────────────────┐
        ↓                      ↓                      ↓
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│ CLI PIPELINES │    │ BROWSER APPS  │    │ PROXY SERVERS │
├───────────────┤    ├───────────────┤    ├───────────────┤
│- Direct Node  │    │- Vite/React   │    │- File Access  │
│- File System  │    │- Limited APIs  │    │- Script Exec  │
│- Full Access  │    │- Supabase     │    │- Google Drive │
└───────────────┘    └───────────────┘    └───────────────┘
```

## Service Layer Architecture

### Environment-Aware Services

Services automatically detect their execution environment and adapt accordingly:

```typescript
// Browser environment - requires Supabase client
const service = DocumentClassificationService.getInstance(supabaseClient);

// CLI environment - uses singleton pattern
const service = DocumentClassificationService.getInstance();
```

### Core Service Categories

#### 1. **Document Services**
- `DocumentClassificationService` - AI-powered document type identification
- `DocumentTypeService` - Manages 116 document types across 16 MIME types
- `DocumentArchivingService` - Handles document lifecycle and archival

#### 2. **File Management Services**
- `FileService` - Cross-environment file operations
- `GoogleDriveService` - Google Drive integration
- `MediaProcessingService` - Audio/video file handling

#### 3. **Infrastructure Services**
- `SupabaseClientService` - Database connection management
- `ServerRegistryService` - Dynamic port management
- `PortsManagementService` - Port allocation and tracking

#### 4. **AI & Prompt Services**
- `PromptService` - Sophisticated prompt management with JSON responses
- `ClaudeService` - AI integration layer
- `PromptManagementService` - Prompt versioning and relationships

#### 5. **Development Services**
- `CLIRegistryService` - CLI command tracking
- `DevTaskService` - Development task management
- `WorkSummaryService` - Work tracking and reporting

## File Registry System

The system manages different file types through specialized registries, each with unique challenges:

### 1. Google Sources Registry
```sql
Table: google_sources
Purpose: External content from Google Drive
Challenges: Remote access, synchronization, permissions
Services: GoogleDriveService, DocumentClassificationService
```

### 2. Documentation Files Registry
```sql
Table: doc_files
Purpose: Static markdown throughout monorepo
Challenges: Scattered locations, version tracking
Services: DocumentTypeService, FileService
```

### 3. Archived Files Registry
```sql
Tables: archived_scripts, archived_docs
Purpose: Historical files in .archive_* folders (not in git)
Challenges: Searchability without git tracking
Services: DocumentArchivingService
```

### 4. Scripts Registry
```sql
Table: scripts_registry
Purpose: Active CLI scripts
Challenges: Dynamic nature, dependency tracking
Services: CLIRegistryService
```

### 5. Living Documents
```sql
Table: living_docs (implied)
Purpose: Dynamic, evolving documentation
Challenges: Currency, pruning old content
Services: LivingDocsPrioritizationService
```

## Three-Tier Execution Model

### Tier 1: CLI Pipelines (Full Access)
```bash
scripts/cli-pipeline/
├── google_sync/     # Google Drive operations
├── document/        # Document management
├── media/          # Media processing
└── database/       # Migration management
```

**Capabilities:**
- Direct file system access
- Process execution
- Network requests
- Database migrations

### Tier 2: Browser Applications (Limited Access)
```
apps/
├── dhg-admin-code   # Main admin interface
├── dhg-audio        # Audio processing
├── dhg-hub          # Central hub
└── dhg-improve-*    # Feature-specific apps
```

**Limitations:**
- No file system access
- No process execution
- CORS restrictions
- Security sandbox

### Tier 3: Proxy Servers (Bridge Layer)
```typescript
// Example: Markdown Server (Port 3001)
app.post('/api/markdown-file', async (req, res) => {
  // Browser requests file operation
  // Server performs file system access
  // Returns result to browser
});
```

**Current Proxy Servers:**
| Server | Port | Purpose |
|--------|------|---------|
| Markdown Server | 3001 | File system operations |
| Test Runner | 3012 | Execute test suites |
| Deployment Server | 3015 | Run deployments |
| Document Processor | 3011 | Heavy processing tasks |

## Database Architecture

### System Tables

#### Registry Tables
- `command_pipelines` - CLI pipeline definitions
- `command_definitions` - Individual commands
- `scripts_registry` - Script file tracking
- `sys_table_migrations` - Table rename history
- `sys_server_ports_registry` - Port allocations

#### Document Tables
- `document_types` - 116 types with categories
- `doc_files` - Local documentation
- `google_sources` - Google Drive files
- `google_expert_documents` - Processed documents

#### Tracking Tables
- `dev_tasks` - Development task tracking
- `dev_task_commits` - Git commit linkage
- `work_summaries` - Work session summaries
- `clipboard_snippets` - Reusable code snippets

### Naming Conventions
```sql
-- Tables must use approved prefixes
SELECT * FROM sys_table_prefixes WHERE active = true;

-- Views must end with _view
CREATE VIEW sys_active_servers_view AS ...
```

## Testing Strategy

### Multi-Environment Testing

```typescript
// Test structure for services
describe('DocumentClassificationService', () => {
  describe('Browser Environment', () => {
    it('requires Supabase client', () => {
      // Test with passed client
    });
  });
  
  describe('CLI Environment', () => {
    it('uses singleton pattern', () => {
      // Test without client
    });
  });
  
  describe('Proxy Server Integration', () => {
    it('handles async operations', () => {
      // Test with mock server
    });
  });
});
```

### Service Testing Priorities

1. **Environment Detection** - Correct mode selection
2. **Singleton Management** - Proper instance handling
3. **Error Boundaries** - Graceful failure modes
4. **Async Operations** - Promise handling
5. **Database Integration** - Transaction safety

## Security & Browser Limitations

### Browser Security Model
```
┌─────────────────────┐
│   Browser App       │
│  ┌───────────────┐  │
│  │ Cannot:       │  │
│  │ - Read files  │  │
│  │ - Execute cmd │  │
│  │ - Direct DB   │  │
│  └───────────────┘  │
└──────────┬──────────┘
           ↓ HTTPS
┌──────────┴──────────┐
│   Proxy Server      │
│  ┌───────────────┐  │
│  │ Can:          │  │
│  │ - Read files  │  │
│  │ - Execute cmd │  │
│  │ - Access DB   │  │
│  └───────────────┘  │
└─────────────────────┘
```

### Security Benefits
1. **Sandboxed Execution** - Browser apps can't access system
2. **Authenticated Requests** - Proxy servers validate access
3. **Audit Trail** - All operations logged in database
4. **Rate Limiting** - Prevent abuse of proxy endpoints

## Development Workflow

### Adding New Functionality

1. **Identify Service Layer**
   ```typescript
   // Does functionality belong in existing service?
   // Or needs new service?
   ```

2. **Implement Environment Awareness**
   ```typescript
   export class NewService {
     static getInstance(supabaseClient?: SupabaseClient) {
       // Handle both browser and CLI
     }
   }
   ```

3. **Create Database Tables**
   ```sql
   -- Use approved prefix
   -- Add to sys_table_definitions
   -- Create appropriate indexes
   ```

4. **Build CLI Pipeline** (if needed)
   ```bash
   scripts/cli-pipeline/new-domain/
   ├── new-domain-cli.ts
   └── package.json
   ```

5. **Add Proxy Server** (if browser needs system access)
   ```typescript
   // Register in sys_server_ports_registry
   // Implement secure endpoints
   ```

## System Benefits

### 1. **Rapid Development**
- Services provide building blocks
- No reimplementation needed
- Consistent patterns across apps

### 2. **Maintainability**
- Single source of truth
- Clear separation of concerns
- Database-driven configuration

### 3. **Scalability**
- Add new apps without duplicating logic
- Services scale independently
- Database handles state management

### 4. **Safety**
- Type safety with TypeScript
- Environment isolation
- Comprehensive error handling

### 5. **Flexibility**
- Works in any environment
- Adapts to security constraints
- Extensible through registries

## Future Enhancements

### Planned Improvements
1. **Service Mesh** - Inter-service communication
2. **GraphQL Layer** - Unified data access
3. **Event System** - Pub/sub for services
4. **Caching Layer** - Performance optimization
5. **Service Discovery** - Automatic service registration

### Testing Expansion
1. **Integration Tests** - Service interaction testing
2. **Contract Tests** - API compatibility
3. **Performance Tests** - Load handling
4. **Security Tests** - Vulnerability scanning

## Conclusion

This architecture enables rapid, safe development by:
- Centralizing logic in environment-aware services
- Managing complexity through specialized registries
- Bridging browser limitations with proxy servers
- Tracking everything in a comprehensive database

The result is a system that grows quickly without becoming unwieldy, maintains consistency across diverse execution contexts, and provides a solid foundation for future expansion.

---

*Last Updated: December 2024*
*Version: 1.0*
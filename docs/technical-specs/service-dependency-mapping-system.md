# Service Dependency Mapping System

## Overview

This system will create comprehensive tracking of relationships between applications, CLI pipelines, commands, and shared services across the monorepo. This will provide architectural insight and impact analysis capabilities.

## Database Schema Design

### Core Registry Tables

#### 1. `services_registry`
Catalog of all shared services in the monorepo.

```sql
CREATE TABLE services_registry (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_name VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  package_path TEXT NOT NULL, -- e.g., 'packages/shared/services/supabase-client'
  service_file VARCHAR(255), -- e.g., 'supabase-client-service.ts'
  service_type VARCHAR(100) NOT NULL, -- 'singleton', 'adapter', 'utility', 'helper'
  export_type VARCHAR(100), -- 'class', 'function', 'object', 'constant'
  is_singleton BOOLEAN DEFAULT false,
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'deprecated', 'archived'
  version VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 2. `apps_registry`
Registry of all applications in the monorepo.

```sql
CREATE TABLE apps_registry (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  app_name VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  app_path TEXT NOT NULL, -- e.g., 'apps/dhg-hub'
  app_type VARCHAR(100) NOT NULL, -- 'vite-app', 'node-service', 'cli-tool'
  framework VARCHAR(100), -- 'react', 'node', 'express'
  package_manager VARCHAR(50) DEFAULT 'pnpm',
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 3. `cli_pipelines_registry`
Registry of all CLI pipelines.

```sql
CREATE TABLE cli_pipelines_registry (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pipeline_name VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  pipeline_path TEXT NOT NULL, -- e.g., 'scripts/cli-pipeline/database'
  main_script VARCHAR(255), -- e.g., 'database-cli.sh'
  domain VARCHAR(100), -- 'database', 'google_sync', 'ai', etc.
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 4. `cli_commands_registry`
Registry of individual commands within CLI pipelines.

```sql
CREATE TABLE cli_commands_registry (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pipeline_id UUID REFERENCES cli_pipelines_registry(id) ON DELETE CASCADE,
  command_name VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  description TEXT,
  command_script VARCHAR(255), -- e.g., 'connection-test.ts'
  command_type VARCHAR(100), -- 'typescript', 'bash', 'node'
  is_primary BOOLEAN DEFAULT false, -- Main commands vs helper commands
  usage_frequency INTEGER DEFAULT 0, -- From command tracking
  success_rate DECIMAL(5,2), -- From command tracking
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pipeline_id, command_name)
);
```

### Dependency Mapping Tables

#### 5. `app_service_dependencies`
Maps applications to the services they use.

```sql
CREATE TABLE app_service_dependencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  app_id UUID REFERENCES apps_registry(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services_registry(id) ON DELETE CASCADE,
  dependency_type VARCHAR(100) NOT NULL, -- 'direct-import', 'adapter-usage', 'singleton-call'
  import_path TEXT, -- How it's imported, e.g., '@shared/services/supabase-client'
  usage_context TEXT, -- Where/how it's used
  usage_frequency VARCHAR(50), -- 'high', 'medium', 'low', 'occasional'
  is_critical BOOLEAN DEFAULT false, -- Is this a critical dependency?
  first_detected_at TIMESTAMPTZ DEFAULT NOW(),
  last_verified_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  UNIQUE(app_id, service_id)
);
```

#### 6. `pipeline_service_dependencies`
Maps CLI pipelines to the services they use.

```sql
CREATE TABLE pipeline_service_dependencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pipeline_id UUID REFERENCES cli_pipelines_registry(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services_registry(id) ON DELETE CASCADE,
  dependency_type VARCHAR(100) NOT NULL,
  import_path TEXT,
  usage_context TEXT,
  usage_frequency VARCHAR(50),
  is_critical BOOLEAN DEFAULT false,
  first_detected_at TIMESTAMPTZ DEFAULT NOW(),
  last_verified_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  UNIQUE(pipeline_id, service_id)
);
```

#### 7. `command_service_dependencies`
Maps individual CLI commands to specific services (most granular level).

```sql
CREATE TABLE command_service_dependencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  command_id UUID REFERENCES cli_commands_registry(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services_registry(id) ON DELETE CASCADE,
  dependency_type VARCHAR(100) NOT NULL,
  import_path TEXT,
  usage_context TEXT, -- Specific function calls, etc.
  is_critical BOOLEAN DEFAULT false,
  first_detected_at TIMESTAMPTZ DEFAULT NOW(),
  last_verified_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  UNIQUE(command_id, service_id)
);
```

### Supporting Tables

#### 8. `service_exports`
Track what each service exports (for comprehensive dependency analysis).

```sql
CREATE TABLE service_exports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id UUID REFERENCES services_registry(id) ON DELETE CASCADE,
  export_name VARCHAR(255) NOT NULL,
  export_type VARCHAR(100), -- 'function', 'class', 'constant', 'type'
  is_default BOOLEAN DEFAULT false,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(service_id, export_name)
);
```

#### 9. `dependency_analysis_runs`
Track when dependency analysis was last run.

```sql
CREATE TABLE dependency_analysis_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_type VARCHAR(100) NOT NULL, -- 'full-scan', 'incremental', 'manual'
  target_type VARCHAR(100), -- 'apps', 'pipelines', 'services', 'all'
  items_scanned INTEGER,
  dependencies_found INTEGER,
  errors_encountered INTEGER,
  run_duration_ms INTEGER,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status VARCHAR(50) DEFAULT 'running', -- 'running', 'completed', 'failed'
  notes TEXT
);
```

## CLI Pipeline Design

### New Pipeline: `service_dependencies`

Location: `scripts/cli-pipeline/service_dependencies/`

#### Commands Needed:

1. **`scan-services`** - Discover and register all shared services
2. **`scan-apps`** - Discover and register all applications  
3. **`scan-pipelines`** - Discover and register all CLI pipelines
4. **`scan-commands`** - Discover and register all CLI commands
5. **`analyze-dependencies`** - Scan code for service usage relationships
6. **`update-registry`** - Update existing registrations
7. **`validate-dependencies`** - Verify dependency relationships are still valid
8. **`export-report`** - Generate dependency reports

#### Scanning Strategy:

**Service Discovery:**
- Scan `packages/shared/services/` recursively
- Parse TypeScript files for exports
- Identify singletons, adapters, utilities
- Extract JSDoc descriptions

**App Discovery:**
- Scan `apps/` directories
- Read package.json for metadata
- Identify framework type (React, Node, etc.)
- Parse main entry points

**Pipeline Discovery:**
- Scan `scripts/cli-pipeline/` directories
- Parse CLI shell scripts for commands
- Extract command definitions and help text
- Link to existing command registry

**Dependency Analysis:**
- Parse import statements in TypeScript/JavaScript files
- Match imports to registered services
- Identify usage patterns (singleton calls, direct imports, etc.)
- Track import aliases and paths

## Data Population Strategy

### Phase 1: Registry Population
1. Run `scan-services` to discover all shared services
2. Run `scan-apps` to register all applications
3. Run `scan-pipelines` to register CLI pipelines
4. Run `scan-commands` to register individual commands

### Phase 2: Dependency Analysis
1. Run `analyze-dependencies --target apps` for app-service relationships
2. Run `analyze-dependencies --target pipelines` for pipeline-service relationships  
3. Run `analyze-dependencies --target commands --granular` for command-level dependencies

### Phase 3: Validation and Maintenance
1. Set up periodic validation runs
2. Integrate with CI/CD for automatic updates
3. Create manual update processes for new services

## Implementation Notes

### Code Analysis Techniques:
- Use TypeScript compiler API for accurate parsing
- Parse import statements with AST analysis
- Identify singleton usage patterns (`getInstance()`)
- Track adapter usage (`createAdapter()`)
- Parse JSDoc comments for descriptions

### Service Categorization:
- **Singletons**: SupabaseClientService, claudeService, etc.
- **Adapters**: createSupabaseAdapter, GoogleDriveBrowserService
- **Utilities**: Logger, file helpers, validation utils
- **Types**: Database types, shared interfaces

### Dependency Types:
- **direct-import**: `import { service } from 'path'`
- **singleton-call**: `Service.getInstance()`
- **adapter-usage**: `createAdapter(config)`
- **type-only**: `import type { Type } from 'path'`

## Expected Outcomes

1. **Complete service inventory** with descriptions and metadata
2. **Comprehensive dependency mapping** at multiple levels of granularity
3. **Impact analysis capabilities** - understand what breaks when services change
4. **Architecture documentation** - visual representation of system relationships
5. **Maintenance insights** - identify unused or over-used services
6. **Onboarding support** - new developers can understand service landscape

## Next Steps

1. **Review and approve this design**
2. **Create the database migration** with all tables
3. **Build the CLI pipeline** for scanning and analysis
4. **Run initial population** commands
5. **Validate data quality** and relationships
6. **Design UI interface** for viewing and managing dependencies

Would you like me to proceed with implementing this system?
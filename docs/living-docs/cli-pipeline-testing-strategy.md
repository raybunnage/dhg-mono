# CLI Pipeline Testing Strategy & Implementation Guide

**Version**: 1.0  
**Created**: 2025-06-11  
**Status**: Living Document  
**Owner**: Development Team  
**Review Cycle**: Weekly  
**Last Updated**: 2025-06-11

## Executive Summary

This document outlines a comprehensive testing strategy for CLI pipelines in the DHG monorepo. With 46+ CLI pipelines managing critical functionality, we need systematic testing to ensure reliability, command availability, and proper error handling. The strategy focuses on automated testing of command existence, usage-based validation, and integration with the CLI registry UI for test status visualization.

## Current State Analysis

### Existing Infrastructure
- **46+ CLI Pipelines**: Located in `scripts/cli-pipeline/`
- **Test Runner Server**: Available at port 3012 for test execution
- **Testing Pipeline**: Basic structure exists in `scripts/cli-pipeline/testing/`
- **Command Registry**: Database tracking all CLI commands and usage

### Critical Gaps
1. **No systematic command validation**: Commands in help may not exist
2. **No usage-based testing**: Most-used commands lack dedicated tests
3. **No test coverage reporting**: No visibility into which pipelines have tests
4. **No integration with UI**: CLI registry doesn't show test status

## Testing Strategy

### Phase 1: Command Existence Testing (Week 1)

**Goal**: Ensure all commands listed in help actually exist and are executable

**Implementation**:
```typescript
interface CommandExistenceTest {
  pipeline: string;
  command: string;
  exists: boolean;
  executable: boolean;
  helpListed: boolean;
}
```

**Test Process**:
1. Parse `--help` output for each pipeline
2. Extract all commands listed
3. Verify each command file exists
4. Check if command is executable
5. Report discrepancies

**Priority Pipelines** (based on criticality):
1. `database` - Core data operations
2. `dev_tasks` - Development workflow
3. `google_sync` - Google Drive integration
4. `document` - Document processing
5. `ai` - AI processing workflows

### Phase 2: Usage-Based Testing (Week 2)

**Goal**: Test the most frequently used commands based on actual usage data

**Data Source**: `command_tracking` table

**Test Categories**:
1. **Smoke Tests**: Basic command execution
2. **Parameter Tests**: Common parameter combinations
3. **Error Handling**: Invalid inputs and edge cases
4. **Output Validation**: Expected output format

**Implementation**:
```typescript
interface UsageBasedTest {
  pipeline: string;
  command: string;
  usageCount: number;
  testCases: TestCase[];
  coverage: number;
}

interface TestCase {
  name: string;
  params: string[];
  expectedOutput?: RegExp;
  expectedExitCode: number;
  timeout?: number;
}
```

### Phase 3: Test Coverage Integration (Week 3)

**Goal**: Display test status in CLI registry UI

**UI Components**:
1. **Test Status Badge**: ✅ Tested | ⚠️ Partial | ❌ No Tests
2. **Coverage Percentage**: Visual indicator (e.g., 75% coverage)
3. **Last Test Run**: Timestamp and status
4. **Quick Actions**: Run tests, view results

**Database Schema**:
```sql
-- New table for test results
CREATE TABLE cli_pipeline_test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID REFERENCES command_pipelines(id),
  command_id UUID REFERENCES command_definitions(id),
  test_type TEXT NOT NULL, -- 'existence' | 'usage' | 'integration'
  status TEXT NOT NULL, -- 'passed' | 'failed' | 'skipped'
  details JSONB,
  executed_at TIMESTAMP DEFAULT NOW(),
  duration_ms INTEGER
);

-- Add to command_pipelines
ALTER TABLE command_pipelines ADD COLUMN test_coverage DECIMAL(5,2);
ALTER TABLE command_pipelines ADD COLUMN last_test_run TIMESTAMP;
ALTER TABLE command_pipelines ADD COLUMN test_status TEXT;
```

## Test Implementation Details

### 1. Command Existence Test Runner

```typescript
// scripts/cli-pipeline/testing/commands/test-command-existence.ts
export async function testCommandExistence(pipelineName: string) {
  const results: CommandExistenceTest[] = [];
  
  // 1. Get help output
  const helpOutput = await getHelpOutput(pipelineName);
  const commands = parseCommandsFromHelp(helpOutput);
  
  // 2. Check each command
  for (const command of commands) {
    const commandPath = await findCommandFile(pipelineName, command);
    results.push({
      pipeline: pipelineName,
      command: command,
      exists: !!commandPath,
      executable: await isExecutable(commandPath),
      helpListed: true
    });
  }
  
  // 3. Check for orphaned commands (exist but not in help)
  const allFiles = await getCommandFiles(pipelineName);
  // ... validate against help
  
  return results;
}
```

### 2. Usage-Based Test Framework

```typescript
// scripts/cli-pipeline/testing/commands/test-usage-based.ts
export async function testMostUsedCommands(limit: number = 10) {
  // 1. Get most used commands from database
  const mostUsed = await getMostUsedCommands(limit);
  
  // 2. Generate test cases for each
  const testSuites = mostUsed.map(cmd => ({
    pipeline: cmd.pipeline_name,
    command: cmd.command_name,
    usageCount: cmd.usage_count,
    testCases: generateTestCases(cmd)
  }));
  
  // 3. Execute tests
  for (const suite of testSuites) {
    await runTestSuite(suite);
  }
}
```

### 3. Test Status Reporter

```typescript
// scripts/cli-pipeline/testing/commands/report-test-status.ts
export async function updateTestStatus(pipelineId: string) {
  const results = await getLatestTestResults(pipelineId);
  
  const coverage = calculateCoverage(results);
  const status = determineOverallStatus(results);
  
  await updatePipelineTestStatus({
    pipeline_id: pipelineId,
    test_coverage: coverage,
    test_status: status,
    last_test_run: new Date()
  });
}
```

## Test Execution Strategy

### Automated Testing
1. **Pre-commit hooks**: Run tests for modified pipelines
2. **Daily scheduled tests**: Full test suite overnight
3. **On-demand testing**: Via CLI registry UI

### Manual Testing
1. **New command validation**: Test before adding to registry
2. **Complex workflows**: Manual verification of multi-step processes
3. **Error scenarios**: Edge cases and failure modes

## Priority Implementation Order

### Week 1: Foundation
1. Create test runner infrastructure
2. Implement command existence tests
3. Test top 5 most critical pipelines
4. Create basic reporting

### Week 2: Expansion
1. Implement usage-based testing
2. Add test coverage calculation
3. Test next 10 pipelines
4. Create test documentation

### Week 3: Integration
1. Add UI components to CLI registry
2. Implement real-time test execution
3. Create test history tracking
4. Add automated scheduling

## Success Metrics

1. **Command Availability**: 100% of help-listed commands exist
2. **Test Coverage**: 80%+ of frequently used commands have tests
3. **Execution Time**: Tests complete within 5 minutes
4. **Failure Detection**: Catch 90%+ of breaking changes
5. **UI Integration**: All pipelines show test status

## Test Categories by Pipeline

### Critical Pipelines (Test First)
1. **database**: Schema operations, migrations
2. **dev_tasks**: Task management, Git integration
3. **google_sync**: File sync, metadata operations
4. **document**: Classification, processing
5. **ai**: Claude integration, processing

### Core Pipelines (Test Second)
6. **auth**: Authentication, user management
7. **monitoring**: Health checks, status reports
8. **deployment**: Build, deploy operations
9. **servers**: Start, stop, health checks
10. **work_summaries**: Creation, tracking

### Support Pipelines (Test Third)
11. **docs**: Documentation management
12. **scripts**: Script execution, management
13. **media_processing**: Audio/video operations
14. **email**: Email processing, extraction
15. **presentations**: Slide processing

## Common Test Patterns

### 1. Help Output Test
```bash
./pipeline-cli.sh --help
# Verify: Exit code 0, contains expected sections
```

### 2. Command Existence Test
```bash
./pipeline-cli.sh <command> --help
# Verify: Exit code 0, shows command-specific help
```

### 3. Dry Run Test
```bash
./pipeline-cli.sh <command> --dry-run
# Verify: No actual operations, shows what would happen
```

### 4. Parameter Validation Test
```bash
./pipeline-cli.sh <command> --invalid-param
# Verify: Exit code 1, helpful error message
```

## Integration with Existing Tools

### Test Runner Server
- Endpoint: `http://localhost:3012/api/run-test`
- Use for automated test execution
- Store results in database

### CLI Registry UI
- Add test status badges
- Show coverage percentage
- Enable test execution from UI

### Command Tracking
- Use usage data for test prioritization
- Track test execution in command history
- Report on untested but frequently used commands

## Maintenance & Evolution

### Weekly Reviews
1. Review test failures
2. Update test cases for new commands
3. Improve coverage for critical paths
4. Remove tests for deprecated commands

### Monthly Analysis
1. Analyze test effectiveness
2. Identify gaps in coverage
3. Optimize test execution time
4. Update testing priorities

### Quarterly Planning
1. Major test framework updates
2. New test category implementation
3. Performance optimization
4. Tool integration improvements

## Next Steps

1. **Immediate** (Today):
   - Create test runner for command existence
   - Test `database` pipeline commands
   - Create initial test result schema

2. **This Week**:
   - Implement usage-based test framework
   - Test top 5 pipelines
   - Create basic UI integration

3. **Next Week**:
   - Expand to 15 pipelines
   - Add automated scheduling
   - Create comprehensive reporting

## Appendix: Test Case Examples

### Example 1: Database Pipeline Tests
```typescript
const databaseTests: TestCase[] = [
  {
    name: "table-records with no params",
    params: ["table-records"],
    expectedExitCode: 0,
    expectedOutput: /Total tables:/
  },
  {
    name: "table-records with --non-empty",
    params: ["table-records", "--non-empty"],
    expectedExitCode: 0,
    expectedOutput: /Non-empty tables:/
  },
  {
    name: "invalid command",
    params: ["non-existent-command"],
    expectedExitCode: 1,
    expectedOutput: /Unknown command/
  }
];
```

### Example 2: Dev Tasks Pipeline Tests
```typescript
const devTasksTests: TestCase[] = [
  {
    name: "list active tasks",
    params: ["list", "--status", "active"],
    expectedExitCode: 0,
    expectedOutput: /Active tasks:/
  },
  {
    name: "submit without required params",
    params: ["submit"],
    expectedExitCode: 1,
    expectedOutput: /Task ID required/
  }
];
```

---

This living document will be updated as the testing implementation progresses and new patterns emerge.
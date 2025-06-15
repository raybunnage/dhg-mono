# CLI Pipeline Test Runner

## Overview

The CLI Pipeline Test Runner is a new feature in the dhg-service-test app that provides a visual interface for running and monitoring tests for all CLI pipelines organized into three groups: ALPHA, BETA, and GAMMA.

## Features

### Visual Test Runner Interface
- **Group Selection**: Switch between ALPHA (17 pipelines), BETA (20 pipelines), and GAMMA (7 pipelines)
- **Real-time Status Updates**: See which pipelines are pending, running, passed, failed, or skipped
- **Progress Visualization**: Color-coded progress bar showing test completion
- **Success Rate Metrics**: Overall pass/fail statistics for each group

### Test Execution
- **One-Click Testing**: Run all tests for a group with a single button click
- **Live Logs**: View test output in real-time as tests execute
- **Individual Pipeline Status**: Each pipeline shows its current test status with visual indicators:
  - ✅ Passed
  - ❌ Failed
  - ⏭️ Skipped
  - 🔄 Running
  - ⏸️ Pending

## Architecture

### Components
1. **CLIPipelineTestRunner.tsx**: React component providing the UI
2. **cli-test-runner-proxy.ts**: Express server handling test execution and status updates
3. **Test Runner Scripts**: Shell scripts for each group:
   - `run-alpha-direct-tests.sh`
   - `run-beta-direct-tests.sh`
   - `run-gamma-direct-tests.sh`

### API Endpoints
- `POST /cli-tests/run-{group}`: Start tests for a specific group
- `GET /cli-tests/status-{group}`: Get current test status and logs

### Port Configuration
- **CLI Test Runner Proxy**: Port 9890

## Pipeline Groups

### ALPHA Group (Infrastructure & System Management)
- testing, utilities, system, registry, tracking
- maintenance, continuous, proxy, servers, monitoring
- shared-services, service_dependencies, refactor_tracking
- deprecation, all_pipelines, database, deployment

### BETA Group (Content & Development Tools)
- ai, analysis, archive, auth, classify
- continuous_docs, dev_tasks, docs, document
- document_archiving, document_types, drive_filter
- element_criteria, email, experts, git
- git_workflow, gmail, google_sync, living_docs

### GAMMA Group (Media & Specialized Services)
- media-analytics, media-processing, mime_types
- presentations, prompt_service, scripts, work_summaries

## Usage

1. **Start the dhg-service-test app**:
   ```bash
   cd apps/dhg-service-test
   pnpm dev
   ```

2. **Start the CLI Test Runner Proxy**:
   ```bash
   ./scripts/cli-pipeline/proxy/start-cli-test-runner-proxy.sh
   ```

3. **Navigate to CLI Pipeline Tests**:
   - Open the dhg-service-test app in your browser
   - Click the "🧪 CLI Pipeline Tests" button

4. **Run Tests**:
   - Select a group (ALPHA, BETA, or GAMMA)
   - Click "🚀 Run [GROUP] Tests"
   - Watch the real-time progress and results

## Test Coverage

Each pipeline is tested for:
- File existence
- Executable permissions
- Help command functionality
- Unknown command handling
- Specific command execution (varies by pipeline)

## Benefits

- **Visual Feedback**: No more running tests in terminal and parsing output
- **Group Organization**: Tests are organized by functional area
- **Real-time Monitoring**: See exactly which pipeline is being tested
- **Historical Results**: Track when tests were last run
- **Easy Debugging**: Live logs help identify issues immediately

## Future Enhancements

- Test history tracking in database
- Scheduled test runs
- Email notifications for failures
- Individual pipeline re-run capability
- Test result trends and analytics
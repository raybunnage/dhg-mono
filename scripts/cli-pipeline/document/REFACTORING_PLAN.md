# Document Pipeline Service Refactoring Plan

This document outlines the incremental refactoring approach for the document pipeline scripts to use a service-based architecture.

## Phase 1: Core Service Framework (Current Progress)

- [x] Archive original scripts
- [x] Create basic standalone service structure 
- [x] Implement simple CLI wrapper
- [x] Test connectivity and basic functions (show-recent)

## Phase 2: Expand Core Functionality (Next)

- [ ] Implement file synchronization service (sync-files)
- [ ] Implement new files discovery service (find-new)
- [ ] Add proper error handling and logging throughout
- [ ] Create unit tests for these core functions

## Phase 3: Advanced Document Operations

- [ ] Implement document type management service
- [ ] Implement classification functionality using Claude API
- [ ] Implement summary generation service
- [ ] Add proper validation and error handling
- [ ] Create integration tests for classification workflows

## Phase 4: CLI Interface Enhancement

- [ ] Build robust command-line interface with improved help
- [ ] Add progress indicators for long-running operations
- [ ] Implement proper configuration management
- [ ] Create comprehensive documentation
- [ ] Create end-to-end tests

## Phase 5: Transition to Shared Package

- [ ] Move service implementation to shared package
- [ ] Implement proper dependency injection for better testing
- [ ] Update adapters to use the shared package
- [ ] Maintain CLI compatibility for user experience
- [ ] Complete test suite with high coverage

## Implementation Guidelines

1. **Incremental Changes**: Each phase should result in a working system, maintaining backward compatibility.

2. **Testing Priority**: Create tests before implementing new features to ensure reliability.

3. **Backward Compatibility**: Ensure the CLI interface remains consistent to avoid breaking existing workflows.

4. **Documentation**: Update documentation with each phase to reflect the current state.

5. **Error Handling**: Implement robust error handling for every operation with clear user feedback.

## Service Architecture

```
┌─────────────────┐      ┌─────────────────────┐
│                 │      │                     │
│  CLI Interface  │─────▶│  Service Adapter    │
│                 │      │                     │
└─────────────────┘      └──────────┬──────────┘
                                    │
                                    ▼
┌─────────────────┐      ┌─────────────────────┐
│                 │      │                     │
│  Test Suite     │─────▶│  Document Service   │
│                 │      │                     │
└─────────────────┘      └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │                     │
                         │  External Services  │
                         │  (Supabase, Claude) │
                         │                     │
                         └─────────────────────┘
```

## Next Immediate Steps

1. Implement the file synchronization service
2. Create proper unit tests for the service
3. Enhance error handling for database operations
4. Add validation for all inputs
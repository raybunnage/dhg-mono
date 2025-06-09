# Testing Vision & Implementation Plan for DHG Monorepo

**Version**: 1.0  
**Created**: 2025-06-09  
**Status**: Living Document  
**Owner**: Development Team  
**Review Cycle**: Weekly  
**Last Updated**: 2025-06-09

## Executive Summary

This document outlines a comprehensive testing strategy for the DHG monorepo, with immediate focus on two priority applications: **dhg-admin-google** (Google Drive & AI integration) and **dhg-admin-code** (Development tools). The strategy emphasizes practical, phased implementation starting with the most critical paths, building toward comprehensive coverage and eventual UI-based test management.

## Current State Analysis

### What Exists
- **Limited test coverage**: Only 1 of 10 apps (dhg-a) has active tests
- **Mixed frameworks**: Vitest in dhg-a, Jest in some services
- **No standardization**: Each package manages its own testing setup
- **Turbo integration**: Test commands configured but largely unused

### Critical Gaps
- **No testing in critical apps**: Admin tools handling AI, Google Drive, and dev workflows lack tests
- **No integration tests**: API endpoints and database operations untested
- **No E2E testing**: User workflows across apps not validated
- **No test documentation**: No guidelines or best practices documented

## Testing Types: Comprehensive Analysis

### 1. Unit Testing

**Purpose**: Test individual functions and components in isolation

**Pros**:
- ✅ Fast execution (milliseconds)
- ✅ Easy to write and maintain
- ✅ Excellent for pure functions and utilities
- ✅ Helps with refactoring confidence
- ✅ Clear failure messages

**Cons**:
- ❌ Can't catch integration issues
- ❌ May not reflect real usage
- ❌ Requires mocking dependencies
- ❌ Can become brittle with implementation changes

**Tools**: Vitest (preferred), Jest

**Priority**: HIGH - Foundation of testing pyramid

### 2. Component Testing

**Purpose**: Test React components with their internal logic

**Pros**:
- ✅ Tests user interactions
- ✅ Validates component contracts
- ✅ Good balance of speed and confidence
- ✅ Tests hooks and state management
- ✅ Can test accessibility

**Cons**:
- ❌ Slower than unit tests
- ❌ Requires DOM simulation
- ❌ Complex components need extensive setup
- ❌ May miss styling issues

**Tools**: React Testing Library + Vitest/Jest

**Priority**: HIGH - Critical for React apps

### 3. Integration Testing

**Purpose**: Test multiple components/services working together

**Pros**:
- ✅ Catches interface mismatches
- ✅ Tests real workflows
- ✅ Validates API contracts
- ✅ Tests database operations
- ✅ Higher confidence than unit tests

**Cons**:
- ❌ Slower execution
- ❌ More complex setup
- ❌ Harder to debug failures
- ❌ May require test databases

**Tools**: Supertest (APIs), Test containers (databases)

**Priority**: MEDIUM - Essential for APIs and services

### 4. End-to-End (E2E) Testing

**Purpose**: Test complete user journeys across the application

**Pros**:
- ✅ Highest confidence level
- ✅ Tests real user scenarios
- ✅ Catches UI/UX issues
- ✅ Can test across browsers
- ✅ Validates deployment

**Cons**:
- ❌ Very slow (seconds to minutes)
- ❌ Flaky and brittle
- ❌ Expensive to maintain
- ❌ Complex debugging
- ❌ Requires running full stack

**Tools**: Playwright (recommended), Cypress

**Priority**: LOW initially, HIGH for critical paths

### 5. Visual Regression Testing

**Purpose**: Detect unintended visual changes

**Pros**:
- ✅ Catches CSS/styling bugs
- ✅ Prevents UI regressions
- ✅ Good for design systems
- ✅ Automated screenshot comparison

**Cons**:
- ❌ Large storage requirements
- ❌ Sensitive to minor changes
- ❌ Platform-specific differences
- ❌ Slow and resource-intensive

**Tools**: Percy, Chromatic, Playwright

**Priority**: LOW - Nice to have

### 6. Performance Testing

**Purpose**: Ensure application meets performance requirements

**Pros**:
- ✅ Prevents performance regressions
- ✅ Identifies bottlenecks
- ✅ Validates scalability
- ✅ Measures real metrics

**Cons**:
- ❌ Complex setup
- ❌ Requires baseline metrics
- ❌ Environment-dependent
- ❌ Time-consuming

**Tools**: Lighthouse CI, Web Vitals

**Priority**: MEDIUM - After functional testing

### 7. Accessibility Testing

**Purpose**: Ensure apps are usable by everyone

**Pros**:
- ✅ Legal compliance
- ✅ Better user experience
- ✅ Automated WCAG checks
- ✅ Improves SEO

**Cons**:
- ❌ Can't catch all issues automatically
- ❌ Requires manual testing too
- ❌ Learning curve for standards

**Tools**: axe-core, Pa11y

**Priority**: MEDIUM - Build into component tests

## Recommended Testing Stack

### Primary Framework: Vitest

**Why Vitest over Jest**:
- ✅ **Faster**: Uses Vite's transform pipeline
- ✅ **Better DX**: Hot module replacement for tests
- ✅ **ESM-first**: Native ES modules support
- ✅ **Vite integration**: Same config as dev server
- ✅ **Jest compatible**: Easy migration
- ✅ **Built-in coverage**: C8 coverage included

### Complete Stack

```typescript
{
  "testing": {
    "unit": "Vitest",
    "components": "React Testing Library + Vitest",
    "integration": "Supertest + Vitest",
    "e2e": "Playwright",
    "accessibility": "axe-core (integrated)",
    "mocking": "MSW (Mock Service Worker)",
    "database": "Supabase test client",
    "ci": "GitHub Actions"
  }
}
```

## Testing Strategy for Priority Apps

### dhg-admin-google: Google Drive & AI Integration

**Critical Test Areas**:

1. **AI Document Classification**
   ```typescript
   // High Priority Tests
   - Document type detection accuracy
   - Claude API error handling
   - Rate limiting behavior
   - Batch processing reliability
   ```

2. **Google Drive Integration**
   ```typescript
   // Integration Tests
   - OAuth flow
   - File retrieval
   - Permission handling
   - Sync operations
   ```

3. **Data Operations**
   ```typescript
   // Database Tests
   - Document CRUD operations
   - Expert profile management
   - Transaction integrity
   ```

### dhg-admin-code: Development Tools

**Critical Test Areas**:

1. **Task Management**
   ```typescript
   // Component Tests
   - Task creation flow
   - Status updates
   - Filtering and search
   - Git integration
   ```

2. **Database Management**
   ```typescript
   // Integration Tests
   - Migration execution
   - Schema validation
   - Backup operations
   ```

3. **Service Dependencies**
   ```typescript
   // Unit Tests
   - Dependency graph building
   - Circular dependency detection
   - Service health checks
   ```

## Phased Implementation Plan

### Phase 1: Foundation (Week 1-2)

**Goal**: Establish testing infrastructure and critical path coverage

**Tasks**:
1. **Setup Vitest in both priority apps**
   ```bash
   pnpm add -D vitest @vitest/ui @testing-library/react @testing-library/user-event jsdom
   ```

2. **Create shared testing utilities**
   ```typescript
   packages/shared/testing/
     - test-utils.tsx       // React Testing Library setup
     - supabase-mock.ts     // Supabase client mocks
     - claude-mock.ts       // AI service mocks
   ```

3. **Write first tests**
   - 5 critical unit tests per app
   - 3 component tests for main features
   - Document patterns in testing guide

**Deliverables**:
- [ ] Vitest configuration in both apps
- [ ] 20 passing tests total
- [ ] Basic testing documentation

### Phase 2: Integration Testing (Week 3-4)

**Goal**: Test service integrations and API endpoints

**Tasks**:
1. **Setup MSW for API mocking**
2. **Create test database strategy**
3. **Write integration tests for**:
   - Google Drive operations
   - Claude AI classification
   - Supabase queries
   - Git operations

**Deliverables**:
- [ ] 15 integration tests
- [ ] MSW handlers for external services
- [ ] Test data fixtures

### Phase 3: Component Coverage (Week 5-6)

**Goal**: Comprehensive component testing

**Tasks**:
1. **Test all major components**
2. **Add accessibility tests**
3. **Create component testing patterns**
4. **Setup visual regression (optional)**

**Deliverables**:
- [ ] 80% component coverage
- [ ] Accessibility audit passing
- [ ] Component testing guide

### Phase 4: E2E Critical Paths (Week 7-8)

**Goal**: Validate critical user journeys

**Tasks**:
1. **Setup Playwright**
2. **Identify 5 critical user paths**
3. **Write E2E tests**
4. **Setup CI pipeline**

**Critical Paths**:
- Document classification workflow
- Task creation and management
- Google Drive sync operation
- Database migration execution
- Authentication flow

### Phase 5: CLI Testing Pipeline (Week 9-10)

**Goal**: Create testing automation and reporting

**Tasks**:
1. **Create test runner CLI**
   ```bash
   ./scripts/cli-pipeline/testing/test-runner-cli.sh
   ```

2. **Implement test commands**:
   - Run tests by type
   - Generate coverage reports
   - Watch mode for development
   - Parallel execution

3. **Add to CI/CD pipeline**

### Phase 6: Testing UI (Week 11-12)

**Goal**: Visual test management and reporting

**Tasks**:
1. **Create test dashboard app**
2. **Features**:
   - Test run history
   - Coverage visualization
   - Flaky test detection
   - Performance metrics

## Best Practices & Guidelines

### Test Organization

```typescript
// File structure
src/
  components/
    Button/
      Button.tsx
      Button.test.tsx      // Component tests
  services/
    auth/
      auth.ts
      auth.test.ts         // Unit tests
  pages/
    ClassifyDocument/
      ClassifyDocument.tsx
      ClassifyDocument.integration.test.tsx  // Integration tests
e2e/
  document-classification.spec.ts  // E2E tests
```

### Testing Patterns

```typescript
// 1. Arrange-Act-Assert
test('should classify document correctly', async () => {
  // Arrange
  const mockDocument = { content: 'test content' };
  const expectedType = 'research-paper';
  
  // Act
  const result = await classifyDocument(mockDocument);
  
  // Assert
  expect(result.type).toBe(expectedType);
});

// 2. Test behavior, not implementation
// ❌ Bad: Testing internal state
expect(component.state.isLoading).toBe(true);

// ✅ Good: Testing user-visible behavior
expect(screen.getByText('Loading...')).toBeInTheDocument();

// 3. Use data-testid for reliable selection
<button data-testid="submit-classification">Classify</button>
```

### Mock Strategies

```typescript
// 1. Mock at the boundary
// Mock external services, not internal modules

// 2. Use MSW for API mocking
import { rest } from 'msw';

export const handlers = [
  rest.post('/api/classify', (req, res, ctx) => {
    return res(ctx.json({ type: 'research-paper' }));
  }),
];

// 3. Minimal mocking
// Only mock what's necessary for the test
```

## Success Metrics

### Phase 1 Success Criteria
- [ ] Both priority apps have working test setup
- [ ] At least 20 tests passing
- [ ] Testing documentation created
- [ ] Team trained on testing approach

### Long-term Success Metrics
- [ ] 80% code coverage on critical paths
- [ ] <5% flaky tests
- [ ] All PRs include relevant tests
- [ ] <10 minute test suite execution
- [ ] 0 production bugs in tested code

## Common Pitfalls to Avoid

1. **Over-mocking**: Don't mock everything, test real integrations where possible
2. **Testing implementation**: Focus on behavior, not internal details
3. **Ignoring flaky tests**: Fix them immediately or delete them
4. **100% coverage obsession**: Focus on critical paths, not metrics
5. **Slow test suites**: Keep tests fast or developers won't run them

## Resource Requirements

### Time Investment
- **Initial setup**: 2 weeks
- **Full implementation**: 12 weeks
- **Ongoing maintenance**: 10-15% of development time

### Team Training
- Vitest basics workshop
- React Testing Library patterns
- TDD introduction
- CI/CD integration

## Next Immediate Steps

1. **Week 1 Sprint Planning**:
   ```bash
   # Monday: Setup Vitest in dhg-admin-google
   # Tuesday: Write first 5 tests
   # Wednesday: Setup Vitest in dhg-admin-code
   # Thursday: Write first 5 tests
   # Friday: Document patterns and learnings
   ```

2. **Create testing channel** for questions and knowledge sharing

3. **Schedule testing workshop** for team alignment

4. **Define code coverage targets** for each phase

## Change Log

- **2025-06-09**: Initial version created
- **[Future]**: Update with lessons learned from Phase 1

---

This living document will evolve as we implement and learn. The key is to start small with high-value tests and gradually build comprehensive coverage while maintaining fast feedback loops.
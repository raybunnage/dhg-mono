# Continuous Improvement Scenario: Add New Tests

## Scenario ID: `add-new-tests`
**Category**: Testing
**Complexity**: Medium
**Estimated Time**: 30-60 minutes
**Last Updated**: 2025-06-15

## Overview
This scenario covers adding comprehensive tests for any component, service, or feature. It includes unit tests, integration tests, and test utilities.

## Prerequisites
- Understanding of Vitest testing framework
- Knowledge of testing best practices
- Familiarity with mocking and test doubles

## When to Use
- After creating new services or components
- When test coverage is below 80%
- Before major refactoring
- When fixing bugs (test-first approach)
- Adding missing tests to legacy code

## Step-by-Step Process

### 1. Identify What to Test
**Key areas**:
- Public API/methods
- Edge cases and error conditions
- State changes and side effects
- Integration points
- User interactions (for UI)

### 2. Create Test File
**Naming convention**: `{filename}.test.ts` or `{filename}.spec.ts`
**Location**: `__tests__/` directory next to source file

### 3. Unit Test Template

#### For Services
```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { {ServiceName}Service } from '../{service-name}';

// Mock dependencies
vi.mock('@shared/services/supabase-client', () => ({
  SupabaseClientService: {
    getInstance: vi.fn(() => ({
      getClient: vi.fn(() => mockSupabase)
    }))
  }
}));

const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ data: [], error: null }))
    })),
    insert: vi.fn(() => ({
      select: vi.fn(() => Promise.resolve({ data: [{ id: '123' }], error: null }))
    }))
  }))
};

describe('{ServiceName}Service', () => {
  let service: {ServiceName}Service;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new {ServiceName}Service();
  });

  describe('initialization', () => {
    it('should create service instance', () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf({ServiceName}Service);
    });
  });

  describe('getData', () => {
    it('should fetch data successfully', async () => {
      const mockData = [{ id: '1', name: 'Test' }];
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn(() => Promise.resolve({ data: mockData, error: null }))
      });

      const result = await service.getData();
      
      expect(result).toEqual(mockData);
      expect(mockSupabase.from).toHaveBeenCalledWith('table_name');
    });

    it('should handle errors gracefully', async () => {
      const mockError = new Error('Database error');
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn(() => Promise.resolve({ data: null, error: mockError }))
      });

      await expect(service.getData()).rejects.toThrow('Database error');
    });
  });

  describe('edge cases', () => {
    it('should handle empty results', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn(() => Promise.resolve({ data: [], error: null }))
      });

      const result = await service.getData();
      expect(result).toEqual([]);
    });

    it('should handle null input gracefully', async () => {
      const result = await service.processData(null);
      expect(result).toBeNull();
    });
  });
});
```

#### For React Components
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import {ComponentName} from '../{ComponentName}';

// Mock hooks/services
vi.mock('../hooks/useData', () => ({
  useData: vi.fn(() => ({
    data: mockData,
    loading: false,
    error: null
  }))
}));

const mockData = [
  { id: '1', name: 'Item 1' },
  { id: '2', name: 'Item 2' }
];

describe('{ComponentName}', () => {
  const renderComponent = (props = {}) => {
    return render(
      <BrowserRouter>
        <{ComponentName} {...props} />
      </BrowserRouter>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render without crashing', () => {
    renderComponent();
    expect(screen.getByTestId('component-name')).toBeInTheDocument();
  });

  it('should display data correctly', () => {
    renderComponent();
    
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
  });

  it('should handle user interactions', async () => {
    const onClickMock = vi.fn();
    renderComponent({ onClick: onClickMock });
    
    const button = screen.getByRole('button', { name: /submit/i });
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(onClickMock).toHaveBeenCalledTimes(1);
    });
  });

  it('should show loading state', () => {
    vi.mocked(useData).mockReturnValueOnce({
      data: null,
      loading: true,
      error: null
    });
    
    renderComponent();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('should show error state', () => {
    vi.mocked(useData).mockReturnValueOnce({
      data: null,
      loading: false,
      error: 'Failed to load data'
    });
    
    renderComponent();
    expect(screen.getByText(/failed to load data/i)).toBeInTheDocument();
  });
});
```

### 4. Integration Test Template
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SupabaseClientService } from '@shared/services/supabase-client';
import { {ServiceName}Service } from '../{service-name}';

describe('{ServiceName}Service Integration', () => {
  let service: {ServiceName}Service;
  let supabase: any;
  let testData: any[];

  beforeAll(async () => {
    // Use real Supabase client for integration tests
    supabase = SupabaseClientService.getInstance().getClient();
    service = new {ServiceName}Service(supabase);
    
    // Set up test data
    const { data, error } = await supabase
      .from('test_table')
      .insert([
        { name: 'Test 1', value: 100 },
        { name: 'Test 2', value: 200 }
      ])
      .select();
    
    if (error) throw error;
    testData = data;
  });

  afterAll(async () => {
    // Clean up test data
    if (testData?.length) {
      await supabase
        .from('test_table')
        .delete()
        .in('id', testData.map(d => d.id));
    }
  });

  it('should interact with real database', async () => {
    const results = await service.getData();
    
    expect(results).toHaveLength(2);
    expect(results[0]).toHaveProperty('name');
    expect(results[0]).toHaveProperty('value');
  });

  it('should handle transactions correctly', async () => {
    const newItem = await service.createItem({
      name: 'Test 3',
      value: 300
    });
    
    expect(newItem).toHaveProperty('id');
    
    // Verify it was created
    const { data } = await supabase
      .from('test_table')
      .select()
      .eq('id', newItem.id)
      .single();
    
    expect(data).toBeTruthy();
    expect(data.name).toBe('Test 3');
  });
});
```

### 5. Test Utilities
**File**: `__tests__/test-utils.ts`

```typescript
import { vi } from 'vitest';

// Mock Supabase client
export const createMockSupabaseClient = () => ({
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(() => Promise.resolve({ data: {}, error: null }))
  })),
  auth: {
    getUser: vi.fn(() => Promise.resolve({ 
      data: { user: { id: 'test-user-id' } }, 
      error: null 
    }))
  }
});

// Test data factories
export const createTestUser = (overrides = {}) => ({
  id: 'test-id',
  email: 'test@example.com',
  name: 'Test User',
  ...overrides
});

// Async test helpers
export const waitForAsync = async (callback: () => boolean, timeout = 5000) => {
  const start = Date.now();
  while (!callback() && Date.now() - start < timeout) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!callback()) {
    throw new Error('Timeout waiting for condition');
  }
};
```

### 6. Test Configuration
**File**: `vitest.config.ts` (if needed)

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom', // for React components
    setupFiles: ['./test-setup.ts'],
    coverage: {
      reporter: ['text', 'html'],
      exclude: [
        'node_modules/',
        '__tests__/',
        '*.config.ts'
      ]
    }
  }
});
```

### 7. Running Tests
```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test {service-name}.test.ts

# Run with coverage
pnpm test --coverage

# Run in watch mode
pnpm test --watch

# Run integration tests only
pnpm test --grep "Integration"
```

## Test Coverage Goals
- **Unit Tests**: 80%+ coverage
- **Critical Paths**: 100% coverage
- **Edge Cases**: All identified cases tested
- **Error Paths**: All error conditions tested

## Best Practices
1. **Arrange-Act-Assert**: Structure tests clearly
2. **One Assertion Per Test**: Keep tests focused
3. **Descriptive Names**: Test names should explain what they test
4. **Mock External Dependencies**: Isolate unit tests
5. **Use Test Factories**: Create reusable test data
6. **Test Behavior, Not Implementation**: Focus on outcomes

## Common Patterns

### Testing Async Code
```typescript
it('should handle async operations', async () => {
  const promise = service.asyncMethod();
  await expect(promise).resolves.toBe('expected value');
});

it('should reject with error', async () => {
  await expect(service.failingMethod()).rejects.toThrow('Expected error');
});
```

### Testing Event Handlers
```typescript
it('should call handler with correct args', () => {
  const handler = vi.fn();
  component.on('event', handler);
  
  component.emit('event', { data: 'test' });
  
  expect(handler).toHaveBeenCalledWith({ data: 'test' });
});
```

### Testing Time-Dependent Code
```typescript
import { vi } from 'vitest';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

it('should debounce calls', () => {
  const callback = vi.fn();
  const debounced = debounce(callback, 1000);
  
  debounced();
  debounced();
  debounced();
  
  expect(callback).not.toHaveBeenCalled();
  
  vi.advanceTimersByTime(1000);
  
  expect(callback).toHaveBeenCalledTimes(1);
});
```

## Validation Checklist
- [ ] Tests follow naming conventions
- [ ] All public methods have tests
- [ ] Error cases are tested
- [ ] Edge cases are covered
- [ ] Mocks are properly cleared
- [ ] No test interdependencies
- [ ] Tests run quickly (<5s for unit tests)
- [ ] Coverage meets requirements
- [ ] Integration tests use test database
- [ ] No hardcoded test data

## Related Scenarios
- `add-new-shared-service` - Tests are part of service creation
- `add-new-app-page` - Component tests for new pages
- `refactor-service` - Preserve tests during refactoring

## Automation Notes
When automated, this scenario should:
- Generate test file with proper structure
- Create test cases for all public methods
- Set up common mocks
- Add test scripts to package.json
- Generate coverage report
- Suggest missing test cases
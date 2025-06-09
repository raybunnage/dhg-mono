# Testing Quick Start Guide for dhg-audio and dhg-hub

Last Updated: 2025-01-09

## 🚀 30-Minute Setup Guide

This guide gets you from zero to your first passing test in dhg-audio and dhg-hub.

## Step 1: Install Dependencies (5 minutes)

```bash
cd apps/dhg-audio
pnpm add -D vitest @vitest/ui @vitest/coverage-v8 @testing-library/react @testing-library/user-event jsdom

cd ../dhg-hub  
pnpm add -D vitest @vitest/ui @vitest/coverage-v8 @testing-library/react @testing-library/user-event jsdom
```

## Step 2: Create Test Configuration (5 minutes)

### dhg-audio/vitest.config.ts
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../../packages/shared'),
    },
  },
})
```

### dhg-audio/src/test/setup.ts
```typescript
import '@testing-library/jest-dom'

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({ data: [], error: null })),
    })),
  })),
}))

// Mock environment variables
vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost:54321')
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-key')
```

## Step 3: Write Your First Tests (10 minutes)

### Test 1: dhg-audio Audio Player Component

Create `apps/dhg-audio/src/components/AudioPlayer/AudioPlayer.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { AudioPlayer } from './AudioPlayer'

describe('AudioPlayer', () => {
  const mockFile = {
    id: '1',
    name: 'test-audio.mp3',
    url: 'https://example.com/audio.mp3',
  }

  it('renders audio player with file name', () => {
    render(<AudioPlayer file={mockFile} />)
    expect(screen.getByText('test-audio.mp3')).toBeInTheDocument()
  })

  it('shows play button initially', () => {
    render(<AudioPlayer file={mockFile} />)
    expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument()
  })

  it('toggles to pause button when clicked', () => {
    render(<AudioPlayer file={mockFile} />)
    
    const playButton = screen.getByRole('button', { name: /play/i })
    fireEvent.click(playButton)
    
    expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument()
  })
})
```

### Test 2: dhg-hub Navigation Component

Create `apps/dhg-hub/src/components/Navigation/Navigation.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { Navigation } from './Navigation'

const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>)
}

describe('Navigation', () => {
  const mockApps = [
    { id: '1', name: 'Audio', path: '/audio', icon: 'Music' },
    { id: '2', name: 'Admin', path: '/admin', icon: 'Settings' },
  ]

  it('renders all navigation links', () => {
    renderWithRouter(<Navigation apps={mockApps} />)
    
    expect(screen.getByText('Audio')).toBeInTheDocument()
    expect(screen.getByText('Admin')).toBeInTheDocument()
  })

  it('highlights active link', () => {
    renderWithRouter(<Navigation apps={mockApps} currentPath="/audio" />)
    
    const audioLink = screen.getByText('Audio').closest('a')
    expect(audioLink).toHaveClass('active')
  })
})
```

## Step 4: Add Test Scripts (5 minutes)

Update `package.json` in both apps:

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:watch": "vitest --watch"
  }
}
```

## Step 5: Run Your Tests! (5 minutes)

```bash
# Run tests once
pnpm test

# Watch mode for development
pnpm test:watch

# See coverage
pnpm test:coverage

# Interactive UI
pnpm test:ui
```

## 🎯 What to Test First - Priority List

### dhg-audio Priority Tests

1. **Audio Playback Core**
   ```typescript
   // Test the core audio functionality
   - Can load audio file
   - Can play/pause
   - Can seek to position
   - Volume control works
   - Handles errors gracefully
   ```

2. **Google Drive Integration**
   ```typescript
   // Test file listing and navigation
   - Lists audio files from drive
   - Filters non-audio files
   - Handles authentication
   - Shows loading states
   ```

3. **Playlist Management**
   ```typescript
   // Test playlist features
   - Add/remove from playlist
   - Save playlist state
   - Navigate between tracks
   - Shuffle/repeat modes
   ```

### dhg-hub Priority Tests

1. **App Navigation**
   ```typescript
   // Test navigation between apps
   - All apps listed correctly
   - Navigation works
   - Deep linking supported
   - Permissions respected
   ```

2. **Dashboard Widgets**
   ```typescript
   // Test dashboard functionality
   - Widgets load data
   - Handle errors gracefully
   - Update in real-time
   - Responsive layout
   ```

3. **User Authentication**
   ```typescript
   // Test auth flows
   - Login/logout works
   - Session persistence
   - Protected routes
   - Profile management
   ```

## 🛠️ Useful Testing Patterns

### Pattern 1: Testing with Supabase

```typescript
// Mock Supabase responses
const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      data: [{ id: 1, name: 'Test' }],
      error: null
    }))
  }))
}

// Use in test
vi.mocked(createClient).mockReturnValue(mockSupabase)
```

### Pattern 2: Testing Async Components

```typescript
it('loads and displays data', async () => {
  render(<DataList />)
  
  // Wait for loading to finish
  expect(screen.getByText(/loading/i)).toBeInTheDocument()
  
  // Wait for data to appear
  await screen.findByText('Test Item')
  
  // Assert no loading indicator
  expect(screen.queryByText(/loading/i)).not.toBeInTheDocument()
})
```

### Pattern 3: Testing User Interactions

```typescript
import userEvent from '@testing-library/user-event'

it('submits form with user input', async () => {
  const user = userEvent.setup()
  const onSubmit = vi.fn()
  
  render(<Form onSubmit={onSubmit} />)
  
  await user.type(screen.getByLabelText(/name/i), 'John Doe')
  await user.click(screen.getByRole('button', { name: /submit/i }))
  
  expect(onSubmit).toHaveBeenCalledWith({ name: 'John Doe' })
})
```

## 📊 Coverage Goals - Week by Week

### Week 1: Foundation (Current)
- [ ] Set up testing infrastructure ✅
- [ ] Write 5 tests for each app
- [ ] Achieve 10% coverage
- [ ] Test one critical feature

### Week 2: Component Coverage
- [ ] Test all shared components used
- [ ] Test app-specific components
- [ ] Achieve 25% coverage
- [ ] Set up CI to run tests

### Week 3: Integration Tests
- [ ] Test API interactions
- [ ] Test authentication flows
- [ ] Mock external services
- [ ] Achieve 40% coverage

### Week 4: E2E Tests
- [ ] Set up Playwright
- [ ] Test critical user paths
- [ ] Test cross-app navigation
- [ ] Achieve 50% coverage

## 🚨 Common Issues and Solutions

### Issue 1: "Cannot find module '@shared/...'"
```typescript
// Solution: Add to vitest.config.ts
resolve: {
  alias: {
    '@shared': path.resolve(__dirname, '../../packages/shared'),
  },
}
```

### Issue 2: "ReferenceError: document is not defined"
```typescript
// Solution: Ensure environment is set
test: {
  environment: 'jsdom', // not 'node'
}
```

### Issue 3: "Invalid hook call"
```typescript
// Solution: Mock React Router
const AllTheProviders = ({ children }) => {
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </BrowserRouter>
  )
}
```

## 🎯 Next Steps After Quick Start

1. **Create a Testing Style Guide**
   - Document naming conventions
   - Establish test structure
   - Define coverage requirements

2. **Set Up Continuous Integration**
   ```yaml
   # .github/workflows/test.yml
   - name: Run tests
     run: pnpm test
   - name: Upload coverage
     uses: codecov/codecov-action@v3
   ```

3. **Add Visual Testing**
   - Storybook for components
   - Percy for visual regression
   - Chromatic for UI review

4. **Create Test Data Factories**
   ```typescript
   // factories/user.ts
   export const createMockUser = (overrides = {}) => ({
     id: '123',
     email: 'test@example.com',
     name: 'Test User',
     ...overrides
   })
   ```

## 💡 Pro Tips

1. **Start with the most critical/fragile code**
2. **Write tests when fixing bugs** (regression tests)
3. **Use tests as documentation** for complex features
4. **Run tests before every commit** with git hooks
5. **Celebrate test wins** - each test adds confidence!

---

Remember: **Perfect is the enemy of good**. Start with simple tests and improve over time!
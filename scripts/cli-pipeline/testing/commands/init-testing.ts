#!/usr/bin/env ts-node

import { Command } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import chalk from 'chalk';
import ora from 'ora';

const program = new Command();

program
  .name('init-testing')
  .description('Initialize testing infrastructure for an app')
  .requiredOption('--app <name>', 'App name to initialize testing for')
  .option('--force', 'Overwrite existing configuration')
  .parse(process.argv);

const options = program.opts();

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function initTesting() {
  const appPath = path.join(process.cwd(), 'apps', options.app);
  const spinner = ora('Initializing testing infrastructure...').start();

  try {
    // Check if app exists
    if (!(await fileExists(appPath))) {
      spinner.fail(chalk.red(`App '${options.app}' not found at ${appPath}`));
      process.exit(1);
    }

    // Create test directories
    const testDirs = [
      'src/test',
      'src/test/setup',
      'tests/e2e',
      'tests/integration',
    ];

    for (const dir of testDirs) {
      const dirPath = path.join(appPath, dir);
      await fs.mkdir(dirPath, { recursive: true });
      spinner.text = `Created ${dir}`;
    }

    // Create vitest.config.ts
    const vitestConfig = `import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData/*',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../../packages/shared'),
    },
  },
})
`;

    const vitestConfigPath = path.join(appPath, 'vitest.config.ts');
    if (await fileExists(vitestConfigPath) && !options.force) {
      spinner.info(chalk.yellow('vitest.config.ts already exists (use --force to overwrite)'));
    } else {
      await fs.writeFile(vitestConfigPath, vitestConfig);
      spinner.succeed(chalk.green('Created vitest.config.ts'));
    }

    // Create test setup file
    const setupContent = `import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({ 
        data: { subscription: { unsubscribe: vi.fn() } } 
      })),
      signIn: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({ 
        data: [], 
        error: null 
      })),
      insert: vi.fn(() => ({ 
        data: null, 
        error: null 
      })),
      update: vi.fn(() => ({ 
        data: null, 
        error: null 
      })),
      delete: vi.fn(() => ({ 
        data: null, 
        error: null 
      })),
    })),
  })),
}))

// Mock environment variables
vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost:54321')
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-key')

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})
`;

    const setupPath = path.join(appPath, 'src/test/setup.ts');
    await fs.writeFile(setupPath, setupContent);
    spinner.succeed(chalk.green('Created test setup file'));

    // Create sample test
    const sampleTest = `import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

// Sample component for testing
function Welcome({ name }: { name: string }) {
  return <h1>Welcome, {name}!</h1>
}

describe('Welcome Component', () => {
  it('renders welcome message', () => {
    render(<Welcome name="Test User" />)
    expect(screen.getByText('Welcome, Test User!')).toBeInTheDocument()
  })

  it('renders with different names', () => {
    const { rerender } = render(<Welcome name="Alice" />)
    expect(screen.getByText('Welcome, Alice!')).toBeInTheDocument()
    
    rerender(<Welcome name="Bob" />)
    expect(screen.getByText('Welcome, Bob!')).toBeInTheDocument()
  })
})
`;

    const sampleTestPath = path.join(appPath, 'src/test/sample.test.tsx');
    await fs.writeFile(sampleTestPath, sampleTest);
    spinner.succeed(chalk.green('Created sample test'));

    // Update package.json
    const packageJsonPath = path.join(appPath, 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
    
    // Add test scripts
    packageJson.scripts = {
      ...packageJson.scripts,
      test: 'vitest',
      'test:ui': 'vitest --ui',
      'test:coverage': 'vitest --coverage',
      'test:watch': 'vitest --watch',
    };

    // Add dev dependencies
    const testDeps = {
      vitest: '^1.1.0',
      '@vitest/ui': '^1.1.0',
      '@vitest/coverage-v8': '^1.1.0',
      '@testing-library/react': '^14.1.2',
      '@testing-library/user-event': '^14.5.2',
      '@testing-library/jest-dom': '^6.1.6',
      jsdom: '^23.2.0',
    };

    packageJson.devDependencies = {
      ...packageJson.devDependencies,
      ...testDeps,
    };

    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
    spinner.succeed(chalk.green('Updated package.json'));

    // Final success message
    spinner.succeed(chalk.green(`\n✅ Testing initialized for ${options.app}!`));
    
    console.log(chalk.cyan('\nNext steps:'));
    console.log(chalk.gray('1. Install dependencies:'), chalk.white(`cd apps/${options.app} && pnpm install`));
    console.log(chalk.gray('2. Run sample test:'), chalk.white('pnpm test'));
    console.log(chalk.gray('3. Open test UI:'), chalk.white('pnpm test:ui'));
    console.log(chalk.gray('4. Start writing tests in:'), chalk.white(`apps/${options.app}/src/`));

  } catch (error) {
    spinner.fail(chalk.red('Failed to initialize testing'));
    console.error(error);
    process.exit(1);
  }
}

// Run initialization
initTesting().catch(console.error);
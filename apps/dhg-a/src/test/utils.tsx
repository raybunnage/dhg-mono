import { render } from '@testing-library/react'
import { ReactElement } from 'react'
import { vi } from 'vitest'

// Mock environment variables for tests
vi.stubGlobal('import.meta', {
  env: {
    VITE_ENV: 'test',
    VITE_APP_NAME: 'DHG Hub (Test)',
    VITE_API_URL: 'https://test-api.dhg-hub.org',
    VITE_FEATURE_FLAGS: 'test'
  }
})

// Add any providers here
const customRender = (ui: ReactElement, options = {}) =>
  render(ui, {
    // wrap provider(s) here if needed
    wrapper: ({ children }) => children,
    ...options,
  })

export * from '@testing-library/react'
export { default as userEvent } from '@testing-library/user-event'
export { customRender as render } 
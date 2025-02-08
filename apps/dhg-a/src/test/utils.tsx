import { render } from '@testing-library/react'
import { ReactElement } from 'react'

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
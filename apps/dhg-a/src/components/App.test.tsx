import { describe, it, expect } from 'vitest'
import { render, screen } from '../test/utils'
import App from '../App'

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />)
    expect(screen.getByRole('main')).toBeInTheDocument()
  })

  it('displays the app title', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: /DHG App A/i })).toBeInTheDocument()
  })

  it('has the correct structure', () => {
    render(<App />)
    expect(screen.getByRole('banner')).toBeInTheDocument() // header
    expect(screen.getByRole('main')).toBeInTheDocument()   // main content
    expect(screen.getByRole('contentinfo')).toBeInTheDocument() // footer
  })
}) 
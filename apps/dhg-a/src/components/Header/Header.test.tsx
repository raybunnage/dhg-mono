import { describe, it, expect } from 'vitest'
import { render, screen } from '../../test/utils'
import Header from './Header'

describe('Header', () => {
  it('renders the logo', () => {
    render(<Header />)
    expect(screen.getByAltText(/logo/i)).toBeInTheDocument()
  })

  it('contains navigation links', () => {
    render(<Header />)
    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })

  it('has accessible landmarks', () => {
    render(<Header />)
    expect(screen.getByRole('banner')).toHaveAttribute('aria-label', 'Main Header')
  })
}) 
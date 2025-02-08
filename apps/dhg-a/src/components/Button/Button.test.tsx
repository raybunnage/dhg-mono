import { describe, it, expect, vi } from 'vitest'
import { render, screen, userEvent } from '../../test/utils'
import Button from './Button'

describe('Button', () => {
  it('renders with default props', () => {
    render(<Button>Click Me</Button>)
    expect(screen.getByRole('button')).toHaveTextContent('Click Me')
  })

  it('handles clicks', async () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Click Me</Button>)
    
    await userEvent.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalledOnce()
  })

  it('can be disabled', () => {
    render(<Button disabled>Click Me</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('applies custom className', () => {
    render(<Button className="custom-class">Click Me</Button>)
    expect(screen.getByRole('button')).toHaveClass('custom-class')
  })
}) 
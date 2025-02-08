import { describe, it, expect } from 'vitest';
import { render, screen, userEvent } from '../../test/utils';
import ThemeToggle from './ThemeToggle';

describe('ThemeToggle', () => {
  it('renders with initial light mode', () => {
    render(<ThemeToggle />);
    expect(screen.getByRole('button')).toHaveTextContent(/dark mode/i);
  });

  it('toggles theme on click', async () => {
    render(<ThemeToggle />);
    const button = screen.getByRole('button');
    
    // Click to dark mode
    await userEvent.click(button);
    expect(document.body.classList.contains('dark-mode')).toBe(true);
    expect(button).toHaveTextContent(/light mode/i);
    
    // Click back to light mode
    await userEvent.click(button);
    expect(document.body.classList.contains('dark-mode')).toBe(false);
    expect(button).toHaveTextContent(/dark mode/i);
  });
}); 
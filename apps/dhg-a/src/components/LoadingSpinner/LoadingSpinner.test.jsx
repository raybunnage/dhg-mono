import { describe, it, expect } from 'vitest';
import { render, screen } from '../../test/utils';
import LoadingSpinner from './LoadingSpinner';

describe('LoadingSpinner', () => {
  it('renders with loading text', () => {
    render(<LoadingSpinner />);
    expect(screen.getByRole('status')).toHaveTextContent(/loading/i);
  });

  it('applies correct size class', () => {
    render(<LoadingSpinner size="lg" />);
    expect(screen.getByRole('status')).toHaveClass('text-2xl');
  });
}); 
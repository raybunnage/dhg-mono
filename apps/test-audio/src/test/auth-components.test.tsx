import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthForm, AuthModal, UserMenu, ProtectedRoute } from '@dhg/shared-components';
import { BrowserRouter } from 'react-router-dom';

describe('Auth Components', () => {
  describe('AuthForm', () => {
    it('renders sign in form by default', () => {
      render(
        <AuthForm 
          mode="signin" 
          onSubmit={vi.fn()} 
        />
      );
      
      expect(screen.getByText('Sign In')).toBeInTheDocument();
      expect(screen.getByLabelText('Email')).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toBeInTheDocument();
    });

    it('renders sign up form', () => {
      render(
        <AuthForm 
          mode="signup" 
          onSubmit={vi.fn()} 
        />
      );
      
      expect(screen.getByText('Sign Up')).toBeInTheDocument();
      expect(screen.getByText('Create a new account to get started.')).toBeInTheDocument();
    });

    it('renders magic link form without password field', () => {
      render(
        <AuthForm 
          mode="magic-link" 
          onSubmit={vi.fn()} 
        />
      );
      
      expect(screen.getByText('Magic Link')).toBeInTheDocument();
      expect(screen.getByLabelText('Email')).toBeInTheDocument();
      expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
    });

    it('submits form with correct data', async () => {
      const onSubmit = vi.fn();
      const user = userEvent.setup();
      
      render(
        <AuthForm 
          mode="signin" 
          onSubmit={onSubmit} 
        />
      );
      
      await user.type(screen.getByLabelText('Email'), 'test@example.com');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));
      
      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
        });
      });
    });

    it('displays error message', () => {
      render(
        <AuthForm 
          mode="signin" 
          onSubmit={vi.fn()} 
          error="Invalid credentials"
        />
      );
      
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });

    it('displays success message', () => {
      render(
        <AuthForm 
          mode="magic-link" 
          onSubmit={vi.fn()} 
          success="Check your email!"
        />
      );
      
      expect(screen.getByText('Check your email!')).toBeInTheDocument();
    });

    it('shows loading state', () => {
      render(
        <AuthForm 
          mode="signin" 
          onSubmit={vi.fn()} 
          loading={true}
        />
      );
      
      expect(screen.getByText('Processing...')).toBeInTheDocument();
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('changes mode when mode change buttons are clicked', async () => {
      const onModeChange = vi.fn();
      const user = userEvent.setup();
      
      render(
        <AuthForm 
          mode="signin" 
          onSubmit={vi.fn()} 
          onModeChange={onModeChange}
        />
      );
      
      await user.click(screen.getByText("Don't have an account? Sign up"));
      expect(onModeChange).toHaveBeenCalledWith('signup');
      
      await user.click(screen.getByText('Sign in with magic link'));
      expect(onModeChange).toHaveBeenCalledWith('magic-link');
    });
  });

  describe('AuthModal', () => {
    it('renders modal when open', () => {
      render(
        <AuthModal 
          open={true}
          onOpenChange={vi.fn()}
          onSubmit={vi.fn()}
        />
      );
      
      expect(screen.getByText('Sign In')).toBeInTheDocument();
    });

    it('does not render modal when closed', () => {
      render(
        <AuthModal 
          open={false}
          onOpenChange={vi.fn()}
          onSubmit={vi.fn()}
        />
      );
      
      expect(screen.queryByText('Sign In')).not.toBeInTheDocument();
    });

    it('calls onOpenChange when close button is clicked', async () => {
      const onOpenChange = vi.fn();
      const user = userEvent.setup();
      
      render(
        <AuthModal 
          open={true}
          onOpenChange={onOpenChange}
          onSubmit={vi.fn()}
        />
      );
      
      await user.click(screen.getByRole('button', { name: /close/i }));
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('UserMenu', () => {
    it('renders user information', () => {
      render(
        <UserMenu 
          user={{
            email: 'test@example.com',
            name: 'Test User',
          }}
          onSignOut={vi.fn()}
        />
      );
      
      expect(screen.getByText('Test User')).toBeInTheDocument();
    });

    it('renders avatar when provided', () => {
      render(
        <UserMenu 
          user={{
            email: 'test@example.com',
            name: 'Test User',
            avatar: 'https://example.com/avatar.jpg',
          }}
          onSignOut={vi.fn()}
        />
      );
      
      const avatar = screen.getByAltText('Test User');
      expect(avatar).toHaveAttribute('src', 'https://example.com/avatar.jpg');
    });

    it('renders default avatar when not provided', () => {
      render(
        <UserMenu 
          user={{
            email: 'test@example.com',
            name: 'Test User',
          }}
          onSignOut={vi.fn()}
        />
      );
      
      expect(screen.getByText('Test User')).toBeInTheDocument();
      // Check for the User icon (Lucide icon)
      expect(document.querySelector('svg')).toBeInTheDocument();
    });

    it('does not render when user is null', () => {
      const { container } = render(
        <UserMenu 
          user={null}
          onSignOut={vi.fn()}
        />
      );
      
      expect(container.firstChild).toBeNull();
    });
  });

  describe('ProtectedRoute', () => {
    it('renders children when authenticated', () => {
      render(
        <BrowserRouter>
          <ProtectedRoute isAuthenticated={true}>
            <div>Protected Content</div>
          </ProtectedRoute>
        </BrowserRouter>
      );
      
      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });

    it('redirects when not authenticated', () => {
      render(
        <BrowserRouter>
          <ProtectedRoute isAuthenticated={false} redirectTo="/login">
            <div>Protected Content</div>
          </ProtectedRoute>
        </BrowserRouter>
      );
      
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });

    it('shows loading state', () => {
      render(
        <BrowserRouter>
          <ProtectedRoute isAuthenticated={false} isLoading={true}>
            <div>Protected Content</div>
          </ProtectedRoute>
        </BrowserRouter>
      );
      
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
      // Check for loading spinner
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });
  });
});
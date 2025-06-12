import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { LivingDocsPage } from '../pages/LivingDocsPage';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the hooks and services
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: '1', email: 'test@example.com' },
    loading: false
  })
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() => Promise.resolve({
          data: mockDocuments,
          error: null
        }))
      }))
    }))
  }
}));

vi.mock('@shared/services/server-registry-service', () => ({
  serverRegistry: {
    getServerUrl: vi.fn(() => 'http://localhost:3001')
  }
}));

const mockDocuments = [
  {
    fileName: 'test-document.md',
    path: 'docs/living-docs/test-document.md',
    description: 'A test document for search functionality',
    category: 'testing',
    priority: 'high',
    status: 'active',
    updateFrequency: 'weekly',
    lastUpdated: '2025-06-11T10:00:00Z'
  },
  {
    fileName: 'another-doc.md',
    path: 'docs/living-docs/another-doc.md',
    description: 'Another document for testing filters',
    category: 'development',
    priority: 'medium',
    status: 'active',
    updateFrequency: 'daily',
    lastUpdated: '2025-06-10T10:00:00Z'
  },
  {
    fileName: 'critical-doc.md',
    path: 'docs/living-docs/critical-doc.md',
    description: 'Critical priority document',
    category: 'infrastructure',
    priority: 'critical',
    status: 'active',
    updateFrequency: 'on-change',
    lastUpdated: '2025-06-09T10:00:00Z'
  }
];

const renderLivingDocsPage = () => {
  return render(
    <BrowserRouter>
      <LivingDocsPage />
    </BrowserRouter>
  );
};

describe('LivingDocsPage Search and Filter Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Search Functionality', () => {
    it('renders search input with placeholder text', async () => {
      renderLivingDocsPage();
      
      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('Search documents...');
        expect(searchInput).toBeInTheDocument();
      });
    });

    it('updates search query when user types', async () => {
      renderLivingDocsPage();
      
      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('Search documents...');
        fireEvent.change(searchInput, { target: { value: 'test' } });
        expect(searchInput.value).toBe('test');
      });
    });

    it('filters documents by filename when searching', async () => {
      renderLivingDocsPage();
      
      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('Search documents...');
        fireEvent.change(searchInput, { target: { value: 'test-document' } });
      });

      // Should show only the test-document
      await waitFor(() => {
        expect(screen.getByText('test-document')).toBeInTheDocument();
        expect(screen.queryByText('another-doc')).not.toBeInTheDocument();
      });
    });

    it('filters documents by description when searching', async () => {
      renderLivingDocsPage();
      
      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('Search documents...');
        fireEvent.change(searchInput, { target: { value: 'search functionality' } });
      });

      // Should show only the document with matching description
      await waitFor(() => {
        expect(screen.getByText('test-document')).toBeInTheDocument();
      });
    });

    it('filters documents by category when searching', async () => {
      renderLivingDocsPage();
      
      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('Search documents...');
        fireEvent.change(searchInput, { target: { value: 'testing' } });
      });

      // Should show only the document with testing category
      await waitFor(() => {
        expect(screen.getByText('test-document')).toBeInTheDocument();
      });
    });

    it('shows no results message when search has no matches', async () => {
      renderLivingDocsPage();
      
      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('Search documents...');
        fireEvent.change(searchInput, { target: { value: 'nonexistent' } });
      });

      await waitFor(() => {
        expect(screen.getByText(/no documents found matching/i)).toBeInTheDocument();
      });
    });

    it('is case insensitive', async () => {
      renderLivingDocsPage();
      
      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('Search documents...');
        fireEvent.change(searchInput, { target: { value: 'TEST' } });
      });

      await waitFor(() => {
        expect(screen.getByText('test-document')).toBeInTheDocument();
      });
    });
  });

  describe('Filter Pills Functionality', () => {
    it('renders all filter pills', async () => {
      renderLivingDocsPage();
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /all \(\d+\)/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /recent/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /high priority/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /needs update/i })).toBeInTheDocument();
      });
    });

    it('shows active state for "All" filter by default', async () => {
      renderLivingDocsPage();
      
      await waitFor(() => {
        const allButton = screen.getByRole('button', { name: /all \(\d+\)/i });
        expect(allButton).toHaveClass('bg-blue-600', 'text-white');
      });
    });

    it('changes active filter when pill is clicked', async () => {
      renderLivingDocsPage();
      
      await waitFor(() => {
        const highPriorityButton = screen.getByRole('button', { name: /high priority/i });
        fireEvent.click(highPriorityButton);
        expect(highPriorityButton).toHaveClass('bg-blue-600', 'text-white');
      });
    });

    it('filters documents by high priority when High Priority pill is active', async () => {
      renderLivingDocsPage();
      
      await waitFor(() => {
        const highPriorityButton = screen.getByRole('button', { name: /high priority/i });
        fireEvent.click(highPriorityButton);
      });

      // Should show high and critical priority documents
      await waitFor(() => {
        expect(screen.getByText('test-document')).toBeInTheDocument(); // high priority
        expect(screen.getByText('critical-doc')).toBeInTheDocument(); // critical priority
        expect(screen.queryByText('another-doc')).not.toBeInTheDocument(); // medium priority
      });
    });
  });

  describe('Combined Search and Filter', () => {
    it('applies both search and filter simultaneously', async () => {
      renderLivingDocsPage();
      
      // Apply high priority filter
      await waitFor(() => {
        const highPriorityButton = screen.getByRole('button', { name: /high priority/i });
        fireEvent.click(highPriorityButton);
      });

      // Then search for specific text
      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('Search documents...');
        fireEvent.change(searchInput, { target: { value: 'test' } });
      });

      // Should show only high priority documents matching search
      await waitFor(() => {
        expect(screen.getByText('test-document')).toBeInTheDocument();
        expect(screen.queryByText('critical-doc')).not.toBeInTheDocument();
        expect(screen.queryByText('another-doc')).not.toBeInTheDocument();
      });
    });
  });

  describe('Results Count Display', () => {
    it('shows results count when filters are active', async () => {
      renderLivingDocsPage();
      
      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('Search documents...');
        fireEvent.change(searchInput, { target: { value: 'test' } });
      });

      await waitFor(() => {
        expect(screen.getByText(/showing \d+ of \d+ documents/i)).toBeInTheDocument();
      });
    });

    it('shows search term in results count', async () => {
      renderLivingDocsPage();
      
      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('Search documents...');
        fireEvent.change(searchInput, { target: { value: 'test document' } });
      });

      await waitFor(() => {
        expect(screen.getByText(/matching "test document"/i)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('search input has proper focus styles', async () => {
      renderLivingDocsPage();
      
      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('Search documents...');
        expect(searchInput).toHaveClass('focus:outline-none', 'focus:ring-2', 'focus:ring-blue-500');
      });
    });

    it('filter pills are keyboard accessible', async () => {
      renderLivingDocsPage();
      
      await waitFor(() => {
        const allButton = screen.getByRole('button', { name: /all \(\d+\)/i });
        expect(allButton).toBeInTheDocument();
        expect(allButton.tagName).toBe('BUTTON');
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles empty search gracefully', async () => {
      renderLivingDocsPage();
      
      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('Search documents...');
        fireEvent.change(searchInput, { target: { value: '' } });
      });

      // Should show all documents when search is empty
      await waitFor(() => {
        expect(screen.getByText('test-document')).toBeInTheDocument();
        expect(screen.getByText('another-doc')).toBeInTheDocument();
        expect(screen.getByText('critical-doc')).toBeInTheDocument();
      });
    });

    it('handles special characters in search', async () => {
      renderLivingDocsPage();
      
      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('Search documents...');
        fireEvent.change(searchInput, { target: { value: '@#$%' } });
      });

      await waitFor(() => {
        expect(screen.getByText(/no documents found matching/i)).toBeInTheDocument();
      });
    });

    it('handles very long search terms', async () => {
      renderLivingDocsPage();
      
      const longSearchTerm = 'a'.repeat(1000);
      
      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('Search documents...');
        fireEvent.change(searchInput, { target: { value: longSearchTerm } });
      });

      await waitFor(() => {
        expect(screen.getByText(/no documents found matching/i)).toBeInTheDocument();
      });
    });
  });
});
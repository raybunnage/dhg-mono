/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      typography: {
        DEFAULT: {
          css: {
            maxWidth: 'none',
            color: '#374151',
            h1: {
              fontWeight: '700',
              fontSize: '2.25rem',
              marginTop: '1.5rem',
              marginBottom: '1rem',
              lineHeight: '2.5rem',
            },
            h2: {
              fontWeight: '600',
              fontSize: '1.875rem',
              marginTop: '1.5rem',
              marginBottom: '0.75rem',
              lineHeight: '2.25rem',
            },
            h3: {
              fontWeight: '600',
              fontSize: '1.5rem',
              marginTop: '1.25rem',
              marginBottom: '0.5rem',
              lineHeight: '2rem',
            },
            'code::before': {
              content: '""',
            },
            'code::after': {
              content: '""',
            },
            code: {
              backgroundColor: '#f3f4f6',
              padding: '0.125rem 0.25rem',
              borderRadius: '0.25rem',
              fontWeight: '500',
              fontSize: '0.875rem',
            },
            pre: {
              backgroundColor: '#1f2937',
              color: '#e5e7eb',
              overflowX: 'auto',
              fontSize: '0.875rem',
              lineHeight: '1.5rem',
              marginTop: '1rem',
              marginBottom: '1rem',
              borderRadius: '0.5rem',
              padding: '1rem',
            },
            'pre code': {
              backgroundColor: 'transparent',
              padding: '0',
              color: 'inherit',
              fontSize: 'inherit',
              fontWeight: 'inherit',
              borderRadius: '0',
            },
            a: {
              color: '#2563eb',
              textDecoration: 'underline',
              fontWeight: '500',
              '&:hover': {
                color: '#1d4ed8',
              },
            },
            blockquote: {
              borderLeftColor: '#e5e7eb',
              borderLeftWidth: '0.25rem',
              paddingLeft: '1rem',
              fontStyle: 'italic',
              color: '#6b7280',
              marginTop: '1rem',
              marginBottom: '1rem',
            },
            ul: {
              listStyleType: 'disc',
              paddingLeft: '1.5rem',
              marginTop: '0.5rem',
              marginBottom: '0.5rem',
            },
            ol: {
              listStyleType: 'decimal',
              paddingLeft: '1.5rem',
              marginTop: '0.5rem',
              marginBottom: '0.5rem',
            },
            li: {
              marginTop: '0.25rem',
              marginBottom: '0.25rem',
            },
            table: {
              width: '100%',
              borderCollapse: 'collapse',
              marginTop: '1rem',
              marginBottom: '1rem',
            },
            thead: {
              borderBottomWidth: '2px',
              borderBottomColor: '#e5e7eb',
            },
            'thead th': {
              fontWeight: '600',
              padding: '0.75rem',
              textAlign: 'left',
            },
            'tbody td': {
              padding: '0.75rem',
              borderBottomWidth: '1px',
              borderBottomColor: '#f3f4f6',
            },
            'tbody tr:last-child td': {
              borderBottomWidth: '0',
            },
            hr: {
              borderColor: '#e5e7eb',
              marginTop: '2rem',
              marginBottom: '2rem',
            },
            p: {
              marginTop: '0.75rem',
              marginBottom: '0.75rem',
              lineHeight: '1.75rem',
            },
          }
        }
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}


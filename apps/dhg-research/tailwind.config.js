/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "../../packages/shared/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Orange theme colors to match dhg-admin-code style
        primary: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',  // Main brand color
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',  // Darkest
        },
        background: {
          DEFAULT: '#fff7ed',  // Light orange background
          paper: '#ffffff',
          elevated: '#fef3e2',
          hover: '#fed7aa',
        },
        text: {
          primary: '#7c2d12',     // Dark orange for main text
          secondary: '#c2410c',   // Medium orange for secondary text
          muted: '#9a3412',      // Muted orange
          disabled: '#fed7aa',   // Light orange for disabled
        },
        border: {
          DEFAULT: '#fed7aa',
          light: '#fef3e2',
          dark: '#ea580c',
        },
        success: {
          DEFAULT: '#16a34a',
          dark: '#15803d',
        },
        warning: {
          DEFAULT: '#eab308',
          dark: '#ca8a04',
        },
        error: {
          DEFAULT: '#dc2626',
          dark: '#b91c1c',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
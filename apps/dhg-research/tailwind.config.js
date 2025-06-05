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
        // Dark blue theme colors
        primary: {
          50: '#e6f1ff',
          100: '#b3d1ff',
          200: '#80b2ff',
          300: '#4d93ff',
          400: '#1a74ff',
          500: '#0055e6',  // Main brand color
          600: '#0044b3',
          700: '#003380',
          800: '#00224d',
          900: '#00111a',  // Darkest
        },
        background: {
          DEFAULT: '#00111a',
          paper: '#001933',
          elevated: '#002244',
          hover: '#003355',
        },
        text: {
          primary: '#ffffff',
          secondary: '#b3d1ff',
          muted: '#6699cc',
          disabled: '#4d6680',
        },
        border: {
          DEFAULT: '#003355',
          light: '#004466',
          dark: '#001122',
        },
        success: {
          DEFAULT: '#00cc66',
          dark: '#009944',
        },
        warning: {
          DEFAULT: '#ffaa00',
          dark: '#cc8800',
        },
        error: {
          DEFAULT: '#ff4444',
          dark: '#cc0000',
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
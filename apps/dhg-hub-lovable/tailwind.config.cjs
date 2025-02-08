/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#00A3E0', // Ocean blue
          50: '#E6F6FC',
          100: '#CCE9F9',
          200: '#99D3F3',
          300: '#66BDED',
          400: '#33A7E7',
          500: '#00A3E0', // Base color
          600: '#0082B3',
          700: '#006286',
          800: '#004159',
          900: '#00212C',
        },
        secondary: {
          DEFAULT: '#0B7285', // Darker blue for contrast
          50: '#E6F3F5',
          100: '#CCE7EC',
          200: '#99CFD9',
          300: '#66B7C6',
          400: '#339FB3',
          500: '#0B7285',
          600: '#095B6A',
          700: '#074450',
          800: '#042E35',
          900: '#02171B',
        },
        accent: {
          DEFAULT: '#FF6B00', // Orange accent
          light: '#FF8533',
          dark: '#CC5500',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        serif: ['Merriweather', 'serif'],
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
} 
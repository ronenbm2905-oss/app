/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Rubik נטען מ-Google Fonts ב-index.html
        sans: ['Rubik', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

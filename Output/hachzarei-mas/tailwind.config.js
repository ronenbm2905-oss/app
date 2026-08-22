/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './mas-shevach.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // §8.2 באפיון. אין אדום אזהרה ואין גרדיאנטים — קהל שמוסר נתונים
        // פיננסיים בורח מדחיפות מזויפת.
        bg: '#FFFFFF',
        surface: '#F7F8FA',
        ink: '#1A1D24',
        muted: '#5B6270',
        brand: '#0E5FD8',
        'brand-dark': '#0A4AAB',
        whatsapp: '#25D366',
        success: '#0F9D58',
        line: '#E3E6EC',
      },
      fontFamily: {
        sans: ['Assistant', 'system-ui', 'Arial', 'sans-serif'],
      },
      fontSize: {
        // הקהל כולל בני 60+ — בסיס 17px ולא פחות (§8.1)
        base: ['1.0625rem', { lineHeight: '1.6' }],
      },
      minHeight: {
        touch: '48px', // אזור מגע מינימלי (§8.1)
      },
    },
  },
  plugins: [],
};

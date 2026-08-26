/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // שלוש הרמות של דוח הבוקר. הן קבועות ושמן מדבר, כדי שאף רכיב לא
        // ימציא גוון משלו ל"דורש טיפול".
        action: { bg: '#fef2f2', border: '#fecaca', fg: '#b91c1c' },
        review: { bg: '#fffbeb', border: '#fde68a', fg: '#b45309' },
        quiet: { bg: '#f8fafc', border: '#e2e8f0', fg: '#64748b' },
      },
      fontFamily: {
        // פונטים מקומיים בלבד. **בלי CDN של Google** — דגל M3 של עדי, שחזר
        // פעמיים; טעינת פונט מ-CDN היא העברת IP של המבקר לצד שלישי.
        sans: ['Segoe UI', 'Arial', 'Helvetica', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

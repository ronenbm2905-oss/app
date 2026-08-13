/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // ---- שפת המותג (placeholder): יוקרה קלאסית + רוז־גולד ----
        // מקור: תיאור הלוגו בבריף — סקריפט מהודר, יהלום מכתיר, רקע דמשק/שיש קרם.
        ivory: "#FAF7F2",
        sand: "#F1EAE1",
        line: "#E2D7C9",
        ink: "#1B1815",
        muted: "#5F564C", // 7.3:1 על ivory — AA לטקסט קטן
        rose: {
          50: "#FDF5F4",
          100: "#F9E8E6",
          200: "#F1D2CE",
          300: "#E3B2AC",
          400: "#CE8B87",
          500: "#B26A70",
          600: "#96505A", // 6.4:1 על לבן — AA לטקסט ולכפתורים
          700: "#7A4049",
          800: "#5D3138",
          900: "#43242A",
        },
        gold: {
          400: "#C9A96A",
          500: "#B08D57",
          600: "#8E6F41", // 4.9:1 על ivory
        },
      },
      fontFamily: {
        // Heebo לעברית/לטינית; Cormorant לכותרות ה"סריף" של המותג.
        sans: ['"Heebo"', "system-ui", "-apple-system", "Segoe UI", "Arial", "sans-serif"],
        display: ['"Cormorant Garamond"', '"Heebo"', "Georgia", "serif"],
      },
      letterSpacing: {
        brand: "0.22em",
      },
      boxShadow: {
        card: "0 1px 2px rgba(27,24,21,.05), 0 8px 24px -12px rgba(27,24,21,.18)",
        sheet: "0 -8px 40px -12px rgba(27,24,21,.35)",
      },
      keyframes: {
        shimmer: { "100%": { transform: "translateX(100%)" } },
        sheetUp: { from: { transform: "translateY(100%)" }, to: { transform: "translateY(0)" } },
        fadeIn: { from: { opacity: "0" }, to: { opacity: "1" } },
      },
      animation: {
        shimmer: "shimmer 1.6s infinite",
        sheetUp: "sheetUp .22s ease-out",
        fadeIn: "fadeIn .18s ease-out",
      },
    },
  },
  plugins: [],
};

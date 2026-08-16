/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      // טון: אמינות פיננסית, לא סטארט-אפ (בריף ס' 8).
      // זו קונסולה פנימית — פונקציונלית, שקטה, בלי צבעי חג.
      colors: {
        ink: { DEFAULT: "#16202b", soft: "#4a5a6a", faint: "#8b9aa8" },
        paper: { DEFAULT: "#f7f8f9", card: "#ffffff", line: "#e2e6ea" },
        accent: { DEFAULT: "#1f4e6b", soft: "#eaf1f6" },
        warn: { DEFAULT: "#8a5a00", soft: "#fdf4e3" },
        danger: { DEFAULT: "#98322b", soft: "#fbeceb" },
        good: { DEFAULT: "#1f6b4a", soft: "#e9f4ef" },
      },
      fontFamily: {
        sans: ["Assistant", "Rubik", "Segoe UI", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

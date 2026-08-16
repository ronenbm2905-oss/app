/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#dbe7ff",
          200: "#bcd2ff",
          500: "#2f6bff",
          600: "#1d54e0",
          700: "#1642b8",
          800: "#123390",
        },
      },
      fontFamily: {
        sans: ["Assistant", "Segoe UI", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

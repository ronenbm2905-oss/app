/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Club / association identity. brand = Kiryat Ono royal blue (≈ IBBA #2355A5),
        // the single primary for all interaction. accent = the club-logo orange, used
        // only as a small branding touch — never for buttons/links.
        brand: {
          50: "#EEF3FA",
          100: "#D6E1F2",
          200: "#B0C4E4",
          300: "#7F9FD1",
          400: "#4E79BD",
          500: "#2F5FAC",
          600: "#2355A5",
          700: "#1D4788",
          800: "#17386B",
          900: "#122A50",
        },
        accent: {
          400: "#F79A5B",
          500: "#F58634",
          600: "#E5731F",
        },
      },
    },
  },
  plugins: [],
};

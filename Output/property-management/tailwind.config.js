/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // --- מהלך A: סקאלת brand הקיימת ממופה מחדש (אפס-churn) ---
        brand: { 50: "#EAF3FC", 100: "#CFE7FB", 500: "#0081E8", 600: "#002C49", 700: "#005FA8" },
        // --- מהלך B: משפחות סמנטיות (מערכת העיצוב) ---
        navy: { DEFAULT: "#002C49", deep: "#001E33", surface: "#013D63", border: "#0B4E7A", rule: "#073E60" },
        accent: { DEFAULT: "#0081E8", light: "#00A0F0" },
        link: "#005FA8",
        ink: { body: "#3F5566", muted: "#6B7C8B", faint: "#9AA7B2" },
        onnavy: { DEFAULT: "#FFFFFF", muted: "#8FA3B4", faint: "#7C93A6" },
        surface: { DEFAULT: "#FFFFFF", alt: "#F2F6F9", sunk: "#E4EBF1" },
        border: { DEFAULT: "#D8E1E8" },
        success: { fill: "#E4F4EA", text: "#15683F", solid: "#1E7A48" },
        danger: { fill: "#FCE9E7", text: "#B42318", solid: "#C0362A" },
        warning: { fill: "#FBEFD9", text: "#8A5A06", solid: "#B9791A" },
        info: { fill: "#E6F1FB", text: "#005FA8", solid: "#0081E8" },
      },
      borderColor: { DEFAULT: "#D8E1E8" }, // `border` חשוף = hairline המותג
      fontFamily: {
        sans: ["Assistant", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        ui: ["Heebo", "Assistant", "system-ui", "sans-serif"],
      },
      borderRadius: {
        none: "0", sm: "2px", DEFAULT: "2px", md: "3px",
        lg: "4px", xl: "5px", "2xl": "6px", "3xl": "8px", full: "9999px",
      },
      boxShadow: {
        brand: "0 24px 80px rgba(0,44,73,.12)",
        focus: "0 0 0 3px rgba(0,129,232,.35)",
      },
      fontSize: {
        stat: ["34px", { lineHeight: "1", letterSpacing: "-0.02em" }],
        "stat-lg": ["44px", { lineHeight: "1", letterSpacing: "-0.02em" }],
        eyebrow: ["12px", { lineHeight: "1", letterSpacing: "0.14em" }],
      },
    },
  },
  plugins: [],
};

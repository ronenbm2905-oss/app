/** @type {import('tailwindcss').Config} */
// ============================================================================
// מקור: itai/Outputs/2026-08-13-nrcar-design.md §4 — מועתק כלשונו.
// ============================================================================
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    // fontSize מוגדר ברמת theme (לא ב-extend) בכוונה:
    // הוא מחליף את הסקאלה של Tailwind, ולכן `text-xs` פשוט לא קיים.
    // שימוש בו לא פולט CSS — הטקסט יישאר בגודל שירש (18px) במקום להתכווץ ל-12px.
    // בסיס: html { font-size: 112.5% } = 18px. rem אחד = 18px.
    // ⚠️ אל תעביר את הבלוק הזה ל-extend — זה מחזיר את text-xs לחיים בשקט.
    fontSize: {
      sm: ["0.889rem", { lineHeight: "1.333rem" }], // 16px / 24px — רצפה
      base: ["1rem", { lineHeight: "1.556rem" }], // 18px / 28px
      lg: ["1.111rem", { lineHeight: "1.778rem" }], // 20px / 32px — ברירת מחדל לתוכן
      xl: ["1.333rem", { lineHeight: "1.889rem" }], // 24px / 34px
      "2xl": ["1.667rem", { lineHeight: "2.222rem" }], // 30px / 40px
      "3xl": ["2.222rem", { lineHeight: "2.556rem" }], // 40px / 46px
    },
    extend: {
      colors: {
        canvas: "#eef4fa",
        surface: { DEFAULT: "#ffffff", sunken: "#e2e8f0" },
        ink: { DEFAULT: "#1e293b", strong: "#0f172a", soft: "#334155", muted: "#475569" },
        line: { DEFAULT: "#64748b", soft: "#cbd5e1" },
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          600: "#1d4ed8",
          700: "#1e40af",
          800: "#1e3a8a",
        },
        ok: { 50: "#ecfdf5", 100: "#d1fae5", 600: "#047857", 700: "#065f46" },
        warn: { 50: "#fffbeb", 100: "#fef3c7", 600: "#b45309", 700: "#92400e" },
        danger: { 50: "#fef2f2", 100: "#fee2e2", 600: "#b91c1c", 700: "#991b1b", 900: "#7f1d1d" },
      },
      fontFamily: {
        sans: ["Assistant", "Segoe UI", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,23,42,.06), 0 2px 10px rgba(15,23,42,.06)",
        hero: "0 2px 4px rgba(15,23,42,.08), 0 8px 24px rgba(15,23,42,.10)",
        nav: "0 -2px 12px rgba(15,23,42,.10)",
      },
      maxWidth: {
        app: "560px", // עמודת האפליקציה — מובייל-פירסט, ממורכזת בדסקטופ
        prose: "38ch", // אורך שורה מרבי לפסקת הסבר
      },
    },
  },
  plugins: [],
};

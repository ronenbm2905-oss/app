/** @type {import('tailwindcss').Config} */
// ============================================================================
// שפת העיצוב: "נייר אחד, דיו אחד, קו אחד".
// מקור יחיד: itai/Outputs/2026-08-13-absolut-diamonds-design-language.md §1.4
//
// שני דברים מוגדרים כאן **מחוץ** ל-extend, בכוונה — כדי שהם יהיו מבניים ולא
// משמעת עצמית:
//   • borderRadius — כל סולם ה-radius של Tailwind נמחק. `rounded-2xl` שנשכח
//     בקוד פשוט לא מייצר class, במקום להחזיר פינות דרך הדלת האחורית.
//   • boxShadow — אין צללים. בשום מקום. `shadow-lg` שנשכח = no-op.
// ============================================================================
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    // radius 0 בכל מקום. יוצא הדופן היחיד: pill לצ'יפים/בוררים ול-FAB.
    borderRadius: { none: "0", DEFAULT: "0", pill: "9999px" },
    // הפרדה = קו שיער או רווח. לא צל.
    boxShadow: { none: "none" },
    extend: {
      colors: {
        paper: "#F7F7F7",
        surface: "#FFFFFF",
        alt: "#EDE8E0",
        ink: { DEFAULT: "#14110F", 80: "#45413D" },
        muted: "#63605A", // הוכהה מ-#6E6A66 — 5.85 paper / 5.14 alt / 6.27 surface
        line: { DEFAULT: "#E2E0DC", strong: "#837E77" }, // strong = גבול רכיב אינטראקטיבי (1.4.11)
        champagne: "#C9AE87", // דקורטיבי בלבד — לעולם לא טקסט
        gold: { DEFAULT: "#9A7B4F", ink: "#7A5F35" }, // gold.ink = הזהב היחיד מותר-לטקסט
        danger: "#8A2C22", // טפסים + מסך הניהול בלבד
        scrim: "rgba(20,17,15,0.88)", // רק לתווית חובה על תמונה
      },
      fontFamily: {
        sans: ['"Assistant"', "system-ui", "-apple-system", "Segoe UI", "Arial", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontSize: {
        display1: ["2rem", { lineHeight: "1.08", letterSpacing: "-0.005em" }], // 32
        display1Lg: ["3.25rem", { lineHeight: "1.02", letterSpacing: "-0.01em" }], // 52
        display2: ["1.625rem", { lineHeight: "1.15" }], // 26
        display2Lg: ["2.25rem", { lineHeight: "1.08", letterSpacing: "-0.005em" }], // 36
        section: ["1.125rem", { lineHeight: "1.25", letterSpacing: "0.06em" }], // 18
        sectionLg: ["1.5rem", { lineHeight: "1.2" }], // 24
        title: ["1rem", { lineHeight: "1.4" }], // 16
        titleLg: ["1.125rem", { lineHeight: "1.35" }], // 18
        eyebrow: ["0.75rem", { lineHeight: "1.3", letterSpacing: "0.06em" }], // 12
        body: ["1rem", { lineHeight: "1.7" }], // 16
        bodyLg: ["1.0625rem", { lineHeight: "1.65" }], // 17
        meta: ["0.875rem", { lineHeight: "1.55" }], // 14
        spec: ["0.9375rem", { lineHeight: "1.5" }], // 15 — שורת מפרט, טקסט הסכמה
        button: ["0.9375rem", { lineHeight: "1", letterSpacing: "0.02em" }], // 15
        priceTotal: ["1.5rem", { lineHeight: "1.1" }], // 24
        priceTotalLg: ["1.75rem", { lineHeight: "1.05" }], // 28
        disclosure: ["0.8125rem", { lineHeight: "1.4" }], // 13 — תווית A1ד
        micro: ["0.6875rem", { lineHeight: "1.5", letterSpacing: "0.14em" }], // 11
      },
      letterSpacing: {
        heLabel: "0.06em",
        heSection: "0.08em",
        enLabel: "0.18em",
        enSection: "0.14em",
        wordmarkHe: "0.12em",
        wordmarkEn: "0.30em",
      },
      maxWidth: { content: "1440px", prose: "60ch" },
      spacing: { gutter: "1.5rem", section: "3rem" },
      transitionDuration: { hover: "200ms", enter: "500ms" },
      backgroundImage: {
        stripe: "repeating-linear-gradient(135deg,#EDE8E0 0 6px,#F4F1EC 6px 12px)",
      },
      keyframes: {
        enter: { from: { opacity: "0", transform: "translateY(12px)" }, to: { opacity: "1", transform: "none" } },
        sheetUp: { from: { transform: "translateY(100%)" }, to: { transform: "translateY(0)" } },
        fadeIn: { from: { opacity: "0" }, to: { opacity: "1" } },
      },
      animation: {
        enter: "enter .5s ease-out both",
        sheetUp: "sheetUp .22s ease-out",
        fadeIn: "fadeIn .18s ease-out",
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // פלטת הקלפים: טורקיז הגב + קרם רקע (מתוך שפת המותג "הדרך למילים")
        cardback: "#8ECFDD",
        cardbackDark: "#3E7C8C",
        cream: "#FAF7EF",
        happy: "#FBC02D",
        sad: "#5C9CE6",
        angry: "#EF5350",
        excited: "#AB47BC",
      },
      fontFamily: {
        sans: ['"Varela Round"', '"Segoe UI"', "system-ui", "sans-serif"],
      },
      keyframes: {
        pop: { "0%": { transform: "scale(0.8)", opacity: "0" }, "100%": { transform: "scale(1)", opacity: "1" } },
        shake: {
          "0%,100%": { transform: "translateX(0)" },
          "20%,60%": { transform: "translateX(-8px)" },
          "40%,80%": { transform: "translateX(8px)" },
        },
        flip: { from: { transform: "rotateY(90deg)" }, to: { transform: "rotateY(0deg)" } },
      },
      animation: {
        pop: "pop 0.25s ease-out",
        shake: "shake 0.4s ease-in-out",
        flip: "flip 0.3s ease-out",
      },
    },
  },
  plugins: [],
};

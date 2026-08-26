import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // כתובת IPv4 מפורשת. ברירת המחדל של Vite ("localhost") נפתרה כאן ל-IPv6
    // בלבד, כך ש-127.0.0.1 החזיר "connection refused" ודפדפן שמעדיף IPv4
    // פשוט לא הצליח להתחבר.
    host: "127.0.0.1",
    port: 5192,
    strictPort: true,
  },
});

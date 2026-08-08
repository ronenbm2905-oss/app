import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// The live Kiryat Ono project. Builds for the multi-club (SaaS) environment must
// never point at it, and SaaS-environment keys must never end up in a production build.
const PROD_PROJECT_ID = "basketball-schedule-f0f57";

// Vite always loads `.env` on top of `.env.[mode]`, so `--mode saas` on its own does
// NOT isolate a build from production keys — it only overrides the keys that
// `.env.saas` actually defines. These guards turn that silent footgun into a loud
// failure, in the same spirit as the incident where a stray `.env.local` produced a
// Firebase-disabled build that looked exactly like data loss.
function envGuard(mode) {
  return {
    name: "club-env-guard",
    configResolved(config) {
      const env = loadEnv(mode, process.cwd(), "VITE_");
      const projectId = env.VITE_FIREBASE_PROJECT_ID || "";

      // The dev server is guarded too, not just builds. Kiryat Ono uses the live app
      // every day, and until the multi-club project exists `.env` still points at
      // THEIR Firestore — so `npm run dev` on this branch plus a sign-in as admin
      // would be editing their real data, and "publish week" would write into their
      // live project. Running against production from this branch is never intended.
      if (config.command === "serve") {
        if (projectId === PROD_PROJECT_ID) {
          throw new Error(
            `\n\n  ✖ Dev server blocked: this branch is the multi-club version, but the ` +
              `environment resolves to the LIVE Kiryat Ono project (${PROD_PROJECT_ID}).\n` +
              `    Running here would read and write the club's real data.\n\n` +
              `    Either:\n` +
              `      • create .env.saas for the new project and run:  npm run dev:saas\n` +
              `      • or work offline in local mode:  create .env.local with empty VITE_FIREBASE_* keys\n` +
              `      • to work on the live app, switch to the main branch\n`
          );
        }
        return; // empty (local mode) or the new project — both fine
      }

      if (config.command !== "build") return;

      // This branch builds ONE thing: the multi-club app for its own project.
      // A plain `npm run build` here used to succeed and quietly produce a build of
      // the multi-club code aimed at Kiryat Ono's project — one `--project prod`
      // away from replacing the app their coaches use every day. Kiryat Ono is
      // built from the `main` branch, which has its own vite.config.js.
      if (mode !== "saas") {
        throw new Error(
          `\n\n  ✖ Build aborted: this is the multi-club branch, which only builds with ` +
            `--mode saas.\n    Use:  npm run build:saas\n` +
            `    To build the live Kiryat Ono app, switch to the main branch first.\n`
        );
      }
      if (projectId === PROD_PROJECT_ID) {
        throw new Error(
          `\n\n  ✖ Build aborted: --mode saas resolved to the PRODUCTION Firebase project ` +
            `(${PROD_PROJECT_ID}).\n    Fill in ALL VITE_FIREBASE_* keys in .env.saas for the ` +
            `multi-club project.\n    (Vite loads .env on top of .env.saas, so any key you leave ` +
            `out falls through to production.)\n`
        );
      }
      if (!projectId) {
        throw new Error(
          `\n\n  ✖ Build aborted: no VITE_FIREBASE_PROJECT_ID resolved, so this build would ship ` +
            `in LOCAL MODE\n    (localStorage only, no cloud sync) — which looks identical to total ` +
            `data loss once deployed.\n    Check for an empty/stray .env.local.\n`
        );
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), envGuard(mode)],
}));

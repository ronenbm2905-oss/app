// Runtime club theming.
//
// The brand-*/accent-* Tailwind classes resolve to CSS variables (see
// tailwind.config.js + the :root block in index.css) instead of fixed hex values.
// Setting those variables here re-skins every existing class across the app —
// no component needs to know a club's colors.
//
// The variables hold space-separated RGB channels ("35 85 165") rather than hex,
// which is what Tailwind's `rgb(var(--x) / <alpha-value>)` syntax requires so that
// opacity modifiers like `bg-brand-600/50` keep working.

import { DEFAULT_SETTINGS } from "../constants";

// How each step is derived from the base color: positive = mix toward white,
// negative = mix toward black. These ratios reproduce the original hand-picked
// Kiryat Ono palette almost exactly, so an unthemed club looks unchanged.
const BRAND_STEPS = {
  50: 0.92, 100: 0.81, 200: 0.64, 300: 0.42, 400: 0.2,
  500: 0.055, 600: 0, 700: -0.17, 800: -0.34, 900: -0.5,
};
const ACCENT_STEPS = { 400: 0.18, 500: 0, 600: -0.1 };

const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));

// Accepts "#RGB" or "#RRGGBB" (with or without the #). Returns null when unparseable
// so a bad value in Firestore falls back to the default instead of blanking the UI.
export function hexToRgb(hex) {
  if (typeof hex !== "string") return null;
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

// ratio > 0 mixes toward white, < 0 toward black, 0 returns the base color.
export function mix([r, g, b], ratio) {
  const target = ratio >= 0 ? 255 : 0;
  const t = Math.abs(ratio);
  return [
    clamp(r + (target - r) * t),
    clamp(g + (target - g) * t),
    clamp(b + (target - b) * t),
  ];
}

// Builds { "50": "238 243 250", ... } for one base color.
export function buildScale(hex, steps) {
  const base = hexToRgb(hex);
  if (!base) return null;
  const out = {};
  for (const [step, ratio] of Object.entries(steps)) {
    out[step] = mix(base, ratio).join(" ");
  }
  return out;
}

// Applies a club's colors to the document. Called whenever club data loads or the
// admin changes a color, so the preview in the settings screen is live.
export function applyTheme(settings, root) {
  const el = root || (typeof document !== "undefined" ? document.documentElement : null);
  if (!el) return;
  const s = settings || {};

  const brand =
    buildScale(s.primaryColor, BRAND_STEPS) ||
    buildScale(DEFAULT_SETTINGS.primaryColor, BRAND_STEPS);
  const accent =
    buildScale(s.accentColor, ACCENT_STEPS) ||
    buildScale(DEFAULT_SETTINGS.accentColor, ACCENT_STEPS);

  // Chrome does not re-resolve `background-color: rgb(var(--x) / ...)` on elements
  // that carry a color transition (Tailwind's `transition-colors`) when only the
  // custom property changed — they keep the previously computed color until some
  // unrelated repaint. Left alone, an admin changing the club color would see the
  // theme apply to most of the UI but not to buttons or the active tab.
  // Suppressing transitions across the swap makes it instant and complete.
  const html = typeof document !== "undefined" ? document.documentElement : null;
  if (html) html.classList.add("theme-switching");

  for (const [step, channels] of Object.entries(brand)) {
    el.style.setProperty(`--brand-${step}`, channels);
  }
  for (const [step, channels] of Object.entries(accent)) {
    el.style.setProperty(`--accent-${step}`, channels);
  }

  if (html) {
    void html.offsetHeight; // force the new values to be committed while transitions are off
    // setTimeout, not requestAnimationFrame: rAF does not fire at all while the tab
    // is hidden, so opening the app in a background tab would leave this class on
    // the document forever and kill every transition in the app.
    setTimeout(() => html.classList.remove("theme-switching"), 0);
  }
}

// The primary color as a plain hex string — for the few places that need a real
// color value rather than a class (canvas export, <meta theme-color>).
export function primaryHex(settings) {
  const hex = (settings && settings.primaryColor) || DEFAULT_SETTINGS.primaryColor;
  return hexToRgb(hex) ? hex : DEFAULT_SETTINGS.primaryColor;
}

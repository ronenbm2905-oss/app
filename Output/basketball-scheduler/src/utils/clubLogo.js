// The club logo, kept apart from utils/club.js because importing an image relies on
// Vite's asset pipeline and would make every module that touches club settings
// (including the pure import/scheduling logic) unloadable in a plain-Node test.

import { clubSettings } from "./club";
import { DEFAULT_SETTINGS } from "../constants";
import bundledLogo from "../assets/club-logo.jpg";

// The bundled image is Kiryat Ono's own crest, kept as the fallback for the original
// single-club document (which has no `settings` of its own, so its name still comes
// straight from DEFAULT_SETTINGS). Any OTHER club must not inherit it: putting a
// different association's crest — and trademark — at the top of their board, and into
// every PNG they forward to parents on WhatsApp, is worse than showing no logo at all.
//
// Returns "" when there is no logo to show; callers skip the <img> entirely, and
// imageExport already composes a header without one.
export const clubLogoSrc = (data) => {
  const settings = clubSettings(data);
  if (settings.logoUrl) return settings.logoUrl;
  return settings.name === DEFAULT_SETTINGS.name ? bundledLogo : "";
};

export { bundledLogo };

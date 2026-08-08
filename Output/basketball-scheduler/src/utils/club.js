// Per-club identity accessors.
//
// Everything that used to be a module-level constant naming Kiryat Ono is read
// from `data.settings` through these helpers, so a single build serves any club.
// Each helper falls back to the default when a club document is missing the field,
// which keeps older documents (and the local-mode dataset) working unchanged.

// This module stays free of asset imports so the pure logic below (which games.js
// depends on) can still be exercised by the project's plain-Node unit tests.
// The logo, which needs Vite's asset pipeline, lives in ./clubLogo.js.

import { DEFAULT_SETTINGS } from "../constants";

const settingsOf = (data) => (data && data.settings) || DEFAULT_SETTINGS;

export const clubSettings = settingsOf;

export const clubName = (data) => settingsOf(data).name || DEFAULT_SETTINGS.name;

// Short form for tight spots (image headers, chips). Falls back to the full name.
export const clubShortName = (data) => settingsOf(data).shortName || clubName(data);

export const clubPickupPoint = (data) =>
  settingsOf(data).pickupPoint || DEFAULT_SETTINGS.pickupPoint;

// Used to tell home from away when importing the federation's game file. An empty
// or missing list would silently mark EVERY game as away, so never return one.
export const clubHomeKeywords = (data) => {
  const k = settingsOf(data).homeKeywords;
  return Array.isArray(k) && k.length ? k : DEFAULT_SETTINGS.homeKeywords;
};

export const clubLegal = (data) => ({
  ...DEFAULT_SETTINGS.legal,
  ...(settingsOf(data).legal || {}),
});

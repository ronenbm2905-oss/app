// The club logo, kept apart from utils/club.js because importing an image relies on
// Vite's asset pipeline and would make every module that touches club settings
// (including the pure import/scheduling logic) unloadable in a plain-Node test.

import { clubSettings } from "./club";

// A club's logo, or "" when it has not uploaded one.
//
// There is deliberately no bundled fallback. This used to return the original club's
// crest whenever a document's name still matched the defaults, which put one
// association's trademark at the top of another's board — and into every PNG they
// forward to parents on WhatsApp. It also carried a 418KB image into the bundle every
// club downloads, to serve exactly one of them.
//
// Callers skip the <img> entirely on "", and imageExport already composes a header
// without one, so showing nothing is a supported state rather than a broken image.
export const clubLogoSrc = (data) => clubSettings(data).logoUrl || "";

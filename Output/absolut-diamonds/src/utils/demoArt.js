// ============================================================================
// demoArt.js — איורי SVG לנתוני הדמו בלבד.
//
// למה לא תמונות אמיתיות: אין לנו זכויות על תצלומי תכשיטים, וגם אין טעם —
// ברגע שהצוות יעלה צילומים דרך מסך הניהול הם יחליפו את אלה. עד אז אנחנו
// צריכים משהו ש**מדגים את ההתנהגות** (החלפת גוון מחליפה תמונה) בלי להתחזות
// לצילום מוצר.
//
// כל האיורים כאן הם data-URI של SVG: קלים (~1KB), נכנסים ל-localStorage בלי
// לפוצץ אותו, ונראים נכון בכל רזולוציה.
// ============================================================================

const METAL = {
  yellow: { light: "#E8C766", mid: "#C9A227", dark: "#9A7B1C" },
  white: { light: "#EDEDF0", mid: "#C9C9D2", dark: "#9A9AA6" },
  rose: { light: "#E8B9AE", mid: "#C98B7C", dark: "#9E6558" },
};

const BG = "#F6F1E9";
const STONE_LIGHT = "#EAF4FA";
const STONE_MID = "#CBE2F0";
const STONE_LINE = "#8FA9B8";

function uri(svg) {
  return `data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, " ").trim())}`;
}

function defs(m) {
  return `
    <defs>
      <linearGradient id="metal" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${m.light}"/>
        <stop offset="55%" stop-color="${m.mid}"/>
        <stop offset="100%" stop-color="${m.dark}"/>
      </linearGradient>
      <linearGradient id="stone" x1="0" y1="0" x2="0.6" y2="1">
        <stop offset="0%" stop-color="#FFFFFF"/>
        <stop offset="45%" stop-color="${STONE_LIGHT}"/>
        <stop offset="100%" stop-color="${STONE_MID}"/>
      </linearGradient>
    </defs>`;
}

// יהלום סכמטי — משמש גם בתוך איורי התכשיט.
function gem(cx, cy, r) {
  const top = cy - r * 0.55;
  const belt = cy - r * 0.1;
  return `
    <g>
      <path d="M ${cx - r} ${belt} L ${cx - r * 0.55} ${top} L ${cx + r * 0.55} ${top} L ${cx + r} ${belt} L ${cx} ${cy + r} Z"
            fill="url(#stone)" stroke="${STONE_LINE}" stroke-width="1.1" stroke-linejoin="round"/>
      <path d="M ${cx - r} ${belt} L ${cx + r} ${belt} M ${cx - r * 0.55} ${top} L ${cx - r * 0.3} ${belt} L ${cx} ${cy + r}
               M ${cx + r * 0.55} ${top} L ${cx + r * 0.3} ${belt} L ${cx} ${cy + r}"
            fill="none" stroke="${STONE_LINE}" stroke-width="0.8" opacity="0.7"/>
    </g>`;
}

function frame(inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
    <rect width="400" height="400" fill="${BG}"/>${inner}</svg>`;
}

// --- טבעת: להקה + אבן מרכזית ---
function ringArt(metalColor, { side = false } = {}) {
  const m = METAL[metalColor] || METAL.yellow;
  if (side) {
    return uri(
      frame(`${defs(m)}
        <ellipse cx="200" cy="230" rx="92" ry="96" fill="none" stroke="url(#metal)" stroke-width="15"/>
        <ellipse cx="200" cy="230" rx="92" ry="96" fill="none" stroke="${m.dark}" stroke-width="1" opacity="0.5"/>
        <path d="M 168 138 L 200 108 L 232 138" fill="none" stroke="url(#metal)" stroke-width="7"/>
        ${gem(200, 116, 34)}`)
    );
  }
  return uri(
    frame(`${defs(m)}
      <circle cx="200" cy="228" r="96" fill="none" stroke="url(#metal)" stroke-width="16"/>
      <circle cx="200" cy="228" r="96" fill="none" stroke="${m.dark}" stroke-width="1" opacity="0.45"/>
      <path d="M 172 142 L 200 116 L 228 142" fill="none" stroke="url(#metal)" stroke-width="8" stroke-linecap="round"/>
      ${gem(200, 120, 40)}`)
  );
}

// --- עגילים ---
function earringsArt(metalColor) {
  const m = METAL[metalColor] || METAL.yellow;
  return uri(
    frame(`${defs(m)}
      <g>
        <path d="M 140 130 L 140 168" stroke="url(#metal)" stroke-width="6" stroke-linecap="round"/>
        <circle cx="140" cy="126" r="9" fill="url(#metal)"/>
        ${gem(140, 196, 32)}
      </g>
      <g>
        <path d="M 260 130 L 260 168" stroke="url(#metal)" stroke-width="6" stroke-linecap="round"/>
        <circle cx="260" cy="126" r="9" fill="url(#metal)"/>
        ${gem(260, 196, 32)}
      </g>`)
  );
}

// --- שרשרת עם תליון ---
function necklaceArt(metalColor) {
  const m = METAL[metalColor] || METAL.yellow;
  return uri(
    frame(`${defs(m)}
      <path d="M 80 110 Q 200 300 320 110" fill="none" stroke="url(#metal)" stroke-width="7" stroke-linecap="round"/>
      <path d="M 80 110 Q 200 300 320 110" fill="none" stroke="${m.dark}" stroke-width="1" opacity="0.4"/>
      <circle cx="200" cy="252" r="9" fill="url(#metal)"/>
      ${gem(200, 292, 36)}`)
  );
}

// --- צמיד טניס ---
function braceletArt(metalColor) {
  const m = METAL[metalColor] || METAL.yellow;
  const stones = [110, 155, 200, 245, 290].map((x, i) => gem(x, 200 + (i % 2 === 0 ? 0 : 4), 22)).join("");
  return uri(
    frame(`${defs(m)}
      <ellipse cx="200" cy="200" rx="140" ry="86" fill="none" stroke="url(#metal)" stroke-width="12"/>
      <ellipse cx="200" cy="200" rx="140" ry="86" fill="none" stroke="${m.dark}" stroke-width="1" opacity="0.4"/>
      ${stones}`)
  );
}

// A8 — כל תמונה היא **אובייקט** עם מקור, alt ורישיון, לא מחרוזת.
// `isStock: true` כי אלה איורים ולא צילומי הפריט — וזה בדיוק מה שהדגל אומר.
// זה גם מה שמפעיל את תווית "תמונת דגם" (A1ד) על הדגמים בדמו.
function demoImage(url, category, metalColor, idx) {
  return {
    url,
    storagePath: "",
    isStock: true,
    alt_he: `איור של ${ALT_HE[category] || "תכשיט"} בגוון ${ALT_METAL_HE[metalColor] || ""}`.trim(),
    alt_en: `Illustration of a ${ALT_EN[category] || "jewelry piece"} in ${metalColor} gold`,
    license: {
      source: "internal_illustration",
      assetId: `demo-${category}-${metalColor}-${idx}`,
      licenseType: "own_photo",
      purchasedByEntity: "",
      purchasedAt: "",
      modelRelease: false,
      commercialUse: true,
      paidAdsAllowed: false,
      modificationAllowed: true,
    },
  };
}

const ALT_HE = { rings: "טבעת", earrings: "עגילים", necklaces: "שרשרת עם תליון", bracelets: "צמיד" };
const ALT_EN = { rings: "ring", earrings: "pair of earrings", necklaces: "pendant necklace", bracelets: "bangle" };
const ALT_METAL_HE = { yellow: "זהב צהוב", white: "זהב לבן", rose: "זהב ורוד" };

function rawFor(category, metalColor) {
  switch (category) {
    case "earrings":
      return [earringsArt(metalColor)];
    case "necklaces":
      return [necklaceArt(metalColor)];
    case "bracelets":
      return [braceletArt(metalColor)];
    case "rings":
    default:
      return [ringArt(metalColor), ringArt(metalColor, { side: true })];
  }
}

export function demoImagesFor(category, metalColor) {
  return rawFor(category, metalColor).map((url, i) => demoImage(url, category, metalColor, i));
}

export function demoImagesByMetal(category, metals = ["yellow", "white", "rose"]) {
  const out = {};
  for (const m of metals) out[m] = demoImagesFor(category, m);
  return out;
}

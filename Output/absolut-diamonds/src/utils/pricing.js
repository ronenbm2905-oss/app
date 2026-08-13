import { sumAgorot } from "./money.js";

// ============================================================================
// pricing.js — **הלב המסחרי.** פונקציות טהורות, אגורות שלמות בלבד (A5.1).
//
//     מחיר = שיבוץ (בסיס + תוספת סוג זהב + תוספת גוון) + מחיר האבן × מס' אבנים
//
// כללים שנגזרים מזה ומהסקירה של עדי:
//   1. **A5.6 — "החל מ־" מחושב ב-runtime מהפריטים הזמינים בפועל. לעולם לא
//      מוקלד.** ברגע שהאבן הזולה נמכרת, מחרוזת קשיחה מבטיחה מחיר שאינו קיים.
//   2. אבן שאינה `available` לא נכנסת לשום חישוב ולא מוצעת בקונפיגורטור
//      (A4.5 — אחרת שני לקוחות מקבלים הפניה לאותה אבן).
//   3. `null` ≠ 0. דגם בלי מחיר בסיס הוא נתון חסר, לא דגם בחינם.
//   4. **A5.8א — הסכום המחושב הוא הצעת מחיר.** ה-UI חייב להצמיד לו disclaimer,
//      והליד חייב לשמור תצלום מצב של הרכיבים (ולא הפניה לפריט).
// ============================================================================

function int(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

export function metalSurchargeFor(model, metalColor) {
  return int(model?.metalSurchargeAgorot?.[metalColor]) ?? 0;
}

export function karatSurchargeFor(model, karat) {
  return int(model?.karatSurchargeAgorot?.[karat]) ?? 0;
}

export function stoneCountFor(model) {
  const n = int(model?.stoneCount);
  return n && n > 0 ? n : 1;
}

// מחיר השיבוץ בלבד — בלי אבן.
export function settingPriceAgorot(model, metalColor, karat) {
  const base = int(model?.basePriceAgorot);
  if (base == null) return null;
  return sumAgorot(base, metalSurchargeFor(model, metalColor), karatSurchargeFor(model, karat));
}

// האם האבן מתאימה לדגם: צורה ברשימה + קראט בטווח + זמינה בפועל.
export function isCompatible(model, diamond) {
  if (!model || !diamond) return false;
  if (diamond.status !== "available") return false;
  const shapes = Array.isArray(model.compatibleShapes) ? model.compatibleShapes : [];
  if (shapes.length && !shapes.includes(diamond.shape)) return false;
  const carat = Number(diamond.carat);
  if (!Number.isFinite(carat)) return false;
  const min = Number(model?.caratRange?.min);
  const max = Number(model?.caratRange?.max);
  if (Number.isFinite(min) && carat < min - 1e-9) return false;
  if (Number.isFinite(max) && carat > max + 1e-9) return false;
  return true;
}

export function compatibleDiamonds(model, diamonds) {
  return (diamonds || []).filter((d) => isCompatible(model, d));
}

// פירוק המחיר — המסך מציג אותו שורה-שורה. שקיפות היא דרישה, לא קישוט:
// לקוח שרואה רק "29,400" לא מבין למה, ולא סומך.
export function computeConfigPrice(model, { metalColor, metalKarat, diamond } = {}) {
  const base = int(model?.basePriceAgorot);
  const metal = metalSurchargeFor(model, metalColor);
  const karat = karatSurchargeFor(model, metalKarat);
  const setting = base == null ? null : sumAgorot(base, metal, karat);
  const unit = int(diamond?.priceAgorot);
  const count = stoneCountFor(model);
  const stones = unit == null ? null : unit * count;

  return {
    baseAgorot: base,
    metalSurchargeAgorot: metal,
    karatSurchargeAgorot: karat,
    settingAgorot: setting,
    diamondUnitAgorot: unit,
    stoneCount: count,
    diamondsAgorot: stones,
    totalAgorot: setting == null ? null : sumAgorot(setting, stones ?? 0),
    hasDiamond: stones != null,
    complete: setting != null && stones != null,
  };
}

// A5.6 — הקונפיגורציה הזולה האפשרית. הבסיס ל-"החל מ־", מחושב תמיד.
export function cheapestConfig(model, diamonds) {
  const base = int(model?.basePriceAgorot);
  if (base == null) return null;

  const metals = model?.metalOptions?.length ? model.metalOptions : ["yellow"];
  const karats = model?.karatOptions?.length ? model.karatOptions : ["14k"];

  let bestMetal = metals[0];
  for (const m of metals) {
    if (metalSurchargeFor(model, m) < metalSurchargeFor(model, bestMetal)) bestMetal = m;
  }
  let bestKarat = karats[0];
  for (const k of karats) {
    if (karatSurchargeFor(model, k) < karatSurchargeFor(model, bestKarat)) bestKarat = k;
  }

  let bestStone = null;
  for (const d of compatibleDiamonds(model, diamonds)) {
    const p = int(d.priceAgorot);
    if (p == null) continue;
    if (!bestStone || p < int(bestStone.priceAgorot)) bestStone = d;
  }

  const price = computeConfigPrice(model, {
    metalColor: bestMetal,
    metalKarat: bestKarat,
    diamond: bestStone,
  });

  return {
    metalColor: bestMetal,
    metalKarat: bestKarat,
    diamond: bestStone,
    settingOnlyAgorot: price.settingAgorot,
    totalAgorot: price.totalAgorot,
    // withDiamond=false → המסך אומר "מחיר השיבוץ", **לא** "החל מ־".
    // "החל מ־" בלי אבן זמינה בפועל הוא בדיוק ההבטחה שעדי אוסרת (A5.6).
    withDiamond: Boolean(bestStone),
  };
}

export function catalogPrice(model, diamonds) {
  const cheapest = cheapestConfig(model, diamonds);
  if (!cheapest) return { valueAgorot: null, kind: "unknown" };
  return {
    valueAgorot: cheapest.totalAgorot,
    kind: cheapest.withDiamond ? "from" : "settingOnly",
    cheapest,
  };
}

export function defaultConfig(model) {
  return {
    metalColor: model?.metalOptions?.[0] ?? "yellow",
    metalKarat: model?.karatOptions?.[0] ?? "14k",
    diamondId: null,
  };
}

// נרמול קונפיגורציה מה-URL — ערך לא חוקי נופל לברירת מחדל ולא מפיל את הדף.
export function normalizeConfig(model, raw = {}) {
  const metals = model?.metalOptions?.length ? model.metalOptions : ["yellow"];
  const karats = model?.karatOptions?.length ? model.karatOptions : ["14k"];
  return {
    metalColor: metals.includes(raw.metalColor) ? raw.metalColor : metals[0],
    metalKarat: karats.includes(raw.metalKarat) ? raw.metalKarat : karats[0],
    diamondId: raw.diamondId || null,
  };
}

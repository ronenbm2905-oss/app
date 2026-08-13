import { COLORS, CLARITIES, PUBLIC_STATUS } from "../constants.js";
import { catalogPrice } from "./pricing.js";

// ============================================================================
// filters.js — סינון ומיון. טהור, נבדק בלי דפדפן.
//
//   1. 🔴 A4.5/A6.4 — **רק `available` יוצא לציבור.** לא `hidden` (תמחור שטרם
//      פורסם + מודיעין תחרותי) ולא `sold` (מספר תעודה שכבר אינו נכון).
//      זו שכבה נפרדת ומפורשת, לא תנאי אחד מתוך רבים שאפשר לשכוח.
//      ⚠️ הסינון הזה הוא UX — האכיפה האמיתית ב-firestore.rules.
//   2. "מ־/עד" על צבע וניקיון עובד על **אינדקס בסולם**, לא על אותיות.
//      D<E<F ולא במקרה, ובניקיון (VVS1 מול SI2) ההשוואה המחרוזתית שגויה.
// ============================================================================

export function publicOnly(items) {
  return (items || []).filter((it) => it?.status === PUBLIC_STATUS);
}

const colorIndex = (c) => COLORS.indexOf(c);
const clarityIndex = (c) => CLARITIES.indexOf(c);

function inScale(value, from, to, indexOf) {
  const i = indexOf(value);
  if (i === -1) return false;
  if (from) {
    const f = indexOf(from);
    if (f !== -1 && i < f) return false;
  }
  if (to) {
    const t = indexOf(to);
    if (t !== -1 && i > t) return false;
  }
  return true;
}

function inRange(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return false;
  if (min != null && min !== "" && n < Number(min)) return false;
  if (max != null && max !== "" && n > Number(max)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// אבנים
// ---------------------------------------------------------------------------
export function filterDiamonds(diamonds, f = {}) {
  return (diamonds || []).filter((d) => {
    if (f.shapes?.length && !f.shapes.includes(d.shape)) return false;
    if (f.origin && d.origin !== f.origin) return false;
    if ((f.colorFrom || f.colorTo) && !inScale(d.color, f.colorFrom, f.colorTo, colorIndex)) return false;
    if ((f.clarityFrom || f.clarityTo) && !inScale(d.clarity, f.clarityFrom, f.clarityTo, clarityIndex))
      return false;
    if ((f.caratMin != null || f.caratMax != null) && !inRange(d.carat, f.caratMin, f.caratMax)) return false;
    if (
      (f.priceMinAgorot != null || f.priceMaxAgorot != null) &&
      !inRange(d.priceAgorot, f.priceMinAgorot, f.priceMaxAgorot)
    )
      return false;
    return true;
  });
}

export function sortDiamonds(diamonds, sort = "priceAsc") {
  const arr = [...(diamonds || [])];
  const byPrice = (a, b) => (Number(a.priceAgorot) || 0) - (Number(b.priceAgorot) || 0);
  const byCarat = (a, b) => (Number(a.carat) || 0) - (Number(b.carat) || 0);
  switch (sort) {
    case "priceDesc":
      return arr.sort((a, b) => byPrice(b, a));
    case "caratDesc":
      return arr.sort((a, b) => byCarat(b, a));
    case "caratAsc":
      return arr.sort(byCarat);
    case "colorBest":
      return arr.sort((a, b) => colorIndex(a.color) - colorIndex(b.color));
    case "clarityBest":
      return arr.sort((a, b) => clarityIndex(a.clarity) - clarityIndex(b.clarity));
    case "priceAsc":
    default:
      return arr.sort(byPrice);
  }
}

// ---------------------------------------------------------------------------
// דגמים
// ---------------------------------------------------------------------------
export function filterModels(models, f = {}, diamonds = []) {
  return (models || []).filter((m) => {
    if (f.category && m.category !== f.category) return false;
    if (f.subcategory && m.subcategory !== f.subcategory) return false;
    if (f.metalColor && !(m.metalOptions || []).includes(f.metalColor)) return false;
    if (f.shape && !(m.compatibleShapes || []).includes(f.shape)) return false;
    if (f.priceMinAgorot != null || f.priceMaxAgorot != null) {
      // מסננים לפי מחיר ה-"החל מ־" — זה המספר שהלקוח רואה על הכרטיס.
      // סינון לפי מחיר הבסיס היה מחזיר תוצאות שסותרות את מה שכתוב עליהן.
      const { valueAgorot } = catalogPrice(m, diamonds);
      if (!inRange(valueAgorot, f.priceMinAgorot, f.priceMaxAgorot)) return false;
    }
    return true;
  });
}

export function sortModels(models, sort = "newest", diamonds = []) {
  const arr = [...(models || [])];
  const price = (m) => catalogPrice(m, diamonds).valueAgorot ?? Number.POSITIVE_INFINITY;
  switch (sort) {
    case "priceAsc":
      return arr.sort((a, b) => price(a) - price(b));
    case "priceDesc":
      return arr.sort((a, b) => price(b) - price(a));
    case "newest":
    default:
      return arr.sort((a, b) => {
        const so = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
        if (so !== 0) return so;
        return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
      });
  }
}

export function countActiveFilters(f = {}) {
  let n = 0;
  for (const v of Object.values(f)) {
    if (v == null || v === "") continue;
    if (Array.isArray(v)) {
      if (v.length) n++;
      continue;
    }
    n++;
  }
  return n;
}

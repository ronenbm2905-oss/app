import {
  CERT_LABS,
  CERT_VERIFY_URL,
  CLARITIES,
  COLORS,
  FLAWLESS_TERMS,
  FORBIDDEN_TERMS_ALL,
  FORBIDDEN_TERMS_LAB,
  FORBIDDEN_TERMS_MODEL_ORIGIN,
  LISTING_TYPES,
  ORIGINS,
  SHAPES,
  TREATMENTS,
} from "../constants.js";

// ============================================================================
// validate.js — ליבת הציות + ולידציית טפסים.
//
// כל מה שכאן מגיע ישירות מסקירת עדי 2026-08-13 (A1–A5).
// ⚠️ ולידציית טופס היא UX. האכיפה על `leads` יושבת ב-firestore.rules.
//    אבל `validateListing` היא **לא** UX: היא **חוסמת פרסום**, וזו הנקודה
//    שבה הכלל המשפטי הופך לקוד ולא לנוהל.
// ============================================================================

// ---------------------------------------------------------------------------
// A2.2 — מונח התצוגה **נגזר מהשדה ולעולם אינו מוקלד ידנית**.
// זה מה שמבטיח שאותו מונח בדיוק יופיע בכל חמשת המקומות שעדי דורשת:
// כרטיס בגריד · בסמיכות לכותרת · טבלת המפרט · הודעת הוואטסאפ · תגיות שיתוף.
// ---------------------------------------------------------------------------
const ORIGIN_LABEL = {
  natural: { he: "יהלום טבעי", en: "Natural Diamond" },
  lab: { he: "יהלום מעבדה (Lab-Grown)", en: "Lab-Grown Diamond" },
};

export function originLabel(origin, lang = "he") {
  const entry = ORIGIN_LABEL[origin];
  // origin חסר הוא באג, לא מקרה קצה — לא ממציאים "טבעי" כברירת מחדל.
  if (!entry) return lang === "en" ? "Origin not specified" : "מקור לא צוין";
  return entry[lang] || entry.he;
}

export function certVerifyUrl(certLab) {
  return CERT_VERIFY_URL[certLab] || null;
}

// ---------------------------------------------------------------------------
// A2.4/A2.5 — לינט מונחים אסורים
// ---------------------------------------------------------------------------
function containsTerm(text, term) {
  if (!text) return false;
  return String(text).toLowerCase().includes(String(term).toLowerCase());
}

export function lintTerms(texts, terms) {
  const found = [];
  for (const text of texts.filter(Boolean)) {
    for (const term of terms) {
      if (containsTerm(text, term) && !found.includes(term)) found.push(term);
    }
  }
  return found;
}

// ---------------------------------------------------------------------------
// A8 — תמונה תקינה
// ---------------------------------------------------------------------------
function imageErrors(image, { allowStock }) {
  const errs = [];
  if (!image?.url) errs.push({ code: "validate.imageUrlMissing" });
  // 🔴 A1ג + A8 — `isStock` ללא ברירת מחדל. null = לא נבחר, וזו שגיאה.
  // `false` כברירת מחדל היא בדיוק הבאג שמסמן סטוק כאמיתי בשקט.
  if (image?.isStock !== true && image?.isStock !== false) {
    errs.push({ code: "validate.imageStockUnset" });
  }
  if (image?.isStock === true && !allowStock) {
    // A1ב(1) — אבן ספציפית + תמונת סטוק = חסימת פרסום.
    errs.push({ code: "validate.stockOnSpecificStone" });
  }
  // O5.2 — alt חובה. תמונת נוי מקבלת מחרוזת ריקה **מפורשת**, ולכן בודקים
  // undefined/null ולא falsy.
  if (image?.alt_he == null) errs.push({ code: "validate.imageAltMissing" });
  if (image?.isStock === true && !image?.license?.assetId) {
    // A8 — בלי assetId אין הוכחת רישיון מול מכתב אכיפה.
    errs.push({ code: "validate.imageLicenseMissing" });
  }
  return errs;
}

// ---------------------------------------------------------------------------
// 🔴 A1ב — `validateListing`. מחזירה רשימת שגיאות; `status` אינו יכול לעבור
// ל-"available" כל עוד היא אינה ריקה. ארבעת מקרי החסימה + מה שנוסף ב-A2–A5.
// ---------------------------------------------------------------------------
export function validateListing(item) {
  const errors = [];
  const type = item?.listingType;

  // (4) listingType ריק → שגיאה. אין ברירת מחדל — ברירת מחדל היא המנגנון
  // שדרכו סטוק זולג לתוך פריט מתועד.
  if (!LISTING_TYPES.includes(type)) {
    errors.push({ code: "validate.listingTypeMissing" });
    return errors; // בלי סוג אי אפשר לבדוק שום דבר אחר
  }

  const images = Array.isArray(item.images) ? item.images : [];

  if (type === "specific_stone") {
    // ---- אבן פיזית אחת ----
    for (const img of images) errors.push(...imageErrors(img, { allowStock: false }));

    // A2.1 — origin חובה, ללא ברירת מחדל
    if (!ORIGINS.includes(item.origin)) errors.push({ code: "validate.originMissing" });

    // A3 — treatments חובה. [] = טרם נבחר; ["none"] = נבחר במפורש "ללא טיפול".
    if (!Array.isArray(item.treatments) || item.treatments.length === 0) {
      errors.push({ code: "validate.treatmentsMissing" });
    } else {
      const bad = item.treatments.filter((tr) => !TREATMENTS.includes(tr));
      if (bad.length) errors.push({ code: "validate.treatmentsInvalid" });
      const treated = item.treatments.some((tr) => tr !== "none");
      const other = item.treatments.includes("other");
      if ((treated || other) && !String(item.treatmentNote_he || "").trim()) {
        errors.push({ code: "validate.treatmentNoteMissing" });
      }
    }

    // A4.1 — התעודה היא יחידה אטומית. אחד בלי השני = חסימה.
    const hasNum = Boolean(String(item.certNumber || "").trim());
    const hasFile = Boolean(String(item.certFileUrl || "").trim());
    if (!hasNum || !hasFile) errors.push({ code: "validate.certIncomplete" });
    // A4.2 — certLab enum, לא טקסט חופשי
    if (!CERT_LABS.includes(item.certLab)) errors.push({ code: "validate.certLabInvalid" });

    // 4C מדויק
    if (!Number.isFinite(Number(item.carat)) || Number(item.carat) <= 0)
      errors.push({ code: "validate.caratMissing" });
    if (!SHAPES.includes(item.shape)) errors.push({ code: "validate.shapeMissing" });
    if (!COLORS.includes(item.color)) errors.push({ code: "validate.colorMissing" });
    if (!CLARITIES.includes(item.clarity)) errors.push({ code: "validate.clarityMissing" });

    // A5 — מחיר באגורות שלמות
    if (!Number.isInteger(Number(item.priceAgorot)) || Number(item.priceAgorot) < 0)
      errors.push({ code: "validate.priceInvalid" });
    if (item.vatIncluded !== true) errors.push({ code: "validate.vatNotIncluded" });

    // A2.4 — לינט על טקסט חופשי של אבן מעבדה
    if (item.origin === "lab") {
      const hits = lintTerms(
        [item.treatmentNote_he, item.treatmentNote_en, item.note_he, item.note_en],
        FORBIDDEN_TERMS_LAB
      );
      if (hits.length) errors.push({ code: "validate.forbiddenTermLab", terms: hits });
    }

    // "ללא פגם" מותר רק ב-FL
    if (item.clarity !== "FL") {
      const hits = lintTerms([item.treatmentNote_he, item.note_he], FLAWLESS_TERMS);
      if (hits.length) errors.push({ code: "validate.flawlessClaim", terms: hits });
    }

    const all = lintTerms(
      [item.treatmentNote_he, item.treatmentNote_en, item.note_he, item.note_en],
      FORBIDDEN_TERMS_ALL
    );
    if (all.length) errors.push({ code: "validate.forbiddenTerm", terms: all });
  }

  if (type === "made_to_order") {
    // ---- דגם לפי הזמנה ----
    // תמונות סטוק מותרות — עם תווית (A1ד), אבל הדגל חייב להיבחר במפורש.
    const perMetal = item.imagesByMetal || {};
    const flat = [...images, ...Object.values(perMetal).flat()];
    for (const img of flat) errors.push(...imageErrors(img, { allowStock: true }));

    // A1ב(2) — דגם לפי הזמנה + מספר תעודה = חסימה.
    // התעודה תונפק לאבן שתיבחר, ולדגם אין אבן.
    if (String(item.certNumber || "").trim()) errors.push({ code: "validate.certOnMadeToOrder" });

    // A1ב(3) — 4C בערך יחיד לצד מחיר = חסימה. לדגם מותרים טווחים בלבד.
    for (const field of ["carat", "color", "clarity", "origin"]) {
      if (item[field] != null && item[field] !== "") {
        errors.push({ code: "validate.singleSpecOnMadeToOrder", field });
      }
    }
    const range = item.caratRange;
    if (
      !range ||
      !Number.isFinite(Number(range.min)) ||
      !Number.isFinite(Number(range.max)) ||
      Number(range.min) <= 0 ||
      Number(range.max) < Number(range.min)
    ) {
      errors.push({ code: "validate.caratRangeInvalid" });
    }

    if (!Number.isInteger(Number(item.basePriceAgorot)) || Number(item.basePriceAgorot) < 0)
      errors.push({ code: "validate.priceInvalid" });
    if (item.vatIncluded !== true) errors.push({ code: "validate.vatNotIncluded" });

    // A5.4 — מה כלול במחיר ומה לא. בלי סליקה זה התחליף למסך תשלום.
    if (!String(item.priceIncludes_he || "").trim())
      errors.push({ code: "validate.priceIncludesMissing" });

    // ⚠️ לדגם אין origin — הוא מותאם לאבן שתיבחר. לכן **כל** טענת מקור
    // בכותרת/תיאור היא שקרית בהגדרה, לא רק כשמדובר במעבדה.
    const originHits = lintTerms(
      [item.title_he, item.title_en, item.description_he, item.description_en],
      FORBIDDEN_TERMS_MODEL_ORIGIN
    );
    if (originHits.length) errors.push({ code: "validate.originClaimOnModel", terms: originHits });

    const all = lintTerms(
      [item.title_he, item.title_en, item.description_he, item.description_en],
      FORBIDDEN_TERMS_ALL
    );
    if (all.length) errors.push({ code: "validate.forbiddenTerm", terms: all });
  }

  return errors;
}

// `status: "available"` מותר רק כשאין שגיאות. זו הפונקציה שמסך הניהול קורא
// לפני שהוא מאפשר פרסום.
export function canPublish(item) {
  return validateListing(item).length === 0;
}

// ---------------------------------------------------------------------------
// טפסים
// ---------------------------------------------------------------------------

// טלפון ישראלי — מכוון להיות סלחני. טופס שדוחה מספר תקין הוא ליד אבוד,
// וזה גרוע יותר מליד עם ספרה שגויה.
export function isValidPhone(raw) {
  if (!raw) return false;
  const digits = String(raw).replace(/\D/g, "");
  return digits.length >= 9 && digits.length <= 15;
}

export function isValidEmail(raw) {
  if (!raw) return true; // לא חובה
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(raw).trim());
}

// A7.1 — שתי הסכמות נפרדות. רק `contact` חוסמת שליחה.
export function validateLead(values) {
  const errors = {};
  if (String(values?.name || "").trim().length < 2) errors.name = "lead.errNameRequired";
  if (!String(values?.phone || "").trim()) errors.phone = "lead.errPhoneRequired";
  else if (!isValidPhone(values.phone)) errors.phone = "lead.errPhoneInvalid";
  if (values?.email && !isValidEmail(values.email)) errors.email = "lead.errEmailInvalid";
  if (!values?.consentContact) errors.consentContact = "lead.errConsent";
  return errors;
}

export function validateModel(model, allModels = []) {
  const errors = {};
  const sku = String(model?.sku || "").trim();
  if (!sku) errors.sku = "admin.errSkuRequired";
  else if (allModels.some((m) => m.id !== model.id && String(m.sku).trim() === sku))
    errors.sku = "admin.duplicateSku";
  if (!String(model?.title_he || "").trim()) errors.title_he = "admin.errTitleRequired";
  if (!Number.isFinite(Number(model?.basePriceAgorot))) errors.basePriceAgorot = "admin.errBasePriceRequired";
  if (!model?.metalOptions?.length) errors.metalOptions = "admin.errMetalRequired";
  if (!model?.karatOptions?.length) errors.karatOptions = "admin.errKaratRequired";
  if (!model?.compatibleShapes?.length) errors.compatibleShapes = "admin.errShapesRequired";
  if (!String(model?.priceIncludes_he || "").trim()) errors.priceIncludes_he = "admin.errPriceIncludes";
  const min = Number(model?.caratRange?.min);
  const max = Number(model?.caratRange?.max);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max < min)
    errors.caratRange = "admin.errCaratRangeInvalid";
  return errors;
}

export function validateDiamond(diamond, allDiamonds = []) {
  const errors = {};
  const stoneId = String(diamond?.stoneId || "").trim();
  if (!stoneId) errors.stoneId = "admin.errStoneIdRequired";
  else if (allDiamonds.some((d) => d.id !== diamond.id && String(d.stoneId).trim() === stoneId))
    errors.stoneId = "admin.duplicateStoneId";
  if (!Number.isFinite(Number(diamond?.carat)) || Number(diamond.carat) <= 0)
    errors.carat = "admin.errCaratRequired";
  if (!Number.isFinite(Number(diamond?.priceAgorot))) errors.priceAgorot = "admin.errPriceRequired";
  if (!ORIGINS.includes(diamond?.origin)) errors.origin = "admin.errOriginRequired";
  if (!Array.isArray(diamond?.treatments) || diamond.treatments.length === 0)
    errors.treatments = "admin.errTreatmentsRequired";
  if (!String(diamond?.certNumber || "").trim() || !String(diamond?.certFileUrl || "").trim())
    errors.cert = "admin.errCertRequired";
  return errors;
}

export function hasErrors(errors) {
  return Object.keys(errors || {}).length > 0;
}

// ============================================================================
// constants.js — הטקסונומיה + הסכימה.
//
// 🔁 עודכן פעמיים:
//   1. תשובת הלקוח — המוצר הוא **קונפיגורטור**: דגם + אבן = מחיר מחושב.
//   2. סקירת עדי 2026-08-13 — A1..A9. השינוי המבני המרכזי:
//
//      ה**הפרדה בין `models` ל-`diamonds` היא בדיוק ה-`listingType` שעדי דורשת:**
//        • `models`   = made_to_order  — דגם לפי הזמנה. תמונות סטוק מותרות
//                                        (עם תווית), **אסור** מספר תעודה,
//                                        4C בטווחים בלבד, מחיר "החל מ־".
//        • `diamonds` = specific_stone — אבן פיזית אחת. תמונת סטוק **אסורה**,
//                                        תעודה חובה (מספר + קובץ), 4C מדויק.
//
//      השדה נשמר במפורש על כל מסמך ולא נגזר מהאוסף — כדי ש-`validateListing`
//      תוכל לחסום פרסום בלי להסתמך על "איפה זה שמור".
//
// כל ערך מזוהה ב-**מזהה אנגלי יציב**. עדי כתבה בכללים `status == "זמין"`;
// אנחנו שומרים `"available"` ומתרגמים בתצוגה — אותה סמנטיקה, בלי לשבור i18n.
// ============================================================================

// ⚠️ A9.2 — מפתחות ה-localStorage **ניטרליים בכוונה.** שם המותג לא נעול
// משפטית, ומפתח אחסון שנושא אותו הוא עוד מקום שצריך לשנות ביום ההחלפה
// (וגם שובר את הנתונים הקיימים אצל מי שכבר ביקר). הכלל: שם המותג מופיע
// בקוד **אך ורק** ב-brand.js — נאכף בבדיקה ב-render-check.
// ⚠️ מעלים את המספר בכל שינוי ל-`defaults.js` שחייב להגיע גם למי שכבר טען
// את האתר. `settings.brand` מועתק ל-localStorage בזמן ה-seed, ולכן שינוי שם
// מותג בקוד **אינו** מגיע לדפדפן שכבר זרע — בלי העלאת גרסה, מבקר חוזר ימשיך
// לראות את השם הישן. v4 = החלפת שם המותג (2026-08-13, ראה `brand.js`).
export const LOCAL_DATA_KEY = "jewelry_catalog_v4";
export const LOCAL_LANG_KEY = "jewelry_catalog_lang";

export const COL_MODELS = "models";
export const COL_DIAMONDS = "diamonds";
export const COL_LEADS = "leads";
export const COL_SETTINGS = "settings";
export const COL_ADMINS = "admins";

// A6.5 — settings מפוצל: מסמך פומבי ומסמך שהוא אדמין-בלבד.
export const SETTINGS_PUBLIC_ID = "public";
export const SETTINGS_PRIVATE_ID = "private";

// A1 — ללא ברירת מחדל בשום מקום.
export const LISTING_TYPES = ["specific_stone", "made_to_order"];

// ---- קטגוריות ----
export const CATEGORIES = ["rings", "earrings", "necklaces", "bracelets"];

export const SUBCATEGORIES = {
  rings: ["engagement", "wedding"],
  earrings: ["studs", "drops"],
  necklaces: ["pendants", "tennis"],
  bracelets: ["tennis", "bangles"],
};

// ---- 4C ----
export const SHAPES = [
  "round",
  "princess",
  "oval",
  "marquise",
  "pear",
  "emerald",
  "cushion",
  "heart",
  "radiant",
  "asscher",
];

export const COLORS = "DEFGHIJKLMNOPQRSTUVWXYZ".split("");

export const COLOR_GROUPS = [
  { id: "colorless", from: "D", to: "F" },
  { id: "nearColorless", from: "G", to: "J" },
  { id: "faint", from: "K", to: "M" },
  { id: "tinted", from: "N", to: "Z" },
];

export const CLARITIES = ["FL", "IF", "VVS1", "VVS2", "VS1", "VS2", "SI1", "SI2", "I1", "I2", "I3"];

export const CUTS = ["excellent", "veryGood", "good", "fair"];

// 🔴 A2 — חובה, ללא ברירת מחדל. ברירת מחדל "natural" היא מכונה לייצור הטעיות.
export const ORIGINS = ["natural", "lab"];

// 🔴 A3 — תקנות הגנת הצרכן (גילוי פרט מהותי לגבי יהלומים), תשנ"ה-1995
// מחייבות לגלות מילוי וטיפול צבע. חובה, ללא ברירת מחדל.
// ⚠️ `[]` ריק ≠ `["none"]` — "ללא טיפול" היא בחירה אקטיבית, לא היעדר בחירה.
export const TREATMENTS = [
  "none",
  "fracture_filling",
  "hpht",
  "irradiation",
  "laser_drilling",
  "coating",
  "other",
];

// A4.2 — enum, לא טקסט חופשי. טקסט חופשי הוא איך "תעודת בית" נכנסת פנימה.
export const CERT_LABS = ["IGI", "GIA"];

// קישור לאימות עצמאי של הלקוח (A4.4) — הופך טענה לעובדה ניתנת לבדיקה.
export const CERT_VERIFY_URL = {
  IGI: "https://www.igi.org/verify-your-report/",
  GIA: "https://www.gia.edu/report-check-landing",
};

// ---- מתכת ----
export const METAL_KARATS = ["14k", "18k"];
export const METAL_COLORS = ["yellow", "white", "rose"];

// 🎨 דגימת חומר 12px בבורר הגוון — **יוצא הדופן היחיד לצבע בממשק.**
// זו לא צבעוניות ממשק אלא דגימת חומר, מאותה קטגוריה של צילום. תמיד מוצגת
// **לצד** התווית המילולית ולעולם לא במקומה (WCAG 1.4.1).
// ⚠️ ללבן יש קו שיער `line.strong` ברכיב, אחרת הוא נעלם על רקע surface.
export const METAL_SWATCH = {
  yellow: "#C6A44E",
  white: "#D8D8D4",
  rose: "#C99B87",
};

// ---- מסחרי ----
export const STATUSES = ["available", "sold", "hidden"];
// 🔴 A4.5 + A6.4 — רק "available" נקרא פומבית. פריט שנמכר אינו חושף
// מחיר, CTA או מספר תעודה. הכלל נאכף ב-firestore.rules, לא בשאילתה.
export const PUBLIC_STATUS = "available";

// A5.3 — נעול. אין מחיר בדולר בפרוסה 1.
// ⚠️ מחיר בדולר מצריך סקירה מחדש — בסיס המרה, תאריך, ומי המחיר המחייב.
export const CURRENCY = "ILS";

// A5.2 — שיעור המע"מ שלפיו מנרמלים מחיר שהוזן ללא מע"מ.
export const VAT_RATE = 0.18;

export const MODEL_SORTS = ["newest", "priceAsc", "priceDesc"];
export const DIAMOND_SORTS = ["priceAsc", "priceDesc", "caratDesc", "caratAsc", "colorBest", "clarityBest"];
export const DEFAULT_MODEL_SORT = "newest";
export const DEFAULT_DIAMOND_SORT = "priceAsc";

export const LEAD_SOURCES = ["contactForm", "configuratorForm", "whatsapp", "modelForm"];
export const LEAD_STATUSES = ["new", "contacted", "closed"];

// A7.4 — שדות שאסור לבנות עבורם UI. שמירה בסכימה: אם מישהו מוסיף שדה כזה
// לטופס, הבדיקה ב-smoke נופלת.
export const FORBIDDEN_LEAD_FIELDS = [
  "idNumber",
  "tz",
  "birthDate",
  "address",
  "creditCard",
  "income",
  "budget",
  "occasion",
];

// A6.2 — שדות שהלקוח לעולם אינו כותב. נאכפים גם ב-rules.
export const ADMIN_ONLY_LEAD_FIELDS = ["status", "internalNotes", "assignedTo", "isSpam"];

// ---- A2.4/A2.5 — לינט מונחים ----
// כשה-origin הוא lab: מילים שמשייכות את האבן לטבע.
export const FORBIDDEN_TERMS_LAB = [
  "אמיתי",
  "טבעי",
  "מקורי",
  "אבן טבעית",
  "כרוי",
  "מהאדמה",
  "natural",
  "genuine",
  "real",
  "mined",
];

// ⚠️ בארכיטקטורה שלנו לדגם אין `origin` — הוא מותאם לאבן שהלקוח יבחר, שיכולה
// להיות טבעית או מעבדה. לכן **כל** טענת מקור בכותרת/תיאור של דגם היא שקרית
// בהגדרה, ולא רק כשמדובר במעבדה.
export const FORBIDDEN_TERMS_MODEL_ORIGIN = [
  "יהלום טבעי",
  "אבן טבעית",
  "כרוי",
  "מהאדמה",
  "natural diamond",
  "mined",
];

// לשני הסוגים — הבטחות שאי אפשר לעמוד מאחוריהן (ס' 2 לחוק הגנת הצרכן).
export const FORBIDDEN_TERMS_ALL = [
  "השקעה",
  "ערכו יעלה",
  "מחיר סיטונאי",
  "ישירות מהבורסה",
  "הכי זול בישראל",
  "investment",
  "wholesale price",
];

// "ללא פגם" מותר רק כאשר clarity === "FL".
export const FLAWLESS_TERMS = ["ללא פגם", "flawless", "מושלם לחלוטין"];

// ---- תמונות (A8) ----
export const LICENSE_TYPES = ["own_photo", "stock_standard", "stock_extended", "ai_generated", "other"];

// A8 — אובייקט תמונה מלא. `isStock` **ללא ברירת מחדל** (null = טרם נבחר).
export const EMPTY_IMAGE = {
  url: "",
  storagePath: "",
  isStock: null, // 🔴 חובה בחירה אקטיבית. false כברירת מחדל = סימון סטוק כאמיתי בשקט.
  alt_he: "",
  alt_en: "",
  license: {
    source: "",
    assetId: "",
    licenseType: "",
    purchasedByEntity: "",
    purchasedAt: "",
    modelRelease: false,
    commercialUse: false,
    paidAdsAllowed: false,
    modificationAllowed: false,
  },
};

// ---- גבולות ה-UI לסינון (באגורות) ----
export const CARAT_BOUNDS = { min: 0, max: 5 };
export const PRICE_BOUNDS_AGOROT = { min: 0, max: 20000000 }; // ₪0–₪200,000

export const LOCAL_IMAGE_MAX_BYTES = 400 * 1024;
export const CLOUD_IMAGE_MAX_BYTES = 6 * 1024 * 1024;

// ---- מצבי ריק ----
export const EMPTY_MODEL_FILTERS = {
  category: null,
  subcategory: null,
  metalColor: null,
  shape: null,
  priceMinAgorot: null,
  priceMaxAgorot: null,
};

export const EMPTY_DIAMOND_FILTERS = {
  shapes: [],
  origin: null,
  colorFrom: null,
  colorTo: null,
  clarityFrom: null,
  clarityTo: null,
  caratMin: null,
  caratMax: null,
  priceMinAgorot: null,
  priceMaxAgorot: null,
};

export const EMPTY_MODEL = {
  listingType: "made_to_order", // הדגם הוא תמיד לפי הזמנה — זו מהותו.
  sku: "",
  category: "rings",
  subcategory: "engagement",
  title_he: "",
  title_en: "",
  description_he: "",
  description_en: "",
  // A5.1 — אגורות שלמות. פלואט על מחירי תכשיטים מייצר סטיות, ומחיר מוצג
  // הוא כמעט-מחייב לפי תקנה 4 לתקנות תשנ"א-1991.
  basePriceAgorot: null,
  vatIncluded: true, // A5.2 — מנורמל בשמירה; מוצג רק מחיר כולל מע"מ.
  priceInputWasExVat: false, // עקבות ביקורת: האם האדמין הזין מחיר לפני מע"מ
  priceUpdatedAt: null, // A5.5 — נשמר ומוצג
  priceIncludes_he: "", // A5.4 — חובה: מה כלול ומה לא
  priceIncludes_en: "",
  metalOptions: ["yellow", "white", "rose"],
  metalSurchargeAgorot: { yellow: 0, white: 0, rose: 0 },
  karatOptions: ["14k", "18k"],
  karatSurchargeAgorot: { "14k": 0, "18k": 0 },
  imagesByMetal: { yellow: [], white: [], rose: [] },
  compatibleShapes: ["round"],
  // A1 — לדגם 4C בטווחים בלבד, לעולם לא ערך יחיד.
  caratRange: { min: 0.3, max: 2 },
  colorRange: null,
  clarityRange: null,
  stoneCount: 1,
  collection: "",
  status: "hidden", // נכנס מוסתר; מתפרסם רק אחרי validateListing נקייה
  featured: false,
  sortOrder: 0,
  createdAt: null,
  updatedAt: null,
};

export const EMPTY_DIAMOND = {
  listingType: "specific_stone", // אבן פיזית אחת — זו מהותה.
  stoneId: "",
  carat: null,
  shape: "",
  color: "",
  clarity: "",
  cut: "",
  origin: null, // 🔴 A2 — ללא ברירת מחדל
  treatments: [], // 🔴 A3 — [] = טרם נבחר. ["none"] = נבחר "ללא טיפול".
  treatmentNote_he: "",
  treatmentNote_en: "",
  certLab: "IGI",
  certNumber: "",
  certFileUrl: "", // A4.1 — יחידה אטומית עם certNumber
  certVerifiedAt: null,
  certVerifiedBy: null,
  priceAgorot: null,
  vatIncluded: true,
  priceInputWasExVat: false,
  priceUpdatedAt: null,
  images: [], // A8 — אובייקטים, לא מחרוזות
  status: "hidden",
  createdAt: null,
  updatedAt: null,
};

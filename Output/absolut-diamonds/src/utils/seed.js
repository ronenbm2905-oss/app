import { demoImagesByMetal } from "./demoArt.js";
import { DEFAULT_SETTINGS_PUBLIC, DEFAULT_SETTINGS_PRIVATE } from "./defaults.js";

// ============================================================================
// seed.js — נתוני הדמו של המצב המקומי.
//
// למה כאן **יש** נתוני דמו (בניגוד לכלל "EMPTY ולא SAMPLE" של השלד): זו חנות
// ראווה, לא כלי ניהול. קטלוג ריק לא מאפשר לבדוק סינון, "החל מ־", ובעיקר לא
// את הקונפיגורטור — שהוא כל המוצר.
//
// ⚠️ המחירים ריאליים לשוק הישראלי 2026 אבל **אינם מחירי הלקוח**.
// ⚠️ התמונות הן איורי SVG (`isStock: true`) ולא צילומי מוצר — בכוונה.
// ⚠️ מספרי התעודה כאן **מומצאים לצורכי דמו**. באמת, `certNumber` בלי
//    `certFileUrl` תקף חוסם פרסום (A4) — ולכן לדמו יש קובץ placeholder.
// ============================================================================

// 🔴 מספר דמו — **לא מספר אמיתי.** מסך ההגדרות מתריע עליו עד שמחליפים.
export const DEMO_WHATSAPP = "972500000000";

// placeholder לקובץ תעודה. קיים כדי שהאטומיות של A4 תתקיים בדמו; באמת זה
// קישור לקובץ ה-PDF ב-Storage.
const DEMO_CERT_FILE = "#demo-certificate-not-a-real-file";

const D = (n) => new Date(2026, 6, n, 10, 0, 0).toISOString();
const ILS = (shekels) => Math.round(shekels * 100); // → אגורות שלמות (A5.1)

function model(o) {
  const metals = o.metalOptions || ["yellow", "white", "rose"];
  return {
    listingType: "made_to_order",
    status: "available",
    featured: false,
    collection: "",
    sortOrder: 0,
    stoneCount: 1,
    metalOptions: metals,
    metalSurchargeAgorot: { yellow: 0, white: 0, rose: ILS(250) },
    karatOptions: ["14k", "18k"],
    karatSurchargeAgorot: { "14k": 0, "18k": ILS(900) },
    vatIncluded: true,
    priceInputWasExVat: false,
    priceUpdatedAt: o.createdAt,
    // A5.4 — מה כלול ומה לא. בלי סליקה, זה התחליף למסך התשלום.
    priceIncludes_he:
      "המחיר כולל את השיבוץ, המתכת והיהלום שנבחר, כולל מע״מ. אינו כולל התאמת מידה, חריטה, משלוח או הערכת שמאי.",
    priceIncludes_en:
      "The price covers the setting, the metal and the chosen diamond, including VAT. It does not include resizing, engraving, shipping or an appraisal.",
    // לדגם אין 4C יחיד — טווח בלבד (A1ב3).
    colorRange: null,
    clarityRange: null,
    updatedAt: o.createdAt,
    ...o,
    imagesByMetal: demoImagesByMetal(o.category, metals),
  };
}

function stone(o) {
  return {
    listingType: "specific_stone",
    cut: "excellent",
    certLab: "IGI",
    certFileUrl: DEMO_CERT_FILE,
    certVerifiedAt: null,
    certVerifiedBy: null,
    // 🔴 A3 — בחירה אקטיבית. ["none"] = "נבדק, ללא טיפול".
    treatments: ["none"],
    treatmentNote_he: "",
    treatmentNote_en: "",
    vatIncluded: true,
    priceInputWasExVat: false,
    priceUpdatedAt: o.createdAt,
    // A1 — אבן ספציפית: אין תמונות סטוק. בלי צילום אמיתי מוצג איור סכמטי.
    images: [],
    status: "available",
    updatedAt: o.createdAt,
    ...o,
  };
}

// ---------------------------------------------------------------------------
// דגמים — 10, על ארבע הקטגוריות
// ---------------------------------------------------------------------------
export const DEMO_MODELS = [
  model({
    id: "m-r101",
    sku: "R-101",
    category: "rings",
    subcategory: "engagement",
    title_he: "סוליטר קלאסי",
    title_en: "Classic Solitaire",
    description_he:
      "ארבע שיניים, להקה נקייה, והאבן במרכז בלי שום דבר שיסיח ממנה. הדגם שרוב הזוגות חוזרים אליו.",
    description_en:
      "Four prongs, a clean band, and the stone at the centre with nothing competing with it. The design most couples come back to.",
    basePriceAgorot: ILS(3200),
    compatibleShapes: ["round", "oval", "cushion"],
    caratRange: { min: 0.3, max: 2.5 },
    featured: true,
    sortOrder: 1,
    createdAt: D(2),
  }),
  model({
    id: "m-r102",
    sku: "R-102",
    category: "rings",
    subcategory: "engagement",
    title_he: "הילה",
    title_en: "Halo",
    description_he:
      "מעגל של יהלומים קטנים סביב האבן המרכזית. מגדיל את הנוכחות של האבן בלי להגדיל את הקראט.",
    description_en:
      "A circle of small diamonds around the centre stone. Makes the stone read larger without adding carat.",
    basePriceAgorot: ILS(5400),
    metalSurchargeAgorot: { yellow: 0, white: 0, rose: ILS(300) },
    compatibleShapes: ["round", "oval", "pear"],
    caratRange: { min: 0.4, max: 2.0 },
    featured: true,
    sortOrder: 2,
    createdAt: D(3),
  }),
  model({
    id: "m-r103",
    sku: "R-103",
    category: "rings",
    subcategory: "engagement",
    title_he: "פאווה מלכותית",
    title_en: "Royal Pavé",
    description_he: "הלהקה כולה משובצת יהלומים זעירים, עד לאבן המרכזית. ברק מכל זווית.",
    description_en:
      "The band is set with micro diamonds all the way to the centre stone. Sparkle from every angle.",
    basePriceAgorot: ILS(6800),
    karatSurchargeAgorot: { "14k": 0, "18k": ILS(1200) },
    compatibleShapes: ["round", "princess", "emerald"],
    caratRange: { min: 0.5, max: 3.0 },
    sortOrder: 3,
    createdAt: D(4),
  }),
  model({
    id: "m-r104",
    sku: "R-104",
    category: "rings",
    subcategory: "engagement",
    title_he: "שלוש אבנים",
    title_en: "Three Stone",
    description_he: "אבן מרכזית ושתי אבני צד. הדגם הקלאסי שמסמל עבר, הווה ועתיד.",
    description_en: "A centre stone flanked by two side stones. The classic design for past, present and future.",
    basePriceAgorot: ILS(7900),
    compatibleShapes: ["round", "oval", "emerald"],
    caratRange: { min: 0.7, max: 2.5 },
    sortOrder: 4,
    createdAt: D(5),
  }),
  model({
    id: "m-r105",
    sku: "R-105",
    category: "rings",
    subcategory: "wedding",
    title_he: "טבעת נישואין משובצת",
    title_en: "Set Wedding Band",
    description_he: "להקה דקה עם אבן אחת שקועה. נועדה להיענד לצד טבעת האירוסין בלי להתחרות בה.",
    description_en:
      "A slim band with a single flush-set stone. Made to sit beside the engagement ring, not compete with it.",
    basePriceAgorot: ILS(4300),
    compatibleShapes: ["round"],
    caratRange: { min: 0.2, max: 0.6 },
    sortOrder: 5,
    createdAt: D(6),
  }),
  model({
    id: "m-e201",
    sku: "E-201",
    category: "earrings",
    subcategory: "studs",
    title_he: "צמודי סוליטר",
    title_en: "Solitaire Studs",
    description_he: "זוג צמודים בשיבוץ ארבע שיניים. הפריט שנענד הכי הרבה מכל מה שיש בקופסה.",
    description_en: "A pair of four-prong studs. The piece that gets worn more than anything else in the box.",
    basePriceAgorot: ILS(2400),
    stoneCount: 2,
    compatibleShapes: ["round", "princess"],
    caratRange: { min: 0.25, max: 1.5 },
    featured: true,
    sortOrder: 6,
    createdAt: D(7),
  }),
  model({
    id: "m-e202",
    sku: "E-202",
    category: "earrings",
    subcategory: "drops",
    title_he: "עגילי טיפה",
    title_en: "Drop Earrings",
    description_he: "אבן תלויה על חוליה עדינה, שזזה עם התנועה. ערב, לא יומיום.",
    description_en: "A stone suspended on a fine link that moves with you. For evenings, not for every day.",
    basePriceAgorot: ILS(4100),
    stoneCount: 2,
    compatibleShapes: ["pear", "oval"],
    caratRange: { min: 0.3, max: 1.2 },
    sortOrder: 7,
    createdAt: D(8),
  }),
  model({
    id: "m-n301",
    sku: "N-301",
    category: "necklaces",
    subcategory: "pendants",
    title_he: "תליון סוליטר",
    title_en: "Solitaire Pendant",
    description_he: "אבן אחת על שרשרת עדינה באורך 42 ס״מ. המתנה הבטוחה ביותר שיש.",
    description_en: "A single stone on a fine 42cm chain. The safest gift there is.",
    basePriceAgorot: ILS(2100),
    compatibleShapes: ["round", "oval", "pear", "heart"],
    caratRange: { min: 0.25, max: 1.5 },
    featured: true,
    sortOrder: 8,
    createdAt: D(9),
  }),
  model({
    id: "m-n302",
    sku: "N-302",
    category: "necklaces",
    subcategory: "pendants",
    title_he: "תליון מרקיזה",
    title_en: "Marquise Pendant",
    description_he: "שיבוץ מוארך שמאריך את קו הצוואר. עובד יפה במיוחד עם אבנים בצורת מרקיזה ואובל.",
    description_en:
      "An elongated setting that lengthens the neckline. Works especially well with marquise and oval stones.",
    basePriceAgorot: ILS(2900),
    compatibleShapes: ["marquise", "oval"],
    caratRange: { min: 0.3, max: 1.2 },
    sortOrder: 9,
    createdAt: D(10),
  }),
  model({
    id: "m-b401",
    sku: "B-401",
    category: "bracelets",
    subcategory: "bangles",
    title_he: "צמיד חישוק עם אבן",
    title_en: "Bangle with Centre Stone",
    description_he: "חישוק קשיח בגימור מלוטש, עם אבן אחת במרכז. נענד לבד או בערימה.",
    description_en: "A rigid polished bangle with one stone at the centre. Wear it alone or stacked.",
    basePriceAgorot: ILS(5600),
    metalSurchargeAgorot: { yellow: 0, white: 0, rose: ILS(400) },
    compatibleShapes: ["round", "oval"],
    caratRange: { min: 0.3, max: 1.0 },
    sortOrder: 10,
    createdAt: D(11),
  }),
];

// ---------------------------------------------------------------------------
// מלאי אבנים — 26. כולל אבן שנמכרה ואבן מטופלת, כדי ששני המסלולים
// הרגישים ביותר (A4.5 ו-A3) ייבדקו ולא יתגלו בייצור.
// ---------------------------------------------------------------------------
export const DEMO_DIAMONDS = [
  // -- טבעיים --
  stone({ id: "d-1001", stoneId: "D-1001", carat: 0.31, shape: "round", color: "F", clarity: "VS1", origin: "natural", certNumber: "IGI-621904331", priceAgorot: ILS(3900), createdAt: D(2) }),
  stone({ id: "d-1002", stoneId: "D-1002", carat: 0.51, shape: "round", color: "G", clarity: "VS2", origin: "natural", certNumber: "IGI-621904332", priceAgorot: ILS(7400), createdAt: D(2) }),
  stone({ id: "d-1003", stoneId: "D-1003", carat: 0.72, shape: "round", color: "E", clarity: "VS1", origin: "natural", certNumber: "IGI-621904333", priceAgorot: ILS(14800), createdAt: D(3) }),
  stone({ id: "d-1004", stoneId: "D-1004", carat: 1.01, shape: "round", color: "G", clarity: "VS1", origin: "natural", certNumber: "IGI-621904334", priceAgorot: ILS(26500), createdAt: D(3) }),
  stone({ id: "d-1005", stoneId: "D-1005", carat: 1.2, shape: "round", color: "H", clarity: "SI1", cut: "veryGood", origin: "natural", certNumber: "IGI-621904335", priceAgorot: ILS(27900), createdAt: D(4) }),
  stone({ id: "d-1006", stoneId: "D-1006", carat: 1.52, shape: "round", color: "F", clarity: "VS2", origin: "natural", certNumber: "IGI-621904336", priceAgorot: ILS(58000), createdAt: D(4) }),
  stone({ id: "d-1007", stoneId: "D-1007", carat: 0.9, shape: "oval", color: "G", clarity: "VS2", origin: "natural", certNumber: "IGI-621904337", priceAgorot: ILS(17200), createdAt: D(5) }),
  stone({ id: "d-1008", stoneId: "D-1008", carat: 1.31, shape: "oval", color: "H", clarity: "VS1", origin: "natural", certNumber: "IGI-621904338", priceAgorot: ILS(31500), createdAt: D(5) }),
  stone({ id: "d-1009", stoneId: "D-1009", carat: 0.81, shape: "pear", color: "F", clarity: "VS2", cut: "veryGood", origin: "natural", certNumber: "IGI-621904339", priceAgorot: ILS(15600), createdAt: D(6) }),
  stone({ id: "d-1010", stoneId: "D-1010", carat: 1.05, shape: "cushion", color: "G", clarity: "SI1", origin: "natural", certNumber: "IGI-621904340", priceAgorot: ILS(19800), createdAt: D(6) }),
  stone({ id: "d-1011", stoneId: "D-1011", carat: 0.7, shape: "princess", color: "H", clarity: "VS2", cut: "veryGood", origin: "natural", certNumber: "IGI-621904341", priceAgorot: ILS(9600), createdAt: D(7) }),
  stone({ id: "d-1012", stoneId: "D-1012", carat: 1.1, shape: "emerald", color: "F", clarity: "VS1", origin: "natural", certNumber: "IGI-621904342", priceAgorot: ILS(29400), createdAt: D(7) }),
  stone({ id: "d-1013", stoneId: "D-1013", carat: 0.62, shape: "marquise", color: "G", clarity: "VS2", cut: "veryGood", origin: "natural", certNumber: "IGI-621904343", priceAgorot: ILS(8900), createdAt: D(8) }),
  // 🔴 אבן מטופלת — הדגמה של A3. הטיפול מוצג בסמיכות למחיר, לא בהערת שוליים.
  stone({
    id: "d-1014",
    stoneId: "D-1014",
    carat: 0.75,
    shape: "heart",
    color: "H",
    clarity: "SI1",
    cut: "good",
    origin: "natural",
    certNumber: "IGI-621904344",
    priceAgorot: ILS(10400),
    treatments: ["fracture_filling"],
    treatmentNote_he: "מילוי סדקים. הטיפול משפיע על המראה ועל הערך.",
    treatmentNote_en: "Fracture filling. The treatment affects appearance and value.",
    createdAt: D(8),
  }),
  stone({ id: "d-1015", stoneId: "D-1015", carat: 0.25, shape: "round", color: "G", clarity: "VS2", origin: "natural", certNumber: "IGI-621904345", priceAgorot: ILS(2300), createdAt: D(9) }),
  stone({ id: "d-1016", stoneId: "D-1016", carat: 2.02, shape: "round", color: "E", clarity: "VVS2", origin: "natural", certNumber: "IGI-621904346", priceAgorot: ILS(128000), createdAt: D(9) }),
  // אבן שנמכרה — לא בקונפיגורטור, לא בחישובי מחיר, ולא חושפת תעודה (A4.5).
  stone({ id: "d-1017", stoneId: "D-1017", carat: 1.0, shape: "round", color: "F", clarity: "VS2", origin: "natural", certNumber: "IGI-621904347", priceAgorot: ILS(25900), status: "sold", createdAt: D(10) }),

  // -- מעבדה --
  stone({ id: "d-2001", stoneId: "L-2001", carat: 1.0, shape: "round", color: "E", clarity: "VVS2", origin: "lab", certNumber: "IGI-LG558120901", priceAgorot: ILS(4600), createdAt: D(10) }),
  stone({ id: "d-2002", stoneId: "L-2002", carat: 1.51, shape: "round", color: "F", clarity: "VS1", origin: "lab", certNumber: "IGI-LG558120902", priceAgorot: ILS(7200), createdAt: D(11) }),
  stone({ id: "d-2003", stoneId: "L-2003", carat: 2.05, shape: "round", color: "D", clarity: "VVS1", origin: "lab", certNumber: "IGI-LG558120903", priceAgorot: ILS(11900), createdAt: D(11) }),
  stone({ id: "d-2004", stoneId: "L-2004", carat: 1.2, shape: "oval", color: "E", clarity: "VS1", origin: "lab", certNumber: "IGI-LG558120904", priceAgorot: ILS(5400), createdAt: D(12) }),
  stone({ id: "d-2005", stoneId: "L-2005", carat: 1.05, shape: "pear", color: "F", clarity: "VS2", origin: "lab", certNumber: "IGI-LG558120905", priceAgorot: ILS(4300), createdAt: D(12) }),
  stone({ id: "d-2006", stoneId: "L-2006", carat: 1.6, shape: "emerald", color: "E", clarity: "VS1", origin: "lab", certNumber: "IGI-LG558120906", priceAgorot: ILS(7800), createdAt: D(13) }),
  stone({ id: "d-2007", stoneId: "L-2007", carat: 1.02, shape: "princess", color: "F", clarity: "VS2", origin: "lab", certNumber: "IGI-LG558120907", priceAgorot: ILS(4100), createdAt: D(13) }),
  stone({ id: "d-2008", stoneId: "L-2008", carat: 1.35, shape: "cushion", color: "D", clarity: "VS1", origin: "lab", certNumber: "IGI-LG558120908", priceAgorot: ILS(6300), createdAt: D(14) }),
  stone({ id: "d-2009", stoneId: "L-2009", carat: 0.95, shape: "marquise", color: "F", clarity: "VS1", origin: "lab", certNumber: "IGI-LG558120909", priceAgorot: ILS(3800), createdAt: D(14) }),
];

export const DEMO_SETTINGS_PUBLIC = {
  ...DEFAULT_SETTINGS_PUBLIC,
  contact: {
    ...DEFAULT_SETTINGS_PUBLIC.contact,
    whatsapp: DEMO_WHATSAPP,
  },
};

export function makeDemoData() {
  return {
    schemaVersion: 3,
    models: DEMO_MODELS.map((m) => ({ ...m })),
    diamonds: DEMO_DIAMONDS.map((d) => ({ ...d })),
    leads: [],
    settingsPublic: JSON.parse(JSON.stringify(DEMO_SETTINGS_PUBLIC)),
    settingsPrivate: JSON.parse(JSON.stringify(DEFAULT_SETTINGS_PRIVATE)),
  };
}

export const EMPTY_DATA = {
  schemaVersion: 3,
  models: [],
  diamonds: [],
  leads: [],
  settingsPublic: JSON.parse(JSON.stringify(DEFAULT_SETTINGS_PUBLIC)),
  settingsPrivate: JSON.parse(JSON.stringify(DEFAULT_SETTINGS_PRIVATE)),
};

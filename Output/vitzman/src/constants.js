// ============================================================================
// constants.js — enums, 24 קטגוריות ההוצאה, ומצב פתיחה ריק.
//
// עיקרון מהשלד: EMPTY ולא SAMPLE. נתוני ויצמן נכנסים דרך הייבוא
// (`scripts/import-vitzman.mjs`), לא דרך קוד.
// ============================================================================

export const SCHEMA_VERSION = 1;

export const DEFAULT_VAT_RATE = 0.18;

// --- מצב הבניין ------------------------------------------------------------
// בגיליון זו הייתה הפרדה לשני **גיליונות** נפרדים, ולכן `בן גוריון 1` הצליח
// להופיע בשניהם. כשדה יחיד על הישות זה בלתי-אפשרי מבנית.
export const BUILDING_STATUS = ["active", "inactive"];
export const BUILDING_STATUS_LABEL = {
  active: "פעיל",
  inactive: "לא פעיל",
};

// --- מצב המע"מ על חוזה -----------------------------------------------------
// `standard`  — הספק מוציא חשבונית עם מע"מ. עלות בפועל = עלות מושווית.
// `imputed`   — הספק עוסק פטור. **בפועל משלמים נטו**, אבל מוסיפים מע"מ רעיוני
//               כדי שהשוואת עלויות מול ספק רגיל תהיה הוגנת (23 הערות בגיליון).
//               ההפרדה הזו קריטית: באקסל המע"מ הרעיוני יושב בתוך ההוצאה ולכן
//               מקטין את הרווח המדווח — כאן הוא נשאר מדיד ונפרד.
export const VAT_MODE = ["standard", "imputed"];
export const VAT_MODE_LABEL = {
  standard: "מע\"מ רגיל",
  imputed: "עוסק פטור — מע\"מ רעיוני להשוואה",
};

// --- סוגי הערה --------------------------------------------------------------
// 214 ההערות בגיליון אינן טקסט חופשי אחיד; הן חמישה סוגים שונים שמשמעותם שונה.
export const NOTE_KINDS = ["priceChange", "vatExempt", "estimate", "conditional", "vaadPays", "contact", "general"];
export const NOTE_KIND_LABEL = {
  priceChange: "שינוי מחיר",
  vatExempt: "עוסק פטור",
  estimate: "הערכה בלבד",
  conditional: "מותנה בגבייה",
  vaadPays: "הוועד משלם ישירות",
  contact: "איש קשר",
  general: "כללי",
};

// --- סוגי ביקורת תקופתית ----------------------------------------------------
// ארבע העמודות שקיימות בגיליון ולא מולא בהן אף תא (0/131).
// המודל נבנה עכשיו; המסך בפרוסה 2.
export const INSPECTION_TYPES = ["fireDetection", "fireSuppression", "waterTank", "generator"];
export const INSPECTION_TYPE_LABEL = {
  fireDetection: "ביקורת גילוי אש",
  fireSuppression: "ביקורת כיבוי אש",
  waterTank: "ניקוי מאגרים",
  generator: "טיפול גנרטור",
};
/** תדירות מומלצת בחודשים — בסיס להתראת פקיעה בפרוסה 2. */
export const INSPECTION_INTERVAL_MONTHS = {
  fireDetection: 12,
  fireSuppression: 12,
  waterTank: 12,
  generator: 6,
};

// --- 24 קטגוריות ההוצאה ------------------------------------------------------
// המפתח `col` הוא **אות העמודה בגיליון המקור**. הוא נשמר כדי שדוח הסתירות
// יוכל להצביע על התא המדויק, וכדי שייבוא חוזר יידע לאן למפות.
export const EXPENSE_CATEGORIES = [
  { id: "cleaning", col: "B", name: "ניקיון" },
  { id: "highWindows", col: "C", name: "גרניק/חלונות לגובה/פחים/שוט/פוליש" },
  { id: "elevatorContract", col: "D", name: "הסכם שירות מעליות" },
  { id: "elevatorSafety", col: "E", name: "בודק בטיחות למעליות" },
  { id: "gardening", col: "F", name: "גינון" },
  { id: "gardenRepairs", col: "G", name: "תיקוני גינה וצמחים" },
  { id: "cleaningSupplies", col: "H", name: "חומרי ניקוי" },
  { id: "scentTrash", col: "I", name: "עלות מכשירי ריח שוט אשפה" },
  { id: "scentBuilding", col: "J", name: "עלות מכשירי ריח בבניין" },
  { id: "adScreen", col: "K", name: "מסך פירסומי" },
  { id: "pumpContract", col: "L", name: "הסכם שרות למשאבות" },
  { id: "insurance", col: "M", name: "ביטוח לבנין" },
  { id: "publicElectricity", col: "N", name: "חשמל ציבורי" },
  { id: "pestControl", col: "O", name: "הדברה/פוליש" },
  { id: "fireEquipment", col: "P", name: "ציוד אש/גילוי אש/מתזים/גנרטור/דחסן/משאבות/מזרקה/ביוב/מפוחים" },
  { id: "tankCleaning", col: "Q", name: "ניקוי מאגר" },
  { id: "housingCulture", col: "R", name: "תרבות הדיור" },
  { id: "telecom", col: "S", name: "בזק/אינטרנט" },
  { id: "creditFees", col: "T", name: "עמלות אשראי בגבייה" },
  { id: "faultsAndParts", col: "U", name: "תקלות קבלני חוץ/חלפים/סיור נורות" },
  { id: "maintenanceWorker", col: "V", name: "עלות עובד אחזקה" },
  { id: "receptionLifeguard", col: "W", name: "עלות פקיד קבלה + מציל" },
  { id: "lightingScans", col: "X", name: "סריקות תאורה" },
  { id: "collectionLegal", col: "Y", name: "שירותי גבייה/משרד עורך דין" },
];

export const CATEGORY_BY_ID = Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c.id, c]));
export const CATEGORY_BY_COL = Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c.col, c]));

// --- עמודות המקור שאינן קטגוריות עלות ---------------------------------------
export const SOURCE_COLUMNS = {
  address: "A",
  optimisticForecast: "Z", // 'אנדרי - צפי אופטימלי' — 0/131 מלאים, מחוץ לכל סכום
  managementFee: "AA", // 'תשלום עבור הסכם השירות' — ההכנסה
  totalExpenses: "AB",
  profit: "AC",
  profitPct: "AD",
};

// --- ישויות ואוספים ----------------------------------------------------------
export const ENTITY_COLLECTIONS = [
  "buildings",
  "vendors",
  "employees",
  "contracts",
  "notes",
  "inspections",
];

export const EMPTY = {
  schemaVersion: SCHEMA_VERSION,
  buildings: [],
  vendors: [],
  employees: [],
  contracts: [],
  notes: [],
  inspections: [],
  meta: { sourceFile: null, importedAt: null, discrepancies: [] },
};

// --- ספי רווחיות -------------------------------------------------------------
// הגיליון לא סימן בשום צורה בניין בהפסד. שניים כאלה ישבו בו בלי שאיש ידע.
export const THIN_MARGIN_THRESHOLD = 0.05;

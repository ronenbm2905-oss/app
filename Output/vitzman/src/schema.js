// ============================================================================
// schema.js — מפעלי ישויות (factories) + נרמול.
//
// כל ישות נוצרת דרך factory כדי שאף שדה לא ייעדר: קוד שקורא `building.aliases`
// חייב לקבל מערך, לא undefined. `normalize` ממזג נתונים ישנים מ-localStorage
// עם ברירות המחדל — כך ששינוי סכימה לא מפיל התקנה קיימת.
// ============================================================================

import { newId, addressKey } from "./utils/id.js";
import { round2 } from "./utils/money.js";
import { EMPTY, SCHEMA_VERSION, DEFAULT_VAT_RATE } from "./constants.js";

/**
 * הבניין — הישות המרכזית.
 *
 * שני שדות שלא היו קיימים בגיליון וסוגרים בו באג מבני:
 *   · `id`      — מפתח יציב. הכתובת היא תצוגה, לא זהות.
 *   · `aliases` — כל האיותים החלופיים שראינו במקור, כדי שסנכרון בין רשימות
 *                 יהיה חיפוש ולא ניחוש.
 *
 * ושלושה שדות שהיו **גיליונות נפרדים** והפכו לשדות — ולכן `בן גוריון 1`
 * לא יכול יותר להיות גם פעיל וגם לא-פעיל:
 *   · `status` · `assignedEmployeeId` · `inIlm`
 */
export function makeBuilding(b = {}) {
  const address = (b.address || "").trim();
  return {
    id: b.id || newId("bld"),
    address,
    aliases: Array.isArray(b.aliases) ? [...new Set(b.aliases.filter(Boolean))] : [],
    status: b.status === "inactive" ? "inactive" : "active",
    assignedEmployeeId: b.assignedEmployeeId || null,
    inIlm: !!b.inIlm,
    /**
     * ⚠ **ערך מוצא להגירה בלבד.** ההכנסה התקפה נגזרת תמיד מ-`feeAgreements`,
     * כדי שגם לדמי הניהול תהיה היסטוריה (16 מ-24 הערות שינוי-המחיר בגיליון
     * היו על העמודה הזו, לא על ההוצאות). `normalize` ממיר את השדה הזה להסכם
     * עם `effectiveFrom: null` כשאין עדיין הסכם — כך נתונים ישנים עולים כמו שהם.
     */
    managementFee: round2(b.managementFee ?? 0),
    insurerName: b.insurerName || "",
    areaManager: b.areaManager || "",
    sourceRow: b.sourceRow ?? null, // שורת המקור בגיליון — לצורך דוח הסתירות
    createdAt: b.createdAt || new Date().toISOString(),
  };
}

/** כל מפתחות ההתאמה של בניין: הכתובת עצמה + כל הכינויים. */
export const buildingKeys = (b) => [b.address, ...(b.aliases || [])].map(addressKey).filter(Boolean);

export function makeEmployee(e = {}) {
  return {
    id: e.id || newId("emp"),
    name: (e.name || "").trim(),
    active: e.active !== false,
  };
}

/**
 * ספק. `vatExempt` הוא השדה שהיה חבוי ב-23 הערות תאים ("עוסק פטור").
 * הטלפונים שנמצאו בהערות נכנסים ל-`phone` ולא נשארים כטקסט חופשי.
 */
export function makeVendor(v = {}) {
  return {
    id: v.id || newId("vnd"),
    name: (v.name || "").trim(),
    phone: v.phone || "",
    vatExempt: !!v.vatExempt,
    notes: v.notes || "",
  };
}

/**
 * חוזה שירות — עלות אחת של קטגוריה אחת בבניין אחד, מתאריך תחולה מסוים.
 *
 * **היסטוריית מחירים היא כמה חוזים, לא שדה.** 27 ההערות מסוג
 * "הסכם עלה מ-4650 ל-5500 החל מ-1.7.2022" הופכות לשתי שורות עם `effectiveFrom`
 * שונה. החוזה הפעיל = בעל ה-`effectiveFrom` הגדול ביותר שכבר עבר.
 *
 * `amount` הוא תמיד **מה שמשלמים בפועל**. המע"מ הרעיוני של עוסק פטור נגזר
 * ממנו ב-`profitability.js` ואינו מעורבב לתוכו — זו בדיוק ההפרדה שחסרה באקסל.
 */
export function makeContract(c = {}) {
  return {
    id: c.id || newId("ctr"),
    buildingId: c.buildingId || null,
    categoryId: c.categoryId || null,
    vendorId: c.vendorId || null,
    amount: c.amount == null ? null : round2(c.amount),
    /** `null` = "לא אנחנו משלמים" (הוועד ישירות). שונה מהותית מ-0. */
    effectiveFrom: c.effectiveFrom || null, // "YYYY-MM-DD"
    vatMode: c.vatMode === "imputed" ? "imputed" : "standard",
    vatRate: c.vatRate ?? DEFAULT_VAT_RATE,
    /** המספר הוא אומדן ולא חוזה חתום — 3 הערות "הערכה בלבד" בגיליון. */
    isEstimate: !!c.isEstimate,
    /** ההכנסה/ההוצאה מותנית בכך שכל הדיירים שילמו — 4 הערות בגיליון. */
    isConditional: !!c.isConditional,
    /** הוועד משלם לספק ישירות; לא עובר דרכנו. */
    paidByVaad: !!c.paidByVaad,
    notes: c.notes || "",
  };
}

/**
 * הסכם דמי ניהול — ההכנסה מוועד הבית, מתאריך תחולה מסוים.
 *
 * **אותה צורה בדיוק כמו `serviceContract`** (`amount` + `effectiveFrom`), ולכן
 * `activeAsOf` משרת את שניהם ואין שני מנועי בחירה שיכולים להיפרד זה מזה.
 * היסטוריה = כמה הסכמים לאותו בניין; התקף הוא בעל התאריך הגדול ביותר שכבר עבר.
 */
export function makeFeeAgreement(f = {}) {
  return {
    id: f.id || newId("fee"),
    buildingId: f.buildingId || null,
    amount: round2(f.amount ?? 0),
    effectiveFrom: f.effectiveFrom || null, // `null` = מאז ומעולם
    note: f.note || "",
  };
}

/**
 * הערה. באקסל אלה היו 214 הערות תאים — מידע שאי אפשר לשאול אותו שאלה
 * ושהדבקה אחת שגויה מוחקת. כאן זו ישות עם `kind`, קישור לבניין, ו-`sourceCell`
 * שמאפשר לחזור למקור.
 */
export function makeNote(n = {}) {
  return {
    id: n.id || newId("nte"),
    buildingId: n.buildingId || null,
    categoryId: n.categoryId || null,
    kind: n.kind || "general",
    text: (n.text || "").trim(),
    sourceSheet: n.sourceSheet || "",
    sourceCell: n.sourceCell || "",
    authoredAt: n.authoredAt || null,
    author: n.author || "",
  };
}

/**
 * ביקורת תקופתית. ארבע עמודות התאריך בגיליון היו ריקות ב-131 מתוך 131.
 * המודל נבנה עכשיו כדי שפרוסה 2 תוסיף מסך ולא סכימה.
 */
export function makeInspection(i = {}) {
  return {
    id: i.id || newId("ins"),
    buildingId: i.buildingId || null,
    type: i.type || "fireDetection",
    lastDate: i.lastDate || null, // "YYYY-MM-DD"
    /** מועד יעד ידני — גובר על החישוב מ-`lastDate + intervalMonths`. */
    nextDueDate: i.nextDueDate || null,
    /** עקיפת התדירות לבניין הזה. `null` = ברירת המחדל לסוג הביקורת. */
    intervalMonths: Number(i.intervalMonths) > 0 ? Number(i.intervalMonths) : null,
    vendorId: i.vendorId || null,
    notes: i.notes || "",
  };
}

/** נרמול מצב מלא — כל אוסף חסר הופך למערך ריק, כל ישות עוברת ב-factory. */
export function normalize(raw) {
  const d = raw && typeof raw === "object" ? raw : {};
  const buildings = (d.buildings || []).map(makeBuilding);
  return {
    schemaVersion: SCHEMA_VERSION,
    buildings,
    vendors: (d.vendors || []).map(makeVendor),
    employees: (d.employees || []).map(makeEmployee),
    contracts: (d.contracts || []).map(makeContract),
    feeAgreements: migrateFees(buildings, d.feeAgreements),
    notes: (d.notes || []).map(makeNote),
    inspections: (d.inspections || []).map(makeInspection),
    meta: { ...EMPTY.meta, ...(d.meta || {}) },
  };
}

/**
 * הגירה: בניין שיש לו `managementFee` ואין לו אף הסכם מקבל הסכם פותח עם
 * `effectiveFrom: null` (= מאז ומעולם).
 *
 * זה מה שמאפשר ל-`localStorage` קיים ול-seed שנוצר לפני פרוסה 3 לעלות בלי
 * שבירה ובלי ייבוא מחדש. ההגירה **לא נוגעת** בבניין שכבר יש לו הסכם, ולכן
 * היא אידמפוטנטית: הרצה חוזרת לא מייצרת כפילות ולא דורסת עריכות.
 */
function migrateFees(buildings, rawFees) {
  const fees = (rawFees || []).map(makeFeeAgreement);
  const covered = new Set(fees.map((f) => f.buildingId));
  for (const b of buildings) {
    if (covered.has(b.id)) continue;
    if (!b.managementFee) continue;
    fees.push(makeFeeAgreement({ buildingId: b.id, amount: b.managementFee, effectiveFrom: null }));
  }
  return fees;
}

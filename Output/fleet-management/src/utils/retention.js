// ============================================================================
// retention.js — D6: **אנונימיזציה, לא מחיקה.**
//
// עובד עוזב → אי אפשר פשוט למחוק אותו: היסטוריית ההחזקות היא נכס תפעולי,
// וגם ההגנה של החברה מול ס' 27ב לפקודת התעבורה לגבי עבירות שיצוצו באיחור.
// מנגד, לשמור לנצח את שם העובד לצד 12 קנסות אינו מידתי.
//
// המנגנון: `Driver.status='archived'` → ובמועד ה-retention, השם/טלפון/מייל/
// מס' עובד מוחלפים בטוקן ("עובד לשעבר #A17"). שאר הישויות שומרות `driverId`
// בלבד — **וזה עובד רק כי לא דנרמלנו שם לשום מקום (D3).**
//
// המחיקה חייבת לכלול **גם אובייקטים מ-Storage** — זה בדיוק מה שנשמט
// ב-property-management והשאיר שם קבצי PII יתומים.
//
// ⚠️ M1 (שער עדי, 2026-08-13): "לא דנרמלנו שם לשום מקום" היה נכון לגבי שדות
// **מבניים** — ולא נכון לגבי **טקסט חופשי**. שמות עובדים אמיתיים יושבים
// כטקסט ב-`Assignment.importRaw` (יומן החילופים מהאקסל), וגם עלולים לשבת
// בכל שדה הערות שאדמין הקליד. אנונימיזציה שמנקה `driverUid` בלבד משאירה את
// העובד בשמו המלא במאגר — כלומר לא מבצעת את מה שהיא מצהירה. לכן כאן יושבת
// **סריקת רדקציה** על כל שדות הטקסט החופשי, ולא רק על השדות המבניים.
//
// ⚠️ תקופות השמירה עצמן (RETENTION_CLASSES.months) הן ⚖️ עו"ד — כאן רק המבנה
// והפעולה הטכנית. הפעולה מופעלת ידנית ע"י אדמין; אין scheduler בפרוסה 1.
// ============================================================================

import { nowIso } from "./id.js";
import { emptyNotice } from "./notice.js";
import { normText, compareKey, words } from "./importExcel.js";

// מפתח i18n שמסמן שם מאונן. נשמר בתוך fullName כ-"<prefix>|<token>".
export const ANON_PREFIX = "driver.anonymizedName";

// טוקן קצר ויציב לעובד שאורכב. דטרמיניסטי לפי ה-id → אותו נהג = אותו טוקן.
export function anonymizationToken(driverId) {
  let hash = 0;
  for (const ch of String(driverId)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const suffix = hash.toString(36).toUpperCase().slice(0, 4).padStart(4, "0");
  return `#${suffix}`;
}

// ============================================================================
// M1 — רדקציה של שם עובד מטקסט חופשי.
//
// שדות הטקסט שבהם שם של עובד יכול לשרוד אנונימיזציה. הרשימה מפורשת בכוונה
// (ולא "כל מחרוזת בכל ישות"): רדקציה עיוורת הייתה מוחקת מילים גם מלוחית
// רישוי, ממספר אסמכתא ומשם דגם. כל שדה טקסט חדש שנוסף לסכימה חייב להיכנס
// לכאן — הבדיקה ב-smoke סורקת **כל** מחרוזת ולכן שדה שנשכח ייפול שם.
// ============================================================================
export const REDACTABLE_TEXT_FIELDS = {
  assignments: ["importRaw", "notes"],
  vehicles: ["notes"],
  vehiclesPrivate: ["commercialNotes"],
  drivers: ["notes"],
  fines: ["violationType", "authority", "driverStatement.text"],
  finesPrivate: ["adminNotes"],
  fineScans: ["fileName"],
  odometerReadings: ["notes", "photoName"],
  serviceRecords: ["notes", "garage"],
  documents: ["title", "notes", "fileName"],
  incidents: ["description"],
  incidentsPrivate: ["adminAssessment"],
  leaseCompanies: ["notes", "contactName"],
};

// מילים קצרות מדי מכדי לזהות אדם — לא מוחקים אותן מהטקסט.
const MIN_NAME_WORD = 2;

const getPath = (obj, path) =>
  path.split(".").reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), obj);

const setPath = (obj, path, value) => {
  const [head, ...rest] = path.split(".");
  if (!rest.length) return { ...obj, [head]: value };
  return { ...obj, [head]: setPath(obj[head] || {}, rest.join("."), value) };
};

// ============================================================================
// redactNameFromText — מחליף את מילות שמו של העובד בטוקן, ומאחד רצף טוקנים.
// טהור. `keep` = מילים שאסור למחוק כי הן שייכות גם לעובד אחר שאינו מאונן
// (שני עובדים בשם "דנה": מחיקת "דנה" הייתה מסמנת את השנייה בטוקן של הראשונה,
// וזו הטעיה גרועה יותר מהשארת שם פרטי משותף שאינו מזהה בפני עצמו).
// ============================================================================
export function redactNameFromText(text, name, token, { keep } = {}) {
  const src = normText(text);
  const keepSet = keep instanceof Set ? keep : new Set(keep || []);
  const targets = new Set(
    words(name)
      .filter((w) => w.length >= MIN_NAME_WORD)
      .map(compareKey)
      .filter((k) => k && !keepSet.has(k))
  );
  if (!src || !targets.size) return { text: src, changed: false };

  const mark = `[${token}]`;
  // פיצול ששומר את המפרידים, כדי שהטקסט יחזור כפי שהיה פרט לשם עצמו.
  // הנקודה והקו התחתון הם מפרידים **כאן** (בניגוד ל-`words`), כי שם עובד
  // נכנס גם לשמות קבצים: "קנס אורית לוי.pdf" — בלי זה "לוי.pdf" אינו מותאם
  // ושם המשפחה שורד את האנונימיזציה בשדה fileName. תאריכים אינם נפגעים:
  // "28.4.2026" מתפצל למספרים, ומספר לעולם אינו מילה בשם.
  const parts = src.split(/([\s,._\-–—()[\]/|·]+)/);
  let changed = false;
  const out = parts.map((part, i) => {
    if (i % 2 === 1) return part; // מפריד
    if (!part || !targets.has(compareKey(part))) return part;
    changed = true;
    return mark;
  });
  if (!changed) return { text: src, changed: false };

  // "[#A17] [#A17]" (שם פרטי + משפחה) → טוקן אחד.
  const collapsed = out
    .join("")
    .replace(new RegExp(`(?:${escapeRe(mark)})(?:[\\s,._\\-–—()[\\]/|·]+(?:${escapeRe(mark)}))+`, "g"), mark)
    .replace(/\s+/g, " ")
    .trim();
  return { text: collapsed, changed: true };
}

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// מילים ששייכות גם לעובד אחר שאינו מאונן — ראה ההסבר ב-redactNameFromText.
export function protectedNameWords(data, driverId) {
  const keep = new Set();
  for (const d of data?.drivers || []) {
    if (d.id === driverId || d.anonymizedAt) continue;
    for (const w of words(d.fullName)) {
      if (w.length >= MIN_NAME_WORD) keep.add(compareKey(w));
    }
  }
  return keep;
}

// ============================================================================
// redactDriverNameEverywhere — סורקת את **כל** שדות הטקסט החופשי ומוחקת מהם
// את שם העובד. מחזירה { data, redacted, fields }.
//
// `Assignment.importRaw` מקבל טיפול מיוחד: הוא עקבת ביקורת (D-Import), ולכן
// הוא **לא נמחק** אלא עובר רדקציה — המשפט נשאר ("החל מ 28.4.2026 עבר לעובד
// [#A17]"), ומסומן ב-`importRawRedactedAt`. `importSource` (קובץ/גיליון/שורה)
// נשמר במלואו: הוא העקבה האמיתית, ואין בו PII.
// ============================================================================
export function redactDriverNameEverywhere(data, driverId, token, at = null) {
  const driver = (data?.drivers || []).find((d) => d.id === driverId) || null;
  const name = driver?.fullName || "";
  const stamp = at || nowIso();
  if (!name || parseAnonymizedName(name)) return { data, redacted: 0, fields: [] };

  const keep = protectedNameWords(data, driverId);
  const out = { ...data };
  const fields = [];

  for (const [collection, paths] of Object.entries(REDACTABLE_TEXT_FIELDS)) {
    const list = data[collection];
    if (!Array.isArray(list) || !list.length) continue;
    out[collection] = list.map((entity) => {
      // רשומת העובד עצמו מטופלת ב-anonymizeDriver (שם, טלפון, מייל, הערות).
      if (collection === "drivers" && entity.id === driverId) return entity;
      let next = entity;
      let touched = false;
      let rawTouched = false;
      for (const path of paths) {
        const cur = getPath(entity, path);
        if (typeof cur !== "string" || !cur) continue;
        const res = redactNameFromText(cur, name, token, { keep });
        if (!res.changed) continue;
        next = setPath(next, path, res.text);
        touched = true;
        if (path === "importRaw") rawTouched = true;
        fields.push(`${collection}.${path}`);
      }
      if (!touched) return entity;
      return {
        ...next,
        ...(rawTouched ? { importRawRedactedAt: stamp } : null),
        updatedAt: stamp,
      };
    });
  }
  return { data: out, redacted: fields.length, fields };
}

// ארכוב: העובד מפסיק להיות פעיל, הקישור לפורטל מנותק — אבל המידע נשאר.
// זה הצעד הראשון; האנונימיזציה מגיעה במועד ה-retention.
export function archiveDriver(data, driverId, today) {
  return {
    ...data,
    drivers: (data.drivers || []).map((d) =>
      d.id === driverId
        ? { ...d, status: "archived", portalStatus: "revoked", userId: null, updatedAt: nowIso() }
        : d
    ),
    // סוגר החזקות פתוחות — עובד שעזב לא ממשיך להחזיק רכב.
    assignments: (data.assignments || []).map((a) =>
      a.driverId === driverId && !a.toDate ? { ...a, toDate: today, driverUid: null } : a
    ),
  };
}

// ============================================================================
// anonymizeDriver — מחליף את שדות הזיהוי בטוקן. מחזיר { data, storagePaths }:
// הקורא אחראי למחוק את האובייקטים מ-Storage (הקוד כאן טהור).
// ============================================================================
export function anonymizeDriver(data, driverId) {
  const token = anonymizationToken(driverId);
  const at = nowIso();

  // M1 — קודם כל מוחקים את השם מכל טקסט חופשי, **בעוד השם עדיין ידוע**.
  // אחרי שנחליף את fullName בטוקן כבר לא יהיה מול מה לחפש.
  const { data: redactedData, fields: redactedFields } = redactDriverNameEverywhere(
    data,
    driverId,
    token,
    at
  );
  data = redactedData;

  const drivers = (data.drivers || []).map((d) =>
    d.id === driverId
      ? {
          ...d,
          fullName: `${ANON_PREFIX}|${token}`, // מפתח i18n + טוקן, מפורק בתצוגה
          phone: "",
          email: "",
          employeeNumber: "",
          userId: null,
          portalStatus: "revoked",
          status: "archived",
          notes: "",
          notice: emptyNotice(),
          anonymizedAt: at,
          updatedAt: at,
        }
      : d
  );

  // ניתוק ה-uid המדונרמל מכל הישויות (driverId נשאר — הוא פסאודונימי).
  const clearUid = (arr) =>
    (arr || []).map((x) => (x.driverId === driverId ? { ...x, driverUid: null } : x));

  // קבצים אישיים של העובד — צילומי מד וצילומי תקלה — נמחקים.
  const storagePaths = [];
  const odometerReadings = (data.odometerReadings || []).map((r) => {
    if (r.driverId !== driverId) return r;
    if (r.photoStorageMode === "storage" && r.photoRef) storagePaths.push(r.photoRef);
    return { ...r, driverUid: null, photoRef: null, photoName: "", photoStorageMode: "none" };
  });
  const incidents = (data.incidents || []).map((i) => {
    if (i.driverId !== driverId) return i;
    for (const p of i.photos || []) {
      if (p.storageMode === "storage" && p.fileRef) storagePaths.push(p.fileRef);
    }
    return { ...i, driverUid: null, photos: [] };
  });

  return {
    data: {
      ...data,
      drivers,
      assignments: clearUid(data.assignments),
      fines: clearUid(data.fines),
      // סריקות הקנס עצמן **לא** נמחקות כאן: הקנס הוא מסמך חשבונאי עם שעון
      // retention נפרד (⚖️). רק ה-uid המדונרמל מנותק.
      fineScans: clearUid(data.fineScans),
      odometerReadings,
      incidents,
    },
    storagePaths,
    // כמה שדות טקסט חופשי עברו רדקציה — מוצג לאדמין ונשמר כעקבה בבדיקות.
    redactedFields,
  };
}

// ============================================================================
// purgeDriverFiles — איסוף כל נתיבי ה-Storage של עובד, בלי לשנות נתונים.
// שימושי לבדיקת "מה יימחק" לפני שמאשרים.
// ============================================================================
export function collectDriverStoragePaths(data, driverId) {
  const paths = [];
  for (const r of data.odometerReadings || []) {
    if (r.driverId === driverId && r.photoStorageMode === "storage" && r.photoRef) paths.push(r.photoRef);
  }
  for (const i of data.incidents || []) {
    if (i.driverId !== driverId) continue;
    for (const p of i.photos || []) if (p.storageMode === "storage" && p.fileRef) paths.push(p.fileRef);
  }
  return paths;
}

// כל נתיבי ה-Storage של רכב — נדרש כשמוחקים רכב (cascade).
export function collectVehicleStoragePaths(data, vehicleId) {
  const paths = [];
  for (const d of data.documents || []) {
    if (d.vehicleId === vehicleId && d.storageMode === "storage" && d.fileRef) paths.push(d.fileRef);
  }
  const fineIds = new Set((data.fines || []).filter((f) => f.vehicleId === vehicleId).map((f) => f.id));
  for (const s of data.fineScans || []) {
    if (fineIds.has(s.fineId) && s.storageMode === "storage" && s.fileRef) paths.push(s.fileRef);
  }
  for (const r of data.odometerReadings || []) {
    if (r.vehicleId === vehicleId && r.photoStorageMode === "storage" && r.photoRef) paths.push(r.photoRef);
  }
  for (const i of data.incidents || []) {
    if (i.vehicleId !== vehicleId) continue;
    for (const p of i.photos || []) if (p.storageMode === "storage" && p.fileRef) paths.push(p.fileRef);
  }
  return paths;
}

// פירוק שם מאונן לתצוגה: "driver.anonymizedName|#A17" → { key, token }.
export function parseAnonymizedName(fullName) {
  if (typeof fullName !== "string" || !fullName.startsWith(`${ANON_PREFIX}|`)) return null;
  return { key: ANON_PREFIX, token: fullName.split("|")[1] || "" };
}

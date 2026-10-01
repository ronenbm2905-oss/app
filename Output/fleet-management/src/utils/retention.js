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
import { canonicalEmail } from "./admins.js";
import { canonicalPhone, mapNumericRuns } from "./phone.js";
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

// ============================================================================
// שדות שמחזיקים **מזהה ישיר של נהג** ולכן נכנסים לאנונימיזציה.
//
// 3.3.4 בהכוונת עדי (17.8): M1 כפי שהיה אכף ששם העובד אינו שורד באף שדה —
// והחמיץ את הכתובת. אצל עובד שנכנס לפורטל מגימייל **פרטי**, הכתובת היא
// מזהה חזק יותר מהשם: היא ייחודית, קבועה, וניתנת לחיפוש. עובד שעזב, עבר
// אנונימיזציה, וכתובתו נשארה ב-`portalLinkedEmail` — לא עבר אנונימיזציה.
//
// ============================================================================
// ⚠️ 1.10.2026 — **הנייד נכנס לרשימה, וזה לא היה "עוד שדה".**
// ============================================================================
// עד כאן הרשימה הייתה `["email", "portalLinkedEmail"]`. הנייד **לא היה בה**
// בכלל — לא כי מישהו החליט שהוא אינו מזהה, אלא כי הוא לא היה *שם*: הסריקה
// נבנתה סביב שדה שהוא "מייל", והטלפון היה שדה קשר משני שאיש לא נכנס איתו
// לשום מקום.
//
// מהרגע שעוגן הזהות של הפורטל הוא הנייד, זו **ההחמצה הגדולה ביותר שאפשר**:
//   • נייד הוא מזהה חזק יותר מכתובת מייל — הוא ייחודי, הוא לא מתחלף כשעובד
//     מחליף מקום עבודה, והוא המזהה שאיתו מוצאים אדם בכל מערכת אחרת;
//   • `phone` הוא עכשיו **המפתח** שהעובד נכנס איתו, בדיוק כפי שהמייל היה;
//   • ועובד שעבר אנונימיזציה ומספרו שרד ב-`portalLinkedPhone` או בהערה
//     חופשית כלשהי — **לא עבר אנונימיזציה**. הטוקן בשם הוא קוסמטיקה אם
//     המספר נשאר לידו.
//
// `portalLinkedEmail` נשאר ברשימה למרות שמסלול המייל הוסר: יש רשומות בענן
// ועדיין עלול לשבת בהן PII, וסריקה שמפסיקה לחפש משהו שכבר נכתב אינה סריקה.
// ============================================================================
export const IDENTIFIER_BEARING_FIELDS = {
  drivers: ["email", "portalLinkedEmail", "phone", "portalLinkedPhone"],
  leaseCompanies: ["email", "phone"],
};

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
// ============================================================================
// redactDriverIdentifiersEverywhere — אותה סריקה, על **המזהים**: מייל ונייד.
//
// מזהה אינו "מילה בשם" ולכן אינו עובר ב-redactNameFromText: הוא מחרוזת אחת
// שיש להחליף כשלמותה, והוא מופיע גם בצורות שקולות — גימייל מתעלם מנקודות
// ומ-+alias, ונייד נכתב כ-050-1234567 / 0501234567 / +972-50-123-4567.
//
// ============================================================================
// ⛔ ולמה **אין כאן regex של טלפון** (עדי §5.1 — חוסם)
// ============================================================================
// לכתובת מייל יש תבנית שאינה מתנגשת בכלום (`משהו@משהו.משהו`), ולכן גרסת
// המייל של הפונקציה הזו יכולה לחפש "כל מה שנראה כמו כתובת" ולהחליף.
// **לטלפון אין מקבילה.** רצף של 8-10 ספרות בטקסט חופשי הוא גם:
//   • לוחית רישוי — שמונה ספרות (הדוגמאות כאן בדויות: `12345678`);
//   • מספר אסמכתא של קנס;
//   • קריאת מד-אוץ';
//   • מספר עובד;
//   • תאריך בלי מפרידים — `30092026`.
// regex תמים היה הופך את `Assignment.importRaw` — שהוא **עקבת ביקורת** —
// לגבינה, והכי גרוע: זה היה נראה כאילו האנונימיזציה עבדה.
//
// לכן המימוש הוא **השוואה קנונית מדויקת על רצף ספרות שלם**
// (phone.js:mapNumericRuns), וארבע ההגנות נגזרות ממנו ישירות:
//   1. מחליפים **רק** רצף שהצורה הקנונית שלו שווה בדיוק למספר המטרה;
//   2. הרצף חייב להיות **נייד ישראלי תקף** (05X+7 / +9725X) — לוחית בת 8
//      ספרות ומספר אסמכתא שאינו מתחיל ב-05 מתקננים ל-'' ולכן אינם מושווים;
//   3. **אין התאמה חלקית** — שבע הספרות של נייד לעולם אינן נבדקות לבדן,
//      גם כשהן יושבות בתוך **קו נייח של עובד אחר** (וזה מצב אמיתי בנתונים
//      שלנו: קו נייח ששבע הספרות שלו זהות לנייד של אדם אחר);
//   4. **גבולות רצף ספרות** — `0540000017` בתוך `+9720540000017` אינו רצף
//      שלם ולכן אינו מטופל (ובטח שלא פעמיים).
// ============================================================================
const EMAIL_LIKE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

export function redactDriverIdentifiersEverywhere(data, driverId, token, at = null) {
  const driver = (data?.drivers || []).find((d) => d.id === driverId) || null;
  const targets = new Set(
    [driver?.email, driver?.portalLinkedEmail].map((e) => canonicalEmail(e)).filter(Boolean)
  );
  // ⬅ **המזהה המרכזי מאז 1.10.2026.** שני השדות, ולא רק זה שהאדמין הקליד:
  //   `phone` הוא מה שהוקלד, `portalLinkedPhone` הוא מה שאומת ב-SMS, והם
  //   נבדלים לגיטימית בצורת הכתיבה.
  const phoneTargets = new Set(
    [driver?.phone, driver?.portalLinkedPhone].map((p) => canonicalPhone(p)).filter(Boolean)
  );
  if (!targets.size && !phoneTargets.size) return { data, redacted: 0, fields: [] };

  const stamp = at || nowIso();
  const mark = `[${token}]`;
  const out = { ...data };
  const fields = [];

  // כל שדה טקסט חופשי שסורקים ממילא ל-M1, ובנוסף שדות המזהים הייעודיים.
  const paths = { ...REDACTABLE_TEXT_FIELDS };
  for (const [c, list] of Object.entries(IDENTIFIER_BEARING_FIELDS)) {
    paths[c] = [...new Set([...(paths[c] || []), ...list])];
  }

  for (const [collection, keys] of Object.entries(paths)) {
    const list = data[collection];
    if (!Array.isArray(list) || !list.length) continue;
    out[collection] = list.map((entity) => {
      // הרשומה של העובד עצמו מטופלת ב-anonymizeDriver (איפוס מלא).
      if (collection === "drivers" && entity.id === driverId) return entity;
      let next = entity;
      let touched = false;
      for (const path of keys) {
        const cur = getPath(entity, path);
        if (typeof cur !== "string" || !cur) continue;
        // מחליפים רק אם **מופע שלם** בטקסט מתקנן לאותו מזהה — כתובת או נייד.
        const replaced = mapNumericRuns(
          cur.replace(EMAIL_LIKE, (m) => (targets.has(canonicalEmail(m)) ? mark : m)),
          // null = "זה אינו המספר שלו, אל תיגע" — וזה הערך שמחזיר כל רצף
          // ספרות שאינו נייד תקף: לוחית, אסמכתא, ק"מ, תאריך.
          (run) => (phoneTargets.has(canonicalPhone(run)) ? mark : null)
        );
        if (replaced === cur) continue;
        next = setPath(next, path, replaced);
        touched = true;
        fields.push(`${collection}.${path}`);
      }
      if (!touched) return entity;
      return { ...next, updatedAt: stamp };
    });
  }
  return { data: out, redacted: fields.length, fields };
}

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

// ============================================================================
// ארכוב: העובד מפסיק להיות פעיל, הקישור לפורטל מנותק — אבל המידע נשאר.
// זה הצעד הראשון; האנונימיזציה מגיעה במועד ה-retention.
//
// ⚠️ **1.10.2026 — `portalLinkedPhone` מתאפס כאן ומיד, ולא ממתין ל-retention.**
// זו הבחנה שלא הייתה קיימת בגימייל (שם `portalLinkedEmail` נשאר עד מועד
// השמירה), ועדי משנה אותה כאן במכוון (§5.5):
//   • `phone` **נשאר** — הוא פרט **קשר**, ואחרי עזיבה עוד מגיע קנס באיחור
//     שצריך לטפל בו;
//   • `portalLinkedPhone` הוא פרט **זהות**, והוא אינו משרת שום מטרה אחרי
//     הניתוק. ומעבר לזה: **מספרי נייד ממוחזרים.** מספר של עובד שעזב עשוי
//     להיות של אדם אחר לגמרי בעוד שנה — כלומר זו עקבת זהות של מישהו
//     שאיננו יודעים מי הוא. אין לה שימוש, ויש לה סיכון.
// העקבה שכן נשארת (3.3.5) היא "גישת פורטל התקיימה ובוטלה" — `portalStatus`
// ו-`updatedAt`, **בלי המספר**.
// ============================================================================
export function archiveDriver(data, driverId, today) {
  return {
    ...data,
    drivers: (data.drivers || []).map((d) =>
      d.id === driverId
        ? {
            ...d,
            status: "archived",
            portalStatus: "revoked",
            userId: null,
            portalLinkedPhone: null,
            updatedAt: nowIso(),
          }
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

  // 3.3.4 — ואותו דבר למזהים (מייל **ונייד**), מאותה סיבה בדיוק ובאותו
  // חלון זמן: אחרי שנאפס את השדות ברשומה כבר לא יהיה מול מה לחפש.
  const { data: idRedacted, fields: idFields } = redactDriverIdentifiersEverywhere(
    data,
    driverId,
    token,
    at
  );
  data = idRedacted;
  redactedFields.push(...idFields);

  const drivers = (data.drivers || []).map((d) =>
    d.id === driverId
      ? {
          ...d,
          fullName: `${ANON_PREFIX}|${token}`, // מפתח i18n + טוקן, מפורק בתצוגה
          phone: "",
          email: "",
          // 3.3.4 — המזהים שאיתם נכנס לפורטל הם מזהים ישירים, ולכן הם נמחקים
          // ברשומה **וגם** נסרקים מכל טקסט חופשי
          // (redactDriverIdentifiersEverywhere).
          portalLinkedEmail: null,
          // ⚠️ 1.10.2026 — הנייד הוא עוגן הזהות של הפורטל, ולכן השדה הזה הוא
          // המקביל המדויק של portalLinkedEmail. בלי האיפוס הזה "עובד מאונן"
          // היה רשומה עם טוקן בשם ומספר נייד מלא לידו. (בפועל הוא מתאפס כבר
          // בארכוב — זו חגורה שנייה, לרשומות שהגיעו לכאן בדרך אחרת.)
          portalLinkedPhone: null,
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

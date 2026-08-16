// ============================================================================
// importExcel.js — מסך 6: ייבוא מהאקסל. **הלוגיקה הטהורה בלבד.**
//
// הקלט הוא "גריד": מערך של שורות, כל שורה מערך של תאים, כאשר `rows[0]` היא
// שורה 1 בגיליון. קריאת הקובץ עצמו יושבת ב-importWorkbook.js — כדי שכל
// הכללים כאן יהיו ניתנים לבדיקה ב-node בלי דפדפן ובלי קובץ.
//
// שלושה עקרונות שמכתיבים את כל הקובץ:
//
//   1. **לא מנחשים בשקט.** כל ערך שנדחה, כל שורה שדולגה וכל שם שנראה כמו
//      טקסט חופשי — מדווח למשתמש עם הערך המקורי והסיבה. ייבוא עיוור אסור.
//
//   2. **D-Import (עדי):** טקסט חופשי בעמודת "שם נהג" הוא הערה אנושית בלתי-
//      מבוקרת על עובד. הוא נכנס לשדה **מבודד** `Assignment.importRaw` המסומן
//      "לבדיקה" — לא ל-`notes` התפעולי, ו**לא** כשם של נהג במאגר. שורה כזו
//      מקבלת `needsReview=true`, שחוסם שיוך קנס אוטומטי (D5).
//
//   3. **fromDateInferred:** לאקסל אין תאריך תחילת החזקה — רק תאריך תחילת
//      הסכם ליסינג. אנחנו כן משתמשים בו (אחרת השיוך האוטומטי משותק לנצח),
//      אבל מסמנים אותו כמשוער כדי שהממשק יזהיר בעת שיוך קנס.
// ============================================================================

// ============================================================================
// גיליונות שמוחרגים מהייבוא לחלוטין — לא מיובאים וגם לא מוצעים כברירת מחדל.
// `החזרות רכבים`: 79 שורות היסטוריה של עובדים שרובם עזבו, בלי מטרה עדכנית.
// זה כשל **מזעור**, ולא רק בעיית איכות נתונים (D-Import, עדי). ההחרגה יושבת
// כאן ולא בשכבת הקריאה כדי שאפשר יהיה לבדוק אותה בלי דפדפן.
// ============================================================================
export const EXCLUDED_SHEETS = ["החזרות רכבים"];

export function isExcludedSheet(name) {
  const n = String(name ?? "").replace(/\s+/g, " ").trim();
  return EXCLUDED_SHEETS.includes(n);
}

// -- טווח סביר לעלות חודשית של רכב בליסינג תפעולי (₪). ----------------------
// מחוץ לטווח = לא סכום, גם אם זה מספר. מקור העמודה מזוהם: ראינו בה טלפון
// ו-serial של תאריך.
export const COST_MIN = 500;
export const COST_MAX = 10000;

// טווח serial של אקסל שמתאים לתאריכים בעשורים הרלוונטיים (1979–2064) —
// משמש רק כדי לתת סיבת-דחייה מדויקת ("זה תאריך"), לא כדי לקבל את הערך.
const DATE_SERIAL_MIN = 29000;
const DATE_SERIAL_MAX = 60000;

// שם אדם סביר בעברית: עד שלוש מילים ("דורית בן מאיר"). מעבר לזה — משפט.
export const MAX_NAME_WORDS = 3;

// מילים שמסגירות יומן חילופים / הערה תפעולית בתוך עמודת "שם נהג".
export const FREE_TEXT_MARKERS = [
  "החל", "מתאריך", "אצל", "עבור", "לשעבר", "מסתובב", "לעובד", "עבר",
  "רכב", "חברה", "זמני", "נגנב", "הוחזר", "החזרה", "טרם", "ללא", "מאגר",
];

// רכב מאגר → Vehicle.status='pool'.
export const POOL_MARKERS = ["מסתובב", "מאגר"];

// כותרות מוכרות → שדה. ההתאמה לפי **תווית**, לא לפי מיקום עמודה, כדי
// שגיליון עם עמודה שנוספה לא ישבור את הייבוא.
export const HEADER_ALIASES = {
  index: ["מסד", "מס' סידורי", "מספר סידורי", "#"],
  plate: ["מס' רישוי", "מספר רישוי", "רישוי", "לוחית"],
  model: ["דגם", "סוג רכב"],
  driver: ["שם נהג", "נהג", "שם הנהג"],
  leaseCompany: ["חברת ליסינג", "ליסינג", "חברה"],
  contractStart: ["תאריך תחילת הסכם", "תחילת הסכם", "תחילת חוזה"],
  contractEnd: ["תאריך סיום הסכם", "סיום הסכם", "סיום חוזה"],
  monthlyCost: ["עלות חודשית", "עלות", "מחיר חודשי"],
};

// שדות שבלעדיהם אין בכלל ייבוא.
const REQUIRED_FIELDS = ["plate", "driver"];

// ============================================================================
// עזרי טקסט
// ============================================================================

export function normText(v) {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return isoFromDate(v) || "";
  return String(v).replace(/\s+/g, " ").trim();
}

// מפתח השוואה כללי — רווחים, גרשיים וגודל אותיות לא אמורים לפצל ישות.
export function compareKey(v) {
  return normText(v).replace(/[\s"'`׳״]/g, "").toLowerCase();
}

// מפתח לוחית — רק ספרות/אותיות. "25-324-403" ו-"25324403" הן אותה לוחית.
export function plateKey(v) {
  return String(v ?? "").replace(/[^0-9A-Za-z]/g, "");
}

// מפתח חברת ליסינג — בנוסף לניקוי הרגיל, מסירים יו"ד, כי כתיב מלא/חסר הוא
// מקור הפיצול הקלאסי בעברית ("פריים ליס" מול "פרים ליס"). המיזוג מוצג
// למשתמש עם כל הווריאנטים המקוריים, כדי שלא ימוזג משהו בשקט.
export function leaseKey(v) {
  return compareKey(v).replace(/י/g, "");
}

export function nameKey(v) {
  return compareKey(v);
}

// פיצול למילים: מקף, סוגריים, לוכסן ופסיק הם מפרידים ולא חלק מהמילה
// ("שם - משפחה" = שתי מילים, לא שלוש) — חשוב כדי ששם תקין עם מקף לא ייפול
// בכלל ">3 מילים" ויסומן בטעות כטקסט חופשי.
export function words(text) {
  return normText(text)
    .split(/[\s,\-–—()\[\]/|·]+/)
    .filter(Boolean);
}

export function looksLikeEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normText(v));
}

// "052-3866645" / "0527306374" / "+972-52-1234567" — התא **כולו** טלפון.
export function looksLikePhone(v) {
  const s = normText(v).replace(/[\s()]/g, "");
  return /^\+?[\d-]{9,15}$/.test(s) && /\d{7,}/.test(s.replace(/-/g, ""));
}

// ============================================================================
// תאריכים — serial של אקסל, אובייקט Date, או מחרוזת
// ============================================================================

// epoch 1899-12-30 (מפצה על באג שנת-המעוברת 1900 של אקסל עבור serial ≥ 61,
// שזה כל טווח הנתונים הריאלי).
export function excelSerialToIso(serial) {
  const n = Number(serial);
  if (!Number.isFinite(n) || n < 1 || n > 2958465) return null;
  const ms = Date.UTC(1899, 11, 30) + Math.floor(n) * 86400000;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function isoFromDate(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

// המרת תא-תאריך ל-"YYYY-MM-DD". מחזיר { iso, raw, reasonKey }.
export function parseDateCell(raw) {
  if (raw === null || raw === undefined || raw === "") {
    return { iso: null, raw: "", reasonKey: null, empty: true };
  }
  if (raw instanceof Date) {
    const iso = isoFromDate(raw);
    return { iso, raw: iso || String(raw), reasonKey: iso ? null : "importx.reason.badDate" };
  }
  if (typeof raw === "number") {
    const iso = excelSerialToIso(raw);
    return { iso, raw: String(raw), reasonKey: iso ? null : "importx.reason.badDate" };
  }
  const s = normText(raw);
  // "YYYY-MM-DD"
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return { iso: s, raw: s, reasonKey: null };
  // "D.M.YY" / "DD/MM/YYYY"
  m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2}|\d{4})$/);
  if (m) {
    const d = Number(m[1]);
    const mo = Number(m[2]);
    let y = Number(m[3]);
    if (y < 100) y += y < 70 ? 2000 : 1900;
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      const iso = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      return { iso, raw: s, reasonKey: null };
    }
  }
  // serial שנשמר כטקסט
  if (/^\d+$/.test(s)) {
    const iso = excelSerialToIso(Number(s));
    if (iso) return { iso, raw: s, reasonKey: null };
  }
  return { iso: null, raw: s, reasonKey: "importx.reason.badDate" };
}

// ============================================================================
// עלות חודשית — העמודה המזוהמת
// ============================================================================
export function parseMonthlyCost(raw) {
  if (raw === null || raw === undefined || raw === "") {
    return { ok: true, value: 0, empty: true, raw: "" };
  }
  // תא בפורמט תאריך שנשמר בעמודת עלות — האקסל מחזיר Date, לא מספר.
  if (raw instanceof Date) {
    return { ok: false, value: 0, raw: isoFromDate(raw), reasonKey: "importx.reason.costIsDate" };
  }
  if (typeof raw === "string") {
    const s = normText(raw);
    if (looksLikePhone(s) || /^0\d/.test(s.replace(/[\s-]/g, ""))) {
      return { ok: false, value: 0, raw: s, reasonKey: "importx.reason.costIsPhone" };
    }
    const cleaned = s.replace(/[₪,\s]/g, "");
    if (!/^\d+(\.\d+)?$/.test(cleaned)) {
      return { ok: false, value: 0, raw: s, reasonKey: "importx.reason.costNotNumber" };
    }
    return rangeCheck(Number(cleaned), s);
  }
  if (typeof raw === "number") return rangeCheck(raw, String(raw));
  return { ok: false, value: 0, raw: String(raw), reasonKey: "importx.reason.costNotNumber" };
}

function rangeCheck(n, raw) {
  if (!Number.isFinite(n)) {
    return { ok: false, value: 0, raw, reasonKey: "importx.reason.costNotNumber" };
  }
  if (n >= DATE_SERIAL_MIN && n <= DATE_SERIAL_MAX) {
    // הסיבה המדויקת חשובה יותר מ"מחוץ לטווח": זה serial של תאריך.
    return { ok: false, value: 0, raw, reasonKey: "importx.reason.costIsDate" };
  }
  if (n < COST_MIN || n > COST_MAX) {
    return { ok: false, value: 0, raw, reasonKey: "importx.reason.costOutOfRange" };
  }
  return { ok: true, value: n, raw };
}

// ============================================================================
// עמודת "שם נהג" — ההיוריסטיקה שקובעת מה שם ומה יומן חילופים
//
// מחזיר { kind: 'name' | 'freeText' | 'empty', name, isPool, reasons[] }.
// מוטב לסמן שם אמיתי כ"לבדיקה" מאשר להזרים משפט למאגר הנהגים כאילו הוא עובד.
// ============================================================================
export function classifyDriverCell(raw) {
  const text = normText(raw);
  if (!text) return { kind: "empty", name: null, isPool: false, reasons: [], text: "" };

  const tokens = words(text);
  const reasons = [];

  if (/\d/.test(text)) reasons.push("importx.reason.hasDigits");

  const markers = tokens.filter((w) => FREE_TEXT_MARKERS.includes(w));
  if (markers.length) reasons.push("importx.reason.marker");

  if (tokens.length > MAX_NAME_WORDS) reasons.push("importx.reason.tooManyWords");

  if (/[()[\]/]/.test(text)) reasons.push("importx.reason.punctuation");

  const isPool = tokens.some((w) => POOL_MARKERS.includes(w));

  if (reasons.length) {
    return { kind: "freeText", name: null, isPool, reasons, text, markers };
  }
  return { kind: "name", name: text, isPool: false, reasons: [], text };
}

// ============================================================================
// איתור שורת הכותרת ומיפוי העמודות
// ============================================================================
export function findHeader(rows, maxScan = 10) {
  for (let i = 0; i < Math.min(rows.length, maxScan); i++) {
    const row = rows[i] || [];
    const map = {};
    for (let c = 0; c < row.length; c++) {
      const label = normText(row[c]);
      if (!label) continue;
      for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
        if (map[field] !== undefined) continue;
        if (aliases.some((a) => compareKey(a) === compareKey(label))) map[field] = c;
      }
    }
    if (REQUIRED_FIELDS.every((f) => map[f] !== undefined)) {
      return { rowNumber: i + 1, rowIndex: i, columns: map };
    }
  }
  return null;
}

// ============================================================================
// סיווג שורה: רכב / איש קשר של הספק / זבל
// ============================================================================
function cell(row, col) {
  return col === undefined || col === null ? null : row?.[col] ?? null;
}

function classifyRow(row, columns) {
  const idx = cell(row, columns.index);
  const plate = normText(cell(row, columns.plate));
  const hasIndex = Number.isFinite(Number(idx)) && String(idx).trim() !== "" && Number(idx) >= 1;

  if (hasIndex && plate) return "vehicle";

  const cells = (row || []).map(normText).filter(Boolean);
  if (!cells.length) return "empty";

  // שורת אנשי קשר של הספק: בלי מספר סידורי, אבל עם מייל או טלפון.
  // (בקובץ האמיתי זו שורה 40 — פרטי הקשר של פריים ליס, שהיו קבורים בתחתית
  //  הגריד. לא רכב, אבל כן נתון שימושי → מזין את LeaseCompany.)
  if (!hasIndex && (cells.some(looksLikeEmail) || cells.some(looksLikePhone))) return "contact";

  return "junk";
}

function extractContact(row, columns) {
  const all = (row || []).map(normText);
  const companyRaw = normText(cell(row, columns.plate)) || all.find(Boolean) || "";
  const rest = all.filter((v, i) => v && i !== columns.plate);

  const email = rest.find(looksLikeEmail) || "";
  const phone = rest.find((v) => v !== email && looksLikePhone(v)) || "";
  const contactName = rest.find((v) => v !== email && v !== phone && !/[\d@]/.test(v)) || "";
  const notes = rest.filter((v) => v !== email && v !== phone && v !== contactName).join(" · ");

  return { companyRaw, companyKey: leaseKey(companyRaw), contactName, phone, email, notes };
}

// ============================================================================
// analyzeImport — הפונקציה המרכזית. טהורה: אותו קלט → אותו פלט, בלי ids
// ובלי חותמות זמן. הפלט הוא בדיוק מה שמסך התצוגה המקדימה מציג.
// ============================================================================
export function analyzeImport(rows, data = {}, meta = {}) {
  const grid = Array.isArray(rows) ? rows : [];
  const header = findHeader(grid);
  if (!header) {
    return {
      ok: false,
      errorKey: "importx.err.noHeader",
      meta,
      rows: [],
      leaseCompanies: [],
      contacts: [],
      rejected: [],
      skipped: [],
      counts: emptyCounts(),
    };
  }

  const { columns } = header;
  const missingCols = Object.keys(HEADER_ALIASES).filter((f) => columns[f] === undefined);

  // אינדקסים של מה שכבר קיים במערכת — כדי שהרצה חוזרת לא תכפיל.
  const existingVehicles = new Map(
    (data.vehicles || []).map((v) => [plateKey(v.plate), v]).filter(([k]) => k)
  );
  const existingDrivers = new Map(
    (data.drivers || []).map((d) => [nameKey(d.fullName), d]).filter(([k]) => k)
  );
  const existingLease = new Map(
    (data.leaseCompanies || []).map((c) => [leaseKey(c.name), c]).filter(([k]) => k)
  );

  const out = [];
  const rejected = [];
  const skipped = [];
  const contacts = [];
  const leaseByKey = new Map();
  // נהגים חדשים שכבר תוכננו בהרצה הזו — כדי ששתי שורות עם אותו שם לא ייצרו
  // שני נהגים.
  const plannedDrivers = new Map();
  const plannedPlates = new Set();

  for (let i = header.rowIndex + 1; i < grid.length; i++) {
    const row = grid[i] || [];
    const rowNumber = i + 1;
    const kind = classifyRow(row, columns);

    if (kind === "empty") continue;

    if (kind === "junk") {
      skipped.push({
        rowNumber,
        reasonKey: "importx.reason.junkRow",
        preview: (row || []).map(normText).filter(Boolean).join(" | ").slice(0, 120),
      });
      continue;
    }

    if (kind === "contact") {
      const c = extractContact(row, columns);
      contacts.push({ rowNumber, ...c });
      skipped.push({
        rowNumber,
        reasonKey: "importx.reason.contactRow",
        preview: (row || []).map(normText).filter(Boolean).join(" | ").slice(0, 120),
      });
      continue;
    }

    // ---- שורת רכב --------------------------------------------------------
    const plateRaw = normText(cell(row, columns.plate));
    const pKey = plateKey(plateRaw);
    const model = normText(cell(row, columns.model));
    const driverCell = cell(row, columns.driver);
    const driver = classifyDriverCell(driverCell);
    const leaseRaw = normText(cell(row, columns.leaseCompany));
    const lKey = leaseKey(leaseRaw);
    const start = parseDateCell(cell(row, columns.contractStart));
    const end = parseDateCell(cell(row, columns.contractEnd));
    const cost = parseMonthlyCost(cell(row, columns.monthlyCost));

    const warnings = [];

    if (!cost.ok) {
      rejected.push({
        rowNumber,
        plate: plateRaw,
        field: "monthlyCost",
        raw: cost.raw,
        reasonKey: cost.reasonKey,
      });
      warnings.push("importx.reason.costRejected");
    }
    if (start.reasonKey) {
      rejected.push({
        rowNumber, plate: plateRaw, field: "contractStart", raw: start.raw, reasonKey: start.reasonKey,
      });
    }
    if (end.reasonKey) {
      rejected.push({
        rowNumber, plate: plateRaw, field: "contractEnd", raw: end.raw, reasonKey: end.reasonKey,
      });
    }

    // חברת ליסינג — נרשמת פעם אחת למפתח, עם כל הווריאנטים המקוריים.
    if (lKey) {
      const entry = leaseByKey.get(lKey) || {
        key: lKey,
        // השם התצוגתי = הווריאנט הראשון שנראה, אחרי ניקוי רווחים כפולים.
        name: leaseRaw,
        variants: [],
        rows: [],
        existingId: existingLease.get(lKey)?.id || null,
        existingName: existingLease.get(lKey)?.name || null,
        contact: null,
      };
      if (!entry.variants.includes(leaseRaw)) entry.variants.push(leaseRaw);
      entry.rows.push(rowNumber);
      leaseByKey.set(lKey, entry);
    }

    // כפילות: אותה לוחית כבר במערכת, או הופיעה כבר בקובץ עצמו.
    const existingVehicle = pKey ? existingVehicles.get(pKey) : null;
    const dupInFile = pKey && plannedPlates.has(pKey);
    let action = "create";
    if (existingVehicle) action = "skipExisting";
    else if (dupInFile) action = "skipDuplicateInFile";
    else if (pKey) plannedPlates.add(pKey);

    // -- נהג + החזקה ------------------------------------------------------
    let driverAction = "none";
    let existingDriverId = null;
    let driverDisplayName = null;

    if (driver.kind === "name") {
      const dKey = nameKey(driver.name);
      const existing = existingDrivers.get(dKey);
      driverDisplayName = driver.name;
      if (existing) {
        driverAction = "reuse";
        existingDriverId = existing.id;
      } else if (plannedDrivers.has(dKey)) {
        driverAction = "reusePlanned";
      } else {
        driverAction = "create";
        plannedDrivers.set(dKey, driver.name);
      }
    }

    // ההחלטה: fromDate = contractStart, אבל מסומן כמשוער.
    const fromDate = start.iso;
    let assignment = null;
    if (!fromDate) {
      warnings.push("importx.reason.noFromDate");
    } else if (driver.kind === "empty") {
      warnings.push("importx.reason.noDriver");
    } else {
      assignment = {
        fromDate,
        fromDateInferred: true,
        needsReview: driver.kind === "freeText",
        // D-Import — הטקסט החופשי נשמר **רק** כאן, מבודד ומסומן לבדיקה.
        importRaw: driver.kind === "freeText" ? driver.text : "",
        driverName: driverDisplayName,
      };
    }

    out.push({
      rowNumber,
      action,
      plateRaw,
      plateKey: pKey,
      model,
      manufacturer: "", // לא קיים בקובץ — לא מנחשים מתוך הדגם
      status: driver.isPool ? "pool" : "active",
      driverRaw: driver.text,
      driverKind: driver.kind,
      driverName: driverDisplayName,
      driverReasons: driver.reasons,
      driverAction,
      existingDriverId,
      existingVehicleId: existingVehicle?.id || null,
      leaseRaw,
      leaseKey: lKey,
      contractStart: start.iso,
      contractEnd: end.iso,
      // null = אין ערך (תא ריק, או ערך שנדחה). מבדילים בין השניים ב-
      // monthlyCostRejected, כדי שלא ייראה כאילו "0" הוא נתון אמיתי.
      monthlyCost: cost.ok && !cost.empty ? cost.value : null,
      monthlyCostEmpty: Boolean(cost.empty),
      monthlyCostRejected: cost.ok ? null : { raw: cost.raw, reasonKey: cost.reasonKey },
      assignment,
      warnings,
    });
  }

  // חיבור פרטי איש הקשר לחברת הליסינג המתאימה.
  for (const c of contacts) {
    const entry = leaseByKey.get(c.companyKey);
    if (entry) entry.contact = c;
  }

  const leaseCompanies = [...leaseByKey.values()].map((e) => ({
    ...e,
    action: e.existingId ? "reuse" : "create",
  }));

  const creating = out.filter((r) => r.action === "create");

  const counts = {
    dataRows: out.length,
    vehiclesToCreate: creating.length,
    vehiclesExisting: out.filter((r) => r.action === "skipExisting").length,
    vehiclesDuplicateInFile: out.filter((r) => r.action === "skipDuplicateInFile").length,
    driversToCreate: new Set(
      creating.filter((r) => r.driverAction === "create").map((r) => nameKey(r.driverName))
    ).size,
    driversExisting: creating.filter((r) => r.driverAction === "reuse").length,
    assignmentsToCreate: creating.filter((r) => r.assignment).length,
    needsReview: creating.filter((r) => r.assignment?.needsReview).length,
    poolVehicles: creating.filter((r) => r.status === "pool").length,
    leaseCompaniesToCreate: leaseCompanies.filter((c) => c.action === "create").length,
    rejectedValues: rejected.length,
    skippedRows: skipped.length,
    inferredFromDates: creating.filter((r) => r.assignment?.fromDateInferred).length,
    costsMissing: creating.filter((r) => r.monthlyCostEmpty).length,
    costsImported: creating.filter((r) => r.monthlyCost !== null).length,
  };

  return {
    ok: true,
    errorKey: null,
    meta,
    header,
    missingCols,
    rows: out,
    leaseCompanies,
    contacts,
    rejected,
    skipped,
    counts,
  };
}

// ============================================================================
// M6 (שער עדי, 2026-08-13) — **מיזוג לפי שם חייב להיראות.**
//
// גם הייבוא וגם מסך האימות ממזגים נהגים לפי `nameKey`. המשמעות: שתי שורות
// עם אותו שם מלא הופכות לרשומת נהג **אחת**, ושם שכבר קיים במערכת נתלה על
// הרשומה הקיימת. ברוב המקרים זה נכון ורצוי (עובד אחד עם שני רכבים) — אבל
// כשמדובר בשני אנשים שונים בעלי אותו שם, כל הקנסות של שניהם ייפלו על אדם
// אחד, ששמו נכון וזהותו לא. בחברה בת 29 עובדים ההסתברות נמוכה; התוצאה
// חמורה. לכן: לא מיזוג שקט — מיזוג מוצג, עם השורות שהוא נוגע בהן.
//
// טהור. מחזיר [{ key, name, rows[], kind: 'existing'|'withinFile', existingDriverId }].
// ============================================================================
export function driverMergeGroups(plan) {
  const byKey = new Map();
  for (const row of plan?.rows || []) {
    if (row.action !== "create") continue;
    if (row.driverKind !== "name" || !row.driverName) continue;
    const key = nameKey(row.driverName);
    if (!key) continue;
    const entry = byKey.get(key) || {
      key,
      name: row.driverName,
      rows: [],
      existingDriverId: null,
    };
    entry.rows.push(row.rowNumber);
    if (row.existingDriverId) entry.existingDriverId = row.existingDriverId;
    byKey.set(key, entry);
  }
  return [...byKey.values()]
    .filter((e) => e.existingDriverId || e.rows.length > 1)
    .map((e) => ({ ...e, kind: e.existingDriverId ? "existing" : "withinFile" }))
    .sort((a, b) => b.rows.length - a.rows.length || (a.rows[0] ?? 0) - (b.rows[0] ?? 0));
}

// האם שורה מסוימת משתתפת במיזוג — לחיווי בטבלת השורות.
export function mergedRowNumbers(plan) {
  const set = new Set();
  for (const g of driverMergeGroups(plan)) for (const r of g.rows) set.add(r);
  return set;
}

function emptyCounts() {
  return {
    dataRows: 0, vehiclesToCreate: 0, vehiclesExisting: 0, vehiclesDuplicateInFile: 0,
    driversToCreate: 0, driversExisting: 0, assignmentsToCreate: 0, needsReview: 0,
    poolVehicles: 0, leaseCompaniesToCreate: 0, rejectedValues: 0, skippedRows: 0,
    inferredFromDates: 0, costsMissing: 0, costsImported: 0,
  };
}

export default analyzeImport;

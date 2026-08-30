// ============================================================================
// import-vitzman.mjs — ייבוא גיליון הבניינים של ויצמן.
//
// הרצה:  npm run import:vitzman
// פלט:   seed/vitzman.json  +  seed/discrepancies.md   (שניהם gitignored)
//
// ----------------------------------------------------------------------------
// עקרון: הייבוא נאמן, ומוכיח את זה
// ----------------------------------------------------------------------------
// הגיליון הוא מקור האמת של רונן. הייבוא **לא מתקן** אותו — הוא משחזר אותו
// לשקל, ואת מה שמצא כותב לדוח נפרד. אם ההתאמה נכשלת, שום קובץ לא נכתב.
//
// ארבע הכרעות מקור:
//
// 1. **שורות 133 ו-1002 אינן בניינים.** 133 היא שורת הסיכום; 1002 היא שורת
//    רפאים 870 שורות מתחת לנתונים עם מספרים ישנים שלא תואמים (עלות עובד
//    אחזקה 50,200 מול 56,200 בסיכום). שתיהן מדולגות ומדווחות.
//
// 2. **`'-'` אינו אפס.** בבר שאול 8 ובפינס 8 יש `'-'` ב-14 ו-15 תאים בהתאמה.
//    באקסל זה נספר כאפס בשקט; כאן זה `amount: null` + `paidByVaad`, שנספר
//    בנפרד ולא מסכם.
//
// 3. **סכום התא נשמר כפי שהוא — גם כשהוא כולל מע"מ רעיוני.** 23 הערות אומרות
//    "עוסק פטור — הוסף מע\"מ פיקטיבי", אבל אף אחת לא מתעדת את הסכום שלפני
//    ההוספה. גזירה לאחור הייתה המצאת נתון. לכן: הסכום כפי שהוא, דגל
//    `vatMode: 'imputed'`, והרכיב הרעיוני מוצג במערכת כאומדן מסומן.
//
// 4. **מיזוג כתובות רק כשהוא ודאי.** `הר הצופים 7ג` ו-`הר הצופים 7 ג` מתמזגים
//    (הבדל רווח בלבד). `תמרי 6` ו-`יעקב תמרי 6` **לא** — הם נכנסים לדוח
//    להכרעת רונן. ייבוא לא מנחש זהויות.
// ============================================================================

import XLSX from "xlsx";
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const SRC = process.env.VITZMAN_SRC || resolve(ROOT, "seed/vitzman-buildings-2025.xlsx");
const OUT_JSON = resolve(ROOT, "seed/vitzman.json");
const OUT_REPORT = resolve(ROOT, "seed/discrepancies.md");

const VAT_RATE = 0.18;

// --- קטגוריות ההוצאה, ממופות לאותיות העמודות בגיליון ------------------------
const CATEGORIES = [
  ["cleaning", "B", "ניקיון"],
  ["highWindows", "C", "גרניק/חלונות לגובה/פחים/שוט/פוליש"],
  ["elevatorContract", "D", "הסכם שירות מעליות"],
  ["elevatorSafety", "E", "בודק בטיחות למעליות"],
  ["gardening", "F", "גינון"],
  ["gardenRepairs", "G", "תיקוני גינה וצמחים"],
  ["cleaningSupplies", "H", "חומרי ניקוי"],
  ["scentTrash", "I", "עלות מכשירי ריח שוט אשפה"],
  ["scentBuilding", "J", "עלות מכשירי ריח בבניין"],
  ["adScreen", "K", "מסך פירסומי"],
  ["pumpContract", "L", "הסכם שרות למשאבות"],
  ["insurance", "M", "ביטוח לבנין"],
  ["publicElectricity", "N", "חשמל ציבורי"],
  ["pestControl", "O", "הדברה/פוליש"],
  ["fireEquipment", "P", "ציוד אש/גילוי אש/מתזים/גנרטור/דחסן/משאבות/מזרקה/ביוב/מפוחים"],
  ["tankCleaning", "Q", "ניקוי מאגר"],
  ["housingCulture", "R", "תרבות הדיור"],
  ["telecom", "S", "בזק/אינטרנט"],
  ["creditFees", "T", "עמלות אשראי בגבייה"],
  ["faultsAndParts", "U", "תקלות קבלני חוץ/חלפים/סיור נורות"],
  ["maintenanceWorker", "V", "עלות עובד אחזקה"],
  ["receptionLifeguard", "W", "עלות פקיד קבלה + מציל"],
  ["lightingScans", "X", "סריקות תאורה"],
  ["collectionLegal", "Y", "שירותי גבייה/משרד עורך דין"],
];
const CAT_BY_COL = Object.fromEntries(CATEGORIES.map(([id, col]) => [col, id]));

/** עמודות ספק → הקטגוריה שהן משרתות. */
const VENDOR_COLUMNS = [
  ["AE", "cleaning", "קבלן נקיון"],
  ["AF", "elevatorContract", "חברת מעליות"],
  ["AG", "gardening", "קבלן גינון"],
  ["AH", "scentBuilding", "ספק מכשירי ריח"],
];

const COL = { address: "A", forecast: "Z", fee: "AA", total: "AB", profit: "AC", pct: "AD",
              insurer: "AM", areaManager: "AN", extra2024: "AO" };
const INSPECTION_COLUMNS = [["AI", "fireDetection"], ["AJ", "fireSuppression"],
                            ["AK", "waterTank"], ["AL", "generator"]];

const ACTIVE_SHEET = "רשימת בנינים פעילים";
const EMPLOYEE_SHEET = "רשימת  בנינים בחלוקה לעובדים ";
const ILM_SHEET = "רשימת ביניינים ילמ";
const INACTIVE_SHEET = "רשימת בנינים לא פעילים";

const ACTIVE_FIRST_ROW = 2;
const ACTIVE_LAST_ROW = 132; // 133 = סיכום, 1002 = רפאים
const TOTALS_ROW = 133;
const GHOST_ROW = 1002;

// --- עזרי דיוק ---------------------------------------------------------------
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const sum = (arr, pick = (x) => x) => round2(arr.reduce((a, x) => a + (Number(pick(x)) || 0), 0));

let seq = 0;
const newId = (p) => `${p}_${(++seq).toString(36).padStart(4, "0")}`;

const addressKey = (raw) =>
  String(raw || "")
    .replace(/["'`״׳]/g, "")
    .replace(/[־–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/(\d)\s+([א-ת])(?=\s|$)/g, "$1$2")
    .toLowerCase();

// --- קריאת הגיליון ------------------------------------------------------------
if (!existsSync(SRC)) {
  console.error(`✗ לא נמצא קובץ מקור: ${SRC}\n  הגדר VITZMAN_SRC או הנח את הקובץ ב-seed/.`);
  process.exit(1);
}
const wb = XLSX.readFile(SRC, { cellFormula: true, bookFiles: true });

const cell = (sheet, ref) => wb.Sheets[sheet]?.[ref];
const val = (sheet, ref) => { const c = cell(sheet, ref); return c === undefined ? undefined : c.v; };
const str = (sheet, ref) => { const v = val(sheet, ref); return v === undefined || v === null ? "" : String(v).trim(); };

/** מספר, או `null` כשהתא ריק / מכיל טקסט שאינו מספר (`'-'`, `'ועד'`, `'*'`). */
function money(sheet, ref) {
  const c = cell(sheet, ref);
  if (!c || c.v === undefined || c.v === null || c.v === "") return { value: null, raw: null };
  if (typeof c.v === "number") return { value: round2(c.v), raw: c.v };
  const t = String(c.v).trim();
  if (t === "") return { value: null, raw: null };
  const n = Number(t.replace(/,/g, ""));
  return Number.isFinite(n) ? { value: round2(n), raw: c.v } : { value: null, raw: t };
}

// --- הערות: 210 קלאסיות + 4 משורשרות ------------------------------------------
const THREADED_PLACEHOLDER = /\[הערה משורשרת\]|threaded comment/i;
const stripHeader = (t) =>
  String(t || "")
    .replace(/^=+\s*/, "")
    .replace(/^ID#\S+\s*/m, "")
    .replace(/^(?:tc=\{[^}]*\}|[^\n(]*)\s*\(\d{4}-\d{2}-\d{2}[^)]*\)\s*/m, "")
    .replace(/גירסת Excel שברשותך[\s\S]*?linkid=\d+\s*/i, "")
    .replace(/^\s*הערה:\s*/m, "")
    .replace(/\s+/g, " ")
    .trim();

/** ההערות המשורשרות יושבות בקובץ נפרד; SheetJS מחזיר אותן רק כטקסט גולמי. */
function readThreadedComments() {
  const out = [];
  for (const [path, buf] of Object.entries(wb.files || {})) {
    if (!path.includes("threadedComments/")) continue;
    const xml = typeof buf === "string" ? buf : buf.asNodeBuffer ? buf.asNodeBuffer().toString("utf8")
              : Buffer.from(buf.content || buf._data?.getContent?.() || []).toString("utf8");
    const re = /<threadedComment[^>]*\bref="([^"]+)"[^>]*>([\s\S]*?)<\/threadedComment>/g;
    let m;
    while ((m = re.exec(xml))) {
      const text = (m[2].match(/<text>([\s\S]*?)<\/text>/) || [, ""])[1]
        .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").trim();
      if (text) out.push({ ref: m[1], text });
    }
  }
  return out;
}
const threaded = readThreadedComments();
const threadedByRef = new Map(threaded.map((t) => [t.ref, t.text]));

function classifyNote(text) {
  if (/עוסק פטור|פיקטיבי/.test(text)) return "vatExempt";
  if (/עלה מ|ירד ל|יעלו מ|החל מ|שונה ל/.test(text)) return "priceChange";
  if (/הערכה|צפי|לא סופי/.test(text)) return "estimate";
  if (/מותנה|כולם שילמו/.test(text)) return "conditional";
  if (/ועד משלם|דרך ועד|מהועד|ידיהועד|ע"י הועד/.test(text)) return "vaadPays";
  if (/\b0\d{1,2}-?\d{7}\b|\b\d{9,10}\b/.test(text)) return "contact";
  return "general";
}

/** תאריך תחולה מתוך "החל מ 1.7.2022" → "2022-07-01". */
function effectiveFromText(text) {
  const m = text.match(/החל מ[-\s]*(\d{1,2})[./](\d{1,2})[./](\d{2,4})/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const year = y.length === 2 ? `20${y}` : y;
  return `${year}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** "עלה מ 4650 ל 5500" → { from: 4650, to: 5500 }. */
function priceChangeAmounts(text) {
  const m = text.match(/(?:עלה|ירד|יעלו|ירדו|שונה)[^\d]{0,12}(\d[\d,]*)\s*(?:₪|שח)?\s*ל[-\s]?(\d[\d,]*)/);
  if (!m) return null;
  return { from: Number(m[1].replace(/,/g, "")), to: Number(m[2].replace(/,/g, "")) };
}

/** כל ההערות בגיליון נתון: ref → { text, author }. */
function commentsOf(sheetName) {
  const sheet = wb.Sheets[sheetName];
  const out = new Map();
  if (!sheet) return out;
  for (const ref of Object.keys(sheet)) {
    if (ref[0] === "!") continue;
    const c = sheet[ref];
    if (!c.c || !c.c.length) continue;
    const author = (c.c[0].a || "").replace(/<[^>]*>/g, "").trim();
    let text = c.c.map((x) => x.t || "").join("\n");
    // הערה משורשרת: הטקסט האמיתי יושב בקובץ הנפרד, כאן רק הודעת תאימות.
    if (THREADED_PLACEHOLDER.test(text)) {
      const real = threadedByRef.get(ref);
      text = real || stripHeader(text.replace(/[\s\S]*linkid=\d+\s*/i, ""));
    }
    text = stripHeader(text);
    if (text) out.set(ref, { text, author });
  }
  return out;
}

const discrepancies = [];
/** הערות AA שהפכו להיסטוריית הכנסה, ואלה שלא ניתן היה למקם בזמן. */
const feeHistorySeeded = [];
const feeNoteWithoutDate = [];
const flag = (severity, title, detail) => discrepancies.push({ severity, title, detail });

// ============================================================================
// 1. הבניינים הפעילים
// ============================================================================
const activeComments = commentsOf(ACTIVE_SHEET);

const buildings = [];
const contracts = [];
const feeAgreements = [];
const notes = [];
const inspections = [];
const vendorByName = new Map();

function vendorFor(name, { vatExempt = false, phone = "" } = {}) {
  const key = String(name || "").trim();
  if (!key) return null;
  let v = vendorByName.get(key);
  if (!v) { v = { id: newId("vnd"), name: key, phone: "", vatExempt: false, notes: "" }; vendorByName.set(key, v); }
  if (vatExempt) v.vatExempt = true;
  if (phone && !v.phone) v.phone = phone;
  return v;
}

let sheetTotalCheck = 0;
const unpricedCells = [];

for (let r = ACTIVE_FIRST_ROW; r <= ACTIVE_LAST_ROW; r++) {
  const address = str(ACTIVE_SHEET, `${COL.address}${r}`);
  if (!address) { flag("info", `שורה ${r} ללא כתובת`, "השורה דולגה."); continue; }

  const b = {
    id: newId("bld"),
    address,
    aliases: [],
    status: "active",
    assignedEmployeeId: null,
    inIlm: false,
    managementFee: money(ACTIVE_SHEET, `${COL.fee}${r}`).value ?? 0,
    insurerName: str(ACTIVE_SHEET, `${COL.insurer}${r}`),
    areaManager: str(ACTIVE_SHEET, `${COL.areaManager}${r}`),
    sourceRow: r,
    createdAt: new Date().toISOString(),
  };
  buildings.push(b);

  // --- דמי הניהול כהסכם, לא כשדה ---
  // ההכנסה מקבלת אותו מבנה כמו ההוצאה (`amount` + `effectiveFrom`) כדי שגם לה
  // תהיה היסטוריה. ההסכם הפותח נושא `effectiveFrom: null` = "מאז ומעולם".
  const baseFee = {
    id: newId("fee"), buildingId: b.id, amount: b.managementFee, effectiveFrom: null, note: "",
  };
  feeAgreements.push(baseFee);

  // --- ספקים של השורה, ממופים לקטגוריה שהם משרתים ---
  const vendorForCat = {};
  for (const [col, catId] of VENDOR_COLUMNS) {
    const name = str(ACTIVE_SHEET, `${col}${r}`);
    if (!name) continue;
    const v = vendorFor(name);
    if (v) vendorForCat[catId] = v.id;
  }

  // --- הערות השורה, לפי עמודה ---
  const rowNotes = new Map(); // col → { text, kind, author }
  for (const [ref, { text, author }] of activeComments) {
    const m = ref.match(/^([A-Z]+)(\d+)$/);
    if (!m || Number(m[2]) !== r) continue;
    const kind = classifyNote(text);
    rowNotes.set(m[1], { text, kind, author });
    notes.push({
      id: newId("nte"),
      buildingId: b.id,
      categoryId: CAT_BY_COL[m[1]] || null,
      kind,
      text,
      sourceSheet: ACTIVE_SHEET,
      sourceCell: ref,
      authoredAt: null,
      author,
    });
    // --- שינוי מחיר של דמי הניהול (עמודה AA) → שורת היסטוריה להכנסה ---
    // רק הערה שנושאת **גם סכומים וגם תאריך** הופכת להיסטוריה. הערה עם סכומים
    // בלי תאריך לא ניתנת למיקום בזמן, ולכן היא נשארת הערה בלבד ומדווחת בדוח —
    // המצאת תאריך הייתה המצאת נתון.
    if (m[1] === COL.fee && kind === "priceChange") {
      const change = priceChangeAmounts(text);
      const from = effectiveFromText(text);
      // ⚠ הגנה על ההכנסה: השורה נזרעת רק אם הסכום ה"אחרי" בהערה תואם את התא.
      // אם המחיר עלה שוב אחרי ההערה, "אחרי" כבר אינו התקף — וזריעה עיוורת
      // הייתה משנה את ההכנסה הכוללת ומפילה את מבחן ההתאמה בלי להסביר למה.
      const matchesSheet = change && Math.abs(round2(change.to) - b.managementFee) < 0.01;
      if (change && from && matchesSheet) {
        // הסכום הקודם תופס את "מאז ומעולם", והסכום הנוכחי מקבל את תאריך התחולה.
        baseFee.amount = round2(change.from);
        baseFee.note = `מחיר קודם, לפי ההערה בתא ${ref}`;
        feeAgreements.push({
          id: newId("fee"), buildingId: b.id, amount: round2(change.to),
          effectiveFrom: from, note: `לפי ההערה בתא ${ref}`,
        });
        feeHistorySeeded.push({ row: r, address, ref, from: change.from, to: change.to, effectiveFrom: from });
      } else if (change) {
        feeNoteWithoutDate.push({
          row: r, address, ref, text,
          reason: !from ? "אין תאריך תחולה" : "הסכום שאחרי השינוי אינו תואם את התא",
        });
      }
    }

    // טלפון שנמצא בהערה על עמודת ספק → נכנס לכרטיס הספק
    if (kind === "contact") {
      const phone = (text.match(/0\d{1,2}-?\d{7}|\d{9,10}/) || [])[0] || "";
      const vendorCol = VENDOR_COLUMNS.find(([c]) => c === m[1]);
      if (vendorCol && phone) {
        const name = str(ACTIVE_SHEET, `${m[1]}${r}`);
        if (name) vendorFor(name, { phone });
      }
    }
  }

  // --- חוזה לכל קטגוריה ---
  for (const [catId, col] of CATEGORIES.map(([id, c]) => [id, c])) {
    const { value, raw } = money(ACTIVE_SHEET, `${col}${r}`);
    const note = rowNotes.get(col);
    const hasCell = raw !== null && raw !== undefined;
    if (!hasCell && !note) continue; // תא ריק לגמרי — אין חוזה

    if (value === null && hasCell) {
      unpricedCells.push({ row: r, address, col, raw: String(raw) });
    }
    if (value !== null) sheetTotalCheck = round2(sheetTotalCheck + value);

    const vatExempt = note?.kind === "vatExempt";
    if (vatExempt && vendorForCat[catId]) {
      const v = [...vendorByName.values()].find((x) => x.id === vendorForCat[catId]);
      if (v) v.vatExempt = true;
    }

    contracts.push({
      id: newId("ctr"),
      buildingId: b.id,
      categoryId: catId,
      vendorId: vendorForCat[catId] || null,
      amount: value,
      effectiveFrom: note ? effectiveFromText(note.text) : null,
      vatMode: vatExempt ? "imputed" : "standard",
      vatRate: VAT_RATE,
      isEstimate: note?.kind === "estimate",
      isConditional: note?.kind === "conditional",
      paidByVaad: value === null && hasCell,
      notes: note?.text || "",
    });

    // --- היסטוריית מחיר: "עלה מ X ל Y החל מ Z" → חוזה קודם ---
    if (note?.kind === "priceChange") {
      const change = priceChangeAmounts(note.text);
      const from = effectiveFromText(note.text);
      if (change && from) {
        contracts.push({
          id: newId("ctr"),
          buildingId: b.id,
          categoryId: catId,
          vendorId: vendorForCat[catId] || null,
          amount: round2(change.from),
          effectiveFrom: null, // תקף עד שהחוזה המתוארך נכנס לתוקף
          vatMode: vatExempt ? "imputed" : "standard",
          vatRate: VAT_RATE,
          isEstimate: false,
          isConditional: false,
          paidByVaad: false,
          notes: `מחיר קודם, לפי ההערה בתא ${col}${r}`,
        });
        // החוזה הנוכחי מקבל את תאריך התחולה שלו
        const cur = contracts[contracts.length - 2];
        cur.effectiveFrom = from;
      }
    }

    // --- שינוי מחיר של דמי הניהול עצמם (עמודה AA) מטופל בנפרד למטה ---
  }

  // --- ביקורות תקופתיות: 4 עמודות, 0/131 מלאות ---
  for (const [col, type] of INSPECTION_COLUMNS) {
    const v = str(ACTIVE_SHEET, `${col}${r}`);
    if (!v) continue;
    inspections.push({ id: newId("ins"), buildingId: b.id, type, lastDate: v, nextDueDate: null, vendorId: null, notes: "" });
  }
}

// ============================================================================
// 2. הבניינים הלא-פעילים  (מבנה עמודות שונה — ולכן רק זהות, בלי עלויות)
// ============================================================================
const inactiveSheet = wb.Sheets[INACTIVE_SHEET];
const inactiveRange = XLSX.utils.decode_range(inactiveSheet["!ref"]);
const inactiveNames = [];
for (let r = 2; r <= inactiveRange.e.r + 1; r++) {
  const a = str(INACTIVE_SHEET, `A${r}`);
  if (a && a !== "כתובת הבנין") inactiveNames.push({ address: a, row: r });
}

const byKey = new Map();
for (const b of buildings) byKey.set(addressKey(b.address), b);

for (const { address, row } of inactiveNames) {
  const key = addressKey(address);
  const existing = byKey.get(key);
  if (existing) {
    flag("high", `"${address}" מופיע גם כפעיל וגם כלא-פעיל`,
      `פעיל בשורה ${existing.sourceRow}, לא-פעיל בשורה ${row} בגיליון "${INACTIVE_SHEET}". ` +
      `במערכת הוא **פעיל** (יש לו הכנסה וחוזים). שני גיליונות נפרדים אפשרו את הסתירה; שדה יחיד לא מאפשר אותה.`);
    continue;
  }
  const b = {
    id: newId("bld"), address, aliases: [], status: "inactive", assignedEmployeeId: null,
    inIlm: false, managementFee: 0, insurerName: "", areaManager: "", sourceRow: row,
    createdAt: new Date().toISOString(),
  };
  buildings.push(b);
  byKey.set(key, b);
}
flag("medium", `לגיליון "${INACTIVE_SHEET}" מבנה עמודות שונה מהגיליון הפעיל`,
  `בפעיל: H=חומרי ניקוי, I=מכשירי ריח שוט אשפה, J=מכשירי ריח בבניין. ` +
  `בלא-פעיל: H=מכשירי ריח, I=מסך פירסומי, J=הסכם שרות למשאבות. ` +
  `לכן **לא ייבאנו עלויות** מהגיליון הלא-פעיל — רק זהות הבניין. השוואה היסטורית של עלויות אינה אפשרית עד שהמבנה יאוחד.`);

// ============================================================================
// 3. שיוך לעובדים  (הגיליון: עובד לכל עמודה)
// ============================================================================
const employees = [];
const empSheet = wb.Sheets[EMPLOYEE_SHEET];
const empRange = XLSX.utils.decode_range(empSheet["!ref"]);
const assignedNotFound = [];

for (let c = empRange.s.c; c <= empRange.e.c; c++) {
  const colLetter = XLSX.utils.encode_col(c);
  const name = str(EMPLOYEE_SHEET, `${colLetter}1`);
  if (!name) continue;
  const emp = { id: newId("emp"), name, active: true };
  employees.push(emp);
  for (let r = 3; r <= empRange.e.r + 1; r++) {
    const addr = str(EMPLOYEE_SHEET, `${colLetter}${r}`);
    if (!addr || addr === "כתובת הבנין") continue;
    const b = byKey.get(addressKey(addr));
    if (!b) { assignedNotFound.push({ employee: name, address: addr, row: r }); continue; }
    if (b.assignedEmployeeId && b.assignedEmployeeId !== emp.id) {
      flag("high", `"${b.address}" משויך לשני עובדים`, `גם ל-${name} וגם לעובד אחר.`);
      continue;
    }
    b.assignedEmployeeId = emp.id;
    if (addr !== b.address && !b.aliases.includes(addr)) b.aliases.push(addr);
  }
}

// ============================================================================
// 4. רשימת "ילמ"
// ============================================================================
const ilmSheet = wb.Sheets[ILM_SHEET];
const ilmRange = XLSX.utils.decode_range(ilmSheet["!ref"]);
const ilmNotFound = [];
for (let r = 1; r <= ilmRange.e.r + 1; r++) {
  const addr = str(ILM_SHEET, `A${r}`);
  if (!addr || addr === "כתובת הבנין") continue;
  const b = byKey.get(addressKey(addr));
  if (!b) { ilmNotFound.push({ address: addr, row: r }); continue; }
  b.inIlm = true;
  if (addr !== b.address && !b.aliases.includes(addr)) b.aliases.push(addr);
}

// ============================================================================
// 4b. הערות בשאר הגיליונות
//
// 161 מתוך 212 תאי ההערות יושבים בגיליון הפעיל; היתר בשלושת האחרים — ובהם
// שינויי מחיר ו"עוסק פטור" של בניינים שיצאו מהרשימה. הם לא משפיעים על שום
// סכום (עלויות מיובאות מהגיליון הפעיל בלבד), אבל הם היסטוריה עסקית אמיתית
// ולכן לא נזרקים.
// ============================================================================
for (const sheetName of [EMPLOYEE_SHEET, ILM_SHEET, INACTIVE_SHEET]) {
  const isCostSheet = sheetName === INACTIVE_SHEET;
  for (const [ref, { text, author }] of commentsOf(sheetName)) {
    const m = ref.match(/^([A-Z]+)(\d+)$/);
    const row = m ? Number(m[2]) : null;
    // בגיליון הלא-פעיל עמודה A היא הכתובת; בשאר — כל עמודה היא עובד/רשימה.
    const addr = row ? str(sheetName, `A${row}`) : "";
    const b = addr ? byKey.get(addressKey(addr)) : null;
    notes.push({
      id: newId("nte"),
      buildingId: b?.id || null,
      categoryId: null, // מבנה העמודות שונה בגיליון הלא-פעיל — מיפוי לקטגוריה היה ניחוש
      kind: classifyNote(text),
      text,
      sourceSheet: sheetName,
      sourceCell: ref,
      authoredAt: null,
      author,
    });
    if (isCostSheet && !b && addr) {
      flag("info", `הערה בגיליון הלא-פעיל ללא בניין מזוהה (${ref})`, `כתובת בשורה: "${addr}".`);
    }
  }
}

// ============================================================================
// 5. מבחני התאמה — אם אחד נכשל, שום קובץ לא נכתב
// ============================================================================
const activeBuildings = buildings.filter((b) => b.status === "active");
const expenseTotal = sum(contracts.filter((c) => c.effectiveFrom === null || !c.notes.startsWith("מחיר קודם")), (c) => 0); // placeholder, מחושב למטה

// הסכום מהחוזים הפעילים בלבד (לא היסטוריים)
const historicIds = new Set(contracts.filter((c) => c.notes.startsWith("מחיר קודם")).map((c) => c.id));
const currentContracts = contracts.filter((c) => !historicIds.has(c.id));
const importedExpenses = sum(currentContracts, (c) => c.amount ?? 0);
const importedIncome = sum(activeBuildings, (b) => b.managementFee);
const importedProfit = round2(importedIncome - importedExpenses);

const SHEET_EXPENSES = round2(val(ACTIVE_SHEET, `${COL.total}${TOTALS_ROW}`));
const SHEET_INCOME = round2(val(ACTIVE_SHEET, `${COL.fee}${TOTALS_ROW}`));
const SHEET_PROFIT = round2(val(ACTIVE_SHEET, `${COL.profit}${TOTALS_ROW}`));

const checks = [];
const check = (name, actual, expected, tol = 0.01) => {
  const ok = typeof expected === "number" ? Math.abs(actual - expected) <= tol : actual === expected;
  checks.push({ name, actual, expected, ok });
  return ok;
};

check("סה\"כ הוצאות מתאים לגיליון", importedExpenses, SHEET_EXPENSES);
check("סה\"כ הכנסות מתאים לגיליון", importedIncome, SHEET_INCOME);
check("רווח מתאים לגיליון", importedProfit, SHEET_PROFIT);
check("מספר בניינים פעילים", activeBuildings.length, 131);
check("מספר עובדים", employees.length, 3);
// לא משווים ל-`activeComments.size` — זו אותה מדידה משני צדדי המשוואה ולכן
// בדיקה שמאשרת את עצמה. הספירה נגזרת מחדש מהחוברת, לכל הגיליונות.
const totalCommentedCells = wb.SheetNames.reduce((acc, name) => {
  const s = wb.Sheets[name];
  return acc + Object.keys(s).filter((r) => r[0] !== "!" && s[r].c?.length).length;
}, 0);
check("כל תאי ההערות נקלטו", notes.length, totalCommentedCells);
check("הסכם דמי ניהול לכל בניין פעיל",
  new Set(feeAgreements.map((f) => f.buildingId)).size, activeBuildings.length);
// הבדיקה שמגינה על ההכנסה: אחרי הפיכת דמי הניהול להסכמים עם היסטוריה,
// ההסכם התקף היום חייב להחזיר בדיוק את מה שהתא בגיליון אומר.
{
  const latest = new Map();
  for (const f of feeAgreements) {
    const cur = latest.get(f.buildingId);
    if (!cur || (f.effectiveFrom || "") > (cur.effectiveFrom || "")) latest.set(f.buildingId, f);
  }
  const drift = activeBuildings.filter(
    (b) => Math.abs((latest.get(b.id)?.amount ?? 0) - b.managementFee) > 0.01
  );
  check("ההסכם התקף מחזיר את דמי הניהול שבגיליון", drift.length, 0);
}
check("הערות הגיליון הפעיל", notes.filter((n) => n.sourceSheet === ACTIVE_SHEET).length, 161);

const failed = checks.filter((c) => !c.ok);
console.log("\n=== מבחני התאמה ===");
for (const c of checks) {
  const mark = c.ok ? "✓" : "✗";
  console.log(`  ${mark} ${c.name}: ${typeof c.actual === "number" ? c.actual.toLocaleString("he-IL") : c.actual}` +
    (c.ok ? "" : `  (צפוי: ${typeof c.expected === "number" ? c.expected.toLocaleString("he-IL") : c.expected})`));
}
if (failed.length) {
  console.error(`\n✗ ${failed.length} מבחני התאמה נכשלו — הקובץ לא נכתב.`);
  process.exit(1);
}

// ============================================================================
// 6. דוח הסתירות
// ============================================================================
// -- ממצא: סיכומי הקטגוריות בשורת הסיכום מול הסכום האמיתי
const catTotalsReport = [];
for (const [catId, col, name] of CATEGORIES) {
  const shown = money(ACTIVE_SHEET, `${col}${TOTALS_ROW}`).value;
  const real = sum(currentContracts.filter((c) => c.categoryId === catId), (c) => c.amount ?? 0);
  const formula = cell(ACTIVE_SHEET, `${col}${TOTALS_ROW}`)?.f || null;
  if (shown !== null && Math.abs(shown - real) > 0.01) {
    catTotalsReport.push({ name, col, shown, real, diff: round2(shown - real), formula });
  }
}

// -- ממצא: נוסחאות עם טווח או ארגומנטים שגויים
//
// שים לב מה **לא** נמצא כאן: הנוסחאות לא נמחקו. כל 131 השורות וכל 24 סיכומי
// הקטגוריות מחזיקים נוסחה. (קריאה ראשונה של ה-XML הגולמי הצביעה על "נוסחאות
// שנמחקו" — זו הייתה טעות: אקסל שומר נוסחה חוזרת כ-`shared`, כלומר הטקסט יושב
// על תא-האב ושאר התאים מפנים אליו ב-`si`. תא כזה נראה ריק לקורא נאיבי.)
// מה שכן שבור זה טווחים ותת-ארגומנטים — וזה שובר בשקט.
const missingFormula = { total: 0, profit: 0, pct: 0 };
for (let r = ACTIVE_FIRST_ROW; r <= ACTIVE_LAST_ROW; r++) {
  if (!str(ACTIVE_SHEET, `A${r}`)) continue;
  if (!cell(ACTIVE_SHEET, `${COL.total}${r}`)?.f) missingFormula.total++;
  if (!cell(ACTIVE_SHEET, `${COL.profit}${r}`)?.f) missingFormula.profit++;
  if (!cell(ACTIVE_SHEET, `${COL.pct}${r}`)?.f) missingFormula.pct++;
}

/** טווחי SUBTOTAL שנעצרים לפני שורת הבניין האחרונה. */
const truncatedRanges = [];
for (const [catId, col, name] of CATEGORIES) {
  const f = cell(ACTIVE_SHEET, `${col}${TOTALS_ROW}`)?.f;
  if (!f) continue;
  const m = f.match(/[A-Z]+\d+:[A-Z]+(\d+)/);
  if (!m) continue;
  const stopsAt = Number(m[1]);
  if (stopsAt >= ACTIVE_LAST_ROW) continue;
  const missed = activeBuildings.filter((b) => b.sourceRow > stopsAt);
  truncatedRanges.push({
    name, col, formula: f, stopsAt, missed,
    lostAmount: sum(currentContracts.filter(
      (c) => c.categoryId === catId && missed.some((b) => b.id === c.buildingId)), (c) => c.amount ?? 0),
  });
}

/** שורות שבהן נוסחת הסה"כ אינה `SUM(B:Y)` — נערכה ביד ועלולה לדלג על עמודות. */
const handEditedRows = [];
for (let r = ACTIVE_FIRST_ROW; r <= ACTIVE_LAST_ROW; r++) {
  const address = str(ACTIVE_SHEET, `A${r}`);
  if (!address) continue;
  const f = cell(ACTIVE_SHEET, `${COL.total}${r}`)?.f;
  if (!f) continue;
  const refs = new Set();
  for (const m of f.matchAll(/([A-Z]+)\d+(?::([A-Z]+)\d+)?/g)) {
    if (!m[2]) { refs.add(m[1]); continue; }
    const a = XLSX.utils.decode_col(m[1]), b = XLSX.utils.decode_col(m[2]);
    for (let i = a; i <= b; i++) refs.add(XLSX.utils.encode_col(i));
  }
  const missing = CATEGORIES.map(([, col]) => col).filter((col) => !refs.has(col));
  if (missing.length) {
    handEditedRows.push({
      row: r, address, formula: f, missing,
      missingValues: missing.map((col) => ({ col, value: money(ACTIVE_SHEET, `${col}${r}`).value })),
    });
  }
}

// -- ממצא: כתובות דומות שלא מוזגו
const nearDupes = [];
const keys = [...byKey.keys()];
const loose = (s) => s.replace(/[\s'"]/g, "");
for (let i = 0; i < keys.length; i++) {
  for (let j = i + 1; j < keys.length; j++) {
    const a = loose(keys[i]), b = loose(keys[j]);
    if (a === b || (a.length > 5 && (a.includes(b) || b.includes(a)))) {
      nearDupes.push([byKey.get(keys[i]).address, byKey.get(keys[j]).address]);
    }
  }
}

// -- ממצא: המע"מ הרעיוני
const imputedContracts = currentContracts.filter((c) => c.vatMode === "imputed" && c.amount != null);
const imputedTotal = sum(imputedContracts, (c) => round2(c.amount - c.amount / (1 + VAT_RATE)));

// -- ממצא: רווחיות
const contractsByBuilding = new Map();
for (const c of currentContracts) {
  if (!contractsByBuilding.has(c.buildingId)) contractsByBuilding.set(c.buildingId, []);
  contractsByBuilding.get(c.buildingId).push(c);
}
const profitRows = activeBuildings.map((b) => {
  const cost = sum(contractsByBuilding.get(b.id) || [], (c) => c.amount ?? 0);
  const profit = round2(b.managementFee - cost);
  return { address: b.address, income: b.managementFee, cost, profit,
           margin: b.managementFee ? profit / b.managementFee : null };
});
const losses = profitRows.filter((r) => r.profit < 0).sort((a, b) => a.profit - b.profit);
const thin = profitRows.filter((r) => r.profit >= 0 && r.margin !== null && r.margin < 0.05)
                       .sort((a, b) => a.margin - b.margin);

const unassigned = activeBuildings.filter((b) => !b.assignedEmployeeId);
const ilmMissing = activeBuildings.filter((b) => !b.inIlm);
/** עובד ממשיך להיות אחראי על בניין שכבר יצא מהרשימה הפעילה. */
const empById = new Map(employees.map((e) => [e.id, e.name]));
const assignedInactive = buildings
  .filter((b) => b.status === "inactive" && b.assignedEmployeeId)
  .map((b) => ({ address: b.address, employee: empById.get(b.assignedEmployeeId) || "?" }));
/** בניין לא-פעיל שעדיין מופיע ברשימת "ילמ". */
const ilmInactive = buildings.filter((b) => b.status === "inactive" && b.inIlm).map((b) => b.address);

const nf = (n) => Number(n).toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (x) => (x == null ? "—" : `${(x * 100).toFixed(2)}%`);

const report = `# דוח סתירות — גיליון הבניינים של ויצמן

נוצר ע"י \`npm run import:vitzman\` בתאריך ${new Date().toISOString().slice(0, 10)}.
מקור: \`${SRC.split("/").pop()}\`

הייבוא **שחזר את הגיליון לשקל** (${nf(importedExpenses)} ₪ הוצאות · ${nf(importedIncome)} ₪
הכנסות · ${nf(importedProfit)} ₪ רווח). כל מה שלמטה הוא מה שהתגלה תוך כדי —
לתיקון במקור, לא במערכת.

---

## 1 · אחוז הרווח מחושב על ההוצאות ולא על ההכנסה

הנוסחה בגיליון: \`${cell(ACTIVE_SHEET, `${COL.pct}${TOTALS_ROW}`)?.f || "—"}\`
זהו **markup** (תוספת על העלות), לא **margin** (שיעור מהמחזור).

| מדד | ערך |
|---|---|
| מוצג בגיליון כ"אחוז רווח" | **${pct(importedProfit / importedExpenses)}** |
| שיעור הרווח מהמחזור (margin) | **${pct(importedProfit / importedIncome)}** |

הפער — ${(Math.abs(importedProfit / importedExpenses - importedProfit / importedIncome) * 100).toFixed(2)}
נקודות אחוז — חוזר על עצמו ב-131 השורות ובשורת הסיכום.

---

## 2 · שורת הסיכום לא מתאזנת מול הנתונים

${catTotalsReport.length === 0 ? "כל סיכומי הקטגוריות תואמים." : `
| קטגוריה | עמודה | מוצג בשורה ${TOTALS_ROW} | הסכום האמיתי | פער | הנוסחה |
|---|---|---|---|---|---|
${catTotalsReport.map((c) => `| ${c.name} | ${c.col} | ${nf(c.shown)} | ${nf(c.real)} | **${nf(c.diff)}** | \`${c.formula || "ערך קשיח"}\` |`).join("\n")}
`}
סכום 24 סיכומי הקטגוריות בשורה ${TOTALS_ROW} הוא
**${nf(sum(CATEGORIES, ([, col]) => money(ACTIVE_SHEET, `${col}${TOTALS_ROW}`).value ?? 0))} ₪**,
בעוד הסה"כ הכללי בתא \`${COL.total}${TOTALS_ROW}\` הוא **${nf(SHEET_EXPENSES)} ₪**.
הפירוק והסה"כ מספרים שני סיפורים שונים.

---

## 3 · נוסחאות עם טווח שגוי — הסיבה לפער

**מה שלא נמצא, ושכדאי לומר במפורש:** הנוסחאות **לא** נמחקו. כל ${activeBuildings.length}
השורות וכל ${CATEGORIES.length} סיכומי הקטגוריות מחזיקים נוסחה
(${COL.total}: ${missingFormula.total} ללא · ${COL.profit}: ${missingFormula.profit} ללא · ${COL.pct}: ${missingFormula.pct} ללא).
אקסל שומר נוסחה חוזרת בצורת \`shared\` — הטקסט יושב על תא-האב והשאר מפנים אליו —
ולכן היא נראית חסרה לכלי שקורא את ה-XML הגולמי בלי לפרש \`si\`.

מה שכן שבור הוא **הטווח**, וזה נכשל בשקט:

${truncatedRanges.length ? `| עמודה | קטגוריה | הנוסחה | נעצרת בשורה | בניינים שנופלים | הסכום שנופל |
|---|---|---|---|---|---|
${truncatedRanges.map((t) => `| ${t.col} | ${t.name} | \`${t.formula}\` | ${t.stopsAt} | **${t.missed.length}** | **${nf(t.lostAmount)} ₪** |`).join("\n")}

${truncatedRanges.map((t) => `**${t.name}** — הבניינים שנופלים מהחישוב:\n${t.missed.map((b) => `- שורה ${b.sourceRow} — ${b.address}`).join("\n")}`).join("\n\n")}` : "— לא נמצאו טווחים קטועים"}

${handEditedRows.length ? `### שורות שנוסחת הסה"כ שלהן נערכה ביד ומדלגת על עמודות

${handEditedRows.map((h) => `- **שורה ${h.row} — ${h.address}**\n  \`${h.formula}\`\n  מדלגת על: ${h.missingValues.map((m) => `\`${m.col}\` (${m.value === null ? "ריק" : nf(m.value) + " ₪"})`).join(", ")}`).join("\n")}

כל עוד העמודות שמדולגות ריקות או אפס — הסה"כ יוצא נכון. ברגע שיוזן בהן סכום,
הוא ייעלם מהחישוב בלי שום סימן.` : ""}

---

## 4 · ארבע רשימות בניינים שלא מסכימות

| ממצא | כמות |
|---|---|
| בניינים פעילים **ללא עובד אחראי** | **${unassigned.length}** |
| בניינים **לא-פעילים** שעדיין משויכים לעובד | **${assignedInactive.length}** |
| כתובות משויכות לעובד שלא זוהו בכלל | **${assignedNotFound.length}** |
| בניינים פעילים שאינם ברשימת "ילמ" | **${ilmMissing.length}** |
| בניינים לא-פעילים שעדיין ברשימת "ילמ" | **${ilmInactive.length}** |
| כתובות ב"ילמ" שלא זוהו בכלל | **${ilmNotFound.length}** |

### בניינים פעילים ללא עובד אחראי
${unassigned.map((b) => `- שורה ${b.sourceRow} — ${b.address}`).join("\n") || "— אין"}

### בניינים לא-פעילים שעדיין משויכים לעובד
${assignedInactive.map((x) => `- ${x.address} — ${x.employee}`).join("\n") || "— אין"}

### כתובות משויכות לעובד שלא זוהו באף רשימה
${assignedNotFound.map((x) => `- ${x.address} (${x.employee}, שורה ${x.row})`).join("\n") || "— אין"}

### כתובות ב"ילמ" שלא זוהו באף רשימה
${ilmNotFound.map((x) => `- ${x.address} (שורה ${x.row})`).join("\n") || "— אין"}

---

## 5 · כתובות דומות — האם זה אותו בניין?

הייבוא **לא מיזג** אותן. מיזוג הוא הכרעה עסקית, לא ניחוש של סקריפט.

${nearDupes.length ? nearDupes.map(([a, b]) => `- \`${a}\`  ↔  \`${b}\``).join("\n") : "— לא נמצאו"}

---

## 6 · המע"מ הרעיוני של ספקי "עוסק פטור"

**${imputedContracts.length}** חוזים סומנו \`עוסק פטור — הוסף מע"מ פיקטיבי\`.
הסכום בתא כבר כולל את המע"מ הרעיוני, ולכן הוא **מנפח את ההוצאה ומקטין את הרווח המדווח**.

| | ₪ |
|---|---|
| רכיב המע"מ הרעיוני (אומדן לפי ${(VAT_RATE * 100).toFixed(0)}%) | **${nf(imputedTotal)}** |
| הרווח המדווח | ${nf(importedProfit)} |
| הרווח בניכוי הרכיב הרעיוני (אומדן) | **${nf(round2(importedProfit + imputedTotal))}** |

⚠ **אומדן, לא נתון.** אף הערה בגיליון לא מתעדת את הסכום שלפני הוספת המע"מ, ולכן
זו גזירה לאחור. הסכומים במערכת נשמרו **כפי שהם בגיליון** — לא שינינו מספרים.
כדי שהמספר יהיה ודאי צריך להזין את הסכום הנקי האמיתי בכל אחד מ-${imputedContracts.length} החוזים.

---

## 7 · בניינים בהפסד ובשולי רווח דקים

### הפסד (${losses.length})
${losses.length ? `| בניין | הכנסה | עלות | רווח | margin |
|---|---|---|---|---|
${losses.map((r) => `| ${r.address} | ${nf(r.income)} | ${nf(r.cost)} | **${nf(r.profit)}** | ${pct(r.margin)} |`).join("\n")}` : "— אין"}

### מתחת ל-5% (${thin.length})
${thin.length ? `| בניין | הכנסה | רווח | margin |
|---|---|---|---|
${thin.map((r) => `| ${r.address} | ${nf(r.income)} | ${nf(r.profit)} | ${pct(r.margin)} |`).join("\n")}` : "— אין"}

---

## 8 · תאים שאינם מספר

\`'-'\` נספר באקסל כאפס בשקט. במערכת הוא \`null\` = "לא אנחנו משלמים",
ואינו נכנס לסכום.

${unpricedCells.length ? `| שורה | בניין | עמודה | תוכן |
|---|---|---|---|
${unpricedCells.map((c) => `| ${c.row} | ${c.address} | ${c.col} | \`${c.raw}\` |`).join("\n")}` : "— אין"}

---

## 9 · ביקורות תקופתיות — ${inspections.length} מתוך ${activeBuildings.length * 4} תאים מלאים

ארבע עמודות קיימות בגיליון (\`AI\`–\`AL\`): גילוי אש · כיבוי אש · ניקוי מאגרים · טיפול גנרטור.
${inspections.length === 0 ? "**אף אחת מהן לא מולאה באף בניין.** המודל נבנה; המסך בפרוסה 2." : ""}

---

## 10 · שורות שאינן בניינים

| שורה | מה זה | טיפול |
|---|---|---|
| ${TOTALS_ROW} | שורת סיכום | דולגה; שימשה למבחני ההתאמה |
| ${GHOST_ROW} | שורת רפאים ${GHOST_ROW - TOTALS_ROW} שורות מתחת לנתונים, עם מספרים ישנים${(() => { const g = money(ACTIVE_SHEET, `V${GHOST_ROW}`).value; const t = money(ACTIVE_SHEET, `V${TOTALS_ROW}`).value; return g !== null && t !== null && g !== t ? ` (עלות עובד אחזקה ${nf(g)} מול ${nf(t)} בסיכום)` : ""; })()} | דולגה |

---

## 11 · היסטוריית דמי ניהול שנזרעה מההערות

דמי הניהול הם **הסכם עם תאריך תחולה**, לא שדה — כדי שגם להכנסה תהיה היסטוריה.
${feeHistorySeeded.length} הערות בעמודה \`${COL.fee}\` נשאו גם סכומים וגם תאריך, ולכן הפכו לשורת מחיר קודם:

${feeHistorySeeded.length ? `| שורה | בניין | תא | מ- | ל- | בתוקף מ- |
|---|---|---|---|---|---|
${feeHistorySeeded.map((f) => `| ${f.row} | ${f.address} | ${f.ref} | ${nf(f.from)} | ${nf(f.to)} | ${f.effectiveFrom} |`).join("\n")}` : "— אף אחת"}

${feeNoteWithoutDate.length ? `**לא נזרעו** (${feeNoteWithoutDate.length}) — נשארו כהערה גלויה בלבד:

${feeNoteWithoutDate.map((f) => `- שורה ${f.row}, ${f.address} (${f.ref}) — **${f.reason}**\n  \`${f.text}\``).join("\n")}

שינוי מחיר בלי מועד אי אפשר למקם בזמן, והמצאת תאריך הייתה המצאת נתון.` : ""}

---

## 12 · סתירות נוספות שנרשמו במהלך הייבוא

${discrepancies.length ? discrepancies.map((d) => `### [${d.severity}] ${d.title}\n${d.detail}`).join("\n\n") : "— אין"}
`;

// ============================================================================
// 7. כתיבה
// ============================================================================
mkdirSync(dirname(OUT_JSON), { recursive: true });

const payload = {
  schemaVersion: 1,
  buildings,
  vendors: [...vendorByName.values()],
  feeAgreements,
  employees,
  contracts,
  notes,
  inspections,
  meta: {
    sourceFile: SRC.split("/").pop(),
    importedAt: new Date().toISOString(),
    sheetTotals: { expenses: SHEET_EXPENSES, income: SHEET_INCOME, profit: SHEET_PROFIT },
    checks,
    /**
     * ממצאים שנוגעים ל**גיליון עצמו** ולא לנתונים — הם לא ניתנים לחישוב מחדש
     * מתוך המודל, ולכן נשמרים. (ממצאים על הנתונים — בניינים בלי עובד, הפסדים,
     * כתובות כפולות — מחושבים חי באפליקציה כדי שלא יתיישנו.)
     */
    sheetFindings: {
      profitPctFormula: cell(ACTIVE_SHEET, `${COL.pct}${TOTALS_ROW}`)?.f || null,
      categoryTotalsSum: sum(CATEGORIES, ([, col]) => money(ACTIVE_SHEET, `${col}${TOTALS_ROW}`).value ?? 0),
      grandTotal: SHEET_EXPENSES,
      truncatedRanges: truncatedRanges.map((t) => ({
        col: t.col, name: t.name, formula: t.formula, stopsAt: t.stopsAt,
        missedCount: t.missed.length, lostAmount: t.lostAmount,
        missed: t.missed.map((b) => ({ row: b.sourceRow, address: b.address })),
      })),
      handEditedRows,
      unpricedCells,
      ghostRow: GHOST_ROW,
      totalsRow: TOTALS_ROW,
      inactiveLayoutDiffers: true,
    },
  },
};

writeFileSync(OUT_JSON, JSON.stringify(payload, null, 2), "utf8");
writeFileSync(OUT_REPORT, report, "utf8");

console.log(`\n=== נכתב ===`);
console.log(`  ${OUT_JSON}`);
console.log(`    ${buildings.length} בניינים (${activeBuildings.length} פעילים) · ${contracts.length} חוזים · ` +
            `${vendorByName.size} ספקים · ${employees.length} עובדים · ${notes.length} הערות`);
console.log(`  ${OUT_REPORT}`);
console.log(`\n  הוצאות ${nf(importedExpenses)} ₪ · הכנסות ${nf(importedIncome)} ₪ · רווח ${nf(importedProfit)} ₪`);
console.log(`  margin ${pct(importedProfit / importedIncome)}  ·  markup ${pct(importedProfit / importedExpenses)}\n`);

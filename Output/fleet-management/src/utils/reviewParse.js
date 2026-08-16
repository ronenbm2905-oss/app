// ============================================================================
// reviewParse.js — קריאת הטקסט החופשי של `Assignment.importRaw` והפקת
// **הצעות בלבד**.
//
// חוק הברזל של הקובץ הזה: הפלט הוא הצעה, לא החלטה. שום פונקציה כאן לא
// כותבת לשום ישות ולא נקראת אוטומטית בעת שיוך קנס. מסך התיקון מציג את
// ההצעה ליד הטקסט המקורי, מסמן אותה כ"נגזר מטקסט חופשי", והאדמין מאשר
// בלחיצה מפורשת. זה אותו עיקרון של שיוך הקנס: **לא מנחשים בשקט.**
//
// הטקסטים בקובץ האמיתי הם יומן חילופים אנושי בפורמט חופשי:
//   "החל מ 28.4.2026 עבר לעובד <שם>"     — תאריך מסירה + שם נכנס
//   "<שם> החל מ 11.1.2026 (<שם> לשעבר)"  — **שני מחזיקים** ברצף
//   "<שם> ... החל 6.5.26"                — שנה דו-ספרתית
//   " אצל <שם> החל מ 8.2.2026"           — שם אחרי מילת-הקשר
//   "רכב מסתובב - חברה אצל <שם>"          — רכב מאגר
//
// שלושת פורמטי התאריך שמופיעים בקובץ (D.M.YYYY / D.M.YY / DD/MM/YY) מטופלים
// באותו פרסר, עם ולידציה אמיתית של היום בחודש (31.4 אינו תאריך).
// ============================================================================

import { normText } from "./importExcel.js";

// מילים שמסמנות גבול בין קטעי טקסט — אחריהן/לפניהן לא ממשיך אותו שם.
export const BOUNDARY_WORDS = [
  "החל", "מתאריך", "בתאריך", "מ", "עד", "עבר", "עברה", "הועבר", "הועברה",
  "לשעבר", "רכב", "חברה", "זמני", "זמנית", "נגנב", "הוחזר", "החזרה", "טרם",
  "ללא", "מאגר", "מסתובב", "אחזקות", "החלף", "החליף",
];

// מילות-הקשר שאחריהן מגיע **שם המחזיק** — אות הזיהוי החזקה ביותר בטקסט.
export const NAME_CUES = ["אצל", "עבור", "לעובד", "לעובדת", "לגברת", "למר", "של"];

// המילה שמסמנת שהשם שלפניה הוא המחזיק ה**קודם** — זה מה שמאפשר את הפיצול.
export const FORMER_CUE = "לשעבר";

// רכב מאגר / רכב מסתובב — אין מחזיק קבוע.
export const POOL_WORDS = ["מסתובב", "מאגר"];

// שם אדם סביר: עד שלוש מילים. מעבר לזה ההצעה מסומנת כ"ביטחון נמוך" ומוצגת
// לעריכה, אבל עדיין מוצגת — עדיף שהאדמין יקצר מאשר יקליד מאפס.
export const MAX_CONFIDENT_NAME_WORDS = 3;

// שים לב לסדר בחלופת השנה: `\d{4}` **לפני** `\d{2}`. בלעדיו "28.4.2026"
// מותאם כ-"28.4.20" ומפוענח כשנת 2020 — באג שקט שמזיז החזקה בשש שנים.
const TOKEN_RE =
  /(\d{1,2}[./]\d{1,2}[./](?:\d{4}|\d{2})(?!\d))|([-–—()[\]{}/,|·:;]+)|([^\s\-–—()[\]{}/,|·:;]+)/g;

const pad = (n) => String(n).padStart(2, "0");

// ============================================================================
// תאריכים בתוך טקסט חופשי
// ============================================================================

// "28.4.2026" / "6.5.26" / "17/6/26" → "YYYY-MM-DD". null = לא תאריך תקין.
// שנה דו-ספרתית: <70 → 20xx, אחרת 19xx (אותה אמנה כמו בפרסור האקסל).
export function parseLooseDate(text) {
  const m = String(text ?? "").trim().match(/^(\d{1,2})[./](\d{1,2})[./](\d{4}|\d{2})$/);
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  let y = Number(m[3]);
  if (y < 100) y += y < 70 ? 2000 : 1900;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  // 31.4 / 30.2 — נדחים, ולא "מתגלגלים" לחודש הבא.
  if (dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${pad(mo)}-${pad(d)}`;
}

// כל התאריכים בטקסט, לפי סדר הופעה. `iso: null` = נראה כמו תאריך אך אינו תקין.
export function findDates(text) {
  const s = normText(text);
  const out = [];
  const re = /(\d{1,2})[./](\d{1,2})[./](\d{4}|\d{2})(?!\d)/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    out.push({
      raw: m[0],
      iso: parseLooseDate(m[0]),
      index: m.index,
      format: m[3].length === 2 ? "D.M.YY" : "D.M.YYYY",
    });
  }
  return out;
}

// ============================================================================
// טוקניזציה — מילים, תאריכים, מספרים וסימני פיסוק
// ============================================================================
function tokenize(text) {
  const s = normText(text);
  const tokens = [];
  let m;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(s)) !== null) {
    if (m[1]) {
      tokens.push({ kind: "date", text: m[1], iso: parseLooseDate(m[1]) });
    } else if (m[2]) {
      tokens.push({ kind: "punct", text: m[2] });
    } else {
      const w = m[3];
      if (/\d/.test(w)) tokens.push({ kind: "number", text: w });
      else if (BOUNDARY_WORDS.includes(w) || NAME_CUES.includes(w)) {
        tokens.push({ kind: "marker", text: w });
      } else tokens.push({ kind: "word", text: w });
    }
  }
  return tokens;
}

// רצפים של מילים "נקיות" — מועמדים לשם. כל טוקן אחר הוא גבול.
function segments(tokens) {
  const out = [];
  let cur = null;
  tokens.forEach((tok, i) => {
    if (tok.kind === "word") {
      if (!cur) cur = { words: [], startIdx: i, precededBy: tokens[i - 1] || null };
      cur.words.push(tok.text);
      cur.endIdx = i;
    } else if (cur) {
      cur.followedBy = tok;
      out.push(cur);
      cur = null;
    }
  });
  if (cur) {
    cur.followedBy = null;
    out.push(cur);
  }
  return out.map((s) => ({ ...s, text: s.words.join(" ") }));
}

// ============================================================================
// M6 (שער עדי, 2026-08-13) — **דירוג הביטחון נגזר מהפרובננס, לא רק מהאורך.**
//
// עד כאן `confidenceOf` הסתכל רק על מספר המילים: קטע בן שתי מילים שנבחר
// **לפי מיקום** ("המילה הראשונה בשורה") קיבל `high` בדיוק כמו קטע בן שתי
// מילים שנבחר **אחרי מילת-הקשר "אצל"**. אבל "אצל X" הוא זיהוי, ומיקום הוא
// ניחוש — ובמסך שכל תכליתו למנוע ניחוש שקט, תווית ביטחון מנופחת מטעה בדיוק
// במקרה שבו היא הכי נחוצה.
//
// הכלל: `position` → תמיד `low`. `cue`/`former` (מילת-הקשר מפורשת בטקסט) →
// לפי אורך הקטע, כמו קודם.
// ============================================================================
export function confidenceOf(wordCount, via = "cue") {
  if (via === "position") return "low";
  return wordCount > 0 && wordCount <= MAX_CONFIDENT_NAME_WORDS ? "high" : "low";
}

// ============================================================================
// parseImportRaw — הפונקציה המרכזית. טהורה לחלוטין.
//
// מחזירה:
//   dates[]            כל התאריכים שנמצאו (raw + iso + פורמט)
//   suggestedFromDate  התאריך הראשון התקין — **הצעה** לתאריך תחילת ההחזקה
//   nameSuggestion     { text, confidence, viaKey } | null — המחזיק הנוכחי
//   formerSuggestion   { text, confidence } | null — המחזיק הקודם ("לשעבר")
//   isPool             הטקסט מתאר רכב מאגר/מסתובב
//   splitSuggested     יש גם מחזיק קודם וגם תאריך → אפשר לפצל לשתי החזקות
// ============================================================================
export function parseImportRaw(raw) {
  const text = normText(raw);
  const empty = {
    raw: text,
    dates: [],
    badDates: [],
    suggestedFromDate: null,
    multipleDates: false,
    nameSuggestion: null,
    formerSuggestion: null,
    isPool: false,
    splitSuggested: false,
    hasAnySuggestion: false,
  };
  if (!text) return empty;

  const tokens = tokenize(text);
  const segs = segments(tokens);

  const dateTokens = tokens.filter((t) => t.kind === "date");
  const dates = dateTokens.filter((t) => t.iso).map((t) => ({ raw: t.text, iso: t.iso }));
  const badDates = dateTokens.filter((t) => !t.iso).map((t) => t.text);
  const found = findDates(text);

  const isPool = tokens.some((t) => POOL_WORDS.includes(t.text));

  // המחזיק הקודם: הקטע שמיד אחריו מופיעה המילה "לשעבר".
  const formerSeg = segs.find((s) => s.followedBy?.text === FORMER_CUE) || null;

  // המחזיק הנוכחי: קודם כל קטע שמגיע אחרי מילת-הקשר ("אצל <שם>"), ואם אין —
  // הקטע הראשון בטקסט שאינו המחזיק הקודם.
  const cueSeg =
    segs.find((s) => s !== formerSeg && NAME_CUES.includes(s.precededBy?.text || "")) || null;
  const nameSeg = cueSeg || segs.find((s) => s !== formerSeg) || null;

  const nameSuggestion = nameSeg
    ? {
        text: nameSeg.text,
        // M6 — `via` הוא הפרובננס עצמו, ולא רק מפתח תרגום: הוא מזין את דירוג
        // הביטחון ואת האזהרה הייעודית במסך.
        via: cueSeg ? "cue" : "position",
        confidence: confidenceOf(nameSeg.words.length, cueSeg ? "cue" : "position"),
        viaKey: cueSeg ? "reviewx.via.cue" : "reviewx.via.position",
        cue: cueSeg ? cueSeg.precededBy.text : null,
      }
    : null;

  const formerSuggestion = formerSeg
    ? {
        text: formerSeg.text,
        via: "former",
        confidence: confidenceOf(formerSeg.words.length, "former"),
        viaKey: "reviewx.via.former",
      }
    : null;

  const suggestedFromDate = dates.length ? dates[0].iso : null;

  return {
    raw: text,
    dates: found.filter((d) => d.iso),
    badDates,
    suggestedFromDate,
    multipleDates: dates.length > 1,
    nameSuggestion,
    formerSuggestion,
    isPool,
    splitSuggested: Boolean(formerSuggestion && suggestedFromDate),
    hasAnySuggestion: Boolean(nameSuggestion || suggestedFromDate || isPool),
  };
}

export default parseImportRaw;

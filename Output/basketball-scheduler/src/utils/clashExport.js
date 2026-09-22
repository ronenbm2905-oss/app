import * as XLSX from "xlsx";
import { isoToDmy } from "./dates.js";
import { clashKindLabel } from "./hallClashes.js";

// The hall-clash report as a spreadsheet, beside the PDF that already exists.
//
// SAME FINDINGS, DIFFERENT SHAPE — and the difference is not cosmetic. The two files are
// used in two different ways, and the one decision that matters here follows from that:
//
//   * The PDF is read top to bottom, once, against a hall's own diary. It leaves the date,
//     day, hall and finding BLANK on the second line of each pair, because a page that
//     repeats them twice a night is a page nobody can scan down.
//   * A spreadsheet gets SORTED and FILTERED — that is the whole reason to want one. The
//     moment it is sorted by hall, a blank cell belongs to whatever row happens to land
//     above it, and a filter on "רימונים" silently drops half of every pair. So nothing is
//     left blank here: every row carries its own date, day, hall and finding, and stands
//     on its own.
//
// WHAT KEEPS A PAIR TOGETHER AFTER A SORT: the finding number. Two rows with the same
// number are one clash. Without it, sorting by hall scatters the two halves of a pair with
// nothing on the page saying they belong to each other — and a manager reading "רימונים,
// 17:00, נערים א" with no partner row has been handed a fact, not a problem.
//
// It is also the way back: the rows leave here in date order, and sorting by the finding
// number restores exactly that. Sorting on the date column would not, because the date is
// written as TEXT for the reason given in `isoToDmy`.
// "יריבה" and "מס' משחק" are here because the report is read in order to ACT on it, and the
// action is a phone call to the other club. A row naming only our own squad says what is
// wrong and nothing about who can put it right. Both are blank on a training, which has no
// opposing club and no number.
export const CLASH_HEADERS = [
  "ממצא",
  "תאריך",
  "יום",
  "אולם",
  "הממצא",
  "מ-",
  "עד",
  "קבוצה · מאמן",
  "סוג",
  "יריבה",
  "מס' משחק",
];

// One row per SIDE of a clash — two rows per finding, each complete in itself.
export function clashRows(clashes) {
  const out = [];
  (Array.isArray(clashes) ? clashes : []).forEach((c, i) => {
    if (!c) return;
    const finding = clashKindLabel(c);
    (Array.isArray(c.rows) ? c.rows : []).forEach((r) => {
      out.push({
        n: i + 1,
        date: isoToDmy(c.date),
        day: c.day || "",
        hall: c.hall || "",
        finding,
        start: r?.start || "",
        end: r?.end || "",
        // The same fallback the screen shows. An empty cell here reads as a broken export
        // rather than as a booking nobody attached a squad to.
        team: r?.team || "(ללא קבוצה)",
        label: r?.label || "",
        // Blank on a training — and blank rather than a dash, so a filter on the column
        // separates fixtures from trainings in one click.
        opponent: r?.opponent || "",
        code: r?.code || "",
      });
    });
  });
  return out;
}

export function clashRowToCells(r) {
  return [r.n, r.date, r.day, r.hall, r.finding, r.start, r.end, r.team, r.label, r.opponent, r.code];
}

export function clashSheetAoa(rows, { dateText, findings, days }) {
  return [
    [`התנגשויות אולם — קרית אונו – דור העתיד · ${dateText}`],
    ["כל ממצא הוא שתי שורות עם אותו מספר בעמודה הראשונה. הרשימה ממוינת לפי תאריך — מיון לפי עמודת \"ממצא\" מחזיר אותה לסדר הזה."],
    ["השינוי עצמו נעשה בלוח השבועי או מול האיגוד. הקובץ מאתר, ואינו משנה דבר."],
    ["להזזת משחק — עמודות \"יריבה\" ו\"מס' משחק\". ריקות בשורה של אימון, שאין לו יריבה."],
    [],
    CLASH_HEADERS,
    ...rows.map(clashRowToCells),
    [],
    [`סה"כ ${findings} ממצאים ב-${days} ימים, מהיום ועד סוף העונה. כולל אימונים ומשחקים.`],
  ];
}

export function clashFileName(iso) {
  return `התנגשויות-אולם-${iso}.xlsx`;
}

// `today` is injected so the filename is testable, and so two files a day apart cannot end
// up looking identical.
export function exportClashesXlsx(clashes, days, today = new Date()) {
  const rows = clashRows(clashes);
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const aoa = clashSheetAoa(rows, {
    dateText: isoToDmy(iso),
    findings: (clashes || []).length,
    days,
  });
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [
    { wch: 7 }, // ממצא
    { wch: 12 }, // תאריך
    { wch: 8 }, // יום
    { wch: 16 }, // אולם
    { wch: 26 }, // הממצא
    { wch: 7 }, // מ-
    { wch: 7 }, // עד
    { wch: 30 }, // קבוצה · מאמן
    { wch: 14 }, // סוג
    { wch: 26 }, // יריבה
    { wch: 11 }, // מס' משחק
  ];
  // Excel opens the sheet right-to-left, like every other sheet this app writes.
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  XLSX.utils.book_append_sheet(wb, ws, "התנגשויות");
  XLSX.writeFile(wb, clashFileName(iso));
  return rows.length;
}

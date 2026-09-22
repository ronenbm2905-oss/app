import * as XLSX from "xlsx";
import { sortByName } from "./names.js";
import { birthDateDmy } from "./dates.js";

// The club's coach list as a file — name, sign-in address, phone, date of birth.
//
// Everything here already lives on the coach record and is already on the manager's screen;
// what changes is that a file leaves the building. So two decisions are baked in rather
// than left to the caller:
//
//   * The columns are fixed and closed. A spread of the record would carry whatever field
//     is added next — parallel groups today, something else next season — into a file the
//     manager has already stopped reading carefully.
//   * The sheet says what it holds. A row of personal details with no header explaining
//     itself is exactly the file that gets forwarded once and lives in someone's downloads
//     folder for a year.
export const COACH_HEADERS = ["שם", 'דוא"ל', "טלפון", "תאריך לידה"];

// Written as DD/MM/YYYY, which is what a Hebrew sheet expects.
//
// Through `birthDateDmy` and NOT `isoToDmy`, which was the fifth reader of `birthDate` to
// assume one stored format. It is right today only because `RostersView` is the sole writer
// of a coach record and writes ISO — a record fixed by hand, or merged from another branch,
// would have printed "2014/09/23" into a file that leaves the building.
export const birthDateText = birthDateDmy;

export function coachRows(coaches) {
  return sortByName(coaches || []).map((c) => ({
    name: c?.name || "",
    email: c?.email || "",
    phone: c?.phone || "",
    birthDate: birthDateText(c?.birthDate),
  }));
}

export function coachRowToCells(row) {
  return [row.name, row.email, row.phone, row.birthDate];
}

// `today` is injected so the filename is testable, and so the caller cannot end up with two
// files a day apart that look identical.
export function coachSheetAoa(rows, dateText) {
  return [
    [`רשימת מאמנים — קרית אונו – דור העתיד · ${dateText}`],
    ["הקובץ מכיל פרטים אישיים של עובדי המועדון. לשימוש הנהלת המועדון בלבד."],
    [],
    COACH_HEADERS,
    ...rows.map(coachRowToCells),
    [],
    [`סה"כ ${rows.length} מאמנים`],
  ];
}

export function exportCoachesXlsx(coaches, today = new Date()) {
  const rows = coachRows(coaches);
  const iso = today.toISOString().slice(0, 10);
  const dateText = birthDateText(iso);
  const ws = XLSX.utils.aoa_to_sheet(coachSheetAoa(rows, dateText));
  ws["!cols"] = [{ wch: 22 }, { wch: 30 }, { wch: 15 }, { wch: 13 }];
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] }; // Excel opens the sheet right-to-left
  XLSX.utils.book_append_sheet(wb, ws, "מאמנים");
  XLSX.writeFile(wb, `רשימת-מאמנים-${iso}.xlsx`);
  return rows.length;
}

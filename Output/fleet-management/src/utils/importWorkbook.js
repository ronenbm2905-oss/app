// ============================================================================
// importWorkbook.js — השכבה הדקה שקוראת קובץ .xlsx בדפדפן.
//
// הספרייה: `read-excel-file` (npm, מתוחזק, ESM, ~50KB). נבחרה על פני
// SheetJS/`xlsx` כי SheetJS הפסיקו לפרסם ל-npm — הגרסה שיושבת שם (0.18.5,
// 2022) נטושה ונושאת advisories פתוחות. שיקולים נוספים:
//   · שומרת על **מספרי שורה אמיתיים** (rows[i] ⇔ שורה i+1), כולל שורות
//     ריקות בתוך הטווח — קריטי, כי בקובץ שלנו הנתונים מתחילים בשורה 4
//     ושורה 40 היא שורת אנשי קשר.
//   · אותה חבילה עובדת גם ב-node (`read-excel-file/node`), ולכן אפשר להריץ
//     את אותו פרסור בדיוק מול הקובץ האמיתי בבדיקות.
//   · מחזירה תאי תאריך כאובייקט Date; ה-parser שלנו מקבל גם Date וגם serial.
//
// הכל client-side: הקובץ **אינו** נשלח לשרת.
// ============================================================================

import readXlsxFile, { readSheetNames } from "read-excel-file";

// ההחרגה עצמה יושבת ב-importExcel.js (טהור, נבדק ב-node). כאן רק re-export
// כדי שהרכיב יצרוך הכל ממקום אחד.
export { EXCLUDED_SHEETS, isExcludedSheet } from "./importExcel.js";

export async function listSheets(file) {
  return readSheetNames(file);
}

// מחזיר { sheet, sheets, rows } — rows[0] = שורה 1 בגיליון.
export async function readGrid(file, sheet) {
  const sheets = await readSheetNames(file);
  const target = sheet && sheets.includes(sheet) ? sheet : sheets[0];
  const rows = await readXlsxFile(file, { sheet: target });
  return { sheet: target, sheets, rows };
}

// הערה: בקובץ של הלקוח יש 37 גיליונות, 36 מהם snapshots היסטוריים מתוארכים.
// המשתמש תמיד רואה את הגיליון שנבחר ויכול לשנות אותו — אין ייבוא של גיליון
// שלא נבחר במפורש.

// ============================================================================
// backup.js — ייצוא וייבוא של כל המצב כקובץ JSON.
//
// כל עוד האפליקציה במצב מקומי, הנתונים חיים ב-localStorage של דפדפן אחד:
// ניקוי היסטוריה, גלישה פרטית או מעבר למחשב אחר מוחקים אותם בלי אזהרה.
// עד שיהיה ענן, קובץ גיבוי הוא ההגנה היחידה — ולכן הוא לא "נחמד שיהיה".
// ============================================================================

/** שם קובץ עם חותמת זמן, כדי שגיבויים לא ידרסו זה את זה. */
export function backupFileName(projectName) {
  const slug = String(projectName || "project")
    .replace(/[\\/:*?"<>|]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 40);
  const now = new Date();
  const p = (n) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}`;
  return `גיבוי-${slug}-${stamp}.json`;
}

/** מוריד את המצב הנוכחי כקובץ. מחזיר את שם הקובץ שנוצר. */
export function downloadBackup(data, projectName) {
  const name = backupFileName(projectName);
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // שחרור מיידי היה יכול לבטל את ההורדה בחלק מהדפדפנים לפני שהתחילה.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return name;
}

/** בדיקת שפיות על קובץ גיבוי לפני שהוא דורס נתונים קיימים. */
export function validateBackup(raw) {
  if (!raw || typeof raw !== "object") return "הקובץ אינו JSON תקין.";
  if (!Array.isArray(raw.projects) || raw.projects.length === 0)
    return "הקובץ לא מכיל פרויקטים.";
  for (const key of ["invoices", "payments", "costLines", "boqItems"]) {
    if (raw[key] != null && !Array.isArray(raw[key])) return `השדה "${key}" פגום בקובץ.`;
  }
  return null;
}

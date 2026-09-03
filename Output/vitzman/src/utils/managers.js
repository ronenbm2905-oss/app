// ============================================================================
// managers.js — מי מנהל את הבניין. פונקציות טהורות.
//
// ⚠ **בגיליון יש שתי תשובות לשאלה הזו, והן חלוקות.**
//
//   · `areaManager` — עמודת טקסט חופשי בגיליון הראשי. זו החלוקה שרונן עובד
//     לפיה בפועל. מופיעים בה: אהרון, שלומי, אבי, אסף.
//   · `assignedEmployeeId` — מהגיליון הנפרד ״רשימת בנינים בחלוקה לעובדים״,
//     שמעולם לא הוצלב מול הראשי. מופיעים בו: אהרון, אנדריי, שלומי.
//
// ״אבי״ ו״אסף״ קיימים רק בעמודה הראשונה; ״אנדריי״ רק בשנייה. ב-38 בניינים
// פעילים השתיים נותנות שמות שונים. **המיזוג אינו מוכרע כאן** — השאלה אם ״אבי״
// ו״אנדריי״ הם אותו אדם היא עסקית, ורק רונן יודע. הקוד סופר, מסמן ומאפשר
// לתקן; הוא לא מנחש.
// ============================================================================

import { buildingProfit } from "./profitability.js";
import { sum } from "./money.js";
import { todayISO } from "./dates.js";

const clean = (s) => String(s || "").trim();

/**
 * העומס בפועל לכל מנהל איזור — כמה בניינים, כמה הכנסה, כמה רווח.
 *
 * השאלה האמיתית אינה ״מי מנהל את הבניין הזה״ אלא ״האם החלוקה הגיונית״, ולכן
 * הספירה לבדה אינה מספיקה: 35 בניינים קטנים אינם אותו עומס כמו 20 גדולים.
 */
export function managerLoad(activeBuildings, employees, contractIndex, asOf = todayISO(), feeIndex = null) {
  const byName = new Map();
  let unmanaged = 0;
  let orphans = 0;

  for (const b of activeBuildings) {
    const name = clean(b.areaManager);
    if (!name) {
      unmanaged++;
      if (!b.assignedEmployeeId) orphans++;
      continue;
    }
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name).push(b);
  }

  const managers = [...byName.entries()]
    .map(([name, mine]) => {
      const rows = mine.map((b) => buildingProfit(b, contractIndex, asOf, feeIndex));
      return {
        name,
        buildingCount: mine.length,
        income: sum(rows, (r) => r.income),
        profit: sum(rows, (r) => r.profit),
      };
    })
    .sort((a, b) => b.buildingCount - a.buildingCount);

  return { managers, unmanaged, orphans };
}

/**
 * בניינים שבהם שתי העמודות נותנות שמות שונים.
 *
 * ⚠ **בניין שיש לו מנהל איזור ואין לו עובד אינו סתירה** — הוא פשוט לא נרשם
 * בגיליון השני. סתירה היא רק כששניהם מלאים ואינם זהים; זו ההבחנה שקובעת אם
 * ״38״ הוא ממצא אמיתי או רעש של גיליון חסר.
 */
export function managerConflicts(activeBuildings, employees) {
  const empById = new Map((employees || []).map((e) => [e.id, e.name]));
  const rows = [];
  const pairs = new Map();

  for (const b of activeBuildings) {
    const manager = clean(b.areaManager);
    const employee = clean(empById.get(b.assignedEmployeeId));
    if (!manager || !employee || manager === employee) continue;
    rows.push({ buildingId: b.id, address: b.address, manager, employee });
    const key = `${manager} ≠ ${employee}`;
    pairs.set(key, (pairs.get(key) || 0) + 1);
  }

  const sorted = [...pairs.entries()].sort((a, b) => b[1] - a[1]);
  return {
    rows,
    pairs: sorted.map(([label, count]) => ({ label, count })),
    topPair: sorted.length ? { label: sorted[0][0], count: sorted[0][1] } : null,
  };
}

/**
 * כל שם שמוכר כמנהל — משתי העמודות גם יחד, כולל בניינים לא-פעילים.
 *
 * משמש כהצעות בשדה החופשי. **הצעות, לא רשימה סגורה:** רשימה סגורה הייתה
 * חוסמת שם חדש, ורשימה שנבנית רק מהעובדים הייתה מוחקת את ״אבי״ ו״אסף״.
 */
export function knownManagers(buildings, employees) {
  const names = new Set();
  for (const b of buildings || []) {
    const n = clean(b.areaManager);
    if (n) names.add(n);
  }
  for (const e of employees || []) {
    const n = clean(e.name);
    if (n) names.add(n);
  }
  return [...names].sort((a, b) => a.localeCompare(b, "he"));
}

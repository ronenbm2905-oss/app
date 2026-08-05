// ============================================================================
// reminders.js — מנוע תזכורות client-side (בלי שירות חיצוני, בלי push/מייל).
// מחשב תזכורות מתוך הנתונים הקיימים ומחזיר רשימה ממוינת לפי דחיפות:
//   - חידוש חוזה  — נגזר אוטומטית מ-Lease.endDate של חוזים פעילים.
//   - ביטוח / דיווח מס / בדיקה שנתית — מרשומות Reminder שנשמרו ידנית.
// כל תזכורת עם leadDays (ברירת מחדל 30) — "בתוך החלון" אם נותרו ≤ leadDays ימים.
// ============================================================================

import { daysUntil } from "./format.js";

export const DEFAULT_LEAD_DAYS = 30;

// מחשב את כל התזכורות הפעילות. today אופציונלי (לבדיקות דטרמיניסטיות).
export function computeReminders(state, today) {
  const list = [];

  // 1. חידוש חוזה — נגזר מחוזים פעילים עם endDate.
  for (const lease of state.leases || []) {
    if (lease.status !== "active" || !lease.endDate) continue;
    list.push(
      buildEntry(
        {
          id: `derived-lease-${lease.id}`,
          type: "leaseRenewal",
          dueDate: lease.endDate,
          leadDays: DEFAULT_LEAD_DAYS,
          propertyId: lease.propertyId,
          leaseId: lease.id,
          source: "derived",
        },
        today
      )
    );
  }

  // 2. תזכורות שנשמרו ידנית (ביטוח/מס/בדיקה שנתית) בסטטוס pending.
  for (const r of state.reminders || []) {
    if (r.status && r.status !== "pending") continue;
    if (!r.dueDate) continue;
    list.push(
      buildEntry(
        {
          id: r.id,
          type: r.type,
          dueDate: r.dueDate,
          leadDays: r.leadDays ?? DEFAULT_LEAD_DAYS,
          propertyId: r.propertyId,
          leaseId: r.leaseId,
          source: "stored",
        },
        today
      )
    );
  }

  // מיון לפי דחיפות: הקרוב/באיחור ראשון (daysUntil עולה).
  list.sort((a, b) => a.daysUntil - b.daysUntil);
  return list;
}

// רק התזכורות שבתוך חלון ההתראה (כולל שכבר עברו) — למונה/באדג'.
export function activeReminders(state, today) {
  return computeReminders(state, today).filter((r) => r.within);
}

function buildEntry(base, today) {
  const days = daysUntilFrom(base.dueDate, today);
  const within = days !== null && days <= base.leadDays;
  const overdue = days !== null && days < 0;
  return { ...base, daysUntil: days ?? Infinity, within, overdue };
}

// כמו daysUntil, אך מאפשר להזריק "today" לבדיקות.
function daysUntilFrom(iso, today) {
  if (!today) return daysUntil(iso);
  if (!iso) return null;
  const d = new Date(iso);
  const t = new Date(today);
  if (isNaN(d.getTime()) || isNaN(t.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  t.setHours(0, 0, 0, 0);
  return Math.round((d - t) / (1000 * 60 * 60 * 24));
}

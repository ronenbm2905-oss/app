// פונקציות תצוגה טהורות. הקונסולה היא הכלי היחיד שמציג את הנתונים —
// אין ייצוא, אין דוחות (עדי R-9).

import { toMillis } from "./retention";

const dateFmt = new Intl.DateTimeFormat("he-IL", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDateTime(v) {
  const ms = toMillis(v);
  if (ms == null) return "—";
  return dateFmt.format(new Date(ms));
}

export function formatPhone(p) {
  if (typeof p !== "string") return "—";
  if (p.length === 10) return `${p.slice(0, 3)}-${p.slice(3, 6)}-${p.slice(6)}`;
  if (p.length === 9) return `${p.slice(0, 2)}-${p.slice(2, 5)}-${p.slice(5)}`;
  return p;
}

export function formatSource(source) {
  if (!source || typeof source !== "object") return "—";
  const parts = [source.utmSource, source.utmMedium, source.utmCampaign].filter(Boolean);
  return parts.length ? parts.join(" · ") : "ישיר";
}

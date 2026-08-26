// ============================================================================
// dates.js — עבודה בחודשים. יחידת הזמן של המערכת היא **חודש** ("2026-10"),
// כי כל התזרים, המנות והמקורות מתוזמנים חודשית ("התשלומים יבוצעו החל מ-11 לכל חודש").
// כל התאריכים נשמרים כמחרוזות ISO "YYYY-MM-DD" — בלי אובייקטי Date בסכימה,
// כדי שסריאליזציה ל-Firestore/localStorage תהיה טריוויאלית ובלי אזורי-זמן.
// ============================================================================

export const toMonth = (iso) => (iso ? String(iso).slice(0, 7) : null);

export const monthLabel = (month) => {
  if (!month) return "";
  const [y, m] = month.split("-");
  return `${m}/${y}`;
};

/** "2026-10" + 3 → "2027-01" */
export function addMonths(month, n) {
  const [y, m] = month.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/** מספר החודשים מ-a ל-b (b-a). שלילי אם b מוקדם יותר. */
export function monthDiff(a, b) {
  const [ya, ma] = a.split("-").map(Number);
  const [yb, mb] = b.split("-").map(Number);
  return (yb * 12 + mb) - (ya * 12 + ma);
}

/** רשימת החודשים הרציפה מ-from עד to (כולל). */
export function monthRange(from, to) {
  const out = [];
  const n = monthDiff(from, to);
  for (let i = 0; i <= n; i++) out.push(addMonths(from, i));
  return out;
}

/** ISO + ימים → ISO. משמש להזזת תקבולי מס רכוש בתרחיש הדחייה. */
export function addDays(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + (Number(days) || 0));
  return d.toISOString().slice(0, 10);
}

export const fmtDate = (iso) => {
  if (!iso) return "";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};

/** תאריך סריאלי של אקסל → ISO. אקסל סופר מ-1899-12-30. */
export const excelSerialToISO = (serial) =>
  new Date(Date.UTC(1899, 11, 30) + Number(serial) * 86400000).toISOString().slice(0, 10);

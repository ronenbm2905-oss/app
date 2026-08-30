import { useMemo } from "react";
import { IconWarning, IconShield } from "./ui/icons.jsx";
import { fmtILS, fmtILSExact, fmtPct, round2 } from "../utils/money.js";
import { portfolioTotals, categoryBreakdown, unassignedBuildings } from "../utils/profitability.js";
import { addressKey } from "../utils/id.js";

/**
 * דוח הסתירות.
 *
 * שני סוגי ממצאים, ובכוונה בנפרד:
 *  · **חי** — מחושב עכשיו מהמודל (בניינים בלי עובד, הפסדים, כפילויות כתובת).
 *    הוא מתעדכן כשהנתונים משתנים, ולכן לא יכול להתיישן.
 *  · **היסטורי** — נוגע לגיליון עצמו (טווחי נוסחה, שורת רפאים). אי אפשר לגזור
 *    אותו מהמודל ולכן הוא נשמר ב-`meta.sheetFindings` בזמן הייבוא.
 */
export default function DiscrepancyReport({ data, contractIndex, feeIndex, onOpenBuilding }) {
  const f = data.meta?.sheetFindings;
  const active = useMemo(() => data.buildings.filter((b) => b.status === "active"), [data.buildings]);
  const totals = useMemo(() => portfolioTotals(active, contractIndex, undefined, feeIndex), [active, contractIndex, feeIndex]);
  const breakdown = useMemo(() => categoryBreakdown(active, contractIndex), [active, contractIndex]);
  const unassigned = useMemo(() => unassignedBuildings(data.buildings), [data.buildings]);

  const empById = useMemo(() => new Map(data.employees.map((e) => [e.id, e.name])), [data.employees]);
  const assignedInactive = useMemo(
    () => data.buildings.filter((b) => b.status === "inactive" && b.assignedEmployeeId),
    [data.buildings]
  );

  /** כתובות דומות שלא מוזגו — מיזוג הוא הכרעה עסקית, לא ניחוש. */
  const nearDupes = useMemo(() => {
    const loose = (s) => addressKey(s).replace(/[\s'"]/g, "");
    const out = [];
    const list = data.buildings;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = loose(list[i].address), b = loose(list[j].address);
        if (!a || !b) continue;
        if (a === b || (a.length > 5 && (a.includes(b) || b.includes(a)))) out.push([list[i], list[j]]);
      }
    }
    return out;
  }, [data.buildings]);

  const imputedContracts = useMemo(
    () => data.contracts.filter((c) => c.vatMode === "imputed" && c.amount != null),
    [data.contracts]
  );
  const noInspections = data.inspections.length === 0;
  const balanceDiff = round2(breakdown.actualTotal - totals.cost);

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <div className="card border-slate-300 bg-slate-900 p-5 text-white">
        <div className="flex items-center gap-2">
          <IconShield className="h-5 w-5" />
          <h1 className="text-lg font-semibold">מה נמצא בגיליון המקור</h1>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          הייבוא שחזר את הגיליון לשקל — {fmtILSExact(totals.cost)} הוצאות,{" "}
          {fmtILSExact(totals.income)} הכנסות, {fmtILSExact(totals.profit)} רווח.
          מה שכאן הוא מה שהתגלה תוך כדי, לתיקון <b>במקור</b>.
        </p>
      </div>

      <Finding n={1} title="אחוז הרווח חושב על ההוצאות ולא על ההכנסה" severity="high">
        <p>נוסחת הגיליון: <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{f?.profitPctFormula || "—"}</code></p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <Box tone="amber" label="מוצג בגיליון כ״אחוז רווח״ (markup)" value={fmtPct(totals.markup)} />
          <Box tone="emerald" label="שיעור הרווח מהמחזור (margin)" value={fmtPct(totals.margin)} />
        </div>
        <p className="mt-2">
          פער של <b className="tnum">{fmtPct(Math.abs((totals.markup ?? 0) - (totals.margin ?? 0)))}</b>,
          בכל 131 השורות ובשורת הסיכום.
        </p>
      </Finding>

      <Finding n={2} title="שורת הסיכום לא מתאזנת מול הפירוק" severity="high">
        <p>
          סכום 24 קטגוריות ההוצאה בשורת הסיכום:{" "}
          <b className="tnum">{fmtILSExact(f?.categoryTotalsSum ?? 0)}</b> — בעוד הסה״כ הכללי הוא{" "}
          <b className="tnum">{fmtILSExact(f?.grandTotal ?? 0)}</b>.
        </p>
        <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-emerald-900">
          ✓ במערכת הפירוק והסה״כ נגזרים מאותם חוזים, ולכן מתאזנים תמיד:{" "}
          <b className="tnum">{fmtILSExact(breakdown.actualTotal)}</b>
          {Math.abs(balanceDiff) >= 0.01 && (
            <span className="text-red-700"> — פער {fmtILSExact(balanceDiff)}!</span>
          )}
        </p>
      </Finding>

      <Finding n={3} title="נוסחאות עם טווח שגוי — הסיבה לפער" severity="high">
        <p className="rounded-lg bg-slate-100 px-3 py-2 text-slate-700">
          <b>מה שלא נמצא:</b> הנוסחאות <b>לא</b> נמחקו. כל השורות וכל סיכומי הקטגוריות
          מחזיקים נוסחה. אקסל שומר נוסחה חוזרת בצורת <code>shared</code>, ולכן היא
          נראית חסרה לכלי שקורא את ה-XML הגולמי בלי לפרש <code>si</code>.
        </p>
        {(f?.truncatedRanges || []).map((t) => (
          <div key={t.col} className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
            <div className="text-sm font-medium text-red-900">
              עמודה {t.col} — {t.name}
            </div>
            <code className="mt-1 block text-xs text-red-800">{t.formula}</code>
            <p className="mt-1 text-sm text-red-800">
              נעצרת בשורה {t.stopsAt}; <b>{t.missedCount} בניינים</b> נופלים מהחישוב
              {t.lostAmount > 0 && <> — <b className="tnum">{fmtILSExact(t.lostAmount)}</b> שלא נספרו</>}.
            </p>
            <details className="mt-1">
              <summary className="cursor-pointer text-xs text-red-700">הבניינים שנופלים</summary>
              <ul className="mt-1 text-xs text-red-800">
                {t.missed.map((m) => <li key={m.row}>שורה {m.row} — {m.address}</li>)}
              </ul>
            </details>
          </div>
        ))}
        {(f?.handEditedRows || []).map((h) => (
          <div key={h.row} className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <div className="text-sm font-medium text-amber-900">
              שורה {h.row} — {h.address}: נוסחה שנערכה ביד
            </div>
            <code className="mt-1 block break-all text-xs text-amber-800">{h.formula}</code>
            <p className="mt-1 text-sm text-amber-800">
              מדלגת על עמודות {h.missing.join(", ")}. כל עוד הן ריקות הסה״כ יוצא נכון;
              ברגע שיוזן בהן סכום — הוא ייעלם בלי סימן.
            </p>
          </div>
        ))}
      </Finding>

      <Finding n={4} title="ארבע רשימות בניינים שלא מסכימות" severity="high">
        <div className="grid gap-2 sm:grid-cols-3">
          <Box tone="amber" label="פעילים ללא עובד אחראי" value={unassigned.length} />
          <Box tone="amber" label="לא-פעילים שעדיין משויכים לעובד" value={assignedInactive.length} />
          <Box tone="slate" label="פעילים שאינם ברשימת ילמ" value={active.filter((b) => !b.inIlm).length} />
        </div>
        {unassigned.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-sm text-slate-700">
              {unassigned.length} בניינים פעילים ללא עובד אחראי
            </summary>
            <ul className="mt-2 space-y-0.5 text-sm">
              {unassigned.map((b) => (
                <li key={b.id}>
                  <button className="text-slate-700 underline-offset-2 hover:underline"
                    onClick={() => onOpenBuilding(b.id)}>
                    {b.address}
                  </button>
                  <span className="mr-2 text-xs text-slate-400">שורה {b.sourceRow}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
        {assignedInactive.length > 0 && (
          <details className="mt-2">
            <summary className="cursor-pointer text-sm text-slate-700">
              {assignedInactive.length} בניינים לא-פעילים שעובד עדיין רשום עליהם
            </summary>
            <ul className="mt-2 space-y-0.5 text-sm">
              {assignedInactive.map((b) => (
                <li key={b.id}>{b.address} — {empById.get(b.assignedEmployeeId)}</li>
              ))}
            </ul>
          </details>
        )}
      </Finding>

      <Finding n={5} title="כתובות דומות — האם זה אותו בניין?" severity="medium">
        <p>הייבוא <b>לא מיזג</b> אותן. מיזוג זהויות הוא הכרעה עסקית, לא ניחוש של סקריפט.</p>
        {nearDupes.length ? (
          <ul className="mt-2 space-y-1 text-sm">
            {nearDupes.map(([a, b], i) => (
              <li key={i} className="rounded bg-slate-50 px-2 py-1">
                <code>{a.address}</code> ↔ <code>{b.address}</code>
              </li>
            ))}
          </ul>
        ) : <p className="mt-2 text-slate-500">— לא נמצאו</p>}
      </Finding>

      <Finding n={6} title="מע״מ רעיוני של ספקי ״עוסק פטור״" severity="medium">
        <p>
          <b>{imputedContracts.length}</b> חוזים מסומנים כך. הסכום בתא כבר כולל את
          המע״מ הרעיוני, ולכן מנפח את ההוצאה ומקטין את הרווח המדווח.
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <Box tone="amber" label="רכיב רעיוני (אומדן)" value={fmtILSExact(totals.imputedVatTotal)} />
          <Box tone="slate" label="הרווח כפי שרשום" value={fmtILSExact(totals.profit)} />
          <Box tone="amber" label="בניכוי הרעיוני (אומדן)" value={fmtILSExact(totals.profitExImputedVat)} />
        </div>
        <p className="mt-2 text-amber-800">
          ⚠ <b>אומדן, לא נתון.</b> אף הערה במקור לא מתעדת את הסכום שלפני ההוספה, ולכן זו
          גזירה לאחור לפי 18%. הסכומים במערכת נשמרו כפי שהם בגיליון — לא שינינו מספרים.
        </p>
      </Finding>

      <Finding n={7} title="בניינים בהפסד ובשולי רווח דקים" severity="high">
        <div className="grid gap-2 sm:grid-cols-2">
          <Box tone="red" label="בהפסד" value={totals.losses.length} />
          <Box tone="amber" label="מתחת ל-5% margin" value={totals.thin.length} />
        </div>
        <table className="mt-3 w-full text-sm">
          <thead><tr className="border-b border-slate-200">
            <th className="th">בניין</th><th className="th">הכנסה</th><th className="th">רווח</th><th className="th">margin</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {[...totals.losses, ...totals.thin].map((r) => (
              <tr key={r.buildingId}>
                <td className="td">
                  <button className="underline-offset-2 hover:underline" onClick={() => onOpenBuilding(r.buildingId)}>
                    {r.address}
                  </button>
                </td>
                <td className="td tnum">{fmtILS(r.income)}</td>
                <td className={`td tnum font-medium ${r.isLoss ? "text-red-700" : "text-amber-700"}`}>{fmtILSExact(r.profit)}</td>
                <td className={`td tnum ${r.isLoss ? "text-red-700" : "text-amber-700"}`}>{fmtPct(r.margin)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Finding>

      <Finding n={8} title="תאים שאינם מספר" severity="medium">
        <p>
          <code>'-'</code> נספר באקסל כאפס בשקט. במערכת הוא ״לא אנחנו משלמים״ ואינו נכנס לסכום.
        </p>
        {(f?.unpricedCells || []).length ? (
          <ul className="mt-2 text-sm">
            {f.unpricedCells.map((c, i) => (
              <li key={i}>שורה {c.row} — {c.address}, עמודה {c.col}: <code>{c.raw}</code></li>
            ))}
          </ul>
        ) : <p className="mt-2 text-slate-500">— אין</p>}
      </Finding>

      <Finding n={9} title="ביקורות תקופתיות — אף תא לא מולא" severity={noInspections ? "high" : "medium"}>
        <p>
          ארבע עמודות קיימות בגיליון: גילוי אש · כיבוי אש · ניקוי מאגרים · טיפול גנרטור.
          {noInspections && <> <b>אף אחת מהן לא מולאה באף אחד מ-{active.length} הבניינים.</b></>}
        </p>
        <p className="mt-2 text-slate-600">
          מישהו הבין שצריך לעקוב ובנה את העמודות. זו החשיפה הכבדה ביותר בקובץ, והיא לא כספית.
          מעקב פקיעה והתראות — פרוסה 2.
        </p>
      </Finding>

      <Finding n={10} title="שורות שאינן בניינים" severity="low">
        <ul className="text-sm">
          <li>שורה {f?.totalsRow} — שורת סיכום. דולגה; שימשה למבחני ההתאמה.</li>
          <li>
            שורה {f?.ghostRow} — שורת רפאים {(f?.ghostRow ?? 0) - (f?.totalsRow ?? 0)} שורות מתחת
            לנתונים, עם מספרים ישנים שאינם תואמים. דולגה.
          </li>
          {f?.inactiveLayoutDiffers && (
            <li>
              לגיליון ״לא פעילים״ <b>מבנה עמודות שונה</b> מהפעיל — לכן לא יובאו ממנו עלויות,
              רק זהות הבניין. השוואה היסטורית של עלויות אינה אפשרית עד שהמבנה יאוחד.
            </li>
          )}
        </ul>
      </Finding>
    </div>
  );
}

const SEV = {
  high: { ring: "border-red-200", chip: "bg-red-100 text-red-800", label: "חמור" },
  medium: { ring: "border-amber-200", chip: "bg-amber-100 text-amber-800", label: "בינוני" },
  low: { ring: "border-slate-200", chip: "bg-slate-100 text-slate-600", label: "לידיעה" },
};

function Finding({ n, title, severity = "medium", children }) {
  const s = SEV[severity];
  return (
    <section className={`card ${s.ring} p-4`}>
      <div className="flex flex-wrap items-center gap-2">
        <IconWarning className="h-4 w-4 text-slate-400" />
        <h2 className="text-sm font-semibold text-slate-800">{n} · {title}</h2>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${s.chip}`}>{s.label}</span>
      </div>
      <div className="mt-2 space-y-1 text-sm leading-relaxed text-slate-700">{children}</div>
    </section>
  );
}

const BOX = {
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
  amber: "border-amber-200 bg-amber-50 text-amber-900",
  red: "border-red-200 bg-red-50 text-red-900",
  slate: "border-slate-200 bg-slate-50 text-slate-900",
};
const Box = ({ tone = "slate", label, value }) => (
  <div className={`rounded-lg border p-2.5 ${BOX[tone]}`}>
    <div className="text-xs font-medium opacity-80">{label}</div>
    <div className="mt-0.5 text-lg font-semibold tnum">{value}</div>
  </div>
);

import { useMemo, useState } from "react";
import StatTile from "./ui/StatTile.jsx";
import { IconWarning, IconInfo } from "./ui/icons.jsx";
import { fmtILS } from "../utils/money.js";
import { monthLabel } from "../utils/dates.js";
import { buildCashflow, stressTest, BUFFER_FLOOR } from "../utils/cashflow.js";
import { DELAY_SCENARIOS } from "../constants.js";
import FundingPanel from "./FundingPanel.jsx";
import SchedulePanel from "./SchedulePanel.jsx";

const SUB_TABS = [
  { key: "grid", label: "טבלת התזרים" },
  { key: "funding", label: "מקורות מימון (כסף נכנס)" },
  { key: "schedule", label: "לוח תשלומים (כסף יוצא)" },
];

export default function CashflowView({ slice, store, canEdit, asOfMonth }) {
  const [sub, setSub] = useState("grid");

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-1 rounded-lg border border-border bg-white p-1">
        {SUB_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setSub(t.key)}
            className={`rounded-sm px-4 py-1.5 text-sm font-semibold transition ${
              sub === t.key ? "bg-navy text-white" : "text-ink-muted hover:bg-surface-alt hover:text-navy"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {sub === "grid" && <CashflowGrid slice={slice} asOfMonth={asOfMonth} />}
      {sub === "funding" && <FundingPanel slice={slice} store={store} canEdit={canEdit} />}
      {sub === "schedule" && <SchedulePanel slice={slice} store={store} canEdit={canEdit} />}
    </div>
  );
}

function CashflowGrid({ slice, asOfMonth }) {
  const { project, costLines, payments, fundingEvents } = slice;
  const [delayDays, setDelayDays] = useState(0);

  /**
   * שילוב ביצוע נדלק רק כשיש מה לשלב. אחרת חודש שכבר עבר ואין בו תנועה מתועדת
   * נספר כאפס, וההפרש מהתוכנית מתגלגל על כל שאר החודשים — התוצאה היא "הקופה
   * נשברת" שכולה ארטיפקט של פנקס ריק, לא של הפרויקט.
   */
  // ‼ נספרים רק ביצועים שאפשר **לשבץ לחודש**. תשלום בלי תאריך (כמו אלה שיובאו
  // מגיליון התשלומים) נכנס ל"שולם" אבל לא לשום חודש — אילו הוא היה מדליק את
  // המתג, החודשים שעברו היו מתאפסים בלי שום ביצוע שיחליף אותם, והתרחישים היו
  // מציגים חור גדול מהאמיתי.
  const hasActuals =
    payments.some((p) => p.date) || fundingEvents.some((f) => f.actualAmount != null);
  const [useActuals, setUseActuals] = useState(hasActuals);

  const cfSlice = useMemo(
    () => ({ project, costLines, payments, fundingEvents }),
    [project, costLines, payments, fundingEvents],
  );
  const opts = { delayDays, asOfMonth: useActuals ? asOfMonth : null };
  const cf = useMemo(() => buildCashflow(cfSlice, opts), [cfSlice, delayDays, useActuals, asOfMonth]);
  const scenarios = useMemo(
    () => stressTest(cfSlice, DELAY_SCENARIOS, { asOfMonth: useActuals ? asOfMonth : null }),
    [cfSlice, useActuals, asOfMonth],
  );

  const missingMonths = cf.months.filter((m) => m.missingActuals).length;

  if (!cf.months.length) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-white p-10 text-center text-ink-muted">
        אין לוח תשלומים או מקורות מימון בפרויקט הזה.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="סה״כ יוצא בתוכנית" value={cf.totals.plannedOut} />
        <StatTile label="סה״כ נכנס בתוכנית" value={cf.totals.plannedIn} />
        <StatTile
          label="הנקודה הנמוכה ביותר"
          value={cf.lowestPoint?.balance ?? 0}
          hint={cf.lowestPoint ? monthLabel(cf.lowestPoint.month) : ""}
          tone={cf.shortfall > 0 ? "danger" : cf.zeroBufferMonths > 0 ? "warning" : "success"}
        />
        <StatTile
          label="חוסר מזומן בתרחיש"
          value={cf.shortfall}
          hint={cf.firstNegative ? `נשבר ב-${monthLabel(cf.firstNegative.month)}` : "הקופה מחזיקה"}
          tone={cf.shortfall > 0 ? "danger" : "success"}
        />
      </div>

      {useActuals && missingMonths > 0 && (
        <Banner tone="warning">
          <strong>{missingMonths} חודשים שעברו בלי תנועה מתועדת.</strong> התוכנית ציפתה בהם לתשלום
          או לתקבול, ובפנקס אין כלום — לכן הם נספרים כאפס והיתרה שמוצגת נמוכה מהמציאות. כבה את
          שילוב הביצוע כדי לראות את התוכנית הנקייה.
        </Banner>
      )}
      {cf.zeroBufferMonths > 0 && cf.shortfall === 0 && (
        <Banner tone="warning">
          <strong>מאוזן, אבל בלי כרית.</strong> ב-{cf.zeroBufferMonths} מתוך {cf.months.length} חודשים
          הקופה יורדת מתחת ל-{fmtILS(BUFFER_FLOOR)}. תוכנית שנוחתת בדיוק על אפס לא סופגת שום
          עיכוב — לא בהחזר, לא בקצב העבודה.
        </Banner>
      )}
      {cf.shortfall > 0 && (
        <Banner tone="danger">
          <strong>בתרחיש הזה הקופה נשברת.</strong> החל מ-{monthLabel(cf.firstNegative.month)} חסרים{" "}
          <span className="num">{fmtILS(cf.shortfall)}</span>. זה הסכום שצריך להיות זמין כגיבוי
          אם ההחזר מ{project.taxAuthorityName} מתעכב.
        </Banner>
      )}

      <section className="mb-6 rounded-lg border border-border bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-navy">
              עיכוב בהחזרי {project.taxAuthorityName} — מעבר למתוכנן
            </h3>
            <p className="text-xs text-ink-muted">
              התוכנית כבר מניחה פיגור מסוים. הבחירה כאן היא כמה <em>עוד</em> יתעכב התקבול.
            </p>
          </div>
          <label className={`flex items-center gap-2 text-xs ${hasActuals ? "text-ink-muted" : "text-ink-faint"}`}>
            <input
              type="checkbox"
              checked={useActuals}
              onChange={(e) => setUseActuals(e.target.checked)}
              disabled={!hasActuals}
              className="h-4 w-4"
            />
            שילוב ביצוע בפועל עד {monthLabel(asOfMonth)}
            {!hasActuals && <span> — אין עדיין תשלומים או תקבולים רשומים</span>}
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          {scenarios.map((s) => (
            <button
              key={s.delayDays}
              onClick={() => setDelayDays(s.delayDays)}
              className={`rounded-lg border px-4 py-2 text-right transition ${
                delayDays === s.delayDays ? "border-accent bg-info-fill" : "border-border bg-white hover:border-ink-faint"
              }`}
            >
              <div className="text-sm font-semibold text-navy">+{s.delayDays} יום</div>
              <div className={`num text-xs ${s.shortfall > 0 ? "text-danger-text" : "text-success-text"}`}>
                {s.shortfall > 0 ? `חסר ${fmtILS(s.shortfall)}` : "תקין"}
              </div>
            </button>
          ))}
        </div>
      </section>

      <div className="table-scroll rounded-lg border border-border bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-surface-alt text-xs text-ink-muted">
            <tr>
              <th className="px-3 py-2 text-right font-semibold">חודש</th>
              <th className="px-3 py-2 text-left font-semibold">יוצא</th>
              <th className="px-3 py-2 text-left font-semibold">נכנס</th>
              <th className="px-3 py-2 text-left font-semibold">נטו</th>
              <th className="px-3 py-2 text-left font-semibold">יתרה בקופה</th>
            </tr>
          </thead>
          <tbody>
            {cf.months.map((m) => (
              <tr
                key={m.month}
                className={`border-b border-border last:border-0 ${
                  m.balance < -0.01 ? "bg-danger-fill" : m.balance < BUFFER_FLOOR ? "bg-warning-fill/40" : ""
                }`}
              >
                <td className="px-3 py-2">
                  <span className="num">{monthLabel(m.month)}</span>
                  {m.isPast && <span className="mr-1.5 text-[11px] text-ink-faint">בפועל</span>}
                  {m.missingActuals && (
                    <span className="mr-1 inline-flex text-warning-text" title="חודש שעבר בלי תנועה מתועדת">
                      <IconWarning size={12} />
                    </span>
                  )}
                </td>
                <td className="num px-3 py-2 text-left text-ink-body">{m.effectiveOut ? fmtILS(m.effectiveOut) : "—"}</td>
                <td className="num px-3 py-2 text-left text-ink-body">{m.effectiveIn ? fmtILS(m.effectiveIn) : "—"}</td>
                <td className={`num px-3 py-2 text-left ${m.net < 0 ? "text-danger-text" : "text-ink-muted"}`}>
                  {m.net ? fmtILS(m.net) : "—"}
                </td>
                <td
                  className={`num px-3 py-2 text-left font-semibold ${
                    m.balance < -0.01 ? "text-danger-text" : m.balance < BUFFER_FLOOR ? "text-warning-text" : "text-navy"
                  }`}
                >
                  {fmtILS(m.balance)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-navy bg-surface-alt">
            <tr>
              <td className="px-3 py-2 font-semibold text-navy">סה״כ</td>
              <td className="num px-3 py-2 text-left font-semibold text-navy">{fmtILS(cf.totals.plannedOut)}</td>
              <td className="num px-3 py-2 text-left font-semibold text-navy">{fmtILS(cf.totals.plannedIn)}</td>
              <td />
              <td className="num px-3 py-2 text-left font-semibold text-navy">{fmtILS(cf.totals.closingBalance)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {project.notes?.length > 0 && (
        <section className="mt-6 rounded-lg border border-border bg-surface-alt p-4">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink-body">
            <IconInfo size={15} /> הערות התזרים מהגיליון המקורי
          </h3>
          <ul className="list-inside list-disc space-y-1 text-sm text-ink-muted">
            {project.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

const BANNER_TONES = {
  warning: "border-warning-solid/40 bg-warning-fill text-warning-text",
  danger: "border-danger-solid/40 bg-danger-fill text-danger-text",
};

const Banner = ({ tone, children }) => (
  <div className={`mb-6 flex items-start gap-2 rounded-lg border p-3 text-sm ${BANNER_TONES[tone]}`}>
    <IconWarning size={18} className="mt-0.5 shrink-0" />
    <p>{children}</p>
  </div>
);

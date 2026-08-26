import { useMemo, useState } from "react";
import { Button } from "./ui/Button.jsx";
import { Select } from "./ui/Field.jsx";
import { IconWarning, IconInfo } from "./ui/icons.jsx";
import { fmtILS, round2, sum } from "../utils/money.js";
import { monthLabel, monthRange } from "../utils/dates.js";
import { makeCostLine } from "../schema.js";

/**
 * עריכת לוח התשלומים המתוכנן — הצד היוצא של התזרים.
 *
 * זו התוכנית, לא הביצוע: כמה מתוכנן לצאת בכל חודש על כל שורת תקציב. הביצוע
 * נכנס דרך תשלומים על חשבוניות. שמירה על ההפרדה הזו היא כל העניין — ברגע
 * שמערבבים אותם אי אפשר יותר לענות "חרגנו או שרק הקדמנו?".
 */
export default function SchedulePanel({ slice, store, canEdit }) {
  const { project, costLines } = slice;
  const [lineId, setLineId] = useState(costLines[0]?.id || "");
  const line = costLines.find((c) => c.id === lineId) || null;

  const months = useMemo(
    () =>
      project.startMonth && project.endMonth ? monthRange(project.startMonth, project.endMonth) : [],
    [project.startMonth, project.endMonth],
  );

  const byMonth = useMemo(() => {
    const m = new Map();
    for (const r of line?.schedule || []) m.set(r.month, r.amount);
    return m;
  }, [line]);

  if (!line) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-white p-10 text-center text-ink-muted">
        אין שורות תקציב בפרויקט.
      </p>
    );
  }

  const scheduled = sum(line.schedule || [], (r) => r.amount);
  const target = round2(line.budgetGross - line.paidBefore);
  const diff = round2(target - scheduled);

  const setMonth = (month, value) => {
    const amount = round2(Number(value) || 0);
    const rest = (line.schedule || []).filter((r) => r.month !== month);
    const next = amount > 0 ? [...rest, { month, amount }] : rest;
    store.upsert(
      "costLines",
      makeCostLine({ ...line, schedule: next.sort((a, b) => a.month.localeCompare(b.month)) }),
    );
  };

  const spreadEvenly = () => {
    if (!confirm(`לפרוס ${fmtILS(target)} שווה בשווה על ${months.length} חודשים? הלוח הנוכחי יידרס.`))
      return;
    const per = round2(target / months.length);
    const rows = months.map((month, i) => ({
      month,
      // השארית נופלת על החודש האחרון כדי שהסכום יישאר מדויק לאגורה.
      amount: i === months.length - 1 ? round2(target - per * (months.length - 1)) : per,
    }));
    store.upsert("costLines", makeCostLine({ ...line, schedule: rows }));
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="w-72">
          <Select
            label="שורת תקציב"
            value={lineId}
            onChange={setLineId}
            options={costLines.map((c) => ({ value: c.id, label: c.name }))}
          />
        </div>
        {canEdit && (
          <Button variant="secondary" onClick={spreadEvenly}>
            פריסה שווה על כל החודשים
          </Button>
        )}
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Box label="תקציב לשורה" value={fmtILS(line.budgetGross)} />
        <Box
          label="נותר לפרוס"
          value={fmtILS(target)}
          hint={line.paidBefore > 0 ? `אחרי ${fmtILS(line.paidBefore)} ששולם קודם` : undefined}
        />
        <Box
          label="סכום הלוח"
          value={fmtILS(scheduled)}
          hint={
            Math.abs(diff) < 0.01
              ? "תואם במדויק"
              : diff > 0
                ? `חסרים ${fmtILS(diff)}`
                : `עודף ${fmtILS(-diff)}`
          }
          tone={Math.abs(diff) < 0.01 ? "success" : "warning"}
        />
      </div>

      {Math.abs(diff) >= 0.01 && (
        <p className="mb-4 flex items-start gap-1.5 rounded-lg border border-warning-solid/30 bg-warning-fill p-3 text-sm text-warning-text">
          <IconWarning size={16} className="mt-0.5 shrink-0" />
          לוח התשלומים לא מסתכם לתקציב השורה. התזרים יראה את מה שבלוח — לא את התקציב.
        </p>
      )}

      <div className="table-scroll rounded-lg border border-border bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-surface-alt text-xs text-ink-muted">
            <tr>
              <th className="px-3 py-2 text-right font-semibold">חודש</th>
              <th className="px-3 py-2 text-left font-semibold">מתוכנן לצאת</th>
              <th className="px-3 py-2 text-left font-semibold">מצטבר</th>
            </tr>
          </thead>
          <tbody>
            {months.map((month, i) => {
              const amount = byMonth.get(month) || 0;
              const cumulative = months
                .slice(0, i + 1)
                .reduce((s, m) => s + (byMonth.get(m) || 0), 0);
              return (
                <tr key={month} className="border-b border-border last:border-0">
                  <td className="num px-3 py-1.5">{monthLabel(month)}</td>
                  <td className="px-3 py-1.5 text-left">
                    {canEdit ? (
                      <input
                        type="number"
                        defaultValue={amount || ""}
                        onBlur={(e) => setMonth(month, e.target.value)}
                        placeholder="0"
                        className="num w-40 rounded-sm border border-border bg-white px-2 py-1 text-left text-sm text-navy outline-none focus:border-accent"
                      />
                    ) : (
                      <span className="num">{amount ? fmtILS(amount) : "—"}</span>
                    )}
                  </td>
                  <td className="num px-3 py-1.5 text-left text-ink-muted">{fmtILS(round2(cumulative))}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t-2 border-navy bg-surface-alt">
            <tr>
              <td className="px-3 py-2 font-semibold text-navy">סה״כ</td>
              <td className="num px-3 py-2 text-left font-semibold text-navy">{fmtILS(scheduled)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="mt-3 flex items-start gap-1.5 text-xs text-ink-muted">
        <IconInfo size={14} className="mt-0.5 shrink-0" />
        הסכום נשמר כשיוצאים מהשדה. זו התוכנית בלבד — הביצוע בפועל נרשם דרך תשלומים
        על חשבוניות בלשונית "חשבוניות".
      </p>
    </div>
  );
}

const BOX_TONES = {
  default: "border-border bg-white text-navy",
  success: "border-success-solid/40 bg-success-fill text-success-text",
  warning: "border-warning-solid/40 bg-warning-fill text-warning-text",
};

const Box = ({ label, value, hint, tone = "default" }) => (
  <div className={`rounded-lg border p-3 ${BOX_TONES[tone]}`}>
    <div className="text-[11px] uppercase tracking-wider opacity-70">{label}</div>
    <div className="num mt-0.5 text-lg font-semibold">{value}</div>
    {hint && <div className="mt-0.5 text-xs opacity-80">{hint}</div>}
  </div>
);

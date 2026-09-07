import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "./ui/Button.jsx";
import { EditableField } from "./ui/EditableField.jsx";
import { StatTile } from "./ui/StatTile.jsx";
import { IconUmbrella, IconWarning, IconUpload, IconTrash, IconSearch } from "./ui/icons.jsx";
import { POLICY_PAYERS, POLICY_PAYER_LABEL, POLICY_STATUS_LABEL } from "../constants.js";
import { makePolicy } from "../schema.js";
import { fmtILS } from "../utils/money.js";
import { fmtDate, fmtRelative } from "../utils/dates.js";
import {
  policyStatus, policyQueue, policySummary, policyTotals,
  insurerBreakdown, agencyBreakdown, spellingConflicts, canDeletePolicy,
} from "../utils/policies.js";
import { importInsurance, matchPolicyToBuilding, buildBuildingIndex } from "../utils/importInsurance.js";

/**
 * מסך הביטוחים.
 *
 * ⚠ **שכבה עצמאית, במכוון.** רונן ביקש במפורש ״אל תערבב כרגע בין הטבלאות״,
 * והבידוד אינו רק ציות: הפרמיות מסתכמות ב-898,940 ₪ בשנה, שרובן כסף שהוועד
 * משלם ישירות. `buildingIds` הוא **קישור לניווט בלבד** ואינו מזרים דבר אל
 * חישוב העלות — ראה את ההסבר בראש `policies.js`.
 */
export default function InsuranceView({ data, asOf, readOnly = false, applyBatch, update, remove, onOpenBuilding }) {
  const policies = data.policies || [];
  const [status, setStatus] = useState("all");
  const [insurer, setInsurer] = useState("all");
  const [q, setQ] = useState("");
  const [pending, setPending] = useState(null);   // תוצאת ייבוא שטרם הוחלה
  const [importError, setImportError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const buildingById = useMemo(
    () => new Map((data.buildings || []).map((b) => [b.id, b])), [data.buildings]);

  const summary = useMemo(() => policySummary(policies, asOf), [policies, asOf]);
  const totals = useMemo(() => policyTotals(policies), [policies]);
  const vitzmanPays = useMemo(() => policyTotals(policies, { payer: "vitzman" }), [policies]);
  const insurers = useMemo(() => insurerBreakdown(policies), [policies]);
  const agencies = useMemo(() => agencyBreakdown(policies), [policies]);
  const conflicts = useMemo(() => spellingConflicts(policies), [policies]);
  const queue = useMemo(() => policyQueue(policies, asOf), [policies, asOf]);

  const insurerNames = useMemo(
    () => [...new Set(policies.map((p) => p.insurerName).filter(Boolean))].sort(), [policies]);
  const agencyNames = useMemo(
    () => [...new Set(policies.map((p) => p.agencyName).filter(Boolean))].sort(), [policies]);

  const rows = useMemo(() => {
    const needle = q.trim();
    return policies
      .map((p) => ({ p, st: policyStatus(p, asOf) }))
      .filter(({ p, st }) => {
        if (status !== "all" && st.status !== status) return false;
        if (insurer !== "all" && (p.insurerName || "") !== insurer) return false;
        if (!needle) return true;
        const hay = [p.sourceAddress, p.street, p.city, p.insurerName, p.agencyName,
                     p.committeeName, p.customerNumber, p.notes].join(" ");
        return hay.includes(needle);
      })
      .sort((a, b) => (a.st.endDate || "9999").localeCompare(b.st.endDate || "9999"));
  }, [policies, status, insurer, q, asOf]);

  /** פוליסות בלי בניין — אזור ההתאמה הידנית. */
  const unlinked = useMemo(() => {
    const index = buildBuildingIndex(data.buildings || []);
    return policies
      .filter((p) => !p.buildingIds?.length)
      .map((p) => ({ p, match: matchPolicyToBuilding(p, data.buildings || [], index) }));
  }, [policies, data.buildings]);

  const save = (id, patch) => { if (!readOnly) update("policies", id, patch); };

  // --- ייבוא: מתכננים, לא מבצעים ------------------------------------------
  //
  // ⚠ **`applyBatch` ולעולם לא `replaceAll`.** קובץ הביטוחים אינו מכיל
  // בניינים, חוזים או הערות — החלפה מלאה לפיו הייתה מוחקת את כל המערכת.
  const handleFile = async (file) => {
    setImportError(""); setPending(null);
    if (!file) return;
    setBusy(true);
    try {
      const wb = XLSX.read(await file.arrayBuffer());
      const result = importInsurance(wb, file.name, data.buildings || []);
      if (!result.ok) {
        setImportError(result.error ||
          `${result.failed.length} מבחני עקביות נכשלו — לא נטען דבר. הייבוא אינו מייצר תמונה חלקית.`);
        return;
      }
      setPending(result);
    } catch (e) {
      setImportError(`קריאת הקובץ נכשלה: ${e.message}`);
    } finally { setBusy(false); }
  };

  const applyImport = () => {
    if (!pending) return;
    applyBatch("policies", { creates: pending.payload.policies.map(makePolicy) });
    setPending(null);
  };

  const removePolicy = (p) => {
    const guard = canDeletePolicy(p);
    if (!guard.ok) { alert(guard.reason); return; }
    remove("policies", p.id);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <IconUmbrella className="h-5 w-5 text-slate-500" /> ביטוחים
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {policies.length} פוליסות. הפרמיה <b>אינה</b> נכנסת לחישוב הרווחיות —
            ברוב הבניינים הוועד משלם אותה ישירות.
          </p>
        </div>
        {!readOnly && (
          <div>
            <Button onClick={() => fileRef.current?.click()} disabled={busy}>
              <IconUpload /> {busy ? "קורא…" : "ייבוא אקסל ביטוחים"}
            </Button>
            <input ref={fileRef} type="file" accept=".xlsx,.xlsm,.xls" className="hidden"
              onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ""; }} />
          </div>
        )}
      </header>

      {importError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{importError}</p>
      )}

      {pending && <ImportPreview result={pending} onApply={applyImport} onCancel={() => setPending(null)} existing={policies.length} />}

      {policies.length === 0 && !pending && (
        <div className="card p-8 text-center text-sm text-slate-500">
          עדיין אין פוליסות. ייבא את אקסל הביטוחים כדי להתחיל.
        </div>
      )}

      {policies.length > 0 && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="פג תוקף" value={summary.counts.overdue}
              tone={summary.counts.overdue ? "bad" : "good"}
              hint={summary.counts.overdue ? "כיסוי שאינו בתוקף — לטיפול מיידי" : "אין"} />
            <StatTile label="מסתיימות ב-90 יום" value={summary.counts.dueSoon}
              tone={summary.counts.dueSoon ? "warn" : "good"} hint="חלון היערכות לחידוש" />
            <StatTile label="ללא תאריך" value={summary.counts.never}
              tone={summary.counts.never ? "warn" : "good"}
              hint="לא ״בתוקף״ ולא ״פג״ — חוסר מידע שעלול להסתיר חוסר כיסוי" />
            <StatTile label="סה״כ פרמיה שנתית" value={fmtILS(totals.annualPremium)}
              hint={`${totals.unpricedCount} בלי סכום · ויצמן משלמת ${fmtILS(vitzmanPays.annualPremium)}`} />
          </div>

          {conflicts.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <IconWarning className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <b>אותה חברה נכתבת בשני אופנים.</b>
                <p className="mt-1">
                  {conflicts.map((c) => c.variants.map((v) => `${v.name} (${v.count})`).join(" · ")).join(" | ")}
                  {" — "}הפילוח סופר אותן בנפרד. <b>לא מוזג אוטומטית:</b> שינוי שם
                  חברה משנה מספרים, וההכרעה שלך. תקן את השם בשורות הרלוונטיות בטבלה.
                </p>
              </div>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <Breakdown title="לפי חברת ביטוח" rows={insurers} total={totals.annualPremium}
              hint="זו התשובה ל״אם ארצה להחליף״ — כמה כסף ובכמה פוליסות מחזיקה כל חברה." />
            <Breakdown title="לפי סוכנות" rows={agencies} total={totals.annualPremium} />
          </div>

          {queue.length > 0 && (
            <section className="card p-4">
              <h3 className="text-sm font-semibold">תור הטיפול — {queue.length} פוליסות</h3>
              <ul className="mt-2 space-y-1 text-sm">
                {queue.slice(0, 8).map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-2">
                    <StatusChip status={r.status} />
                    <span>{r.policy?.sourceAddress || "—"}</span>
                    <span className="text-slate-500">
                      {r.endDate ? `${fmtDate(r.endDate)} · ${fmtRelative(r.daysUntil)}` : "אין תאריך סיום בקובץ"}
                    </span>
                  </li>
                ))}
              </ul>
              {queue.length > 8 && (
                <p className="mt-2 text-xs text-slate-500">ועוד {queue.length - 8}. הטבלה למטה ממוינת לפי מועד.</p>
              )}
            </section>
          )}

          {/* --- סינון --- */}
          <div className="flex flex-wrap items-center gap-2">
            <Chip active={status === "all"} onClick={() => setStatus("all")}>הכל ({policies.length})</Chip>
            {["overdue", "dueSoon", "never", "ok"].map((s) => (
              <Chip key={s} active={status === s} onClick={() => setStatus(s)}>
                {POLICY_STATUS_LABEL[s]} ({summary.counts[s]})
              </Chip>
            ))}
            <select value={insurer} onChange={(e) => setInsurer(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1 text-sm">
              <option value="all">כל החברות</option>
              {insurerNames.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <label className="flex items-center gap-1.5 rounded border border-slate-300 px-2 py-1 text-sm">
              <IconSearch className="h-3.5 w-3.5 text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="כתובת, ועד, מספר לקוח…"
                className="w-44 outline-none" />
            </label>
            <span className="text-xs text-slate-500">{rows.length} מוצגות</span>
          </div>

          <PolicyTable
            rows={rows} readOnly={readOnly} save={save} onRemove={removePolicy}
            buildingById={buildingById} onOpenBuilding={onOpenBuilding}
            insurerNames={insurerNames} agencyNames={agencyNames} />

          {unlinked.length > 0 && (
            <MatchingSection
              unlinked={unlinked} readOnly={readOnly}
              onLink={(policyId, buildingId) => save(policyId, { buildingIds: [buildingId] })} />
          )}
        </>
      )}
    </div>
  );
}

const Chip = ({ active, onClick, children }) => (
  <button type="button" onClick={onClick}
    className={`rounded-full border px-3 py-1 text-xs ${active
      ? "border-slate-900 bg-slate-900 text-white"
      : "border-slate-300 text-slate-600 hover:border-slate-500"}`}>
    {children}
  </button>
);

const STATUS_TONE = {
  overdue: "bg-red-50 text-red-700 border-red-200",
  dueSoon: "bg-amber-50 text-amber-800 border-amber-200",
  never: "bg-slate-100 text-slate-600 border-slate-300",
  ok: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const StatusChip = ({ status }) => (
  <span className={`rounded border px-1.5 py-0.5 text-[11px] ${STATUS_TONE[status]}`}>
    {POLICY_STATUS_LABEL[status]}
  </span>
);

function Breakdown({ title, rows, total, hint }) {
  return (
    <section className="card p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      <table className="mt-2 w-full text-sm">
        <thead>
          <tr className="text-xs text-slate-500">
            <th className="text-right font-medium">שם</th>
            <th className="text-right font-medium">פוליסות</th>
            <th className="text-right font-medium">פרמיה שנתית</th>
            <th className="text-right font-medium">חלק</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-t border-slate-100">
              <td className="py-1">{r.name}</td>
              <td className="tnum py-1">{r.count}</td>
              <td className="tnum py-1">{fmtILS(r.annualPremium)}</td>
              <td className="tnum py-1 text-slate-500">
                {total ? `${Math.round((r.annualPremium / total) * 100)}%` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function PolicyTable({ rows, readOnly, save, onRemove, buildingById, onOpenBuilding, insurerNames, agencyNames }) {
  const payerOptions = POLICY_PAYERS.map((v) => ({ value: v, label: POLICY_PAYER_LABEL[v] }));
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[1100px] text-sm">
        <thead className="bg-slate-50 text-xs text-slate-600">
          <tr>
            <th className="p-2 text-right font-medium">מצב</th>
            <th className="p-2 text-right font-medium">כתובת בקובץ</th>
            <th className="p-2 text-right font-medium">בניין במערכת</th>
            <th className="p-2 text-right font-medium">חברת ביטוח</th>
            <th className="p-2 text-right font-medium">סוכנות</th>
            <th className="p-2 text-right font-medium">מי משלם</th>
            <th className="p-2 text-right font-medium" title="שאלה נפרדת ממי משלם">כלול בדמי הניהול</th>
            <th className="p-2 text-right font-medium">סיום</th>
            <th className="p-2 text-right font-medium">פרמיה שנתית</th>
            <th className="p-2 text-right font-medium">מבנה</th>
            <th className="p-2 text-right font-medium">ועד</th>
            <th className="p-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map(({ p, st }) => {
            const b = p.buildingIds?.[0] ? buildingById.get(p.buildingIds[0]) : null;
            return (
              <tr key={p.id} className="border-t border-slate-100 align-top">
                <td className="p-2"><StatusChip status={st.status} /></td>
                <td className="p-2">
                  <div>{p.sourceAddress || "—"}</div>
                  <div className="text-xs text-slate-400">{p.city || "—"}{p.customerNumber ? ` · ${p.customerNumber}` : ""}</div>
                </td>
                <td className="p-2">
                  {b ? (
                    <button type="button" className="text-slate-700 underline decoration-dotted"
                      onClick={() => onOpenBuilding?.(b.id)}>{b.address}</button>
                  ) : <span className="text-amber-700">לא משויך</span>}
                </td>
                <td className="p-2">
                  <EditableField value={p.insurerName} readOnly={readOnly} suggestions={insurerNames}
                    placeholder="(לא רשום)" onSave={(v) => save(p.id, { insurerName: v })} />
                </td>
                <td className="p-2">
                  <EditableField value={p.agencyName} readOnly={readOnly} suggestions={agencyNames}
                    placeholder="(לא רשום)" onSave={(v) => save(p.id, { agencyName: v })} />
                </td>
                <td className="p-2">
                  <EditableField type="select" value={p.payer} readOnly={readOnly} options={payerOptions}
                    placeholder="לא ידוע" onSave={(v) => save(p.id, { payer: v })} />
                </td>
                <td className="p-2">
                  <TriState value={p.includedInFee} readOnly={readOnly}
                    onChange={(v) => save(p.id, { includedInFee: v })} />
                </td>
                <td className="p-2">
                  <EditableField value={p.endDate || ""} readOnly={readOnly} placeholder="—"
                    title="YYYY-MM-DD"
                    validate={(v) => (!v || /^\d{4}-\d{2}-\d{2}$/.test(v)
                      ? { ok: true } : { ok: false, reason: "תאריך בפורמט YYYY-MM-DD" })}
                    onSave={(v) => save(p.id, { endDate: v || null })} />
                  {st.endDate && <div className="text-xs text-slate-400">{fmtRelative(st.daysUntil)}</div>}
                </td>
                <td className="p-2">
                  <EditableField type="number" value={p.premiumAnnual ?? ""} readOnly={readOnly}
                    placeholder="—" className="w-24"
                    onSave={(v) => save(p.id, { premiumAnnual: v })} />
                </td>
                <td className="p-2">
                  <TriState value={p.hasStructureCover} readOnly={readOnly}
                    onChange={(v) => save(p.id, { hasStructureCover: v })} />
                </td>
                <td className="p-2 text-xs">
                  <div>{p.committeeName || "—"}</div>
                  <div className="text-slate-400">{p.committeePhone || ""}</div>
                </td>
                <td className="p-2">
                  {!readOnly && (
                    <button type="button" title="מחיקת פוליסה" onClick={() => onRemove(p)}
                      className="text-slate-400 hover:text-red-700"><IconTrash /></button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * ⚠ **תלת-ערכי, ולא תיבת סימון.** ״לא ידוע״ אינו ״לא״: 12 שורות בקובץ ריקות
 * בעמודת ״קיים-מבנה״, ו״כלול בדמי הניהול״ אינו קיים בקובץ בכלל. תיבת סימון
 * הייתה הופכת את כולן ל״לא״ ביום הייבוא, בלי שאיש יחליט על כך.
 */
function TriState({ value, onChange, readOnly }) {
  return (
    <select
      value={value === true ? "yes" : value === false ? "no" : ""}
      disabled={readOnly}
      onChange={(e) => onChange(e.target.value === "yes" ? true : e.target.value === "no" ? false : null)}
      className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-sm disabled:bg-slate-50"
    >
      <option value="">לא ידוע</option>
      <option value="yes">כן</option>
      <option value="no">לא</option>
    </select>
  );
}

/** תצוגה מקדימה לפני החלה — אותו דפוס ״לתכנן, לא לבצע״ של שאר המסכים. */
function ImportPreview({ result, onApply, onCancel, existing }) {
  const { checks, payload } = result;
  const meta = payload.meta;
  return (
    <section className="card border-slate-900 p-4">
      <h3 className="text-sm font-semibold">
        נקראו {payload.policies.length} פוליסות — טרם נשמרו
      </h3>
      {existing > 0 && (
        <p className="mt-1 flex items-start gap-1.5 text-sm text-amber-800">
          <IconWarning className="mt-0.5 h-4 w-4 shrink-0" />
          כבר יש {existing} פוליסות במערכת. הייבוא <b>מוסיף</b> ואינו מחליף —
          תקבל כפילויות אם זה אותו קובץ. מחק את הקיימות תחילה אם התכוונת להחליף.
        </p>
      )}
      <ul className="mt-2 grid gap-0.5 text-xs sm:grid-cols-2">
        {checks.map((c) => (
          <li key={c.name} className={c.informational ? "text-slate-500" : "text-emerald-700"}>
            {c.informational ? "·" : "✓"} {c.name}:{" "}
            <span className="tnum">{typeof c.actual === "number" ? c.actual.toLocaleString("he-IL") : String(c.actual)}</span>
          </li>
        ))}
      </ul>

      {meta.legendRows?.length > 0 && (
        <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
          <b>{meta.legendRows.length} שורות בסוף הקובץ אינן פוליסות אלא מקרא צבעים</b> — דולגו:
          <ul className="mt-1">{meta.legendRows.map((l) => <li key={l.sheetRow}>· שורה {l.sheetRow}: {l.text}</li>)}</ul>
          <p className="mt-1">
            ⚠ המקרא מלמד שהצבע נושא מידע שאין באף עמודה (״משלמים חלקית״, ״דואגים
            לתשלום מחשבון הוועד״). הוא <b>לא יובא</b>, כי הוא קיים רק בצבע התא.
          </p>
        </div>
      )}

      {meta.variantMatches?.length > 0 && (
        <details className="mt-3 text-xs text-slate-600">
          <summary className="cursor-pointer">
            {meta.variantMatches.length} התאמות נשענו על ווריאנט של שם רחוב — לבדיקתך
          </summary>
          <ul className="mt-1 space-y-0.5">
            {meta.variantMatches.map((v) => (
              <li key={v.sourceRow}>· ״{v.policy}״ → ״{v.building}״</li>
            ))}
          </ul>
        </details>
      )}

      <div className="mt-3 flex gap-2">
        <Button variant="primary" onClick={onApply}>שמירת {payload.policies.length} הפוליסות</Button>
        <Button onClick={onCancel}>ביטול</Button>
      </div>
    </section>
  );
}

/**
 * ⚠ **ההתאמה ידנית בכוונה.** הייבוא משייך רק כשהזיווג בין הכניסות חד-חד-ערכי;
 * מה שנשאר כאן הוא בדיוק המקומות שבהם שיוך אוטומטי היה עלול להיות שגוי —
 * ״אינשטיין 12״ מול ״אינשטיין 12+14״. שיוך שגוי בשקט גרוע מחוסר שיוך.
 */
function MatchingSection({ unlinked, readOnly, onLink }) {
  return (
    <section className="card p-4">
      <h3 className="text-sm font-semibold">התאמה לבניינים — {unlinked.length} ללא שיוך</h3>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">
        הקישור משמש לניווט בלבד ו<b>אינו מזרים את הפרמיה</b> לעלות הבניין.
        פוליסה בלי שיוך נשארת פעילה ברשימה.
      </p>
      <table className="mt-3 w-full text-sm">
        <tbody>
          {unlinked.map(({ p, match }) => (
            <tr key={p.id} className="border-t border-slate-100">
              <td className="py-2">
                <div>{p.sourceAddress || "—"}</div>
                <div className="text-xs text-slate-400">{p.city || "—"} · שורה {p.sourceRow ?? "—"}</div>
              </td>
              <td className="py-2">
                {match.candidates.length === 0 ? (
                  <span className="text-xs text-slate-400">אין בניין דומה ברשימה</span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {match.candidates.map((c) => (
                      <button key={c.id} type="button" disabled={readOnly}
                        onClick={() => onLink(p.id, c.id)}
                        className="rounded-full border border-slate-300 px-2.5 py-1 text-xs
                          hover:border-slate-900 hover:bg-slate-900 hover:text-white
                          disabled:cursor-not-allowed disabled:opacity-50">
                        {c.address}
                      </button>
                    ))}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

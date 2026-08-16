import { useMemo, useRef, useState } from "react";
import {
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  ShieldAlert,
  CalendarClock,
  CheckCircle2,
  Ban,
  Info,
  Building2,
  Users,
} from "lucide-react";
import { useI18n } from "../hooks/useI18n.jsx";
import Card, { EmptyState, Stat } from "./ui/Card.jsx";
import Button from "./ui/Button.jsx";
import Pill from "./ui/Pill.jsx";
import { Checkbox, Select } from "./ui/Field.jsx";
import { readGrid, listSheets, isExcludedSheet } from "../utils/importWorkbook.js";
import { analyzeImport, driverMergeGroups, mergedRowNumbers, COST_MIN, COST_MAX } from "../utils/importExcel.js";
import { buildImportWrite } from "../utils/importBuild.js";
import { formatCurrency, formatDate } from "../utils/format.js";
import { isFirebaseConfigured } from "../firebase.js";

// ============================================================================
// מסך 6 — ייבוא מהאקסל.
//
// שלושה שלבים קשיחים: בחירת קובץ → **תצוגה מקדימה מלאה** → אישור וכתיבה.
// אין מסלול שעוקף את התצוגה המקדימה; זו כל הנקודה. המשתמש רואה לפני השמירה
// מה ייווצר, מה סומן לבדיקה ולמה, ומה נדחה — כולל הערך המקורי מהקובץ.
// ============================================================================
export default function ImportScreen({ data, orgId, actions, onDone }) {
  const { t, lang } = useI18n();
  const fileRef = useRef(null);

  const [file, setFile] = useState(null);
  const [sheets, setSheets] = useState([]);
  const [sheet, setSheet] = useState("");
  const [grid, setGrid] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  // M3 — לא רק "האם אושר" אלא **מתי**: חותמת הזמן היא של רגע ההצהרה, לא של
  // רגע הכתיבה. היא נשמרת ל-settings.importAck כשהייבוא מבוצע.
  const [ack, setAck] = useState(null); // null = לא אושר · ISO = מתי אושר
  const [result, setResult] = useState(null);

  const plan = useMemo(() => {
    if (!grid) return null;
    return analyzeImport(grid, data, { fileName: file?.name || null, sheet });
  }, [grid, data, file, sheet]);

  const loadSheet = async (f, name) => {
    setBusy(true);
    setError(null);
    try {
      const res = await readGrid(f, name);
      setSheet(res.sheet);
      setSheets(res.sheets);
      setGrid(res.rows);
    } catch (err) {
      console.error("xlsx read failed", err);
      setError("importx.err.read");
      setGrid(null);
    } finally {
      setBusy(false);
    }
  };

  const pickFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setFile(f);
    setResult(null);
    setAck(null); // כל בחירת קובץ מאפסת את ההצהרה — היא נוגעת לקובץ הזה
    setBusy(true);
    setError(null);
    try {
      const names = await listSheets(f);
      // ברירת מחדל: הגיליון הראשון שאינו מוחרג. בקובץ האמיתי זה הגיליון
      // הנוכחי; 36 האחרים הם snapshots היסטוריים.
      const first = names.find((n) => !isExcludedSheet(n)) || names[0];
      setSheets(names);
      await loadSheet(f, first);
    } catch (err) {
      console.error("xlsx sheet list failed", err);
      setError("importx.err.read");
      setBusy(false);
    }
  };

  const changeSheet = async (name) => {
    if (!file) return;
    if (isExcludedSheet(name)) {
      setError("importx.err.excludedSheet");
      return;
    }
    setResult(null);
    await loadSheet(file, name);
  };

  const confirm = async () => {
    if (!plan?.ok) return;
    // M3 — שער אמיתי, לא רק כפתור מעומעם: בלי הצהרה אין ייבוא, ובלי רישום
    // ההצהרה אין ראיה. שתי הבדיקות באותו מקום.
    if (!ack) {
      setError("importx.err.noAck");
      return;
    }
    setBusy(true);
    try {
      const built = buildImportWrite(plan, { orgId, data });
      await actions.applyImport(built, {
        at: ack,
        policyVersion: data.settings?.policyVersion || null,
        file: file?.name || null,
        sheet: sheet || null,
      });
      setResult(built.summary);
      setGrid(null);
      setFile(null);
      setSheets([]);
    } catch (err) {
      console.error("import write failed", err);
      setError("importx.err.read");
    } finally {
      setBusy(false);
    }
  };

  // ---- מסך סיום -----------------------------------------------------------
  if (result) {
    return (
      <div className="space-y-4">
        <Header t={t} />
        <Card>
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <CheckCircle2 size={32} className="text-emerald-600" />
            <h3 className="text-base font-semibold text-slate-900">{t("importx.done.title")}</h3>
            <p className="max-w-xl text-sm text-slate-600">{t("importx.done.body", result)}</p>
            <div className="flex gap-2">
              <Button onClick={onDone}>{t("importx.done.goVehicles")}</Button>
              <Button variant="secondary" onClick={() => setResult(null)}>
                {t("importx.reanalyze")}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Header t={t} />

      {/* -- בחירת קובץ + גיליון -- */}
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => fileRef.current?.click()} disabled={busy}>
            <Upload size={15} />
            {busy ? t("importx.reading") : file ? t("importx.reanalyze") : t("importx.choose")}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={pickFile}
          />
          {file && (
            <span className="inline-flex items-center gap-1.5 text-sm text-slate-700">
              <FileSpreadsheet size={15} className="text-slate-400" />
              {file.name}
            </span>
          )}
          <span className="text-xs text-slate-500">{t("importx.dropHint")}</span>
        </div>

        {sheets.length > 0 && (
          <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">{t("importx.sheet")}</span>
              <Select value={sheet} onChange={(e) => changeSheet(e.target.value)} className="min-w-48">
                {sheets.map((s) => (
                  <option key={s} value={s} disabled={isExcludedSheet(s)}>
                    {s}
                    {isExcludedSheet(s) ? ` — ${t("importx.sheetExcluded")}` : ""}
                  </option>
                ))}
              </Select>
            </label>
            <p className="text-xs text-slate-500">{t("importx.sheetHint", { n: sheets.length })}</p>
          </div>
        )}

        {sheets.some(isExcludedSheet) && (
          <p className="mt-2 flex items-start gap-1.5 rounded border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] text-slate-600">
            <Ban size={13} className="mt-px shrink-0 text-slate-400" />
            {t("importx.sheetExcludedNote")}
          </p>
        )}

        {error && (
          <p className="mt-3 flex items-center gap-1.5 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertTriangle size={15} /> {t(error)}
          </p>
        )}
      </Card>

      {!plan && !busy && !error && (
        <Card>
          <EmptyState title={t("importx.emptyTitle")} hint={t("importx.emptyHint")} />
        </Card>
      )}

      {plan && !plan.ok && (
        <Card>
          <p className="flex items-start gap-2 text-sm text-red-700">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            {t(plan.errorKey)}
          </p>
        </Card>
      )}

      {plan?.ok && <Preview plan={plan} t={t} lang={lang} />}

      {plan?.ok && (
        <Card>
          {/* D-Import / סעיף 5.5 בסקירת עדי — יידוע העובדים לפני הרישום */}
          <div className="rounded border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-start gap-2">
              <ShieldAlert size={16} className="mt-0.5 shrink-0 text-amber-700" />
              <div>
                <div className="text-xs font-semibold text-amber-900">{t("importx.privacy.title")}</div>
                <p className="mt-1 text-xs text-amber-900">{t("importx.privacy.body")}</p>
                {!isFirebaseConfigured && (
                  <p className="mt-1 text-xs text-amber-800">{t("importx.privacy.demo")}</p>
                )}
                <div className="mt-2">
                  <Checkbox
                    label={t("importx.privacy.ack")}
                    checked={Boolean(ack)}
                    onChange={(e) => setAck(e.target.checked ? new Date().toISOString() : null)}
                  />
                </div>
                {/* M3 — אומרים למשתמש שההצהרה נרשמת. הצהרה שנרשמת בלי ידיעתו
                    היא לא ראיה טובה יותר, היא רק פחות הוגנת. */}
                <p className="mt-1 text-[11px] text-amber-800">{t("importx.privacy.ackRecorded")}</p>
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
            {plan.counts.vehiclesToCreate === 0 && (
              <span className="me-auto text-xs text-slate-500">{t("importx.nothingToDo")}</span>
            )}
            <Button variant="secondary" onClick={() => { setGrid(null); setFile(null); setSheets([]); }}>
              {t("importx.cancel")}
            </Button>
            <Button onClick={confirm} disabled={!ack || busy || plan.counts.vehiclesToCreate === 0}>
              {busy ? t("importx.working") : t("importx.confirm")}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function Header({ t }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900">{t("importx.title")}</h2>
      <p className="text-sm text-slate-500">{t("importx.subtitle")}</p>
    </div>
  );
}

// ============================================================================
// התצוגה המקדימה — כל מה שהמשתמש חייב לראות לפני שהוא לוחץ "ייבוא"
// ============================================================================
export function Preview({ plan, t, lang }) {
  const c = plan.counts;
  const reviewRows = plan.rows.filter((r) => r.action === "create" && r.assignment?.needsReview);
  // M6 — מיזוג לפי שם: מה יתמזג, לאיזו רשומה, ובאילו שורות.
  const merges = driverMergeGroups(plan);
  const mergedRows = mergedRowNumbers(plan);

  return (
    <div className="space-y-4">
      {/* -- מה ייווצר -- */}
      <Card title={t("importx.willCreate")}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label={t("importx.vehicles")} value={c.vehiclesToCreate} tone="blue" />
          <Stat label={t("importx.drivers")} value={c.driversToCreate} tone="blue" />
          <Stat label={t("importx.assignments")} value={c.assignmentsToCreate} tone="blue" />
          <Stat label={t("importx.leaseCompanies")} value={c.leaseCompaniesToCreate} tone="blue" />
          <Stat
            label={t("importx.needsReviewCount")}
            value={c.needsReview}
            tone={c.needsReview ? "amber" : "slate"}
          />
          <Stat
            label={t("importx.rejectedCount")}
            value={c.rejectedValues}
            tone={c.rejectedValues ? "red" : "slate"}
          />
          <Stat label={t("importx.skippedCount")} value={c.skippedRows} />
          <Stat
            label={t("importx.alreadyExists")}
            value={c.vehiclesExisting + c.vehiclesDuplicateInFile}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
          <span>
            {t("importx.costsImported")}: <b className="num text-slate-700">{c.costsImported}</b>
          </span>
          <span>
            {t("importx.costsMissing")}: <b className="num text-slate-700">{c.costsMissing}</b>
          </span>
          <span>
            {t("importx.poolCount")}: <b className="num text-slate-700">{c.poolVehicles}</b>
          </span>
        </div>
      </Card>

      {/* -- ההחלטה על תאריך תחילת ההחזקה -- */}
      {c.inferredFromDates > 0 && (
        <div className="rounded-md border border-brand-200 bg-brand-50 p-3">
          <div className="flex items-start gap-2">
            <CalendarClock size={16} className="mt-0.5 shrink-0 text-brand-700" />
            <div>
              <div className="text-xs font-semibold text-brand-800">{t("importx.inferred.title")}</div>
              <p className="mt-1 text-xs text-brand-900">
                {t("importx.inferred.body", { n: c.inferredFromDates })}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* -- שורות שסומנו לבדיקה -- */}
      <Card title={`${t("importx.needsReview.title")} (${reviewRows.length})`}>
        <p className="mb-3 text-xs text-slate-600">{t("importx.needsReview.intro")}</p>
        {reviewRows.length === 0 ? (
          <p className="text-sm text-slate-500">{t("importx.noNeedsReview")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-start text-xs text-slate-500">
                  <Th>{t("importx.col.row")}</Th>
                  <Th>{t("importx.col.plate")}</Th>
                  <Th>{t("importx.needsReview.raw")}</Th>
                  <Th>{t("importx.needsReview.why")}</Th>
                </tr>
              </thead>
              <tbody>
                {reviewRows.map((r) => (
                  <tr key={r.rowNumber} className="border-b border-slate-100 align-top">
                    <Td className="num text-slate-500">{r.rowNumber}</Td>
                    <Td className="num whitespace-nowrap">{r.plateRaw}</Td>
                    <Td>
                      <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-900">
                        {r.assignment.importRaw}
                      </span>
                      {r.status === "pool" && (
                        <Pill tone="blue" className="ms-1">
                          {t("vehicle.status.pool")}
                        </Pill>
                      )}
                    </Td>
                    <Td>
                      <ul className="space-y-0.5 text-xs text-slate-600">
                        {r.driverReasons.map((k) => (
                          <li key={k}>· {t(k)}</li>
                        ))}
                      </ul>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* -- מיזוג לפי שם (M6) -- */}
      <Card title={`${t("importx.merge.title")} (${merges.length})`}>
        <p className="mb-3 text-xs text-slate-600">{t("importx.merge.intro")}</p>
        {merges.length === 0 ? (
          <p className="text-sm text-slate-500">{t("importx.merge.none")}</p>
        ) : (
          <ul className="space-y-2">
            {merges.map((m) => (
              <li key={m.key} className="rounded border border-amber-200 bg-amber-50 p-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Users size={14} className="text-amber-700" />
                  <span className="text-sm font-medium text-amber-900">{m.name}</span>
                  <Pill tone="amber">
                    {t(m.kind === "existing" ? "importx.merge.existing" : "importx.merge.withinFile", {
                      n: m.rows.length,
                    })}
                  </Pill>
                  <span className="num text-xs text-amber-800">
                    {t("importx.merge.rows", { rows: m.rows.join(", ") })}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* -- ערכים שנדחו -- */}
      <Card title={`${t("importx.rejected.title")} (${plan.rejected.length})`}>
        <p className="mb-3 text-xs text-slate-600">{t("importx.rejected.intro")}</p>
        {plan.rejected.length === 0 ? (
          <p className="text-sm text-slate-500">{t("importx.noRejected")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <Th>{t("importx.col.row")}</Th>
                  <Th>{t("importx.col.plate")}</Th>
                  <Th>{t("importx.rejected.field")}</Th>
                  <Th>{t("importx.rejected.value")}</Th>
                  <Th>{t("importx.needsReview.why")}</Th>
                </tr>
              </thead>
              <tbody>
                {plan.rejected.map((r, i) => (
                  <tr key={`${r.rowNumber}_${r.field}_${i}`} className="border-b border-slate-100">
                    <Td className="num text-slate-500">{r.rowNumber}</Td>
                    <Td className="num whitespace-nowrap">{r.plate}</Td>
                    <Td className="text-xs text-slate-600">{t(`importx.col.${fieldKey(r.field)}`)}</Td>
                    <Td>
                      <code dir="ltr" className="rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-700">
                        {r.raw}
                      </code>
                    </Td>
                    <Td className="text-xs text-slate-600">
                      {t(r.reasonKey, { min: COST_MIN, max: COST_MAX })}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* -- חברות ליסינג -- */}
      {plan.leaseCompanies.length > 0 && (
        <Card title={t("importx.lease.title")}>
          <ul className="space-y-3">
            {plan.leaseCompanies.map((co) => (
              <li key={co.key} className="rounded border border-slate-200 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Building2 size={15} className="text-slate-400" />
                  <span className="text-sm font-semibold text-slate-800">{co.name}</span>
                  <Pill tone={co.action === "create" ? "green" : "slate"}>
                    {t(co.action === "create" ? "importx.action.create" : "importx.action.skipExisting")}
                  </Pill>
                  <span className="text-xs text-slate-500">{t("importx.lease.rows", { n: co.rows.length })}</span>
                </div>
                {co.variants.length > 1 && (
                  <p className="mt-1 text-xs text-slate-600">
                    {t("importx.lease.merged", { n: co.variants.length })} —{" "}
                    {co.variants.map((v) => `"${v}"`).join(" · ")}
                  </p>
                )}
                {co.contact && (co.contact.contactName || co.contact.phone || co.contact.email) && (
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-600">
                    <span className="font-medium text-slate-700">{t("importx.lease.contact")}:</span>
                    {co.contact.contactName && <span>{co.contact.contactName}</span>}
                    {co.contact.phone && <span dir="ltr" className="num">{co.contact.phone}</span>}
                    {co.contact.email && <span dir="ltr">{co.contact.email}</span>}
                    {co.contact.notes && <span className="text-slate-500">{co.contact.notes}</span>}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* -- שורות שדולגו -- */}
      {plan.skipped.length > 0 && (
        <Card title={`${t("importx.skipped.title")} (${plan.skipped.length})`}>
          <p className="mb-3 text-xs text-slate-600">{t("importx.skipped.intro")}</p>
          <ul className="space-y-1.5">
            {plan.skipped.map((s) => (
              <li key={s.rowNumber} className="flex flex-wrap items-baseline gap-2 text-xs">
                <span className="num text-slate-400">{t("importx.col.row")} {s.rowNumber}</span>
                <Pill tone="slate">{t(s.reasonKey)}</Pill>
                <code dir="auto" className="text-slate-600">{s.preview}</code>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* -- שורה אחר שורה -- */}
      <Card title={`${t("importx.preview.title")} (${plan.rows.length})`} padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
                <Th>{t("importx.col.row")}</Th>
                <Th>{t("importx.col.plate")}</Th>
                <Th>{t("importx.col.model")}</Th>
                <Th>{t("importx.col.driver")}</Th>
                <Th>{t("importx.col.dates")}</Th>
                <Th>{t("importx.col.cost")}</Th>
                <Th>{t("importx.col.result")}</Th>
              </tr>
            </thead>
            <tbody>
              {plan.rows.map((r) => (
                <tr key={r.rowNumber} className="border-b border-slate-100 hover:bg-slate-50">
                  <Td className="num text-slate-400">{r.rowNumber}</Td>
                  <Td className="num whitespace-nowrap font-medium text-slate-800">{r.plateRaw}</Td>
                  <Td className="whitespace-nowrap text-slate-700">{r.model || "—"}</Td>
                  <Td>
                    {r.driverKind === "name" ? (
                      <span className="inline-flex items-center gap-1 text-slate-800">
                        {r.driverName}
                        {/* M6 — השורה הזו תתמזג לרשומת נהג שכבר קיימת או
                            לשורה אחרת באותו שם. לא בשקט. */}
                        {mergedRows.has(r.rowNumber) && (
                          <Pill tone="amber" title={t("importx.merge.intro")}>
                            <Users size={11} className="me-1" />
                            {t("importx.merge.badge")}
                          </Pill>
                        )}
                      </span>
                    ) : r.driverKind === "freeText" ? (
                      <Pill tone="amber" title={r.driverRaw}>
                        <ShieldAlert size={11} className="me-1" />
                        {t("assign.needsReview")}
                      </Pill>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                    {r.status === "pool" && (
                      <Pill tone="blue" className="ms-1">{t("vehicle.status.pool")}</Pill>
                    )}
                  </Td>
                  <Td className="num whitespace-nowrap text-xs text-slate-600">
                    {formatDate(r.contractStart, lang)} → {formatDate(r.contractEnd, lang)}
                  </Td>
                  <Td className="num whitespace-nowrap">
                    {r.monthlyCostRejected ? (
                      <span className="inline-flex items-center gap-1 text-xs text-red-600">
                        <Ban size={12} />
                        {t(r.monthlyCostRejected.reasonKey, { min: COST_MIN, max: COST_MAX })}
                      </span>
                    ) : r.monthlyCost === null ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      formatCurrency(r.monthlyCost, lang)
                    )}
                  </Td>
                  <Td className="whitespace-nowrap">
                    <Pill tone={r.action === "create" ? "green" : "slate"}>
                      {t(`importx.action.${r.action}`)}
                    </Pill>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="flex items-start gap-1.5 border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500">
          <Info size={13} className="mt-px shrink-0" />
          {t("importx.inferredBadge")} · {t("importx.dropHint")}
        </p>
      </Card>
    </div>
  );
}

const FIELD_KEYS = { monthlyCost: "cost", contractStart: "dates", contractEnd: "dates", plate: "plate" };
function fieldKey(f) {
  return FIELD_KEYS[f] || "row";
}

function Th({ children }) {
  return <th className="px-3 py-2 text-start font-medium">{children}</th>;
}
function Td({ children, className = "" }) {
  return <td className={`px-3 py-2 ${className}`}>{children}</td>;
}

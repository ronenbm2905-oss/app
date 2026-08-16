import { useMemo, useState } from "react";
import { Lightbulb, ScrollText, Split, CheckCircle2, AlertTriangle, UserPlus, Users } from "lucide-react";
import { useI18n } from "../../hooks/useI18n.jsx";
import Card from "../ui/Card.jsx";
import Button from "../ui/Button.jsx";
import Pill from "../ui/Pill.jsx";
import Field, { DateInput, Select, TextInput, Checkbox } from "../ui/Field.jsx";
import {
  emptyResolution,
  validateResolution,
  splitPreview,
  applyNameSuggestion,
  applyDateSuggestion,
  applySplitSuggestion,
  applyPoolSuggestion,
  changeFromDate,
  nameMatchInfo,
  NEW_DRIVER as NEW,
} from "../../utils/review.js";
import { parseImportRaw } from "../../utils/reviewParse.js";
import { classifyDriverCell } from "../../utils/importExcel.js";
import { driverName, vehicleLabel } from "../../utils/options.js";
import { formatDate } from "../../utils/format.js";

// ============================================================================
// ReviewItem — החזקה אחת שסומנה לבדיקה, על כל המסלול שלה:
// הטקסט המקורי → הסיבות שבגללן סומנה → הצעה (לא החלה!) → טופס פתרון.
//
// הפרדה שהיא כל הרעיון: הבלוק הצהוב הוא **מה שכתוב באקסל**, הבלוק הכחול הוא
// **מה שהמערכת מנחשת**, והטופס הלבן הוא **מה שהאדמין קובע**. שום ערך לא זולג
// מהראשון לשלישי בלי לחיצה מפורשת.
// ============================================================================
export default function ReviewItem({ assignment, data, onResolve }) {
  const { t, lang } = useI18n();
  const [draft, setDraft] = useState(() => emptyResolution(assignment));
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);

  const parsed = useMemo(() => parseImportRaw(assignment.importRaw), [assignment.importRaw]);
  const reasons = useMemo(
    () => classifyDriverCell(assignment.importRaw).reasons || [],
    [assignment.importRaw]
  );
  // ------------------------------------------------------------------------
  // M2 (שער עדי, 2026-08-13) — **רשימה אחת: כל הנהגים.**
  // קודם היו כאן שתי רשימות: המחזיק הנוכחי נבחר מתוך פעילים בלבד, והמחזיק
  // הקודם מתוך כולם. התוצאה: שם של עובד שעזב לא נמצא, המסך הציע "נהג חדש",
  // ומתחת ל-UI השכבה שכותבת בכל זאת התאימה מול כל הנהגים. גם כפילות של
  // עוזבים וגם פער בין המוצג לנכתב. הסטטוס מוצג ליד כל שם, והמיזוג מסומן.
  // ------------------------------------------------------------------------
  const allDrivers = useMemo(() => data.drivers || [], [data.drivers]);
  const preview = splitPreview(assignment, draft.fromDate);
  const resolved = !assignment.needsReview;

  // -- החלת הצעה: תמיד יזומה בלחיצה, אף פעם לא ב-effect --------------------
  // הטרנספורמציות עצמן יושבות ב-utils/review.js כפונקציות טהורות ומכוסות
  // בבדיקות; כאן רק החיווט לכפתור.
  const applyName = () =>
    setDraft((d) => applyNameSuggestion(d, parsed.nameSuggestion.text, allDrivers));
  const applyDate = () => setDraft((d) => applyDateSuggestion(d, parsed.suggestedFromDate));
  const applySplit = () =>
    setDraft((d) => applySplitSuggestion(d, parsed.formerSuggestion.text, allDrivers));
  const applyPool = () => setDraft((d) => applyPoolSuggestion(d));
  const changeDate = (v) => setDraft((d) => changeFromDate(d, assignment, v));

  const submit = async () => {
    const errs = validateResolution(data, assignment, draft);
    setErrors(errs);
    if (errs.length) return;
    setBusy(true);
    const res = await onResolve(assignment.id, draft);
    setBusy(false);
    if (res && !res.ok) setErrors(res.errors);
  };

  return (
    <Card
      title={
        <span className="flex flex-wrap items-center gap-2">
          <span className="num">{vehicleLabel(data.vehicles, assignment.vehicleId)}</span>
          {resolved ? (
            <Pill tone="green">{t("reviewx.resolvedBadge")}</Pill>
          ) : (
            <Pill tone="amber">{t("assign.needsReview")}</Pill>
          )}
          {assignment.importSource?.row && (
            <span className="num text-xs font-normal text-slate-500">
              {t("reviewx.sourceRow", { n: assignment.importSource.row })}
            </span>
          )}
        </span>
      }
    >
      <div className="space-y-3">
        {/* -- 1. מה כתוב באקסל. שדה מבודד, נשאר גם אחרי הפתרון. -- */}
        <div className="rounded border border-amber-200 bg-amber-50 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-amber-900">
            <ScrollText size={14} />
            {t("reviewx.rawTitle")}
          </div>
          <p className="text-sm text-amber-900">{assignment.importRaw}</p>
          <p className="mt-1.5 text-[11px] text-amber-800">{t("reviewx.rawNote")}</p>
          {reasons.length > 0 && (
            <div className="mt-2 border-t border-amber-200 pt-2">
              <div className="mb-1 text-[11px] font-semibold text-amber-900">{t("reviewx.whyTitle")}</div>
              <ul className="flex flex-wrap gap-1">
                {reasons.map((r) => (
                  <li key={r}>
                    <Pill tone="amber">{t(r)}</Pill>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* -- 2. מה המערכת מנחשת. הצעה — לא החלטה. -- */}
        {!resolved &&
          (parsed.hasAnySuggestion ? (
            <div className="rounded border border-brand-200 bg-brand-50 p-3">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-brand-700">
                <Lightbulb size={14} />
                {t("reviewx.suggestionTitle")}
              </div>
              <p className="mb-2 text-[11px] text-brand-700">{t("reviewx.suggestionNote")}</p>
              <div className="flex flex-wrap items-center gap-2">
                {parsed.nameSuggestion && (
                  <SuggestionChip
                    label={t("reviewx.suggestName", { name: parsed.nameSuggestion.text })}
                    hint={`${t(parsed.nameSuggestion.viaKey, { cue: parsed.nameSuggestion.cue || "" })} · ${t(
                      `reviewx.confidence.${parsed.nameSuggestion.confidence}`
                    )}`}
                    action={t("reviewx.applyName")}
                    onApply={applyName}
                  />
                )}
                {parsed.suggestedFromDate && (
                  <SuggestionChip
                    label={t("reviewx.suggestDate", {
                      date: formatDate(parsed.suggestedFromDate, lang),
                    })}
                    hint={t("reviewx.suggestDateHint", { raw: parsed.dates[0]?.raw || "" })}
                    action={t("reviewx.applyDate")}
                    onApply={applyDate}
                  />
                )}
                {parsed.formerSuggestion && (
                  <SuggestionChip
                    label={t("reviewx.suggestFormer", { name: parsed.formerSuggestion.text })}
                    hint={t("reviewx.via.former")}
                    action={t("reviewx.applySplit")}
                    onApply={applySplit}
                    disabled={!parsed.suggestedFromDate}
                  />
                )}
                {parsed.isPool && (
                  <SuggestionChip
                    label={t("reviewx.suggestPool")}
                    hint={t("reviewx.suggestPoolHint")}
                    action={t("reviewx.applyPool")}
                    onApply={applyPool}
                  />
                )}
              </div>
              {/* M6 — למה הביטחון נמוך: אם השם נבחר **לפי מיקום** ולא אחרי
                  מילת-הקשר, זה ניחוש ולא זיהוי, וצריך להגיד את זה במילים. */}
              {parsed.nameSuggestion?.via === "position" && (
                <p className="mt-2 flex items-start gap-1.5 text-[11px] text-brand-700">
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                  {t("reviewx.confidencePositionNote")}
                </p>
              )}
              {parsed.nameSuggestion?.confidence === "low" && parsed.nameSuggestion?.via !== "position" && (
                <p className="mt-2 flex items-start gap-1.5 text-[11px] text-brand-700">
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                  {t("reviewx.confidenceLowNote")}
                </p>
              )}
            </div>
          ) : (
            <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              {t("reviewx.noSuggestion")}
            </p>
          ))}

        {/* -- 3. מה האדמין קובע -- */}
        {resolved ? (
          <ResolvedSummary assignment={assignment} data={data} />
        ) : (
          <div className="space-y-3 rounded border border-slate-200 p-3">
            <Field label={t("reviewx.modeLabel")}>
              <Select value={draft.mode} onChange={(e) => setDraft({ ...draft, mode: e.target.value, split: false })}>
                <option value="driver">{t("reviewx.mode.driver")}</option>
                <option value="pool">{t("reviewx.mode.pool")}</option>
              </Select>
            </Field>

            {draft.mode === "pool" ? (
              <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                {t("reviewx.poolNote")}
              </p>
            ) : (
              <DriverPicker
                drivers={allDrivers}
                idValue={draft.driverId}
                nameValue={draft.newDriverName}
                onId={(v) => setDraft({ ...draft, driverId: v })}
                onName={(v) => setDraft({ ...draft, newDriverName: v })}
                label={t("reviewx.holder")}
              />
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("reviewx.fromDate")} required hint={t("reviewx.fromDateHint")}>
                <DateInput value={draft.fromDate || ""} onChange={(e) => changeDate(e.target.value)} />
              </Field>
              <div className="flex items-end">
                <Checkbox
                  label={t("reviewx.keepInferred")}
                  checked={Boolean(draft.fromDateInferred)}
                  onChange={(e) => setDraft({ ...draft, fromDateInferred: e.target.checked })}
                />
              </div>
            </div>

            {/* -- פיצול: הערך האמיתי של המסך -- */}
            {draft.mode === "driver" && (
              <div className="rounded border border-slate-200 bg-slate-50 p-3">
                <Checkbox
                  label={t("reviewx.split")}
                  checked={draft.split}
                  onChange={(e) => setDraft({ ...draft, split: e.target.checked })}
                />
                <p className="mt-1 text-[11px] text-slate-600">{t("reviewx.splitNote")}</p>
                {draft.split && (
                  <div className="mt-3 space-y-3">
                    <DriverPicker
                      drivers={allDrivers}
                      idValue={draft.previousDriverId}
                      nameValue={draft.previousNewDriverName}
                      onId={(v) => setDraft({ ...draft, previousDriverId: v })}
                      onName={(v) => setDraft({ ...draft, previousNewDriverName: v })}
                      label={t("reviewx.splitPrevious")}
                    />
                    {preview && (
                      <div className="rounded border border-slate-200 bg-white p-2">
                        <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
                          <Split size={12} />
                          {t("reviewx.splitPreviewTitle")}
                        </div>
                        <ul className="space-y-1 text-xs text-slate-700">
                          <li className="num">
                            1 · {formatDate(preview.previous.fromDate, lang)} – {formatDate(preview.previous.toDate, lang)}
                          </li>
                          <li className="num">
                            2 · {formatDate(preview.current.fromDate, lang)} –{" "}
                            {preview.current.toDate ? formatDate(preview.current.toDate, lang) : t("assign.active")}
                          </li>
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {errors.length > 0 && (
              <ul className="space-y-1 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                {errors.map((e) => (
                  <li key={e}>{t(e)}</li>
                ))}
              </ul>
            )}

            <div className="flex items-center gap-2">
              <Button onClick={submit} disabled={busy}>
                <CheckCircle2 size={15} />
                {busy ? t("reviewx.saving") : t("reviewx.resolve")}
              </Button>
              <span className="text-[11px] text-slate-500">{t("reviewx.resolveHint")}</span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function SuggestionChip({ label, hint, action, onApply, disabled }) {
  return (
    <div className="flex items-center gap-2 rounded border border-brand-200 bg-white px-2.5 py-1.5">
      <div className="leading-tight">
        <div className="text-xs font-medium text-slate-800">{label}</div>
        {hint && <div className="text-[10px] text-slate-500">{hint}</div>}
      </div>
      <Button size="sm" variant="secondary" onClick={onApply} disabled={disabled}>
        {action}
      </Button>
    </div>
  );
}

// בחירת נהג קיים או יצירת נהג חדש inline — רוב השמות שביומן החילופים לא
// קיימים כרשומות, ושליחת האדמין למסך אחר כדי ליצור אותם הורגת את הזרימה.
//
// M6 — **מיזוג לפי שם חייב להיראות.** שם שהוקלד ומתאים לרשומה קיימת אינו
// יוצר נהג חדש אלא נתלה על אדם שכבר במאגר; בחברה עם שני עובדים באותו שם
// מלא זו הדרך לייחס עבירת תעבורה לאדם הלא-נכון. הרשימה כוללת את **כל**
// הנהגים (M2), ולכן גם עוזבים — והסטטוס מוצג ליד השם.
function DriverPicker({ drivers, idValue, nameValue, onId, onName, label }) {
  const { t } = useI18n();
  const match = idValue === NEW ? nameMatchInfo(drivers, nameValue) : null;
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <Field label={label} required>
        <Select value={idValue} onChange={(e) => onId(e.target.value)}>
          <option value="">{t("common.select")}</option>
          <option value={NEW}>{t("reviewx.driverNew")}</option>
          {drivers.map((d) => (
            // D6 — השם עובר דרך driverName כדי שעובד שעבר אנונימיזציה יוצג
            // כטוקן ולא בשמו.
            <option key={d.id} value={d.id}>
              {driverName([d], d.id, "—", t)}
              {d.status !== "active" ? ` · ${t(`driver.status.${d.status}`)}` : ""}
            </option>
          ))}
        </Select>
      </Field>
      {idValue === NEW && (
        <Field label={t("reviewx.newDriverName")} required hint={t("reviewx.newDriverNote")}>
          <TextInput
            value={nameValue}
            onChange={(e) => onName(e.target.value)}
            placeholder={t("reviewx.newDriverPh")}
          />
        </Field>
      )}
      {match?.merges && (
        <p className="flex items-start gap-1.5 rounded border border-amber-300 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900 sm:col-span-2">
          <Users size={12} className="mt-0.5 shrink-0" />
          <span>
            {t("reviewx.mergeNotice", { name: driverName(drivers, match.matchedId, "—", t) })}
            {match.inactive && ` ${t("reviewx.mergeInactive", { status: t(`driver.status.${match.matched.status}`) })}`}
            {match.ambiguous && ` ${t("reviewx.mergeAmbiguous", { n: match.count })}`}
          </span>
        </p>
      )}
    </div>
  );
}

function ResolvedSummary({ assignment, data }) {
  const { t, lang } = useI18n();
  const siblings = (data.assignments || []).filter((a) => a.reviewSplitFrom === assignment.id);
  return (
    <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
      <div className="mb-1 flex items-center gap-1.5 font-semibold">
        <CheckCircle2 size={14} />
        {t("reviewx.unblocked")}
      </div>
      <ul className="space-y-1">
        {siblings.map((s) => (
          <li key={s.id} className="num">
            {driverName(data.drivers, s.driverId, "—", t)} · {formatDate(s.fromDate, lang)} –{" "}
            {s.toDate ? formatDate(s.toDate, lang) : t("assign.active")}
          </li>
        ))}
        <li className="num">
          {assignment.driverId ? driverName(data.drivers, assignment.driverId, "—", t) : t("reviewx.mode.pool")} ·{" "}
          {formatDate(assignment.fromDate, lang)} –{" "}
          {assignment.toDate ? formatDate(assignment.toDate, lang) : t("assign.active")}
          {assignment.fromDateInferred && (
            <Pill tone="slate" className="ms-1.5">
              {t("importx.inferredBadge")}
            </Pill>
          )}
        </li>
      </ul>
      {assignment.reviewResolution === "pool" && (
        <p className="mt-1.5 flex items-center gap-1 text-[11px]">
          <UserPlus size={12} /> {t("reviewx.poolResolvedNote")}
        </p>
      )}
    </div>
  );
}

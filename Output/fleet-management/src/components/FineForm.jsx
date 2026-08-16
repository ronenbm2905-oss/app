import { useMemo, useState } from "react";
import { Info, AlertTriangle, CheckCircle2, ShieldAlert, Lock, CalendarClock } from "lucide-react";
import { useI18n } from "../hooks/useI18n.jsx";
import Modal from "./ui/Modal.jsx";
import Button from "./ui/Button.jsx";
import Field, { TextInput, NumberInput, DateInput, TimeInput, TextArea, Select, Checkbox } from "./ui/Field.jsx";
import FileInput from "./ui/FileInput.jsx";
import { createFine, createFineScan, emptyAttribution } from "../schema.js";
import { fineStatusOptions, driverName, vehicleLabel, adminNotesOf, scanForFine } from "../utils/options.js";
import { resolveDriverForFine } from "../utils/assignments.js";
import { validateFine, canTransition, hasNotice, NOTICE_REQUIRED_STATUS } from "../utils/fines.js";
import { formatDate } from "../utils/format.js";
import { STORAGE_DOMAINS } from "../constants.js";

// ============================================================================
// מסך 3 (טופס) — הזנת קנס. הליבה: שיוך הנהג **נגזר** מתאריך העבירה מול
// ה-Assignment שהיה תקף. עקיפה ידנית אפשרית אך מחייבת נימוק, ונרשמת בשרשרת
// הראיות (D5). הערת האדמין נשמרת במסמך פרטי (D1) והסריקה כישות נפרדת (D2).
// ============================================================================
export function FineForm({ open, onClose, data, orgId, fine, defaultVehicleId, onSave }) {
  const { t, lang } = useI18n();
  const [draft, setDraft] = useState(
    () => fine || createFine({ orgId, vehicleId: defaultVehicleId || null })
  );
  const [scan, setScan] = useState(() => (fine ? scanForFine(data, fine.id) : null));
  const [adminNotes, setAdminNotes] = useState(() => (fine ? adminNotesOf(data, fine.id) : ""));
  const [errors, setErrors] = useState([]);
  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }));

  const attribution = draft.attribution || emptyAttribution();
  const manual = attribution.source === "manual";

  // הגזירה מתעדכנת בכל שינוי של רכב/תאריך — זה מה שהמשתמש רואה בזמן אמת.
  const derivation = useMemo(
    () => resolveDriverForFine(data, draft.vehicleId, draft.violationDate),
    [data, draft.vehicleId, draft.violationDate]
  );

  const effectiveDriverId = manual ? draft.driverId : derivation.driverId;

  // ------------------------------------------------------------------------
  // M4 (שער עדי) — לעובד שלא קיבל יידוע מתועד אי אפשר למסור הודעה על קנס
  // ואי אפשר להסב אליו את הקנס. הבדיקה נעשית מול הנהג **האפקטיבי** (הנגזר
  // או הידני), ולכן היא מתעדכנת בזמן אמת עם שינוי הרכב/התאריך/העקיפה.
  // הקנס עצמו כן נרשם — החסימה היא על השלב שמייצר החלטה כלפי האדם.
  // ------------------------------------------------------------------------
  const effectiveDriver = (data.drivers || []).find((d) => d.id === effectiveDriverId) || null;
  const noticeBlocked = Boolean(effectiveDriver) && !hasNotice(effectiveDriver);

  const setAttribution = (patch) =>
    setDraft((d) => ({ ...d, attribution: { ...(d.attribution || emptyAttribution()), ...patch } }));

  const toneByStatus = {
    resolved: { Icon: CheckCircle2, cls: "border-emerald-200 bg-emerald-50 text-emerald-800" },
    ambiguous: { Icon: AlertTriangle, cls: "border-amber-200 bg-amber-50 text-amber-900" },
    needsReview: { Icon: ShieldAlert, cls: "border-amber-200 bg-amber-50 text-amber-900" },
    none: { Icon: ShieldAlert, cls: "border-red-200 bg-red-50 text-red-800" },
    pool: { Icon: ShieldAlert, cls: "border-amber-200 bg-amber-50 text-amber-900" },
    invalid: { Icon: Info, cls: "border-slate-200 bg-slate-50 text-slate-600" },
  }[derivation.status];
  const DeriveIcon = toneByStatus.Icon;

  // מעברי סטטוס חוקיים בלבד — לא מדלגים על יידוע העובד לפני הסבה (D5),
  // ולא בוחרים סטטוס שחסום בשער היידוע (M4/D8).
  const statusOptions = fineStatusOptions.filter(
    (o) =>
      o.value === draft.status ||
      (canTransition(draft.status, o.value) &&
        !(noticeBlocked && NOTICE_REQUIRED_STATUS.includes(o.value)))
  );

  const submit = async () => {
    const candidate = {
      ...draft,
      driverId: effectiveDriverId || null,
      amount: Number(draft.amount) || 0,
      violationDate: draft.violationDate || null,
      dueDate: draft.dueDate || null,
    };
    const errs = validateFine(candidate, data);
    setErrors(errs);
    if (errs.length) return;

    const scanEntity = scan
      ? scan.id
        ? scan
        : createFineScan({ ...scan, orgId, fineId: candidate.id })
      : null;

    // שכבת הכתיבה אוכפת את השער בעצמה (M4). אם היא סירבה — לא סוגרים את
    // הטופס בשקט אלא מציגים את הסיבה.
    const res = await onSave(candidate, { scan: scanEntity, adminNotes });
    if (res && res.ok === false) {
      setErrors([res.errorKey]);
      return;
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={fine ? t("fine.edit") : t("fine.add")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={submit}>{t("common.save")}</Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("fine.vehicle")} required>
          <Select value={draft.vehicleId || ""} onChange={set("vehicleId")}>
            <option value="">{t("common.select")}</option>
            {(data.vehicles || []).map((v) => (
              <option key={v.id} value={v.id}>
                {vehicleLabel(data.vehicles, v.id)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("fine.referenceNumber")}>
          <TextInput dir="ltr" value={draft.referenceNumber} onChange={set("referenceNumber")} />
        </Field>
        <Field label={t("fine.violationDate")} required>
          <DateInput value={draft.violationDate || ""} onChange={set("violationDate")} />
        </Field>
        <Field label={t("fine.violationTime")}>
          <TimeInput value={draft.violationTime || ""} onChange={set("violationTime")} />
        </Field>
      </div>

      {/* -- גזירת הנהג + שרשרת הראיות (D5) -- */}
      <div className={`mt-3 rounded border p-3 ${toneByStatus.cls}`}>
        <div className="flex items-start gap-2">
          <DeriveIcon size={16} className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold">{t("fine.derive.title")}</div>
            <p className="mt-0.5 text-xs">{t(derivation.reasonKey)}</p>

            {derivation.driverId && (
              <p className="mt-1 text-sm font-semibold">
                {driverName(data.drivers, derivation.driverId, "—", t)}
                {derivation.candidates[0]?.fromDate && (
                  <span className="num ms-2 text-xs font-normal opacity-80">
                    {formatDate(derivation.candidates[0].fromDate, lang)} →{" "}
                    {derivation.candidates[0].toDate
                      ? formatDate(derivation.candidates[0].toDate, lang)
                      : t("assign.active")}
                  </span>
                )}
              </p>
            )}

            {/* ------------------------------------------------------------
                תאריך תחילת ההחזקה הגיע מהייבוא (תאריך תחילת הסכם הליסינג)
                והוא משוער. השיוך כן מתבצע — אבל לא בשקט. זה החצי השני של
                החלטת ה-fromDateInferred: הפיצ'ר עובד, והמשתמש יודע.
                ------------------------------------------------------------ */}
            {derivation.fromDateInferred && (
              <p className="mt-1.5 flex items-start gap-1.5 rounded border border-amber-300 bg-amber-100/60 px-2 py-1.5 text-[11px] text-amber-900">
                <CalendarClock size={13} className="mt-px shrink-0" />
                {t("fine.inferredFromDate")}
              </p>
            )}

            {/* M4/D8 — הנהג המשויך לא קיבל יידוע: אפשר לרשום את הקנס, אסור
                למסור לו הודעה או להסב אליו. אומרים את זה ליד השם, ברגע
                שבו זה רלוונטי, ולא כשגיאה בשמירה. */}
            {noticeBlocked && (
              <p className="mt-1.5 flex items-start gap-1.5 rounded border border-red-300 bg-red-50 px-2 py-1.5 text-[11px] text-red-800">
                <ShieldAlert size={13} className="mt-px shrink-0" />
                {t("fine.noticeGateNote")}
              </p>
            )}

            {(derivation.status === "ambiguous" || derivation.status === "needsReview") && (
              <ul className="mt-1 space-y-0.5 text-xs">
                {derivation.candidates.map((c) => (
                  <li key={c.id} className="num">
                    {driverName(data.drivers, c.driverId, "—", t)} · {formatDate(c.fromDate, lang)} →{" "}
                    {c.toDate ? formatDate(c.toDate, lang) : t("assign.active")}
                    {c.needsReview && <span className="ms-1">· {t("assign.needsReview")}</span>}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-2">
              <Checkbox
                label={t("fine.overrideToggle")}
                checked={manual}
                onChange={(e) =>
                  e.target.checked
                    ? setDraft((d) => ({
                        ...d,
                        driverId: d.driverId || derivation.driverId,
                        attribution: { ...(d.attribution || emptyAttribution()), source: "manual" },
                      }))
                    : setDraft((d) => ({
                        ...d,
                        driverId: derivation.driverId,
                        attribution: { ...(d.attribution || emptyAttribution()), source: "auto", reason: "" },
                      }))
                }
              />
            </div>

            {manual && (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <Field label={t("fine.driver")}>
                  <Select
                    value={draft.driverId || ""}
                    onChange={(e) => setDraft((d) => ({ ...d, driverId: e.target.value || null }))}
                  >
                    <option value="">{t("common.unassigned")}</option>
                    {(data.drivers || []).map((dr) => (
                      <option key={dr.id} value={dr.id}>
                        {driverName(data.drivers, dr.id, "—", t)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field
                  label={t("fine.overrideReason")}
                  required
                  error={errors.includes("fine.err.noOverrideReason") ? t("fine.err.noOverrideReason") : null}
                >
                  <TextInput
                    value={attribution.reason || ""}
                    placeholder={t("fine.overrideReasonPh")}
                    onChange={(e) => setAttribution({ reason: e.target.value })}
                  />
                </Field>
                {derivation.driverId && (
                  <p className="text-xs sm:col-span-2">
                    {t("fine.systemDerived", { name: driverName(data.drivers, derivation.driverId, "—", t) })}
                  </p>
                )}
              </div>
            )}

            {attribution.overriddenAt && (
              <p className="num mt-2 text-[11px] opacity-80">
                {t("fine.attributionLog", {
                  at: formatDate(attribution.overriddenAt, lang),
                  prev: attribution.previousDriverId
                    ? driverName(data.drivers, attribution.previousDriverId, "—", t)
                    : t("common.unassigned"),
                })}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field
          label={t("fine.amount")}
          required
          error={errors.includes("fine.err.noAmount") ? t("fine.err.noAmount") : null}
        >
          <NumberInput value={draft.amount} onChange={set("amount")} />
        </Field>
        <Field label={t("fine.dueDate")}>
          <DateInput value={draft.dueDate || ""} onChange={set("dueDate")} />
        </Field>
        <Field label={t("fine.authority")}>
          <TextInput value={draft.authority} onChange={set("authority")} />
        </Field>
        <Field label={t("fine.violationType")}>
          <TextInput value={draft.violationType} onChange={set("violationType")} />
        </Field>
        <Field
          label={t("fine.status")}
          hint={t("fine.statusFlowHint")}
          error={
            errors.includes("fine.err.transferBeforeNotice")
              ? t("fine.err.transferBeforeNotice")
              : errors.includes("fine.err.driverNoNotice")
              ? t("fine.err.driverNoNotice")
              : null
          }
        >
          <Select value={draft.status} onChange={set("status")}>
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {t(o.key)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("fine.transferredDate")}>
          <DateInput value={draft.transferredDate || ""} onChange={set("transferredDate")} />
        </Field>
        <Field label={t("fine.paidDate")}>
          <DateInput value={draft.paidDate || ""} onChange={set("paidDate")} />
        </Field>

        {draft.driverStatement?.text && (
          <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs sm:col-span-2">
            <div className="font-semibold text-slate-700">{t("fine.driverStatement")}</div>
            <p className="mt-0.5 text-slate-600">{draft.driverStatement.text}</p>
          </div>
        )}

        {/* D1 — הערת אדמין נשמרת במסמך פרטי; לעולם לא נשלחת למכשיר של הנהג */}
        <Field
          label={
            <span className="inline-flex items-center gap-1">
              <Lock size={12} /> {t("fine.adminNotes")}
            </span>
          }
          hint={t("fine.adminNotesHint")}
          className="sm:col-span-2"
        >
          <TextArea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} />
        </Field>

        <div className="sm:col-span-2">
          <FileInput
            label={t("fine.scan")}
            value={scan}
            domain={STORAGE_DOMAINS.fine}
            orgId={orgId}
            fineId={draft.id}
            docId={draft.id}
            onChange={(meta) => setScan(meta ? { ...(scan || {}), ...meta } : null)}
          />
        </div>
      </div>

      {errors.filter(
        (e) =>
          // אלה מוצגים ליד השדה עצמו — כדי שלא יופיעו פעמיים.
          ![
            "fine.err.noOverrideReason",
            "fine.err.noAmount",
            "fine.err.transferBeforeNotice",
            "fine.err.driverNoNotice",
          ].includes(e)
      ).length > 0 && (
        <ul className="mt-3 space-y-1 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {errors
            .filter(
              (e) =>
                // אלה מוצגים ליד השדה עצמו — כדי שלא יופיעו פעמיים.
          ![
            "fine.err.noOverrideReason",
            "fine.err.noAmount",
            "fine.err.transferBeforeNotice",
            "fine.err.driverNoNotice",
          ].includes(e)
            )
            .map((e) => (
              <li key={e}>{t(e)}</li>
            ))}
        </ul>
      )}
    </Modal>
  );
}

export default FineForm;

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useI18n } from "../../hooks/useI18n.jsx";
import Button from "../ui/Button.jsx";
import Pill from "../ui/Pill.jsx";
import Modal from "../ui/Modal.jsx";
import Card, { Stat } from "../ui/Card.jsx";
import Field, { DateInput, NumberInput, Select, TextArea } from "../ui/Field.jsx";
import FileInput from "../ui/FileInput.jsx";
import { createOdometerReading } from "../../schema.js";
import { STORAGE_DOMAINS } from "../../constants.js";
import { readingsForVehicle, kmStatus } from "../../utils/odometer.js";
import { odometerSourceOptions, driverName, KM_STATUS_TONE } from "../../utils/options.js";
import { formatDate, formatNumber } from "../../utils/format.js";
import { todayIso } from "../../utils/dates.js";
import { currentDriverId } from "../../utils/assignments.js";

// טאב ק"מ — סדרת קריאות + גרף פשוט + כרטיס חריגה מול המכסה השנתית.
export function OdometerTab({ vehicle, data, orgId, actions }) {
  const { t, lang } = useI18n();
  const [adding, setAdding] = useState(false);
  const today = todayIso();

  const readings = useMemo(
    () => readingsForVehicle(data.odometerReadings, vehicle.id),
    [data.odometerReadings, vehicle.id]
  );
  const km = useMemo(
    () => kmStatus(vehicle, data.odometerReadings, today),
    [vehicle, data.odometerReadings, today]
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-slate-800">{t("odo.title")}</h3>
        <Pill tone={KM_STATUS_TONE[km.status]}>{t(`km.status.${km.status}`)}</Pill>
        <Button className="ms-auto" size="sm" onClick={() => setAdding(true)}>
          <Plus size={14} /> {t("odo.add")}
        </Button>
      </div>

      {km.status === "unknown" ? (
        <p className="rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          {t("km.needData")}
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label={t("km.allowedToDate")} value={formatNumber(Math.round(km.allowedToDate), lang)} />
          <Stat
            label={t("km.actualToDate")}
            value={formatNumber(Math.round(km.actualToDate), lang)}
            tone={km.status === "over" ? "red" : km.status === "warning" ? "amber" : "green"}
          />
          <Stat
            label={t("km.delta")}
            value={`${km.deltaKm > 0 ? "+" : ""}${formatNumber(Math.round(km.deltaKm), lang)}`}
            tone={km.deltaKm > 0 ? "red" : "green"}
            sub={km.ratio !== null ? `${Math.round(km.ratio * 100)}%` : null}
          />
          <Stat
            label={t("km.projected")}
            value={
              km.projectedAtContractEnd !== null
                ? formatNumber(Math.round(km.projectedAtContractEnd), lang)
                : "—"
            }
            tone={km.projectedOverage > 0 ? "red" : "slate"}
            sub={
              km.projectedOverage !== null
                ? `${t("km.projectedOverage")}: ${formatNumber(Math.round(km.projectedOverage), lang)}`
                : null
            }
          />
        </div>
      )}

      {readings.length >= 2 && (
        <Card title={t("odo.chart")}>
          <Sparkline readings={readings} lang={lang} />
        </Card>
      )}

      <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
        {readings.length ? (
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="table-head">
                <th className="px-3 py-2 text-start">{t("odo.date")}</th>
                <th className="px-3 py-2 text-start">{t("odo.km")}</th>
                <th className="px-3 py-2 text-start">{t("odo.delta")}</th>
                <th className="px-3 py-2 text-start">{t("odo.source")}</th>
                <th className="px-3 py-2 text-start">{t("assign.driver")}</th>
                <th className="px-3 py-2 text-start">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...readings].reverse().map((r, i, arr) => {
                const prev = arr[i + 1];
                const delta = prev ? r.km - prev.km : null;
                return (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="table-cell num">{formatDate(r.date, lang)}</td>
                    <td className="table-cell num font-medium">{formatNumber(r.km, lang)}</td>
                    <td className="table-cell num text-slate-500">
                      {delta === null ? "—" : `+${formatNumber(delta, lang)}`}
                    </td>
                    <td className="table-cell">{t(`odo.source.${r.source}`)}</td>
                    <td className="table-cell">{r.driverId ? driverName(data.drivers, r.driverId) : "—"}</td>
                    <td className="table-cell">
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={t("common.delete")}
                        onClick={() => {
                          if (window.confirm(t("common.deleteConfirm")))
                            actions.remove("odometerReadings", r.id);
                        }}
                      >
                        <Trash2 size={13} />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="py-6 text-center text-sm text-slate-500">{t("odo.empty")}</p>
        )}
      </div>

      {adding && (
        <ReadingForm
          vehicle={vehicle}
          data={data}
          orgId={orgId}
          onClose={() => setAdding(false)}
          onSave={(reading) => actions.upsert("odometerReadings", reading)}
        />
      )}
    </div>
  );
}

// גרף קו מינימלי ב-SVG — בלי ספריית תרשימים (bundle קטן, RTL-neutral).
function Sparkline({ readings, lang }) {
  const w = 640;
  const h = 120;
  const pad = 8;
  const kms = readings.map((r) => r.km);
  const min = Math.min(...kms);
  const max = Math.max(...kms);
  const span = max - min || 1;
  const pts = readings.map((r, i) => {
    const x = pad + (i * (w - pad * 2)) / Math.max(1, readings.length - 1);
    const y = h - pad - ((r.km - min) / span) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <div dir="ltr">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-28 w-full" role="img" aria-label="km trend">
        <polyline points={pts.join(" ")} fill="none" stroke="#2f6bff" strokeWidth="2" />
        {readings.map((r, i) => {
          const [x, y] = pts[i].split(",");
          return <circle key={r.id} cx={x} cy={y} r="2.5" fill="#1d54e0" />;
        })}
      </svg>
      <div className="num flex justify-between text-[11px] text-slate-500">
        <span>
          {formatDate(readings[0].date, lang)} · {formatNumber(min, lang)}
        </span>
        <span>
          {formatDate(readings[readings.length - 1].date, lang)} · {formatNumber(max, lang)}
        </span>
      </div>
    </div>
  );
}

// מיוצא כדי שבדיקת הרינדור (gate:check) תוכל לרנדר את **נקודת האיסוף**
// עצמה — שם יושבת הצהרת השקיפות, ולא במסך שמעליה.
export function ReadingForm({ vehicle, data, orgId, onClose, onSave }) {
  const { t } = useI18n();
  const today = todayIso();
  const [draft, setDraft] = useState(() =>
    createOdometerReading({
      orgId,
      vehicleId: vehicle.id,
      date: today,
      source: "admin",
      driverId: currentDriverId(data.assignments, vehicle.id, today),
    })
  );
  const [photo, setPhoto] = useState(null);
  const [err, setErr] = useState(null);

  const submit = () => {
    if (!draft.date || !(Number(draft.km) > 0)) {
      setErr(true);
      return;
    }
    // צילום המד נשמר על הקריאה עצמה (נתיב drivers/{driverId}/odometer) —
    // לא כמסמך רכב, כדי שלא ייקרא ע"י מחזיק עתידי של אותו רכב (D2).
    onSave({
      ...draft,
      km: Number(draft.km),
      photoRef: photo?.fileRef || null,
      photoName: photo?.fileName || "",
      photoStorageMode: photo?.storageMode || "none",
      metadataStripped: photo?.metadataStripped ?? false,
    });
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={t("odo.add")}
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
        <Field label={t("odo.date")} required>
          <DateInput value={draft.date || ""} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
        </Field>
        <Field label={t("odo.km")} required error={err ? t("common.required") : null}>
          <NumberInput value={draft.km || ""} onChange={(e) => setDraft({ ...draft, km: e.target.value })} />
        </Field>
        <Field label={t("odo.source")}>
          <Select value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })}>
            {odometerSourceOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {t(o.key)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("assign.driver")}>
          <Select
            value={draft.driverId || ""}
            onChange={(e) => setDraft({ ...draft, driverId: e.target.value || null })}
          >
            <option value="">{t("common.unassigned")}</option>
            {(data.drivers || []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.fullName}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("service.notes")} className="sm:col-span-2">
          <TextArea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
        </Field>
        <div className="sm:col-span-2">
          <FileInput
            label={t("odo.photo")}
            value={photo}
            domain={STORAGE_DOMAINS.odometer}
            orgId={orgId}
            driverId={draft.driverId}
            docId={draft.id}
            onChange={setPhoto}
          />
        </div>
        {/* שקיפות בנקודת האיסוף (עדי 6.3) — הצהרה שהנתון אינו כלי מעקב.
            ⚠️ A8 (עדי 17.8): הגודל עלה מ-`text-[11px] text-slate-600` לגודל
            גוף רגיל. "הצהרת השקיפות המשפטית היא הטקסט הקטן ביותר ובעל
            הניגודיות הנמוכה ביותר במסך" — גילוי שקשה לקרוא הוא גילוי חלש.
            ⚠️ 2.4.3: השורה השנייה כבר **אינה** מצביעה ל"הודעה לעובד, גרסה
            {version}" — אין מסמך בשם הזה אחרי הכרעת G1, והפניה לגרסה של מסמך
            שאיש אינו יכול להשיג היא אות שקיפות כוזב. */}
        <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm leading-relaxed text-slate-800 sm:col-span-2">
          <p>{t("odo.purposeNote")}</p>
          <p className="mt-1">{t("odo.purposeLink")}</p>
        </div>
      </div>
    </Modal>
  );
}

export default OdometerTab;

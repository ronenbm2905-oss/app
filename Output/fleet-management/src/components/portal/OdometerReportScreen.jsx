import { useMemo, useState } from "react";
import { Check, AlertTriangle, Gauge } from "lucide-react";
import { useI18n } from "../../hooks/useI18n.jsx";
import Field, { NumberInput } from "../ui/Field.jsx";
import Button from "../ui/Button.jsx";
import { validateDriverReading, KM_MAX } from "../../utils/portal.js";
import { formatDate, formatNumber } from "../../utils/format.js";
import { todayIso } from "../../utils/dates.js";

// ============================================================================
// "דיווח ק"מ" — נקודת האיסוף מול העובד. שדה אחד, כפתור אחד, והיסטוריה.
//
// ============================================================================
// שלוש החלטות שנראות כמו "מה שחסר" והן דווקא התוכן
// ============================================================================
// **בלי צילום.** לא כי Storage אינו פעיל (הוא באמת אינו — Blaze), אלא כי זו
// החלטה: אין תמונה ⇒ אין EXIF ⇒ אין מיקום, אין דגם מכשיר, ואין שעה מדויקת
// שהעובד לא התכוון למסור. השדות בסכימה **ננעלו** ולא נמחקו, כדי שהחזרתם
// תדרוש שינוי מפורש שנופל בבדיקות ולא "עוד חמש-עשרה שורות".
//
// **בלי `navigator.geolocation`.** לא נקרא בשום מקום בקובץ הזה ובשום מקום
// בפורטל. בדיקה סורקת את התיקייה ונופלת אם מישהו יוסיף.
//
// **בלי בורר תאריך.** התאריך הוא היום, נקודה. `date` בלבד, בלי חותמת
// דיוק-שנייה (D4.3) — כי צמד `date` + שעה מדויקת הוא בדיוק "מתי העובד עמד
// ליד הרכב", וזה מעקב אחר עובדים.
//
// ============================================================================
// והטקסט — 2.4 בהכוונת עדי (17.8)
// ============================================================================
// הצהרת המטרה מרונדרת ב**גודל גוף רגיל, מעל כפתור השליחה, לא מקופלת**.
// עדי: "הצהרת השקיפות המשפטית היא הטקסט הקטן ביותר ובעל הניגודיות הנמוכה
// ביותר במסך" — במסך אדמין זה נסבל, בנקודת איסוף מול עובד זה גילוי חלש.
// נוספו "מי רואה את זה" ו"מה אם טעיתי", שבלעדיו עובד שהקליד ספרה שגויה
// מניח שהזיק למשהו — ופשוט לא מדווח בפעם הבאה.
// ============================================================================
export function OdometerReportScreen({ entry, readings = [], onSubmit }) {
  const { t, lang } = useI18n();
  const [km, setKm] = useState("");
  const [state, setState] = useState({ busy: false, error: null, done: false });

  const last = readings[0] || null;
  const check = useMemo(
    () => validateDriverReading({ km, vehicleId: entry?.vehicleId }, { previousKm: last?.km ?? null }),
    [km, entry?.vehicleId, last?.km]
  );
  const touched = km !== "";

  const submit = async (e) => {
    e?.preventDefault?.();
    if (!check.ok || state.busy) return;
    setState({ busy: true, error: null, done: false });
    const res = await onSubmit(Number(km));
    if (res?.ok) {
      setKm("");
      setState({ busy: false, error: null, done: true });
    } else {
      setState({ busy: false, error: res?.errorKey || "odoReport.err.failed", done: false });
    }
  };

  if (!entry?.vehicleId) {
    return (
      <section className="rounded-md border border-slate-200 bg-white p-6 text-center">
        <h2 className="text-base font-semibold text-slate-900">{t("portal.noVehicleTitle")}</h2>
        <p className="mt-1 text-sm text-slate-700">{t("odoReport.noVehicleBody")}</p>
      </section>
    );
  }

  return (
    <div className="space-y-3">
      <form noValidate onSubmit={submit} className="rounded-md border border-slate-200 bg-white p-4">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
          <Gauge size={18} className="text-brand-600" aria-hidden="true" />
          {t("odoReport.title")}
        </h2>
        <p className="num mt-1 text-sm text-slate-700">
          <bdi dir="ltr">{entry.plate}</bdi>
        </p>

        {last && (
          <p className="num mt-3 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {t("odoReport.lastReading", {
              km: formatNumber(last.km, lang),
              date: formatDate(last.date, lang),
            })}
          </p>
        )}

        <Field
          className="mt-3"
          label={t("odoReport.kmLabel")}
          required
          hint={t("odoReport.kmHint")}
          error={touched && !check.ok ? t(check.errors[0]) : null}
        >
          <NumberInput
            value={km}
            onChange={(e) => setKm(e.target.value)}
            min={1}
            max={KM_MAX - 1}
            step={1}
            dir="ltr"
            autoComplete="off"
            enterKeyHint="send"
            className="!py-3 text-lg"
          />
        </Field>

        {/* אזהרה ולא חסימה — 2.3(ג): קריאה נמוכה מהקודמת קורית בעולם האמיתי
            (החלפת לוח מחוונים, טעות קודמת), ומסך שחוסם אותה מלמד את העובד
            שלא כדאי לדווח. */}
        {touched && check.ok && check.warnings.length > 0 && (
          <p className="mt-2 flex items-start gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
            {t(check.warnings[0])}
          </p>
        )}

        {/* ⚠️ A8 — גודל גוף רגיל, ניגודיות רגילה, **מעל** כפתור השליחה. */}
        <div className="mt-4 space-y-2 rounded border border-slate-200 bg-slate-50 p-3 text-sm leading-relaxed text-slate-800">
          <p>{t("odo.purposeNote")}</p>
          <p>{t("odo.whoSees")}</p>
          <p>{t("odo.correction")}</p>
          <p className="text-slate-700">{t("odo.purposeLink")}</p>
        </div>

        {state.error && (
          <p role="alert" className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {t(state.error)}
          </p>
        )}
        {state.done && (
          <p
            role="status"
            className="mt-3 flex items-center gap-2 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
          >
            <Check size={15} aria-hidden="true" />
            {t("odoReport.success")}
          </p>
        )}

        <Button type="submit" size="lg" className="mt-4 w-full" disabled={!check.ok || state.busy}>
          {state.busy ? t("common.saving") : t("odoReport.submit")}
        </Button>
        <p className="num mt-2 text-center text-xs text-slate-600">
          {t("odoReport.dateNote", { date: formatDate(todayIso(), lang) })}
        </p>
      </form>

      <section className="rounded-md border border-slate-200 bg-white">
        <h2 className="border-b border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-800">
          {t("odoReport.history")}
        </h2>
        {readings.length ? (
          <ul className="divide-y divide-slate-100">
            {readings.map((r) => (
              <li key={r.id} className="flex items-baseline justify-between gap-3 px-4 py-2.5">
                <span className="num text-sm font-medium text-slate-900">
                  {formatNumber(r.km, lang)} {t("common.km")}
                </span>
                <span className="num text-xs text-slate-600">{formatDate(r.date, lang)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-6 text-center text-sm text-slate-600">{t("odoReport.empty")}</p>
        )}
      </section>
    </div>
  );
}

export default OdometerReportScreen;

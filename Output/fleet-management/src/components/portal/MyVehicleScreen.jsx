import { Car, CalendarClock, Building2, Info } from "lucide-react";
import { useI18n } from "../../hooks/useI18n.jsx";
import { formatDate } from "../../utils/format.js";

// ============================================================================
// "הרכב שלי" — המסך הראשון שעובד רואה.
//
// ⚠️ **אין כאן עלות חודשית. אף פעם.** וזה לא נאכף כאן אלא במבנה: המסך מקבל
// `entry`, שהוא מסמך `driverPortal/{driverId}` — היטל שנבנה ב-utils/portal.js
// ולא כולל את השדה בכלל. מסמך הרכב עצמו אינו קריא לנהג ב-firestore.rules,
// ולכן גם באג בקומפוננטה הזו לא יכול לחשוף אותו.
//
// מובייל-פירסט: זה נפתח בטלפון, בשדה, אולי בשמש. כרטיסים בעמודה אחת,
// טקסט בגודל גוף, ולוחית הרישוי גדולה מספיק כדי לזהות בלי להתקרב.
// ============================================================================
export function MyVehicleScreen({ entry, driver, contact }) {
  const { t, lang } = useI18n();

  if (!entry?.vehicleId) {
    return (
      <section className="rounded-md border border-slate-200 bg-white p-6 text-center">
        <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          <Car size={22} aria-hidden="true" />
        </span>
        <h2 className="text-base font-semibold text-slate-900">{t("portal.noVehicleTitle")}</h2>
        <p className="mt-1 text-sm text-slate-700">{t("portal.noVehicleBody")}</p>
        {contact && <p className="mt-3 text-sm text-slate-700">{contact}</p>}
      </section>
    );
  }

  const rows = [
    { key: "vehicle.model", value: [entry.manufacturer, entry.model].filter(Boolean).join(" ") || "—" },
    { key: "vehicle.year", value: entry.year ? String(entry.year) : "—", num: true },
  ];

  return (
    <div className="space-y-3">
      <section className="rounded-md border border-slate-200 bg-white p-4">
        <h2 className="text-xs font-medium text-slate-600">{t("portal.myVehicle")}</h2>
        {/* הלוחית היא המידע שבשבילו נכנסים למסך. dir=ltr + tabular-nums כדי
            שספרות לא יתהפכו בעמוד RTL. */}
        <p className="num mt-1 text-3xl font-semibold tracking-wide text-slate-900">
          <bdi dir="ltr">{entry.plate || "—"}</bdi>
        </p>
        <dl className="mt-3 grid gap-2 text-sm">
          {rows.map((r) => (
            <div key={r.key} className="flex items-baseline justify-between gap-3">
              <dt className="text-slate-600">{t(r.key)}</dt>
              <dd className={`font-medium text-slate-900 ${r.num ? "num" : ""}`}>{r.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-4">
        <h2 className="flex items-center gap-2 text-xs font-medium text-slate-600">
          <Building2 size={14} aria-hidden="true" />
          {t("portal.lease")}
        </h2>
        <p className="mt-1 text-base font-medium text-slate-900">
          {entry.leaseCompany?.name || t("common.notSet")}
        </p>
        {entry.leaseCompany?.phone && (
          <p className="num mt-1 text-sm text-slate-700">
            <bdi dir="ltr">{entry.leaseCompany.phone}</bdi>
          </p>
        )}
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-4">
        <h2 className="flex items-center gap-2 text-xs font-medium text-slate-600">
          <CalendarClock size={14} aria-hidden="true" />
          {t("portal.contractEnd")}
        </h2>
        <p className="num mt-1 text-base font-medium text-slate-900">
          {entry.contractEnd ? formatDate(entry.contractEnd, lang) : t("common.notSet")}
        </p>
      </section>

      {/* מי אני, ועם מי מדברים כשמשהו לא נכון. A2 בהכוונת עדי: "כתובת לפניית
          התאמה" היא חובה מבצעית, ולא נחמדות. */}
      <section className="rounded-md border border-slate-200 bg-slate-50 p-4">
        <p className="flex items-start gap-2 text-sm text-slate-700">
          <Info size={15} className="mt-0.5 shrink-0 text-slate-500" aria-hidden="true" />
          <span>
            {t("portal.identifiedAs", { name: driver?.fullName || "—" })}
            {contact ? ` ${contact}` : ""}
          </span>
        </p>
      </section>
    </div>
  );
}

export default MyVehicleScreen;

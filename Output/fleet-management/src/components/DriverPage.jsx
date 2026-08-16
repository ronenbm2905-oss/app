import { useMemo, useState } from "react";
import { ArrowRight, ArrowLeft, Pencil, Trash2, Archive, ShieldCheck } from "lucide-react";
import { useI18n } from "../hooks/useI18n.jsx";
import Button from "./ui/Button.jsx";
import Pill from "./ui/Pill.jsx";
import Card from "./ui/Card.jsx";
import FinesTable from "./FinesTable.jsx";
import { DriverForm } from "./DriversScreen.jsx";
import { assignmentsForDriver, currentVehicleIdForDriver } from "../utils/assignments.js";
import { finesForDriver } from "../utils/fines.js";
import { vehicleLabel, driverName, DRIVER_STATUS_TONE } from "../utils/options.js";
import { formatDate, formatNumber } from "../utils/format.js";
import { cmpDay, todayIso } from "../utils/dates.js";

// מסך 4b — דף נהג: רכב נוכחי, היסטוריית רכבים, קנסות, דיווחי ק"מ.
export function DriverPage({ driverId, data, orgId, actions, onBack, onOpenVehicle }) {
  const { t, lang, dir } = useI18n();
  const [editing, setEditing] = useState(false);
  const today = todayIso();

  const driver = useMemo(
    () => (data.drivers || []).find((d) => d.id === driverId) || null,
    [data.drivers, driverId]
  );

  const history = useMemo(
    () => assignmentsForDriver(data.assignments, driverId),
    [data.assignments, driverId]
  );
  const fines = useMemo(
    () => finesForDriver(data.fines, driverId).sort((a, b) => -cmpDay(a.violationDate, b.violationDate)),
    [data.fines, driverId]
  );
  const readings = useMemo(
    () =>
      (data.odometerReadings || [])
        .filter((r) => r.driverId === driverId)
        .sort((a, b) => -cmpDay(a.date, b.date)),
    [data.odometerReadings, driverId]
  );

  if (!driver) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm text-slate-500">{t("common.notFound")}</p>
        <Button className="mt-3" variant="secondary" onClick={onBack}>
          {t("nav.back")}
        </Button>
      </div>
    );
  }

  const currentVehicleId = currentVehicleIdForDriver(data.assignments, driverId, today);
  const BackIcon = dir === "rtl" ? ArrowRight : ArrowLeft;

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"
      >
        <BackIcon size={14} /> {t("nav.back")}
      </button>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-slate-200 bg-white p-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-slate-900">
              {driverName(data.drivers, driver.id, "—", t)}
            </h1>
            <Pill tone={DRIVER_STATUS_TONE[driver.status]}>{t(`driver.status.${driver.status}`)}</Pill>
            <Pill tone="slate">{t(`driver.portal.${driver.portalStatus}`)}</Pill>
            {driver.anonymizedAt && (
              <Pill tone="slate" title={driver.anonymizedAt}>
                {t("driver.anonymized")}
              </Pill>
            )}
          </div>
          <p className="num text-xs text-slate-500">
            {[driver.department, driver.employeeNumber, driver.phone, driver.email]
              .filter(Boolean)
              .join(" · ") || "—"}
          </p>
        </div>
        <div>
          <div className="text-xs text-slate-500">{t("driver.currentVehicle")}</div>
          {currentVehicleId ? (
            <button
              type="button"
              onClick={() => onOpenVehicle(currentVehicleId)}
              className="num text-sm font-medium text-brand-700 hover:underline"
            >
              {vehicleLabel(data.vehicles, currentVehicleId)}
            </button>
          ) : (
            <div className="text-sm text-slate-400">—</div>
          )}
        </div>
        <div className="ms-auto flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            <Pencil size={13} /> {t("common.edit")}
          </Button>
          {/* D6 — עובד שעזב עובר ארכוב, ורק אחר כך אנונימיזציה. אין מחיקה:
              היסטוריית ההחזקות היא נכס תפעולי וגם הגנה מול ס' 27ב. */}
          {driver.status !== "archived" && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                if (window.confirm(t("driver.archiveConfirm"))) actions.archiveDriver(driver.id);
              }}
            >
              <Archive size={13} /> {t("driver.archive")}
            </Button>
          )}
          {driver.status === "archived" && !driver.anonymizedAt && (
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                if (window.confirm(t("driver.anonymizeConfirm"))) actions.anonymizeDriver(driver.id);
              }}
            >
              <Trash2 size={13} /> {t("driver.anonymize")}
            </Button>
          )}
        </div>
      </div>

      {/* D8 — תיעוד **יידוע**, לא הסכמה. ביחסי עבודה אי אפשר להישען על הסכמה. */}
      <Card title={t("driver.noticeTitle")}>
        <div className="flex flex-wrap items-center gap-3">
          <ShieldCheck
            size={16}
            className={driver.notice?.acknowledgedAt ? "text-emerald-600" : "text-slate-400"}
          />
          <div className="text-xs">
            {driver.notice?.acknowledgedAt ? (
              <span className="num text-slate-700">
                {t("driver.noticeGiven", {
                  version: driver.notice.policyVersion || "—",
                  date: formatDate(driver.notice.acknowledgedAt, lang),
                })}
              </span>
            ) : (
              <span className="text-amber-800">{t("driver.noticeMissing")}</span>
            )}
          </div>
          {!driver.notice?.acknowledgedAt && driver.status !== "archived" && (
            <Button
              size="sm"
              variant="secondary"
              className="ms-auto"
              onClick={() => actions.acknowledgeNotice(driver.id, data.settings?.policyVersion)}
            >
              {t("driver.recordNotice")}
            </Button>
          )}
        </div>
        <p className="mt-2 text-[11px] text-slate-500">{t("driver.noticeHint")}</p>
      </Card>

      <Card title={t("driver.vehicleHistory")} padded={false}>
        {history.length ? (
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="table-head">
                <th className="px-3 py-2 text-start">{t("assign.vehicle")}</th>
                <th className="px-3 py-2 text-start">{t("assign.from")}</th>
                <th className="px-3 py-2 text-start">{t("assign.to")}</th>
                <th className="px-3 py-2 text-start">{t("assign.notes")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.map((a) => (
                <tr key={a.id} className="row-link" onClick={() => onOpenVehicle(a.vehicleId)}>
                  <td className="table-cell num">{vehicleLabel(data.vehicles, a.vehicleId)}</td>
                  <td className="table-cell num">{formatDate(a.fromDate, lang)}</td>
                  <td className="table-cell num">
                    {a.toDate ? formatDate(a.toDate, lang) : <Pill tone="green">{t("assign.active")}</Pill>}
                  </td>
                  <td className="table-cell">{a.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="py-6 text-center text-sm text-slate-500">{t("assign.empty")}</p>
        )}
      </Card>

      <Card title={t("driver.fines")} padded={false}>
        <FinesTable fines={fines} data={data} showDriver={false} />
      </Card>

      <Card title={t("driver.readings")} padded={false}>
        {readings.length ? (
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="table-head">
                <th className="px-3 py-2 text-start">{t("odo.date")}</th>
                <th className="px-3 py-2 text-start">{t("assign.vehicle")}</th>
                <th className="px-3 py-2 text-start">{t("odo.km")}</th>
                <th className="px-3 py-2 text-start">{t("odo.source")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {readings.map((r) => (
                <tr key={r.id}>
                  <td className="table-cell num">{formatDate(r.date, lang)}</td>
                  <td className="table-cell num">{vehicleLabel(data.vehicles, r.vehicleId)}</td>
                  <td className="table-cell num">{formatNumber(r.km, lang)}</td>
                  <td className="table-cell">{t(`odo.source.${r.source}`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="py-6 text-center text-sm text-slate-500">{t("odo.empty")}</p>
        )}
      </Card>

      {editing && (
        <DriverForm
          orgId={orgId}
          driver={driver}
          onClose={() => setEditing(false)}
          onSave={(d) => actions.upsert("drivers", d)}
        />
      )}
    </div>
  );
}

export default DriverPage;

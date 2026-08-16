import { Paperclip, Pencil } from "lucide-react";
import { useI18n } from "../hooks/useI18n.jsx";
import Pill from "./ui/Pill.jsx";
import Button from "./ui/Button.jsx";
import { formatCurrency, formatDate } from "../utils/format.js";
import { driverName, vehicleLabel, FINE_STATUS_TONE } from "../utils/options.js";
import { totalAmount, isFineOpen } from "../utils/fines.js";
import { daysUntil, todayIso } from "../utils/dates.js";

// טבלת קנסות משותפת — למסך הגלובלי, לטאב ברכב, ולדף הנהג.
export function FinesTable({ fines, data, onEdit, onStatus, showVehicle = true, showDriver = true }) {
  const { t, lang } = useI18n();
  const today = todayIso();

  if (!fines.length) {
    return <p className="py-6 text-center text-sm text-slate-500">{t("fine.empty")}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse">
        <thead>
          <tr className="table-head">
            <th className="px-3 py-2 text-start">{t("fine.violationDate")}</th>
            {showVehicle && <th className="px-3 py-2 text-start">{t("fine.vehicle")}</th>}
            {showDriver && <th className="px-3 py-2 text-start">{t("fine.driver")}</th>}
            <th className="px-3 py-2 text-start">{t("fine.violationType")}</th>
            <th className="px-3 py-2 text-start">{t("fine.amount")}</th>
            <th className="px-3 py-2 text-start">{t("fine.dueDate")}</th>
            <th className="px-3 py-2 text-start">{t("fine.status")}</th>
            <th className="px-3 py-2 text-start">{t("common.actions")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {fines.map((f) => {
            const left = f.dueDate && isFineOpen(f) ? daysUntil(f.dueDate, today) : null;
            const hasScan = Boolean(f.scanId);
            return (
              <tr key={f.id} className="hover:bg-slate-50">
                <td className="table-cell num">
                  {formatDate(f.violationDate, lang)}
                  {f.violationTime && <span className="ms-1 text-xs text-slate-400">{f.violationTime}</span>}
                </td>
                {showVehicle && <td className="table-cell num">{vehicleLabel(data.vehicles, f.vehicleId)}</td>}
                {showDriver && (
                  <td className="table-cell">
                    {f.driverId ? (
                      <span className="inline-flex items-center gap-1">
                        {driverName(data.drivers, f.driverId, "—", t)}
                        {f.attribution?.source === "manual" && (
                          <Pill tone="amber" title={f.attribution.reason}>
                            {t("fine.overrideBadge")}
                          </Pill>
                        )}
                      </span>
                    ) : (
                      <span className="text-amber-700">{t("common.unassigned")}</span>
                    )}
                  </td>
                )}
                <td className="table-cell">{f.violationType || f.authority || "—"}</td>
                <td className="table-cell num font-medium">{formatCurrency(f.amount, lang)}</td>
                <td className="table-cell num">
                  {f.dueDate ? (
                    <span className={left !== null && left < 0 ? "text-red-700 font-medium" : ""}>
                      {formatDate(f.dueDate, lang)}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="table-cell">
                  <Pill tone={FINE_STATUS_TONE[f.status]}>{t(`fine.status.${f.status}`)}</Pill>
                </td>
                <td className="table-cell">
                  <div className="flex items-center gap-1">
                    {hasScan && <Paperclip size={13} className="text-slate-400" title={t("fine.scan")} />}
                    {/* D5 — לא מדלגים על יידוע העובד: received → notified → transferred */}
                    {onStatus && f.status === "received" && (
                      <Button size="sm" variant="subtle" onClick={() => onStatus(f, "notified_driver")}>
                        {t("fine.markNotified")}
                      </Button>
                    )}
                    {onStatus && f.status === "notified_driver" && (
                      <Button size="sm" variant="subtle" onClick={() => onStatus(f, "transferred")}>
                        {t("fine.markTransferred")}
                      </Button>
                    )}
                    {onStatus && f.status === "transferred" && (
                      <Button size="sm" variant="subtle" onClick={() => onStatus(f, "paid")}>
                        {t("fine.markPaid")}
                      </Button>
                    )}
                    {onEdit && (
                      <Button size="sm" variant="ghost" onClick={() => onEdit(f)} aria-label={t("common.edit")}>
                        <Pencil size={13} />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
            <td className="table-cell" colSpan={showVehicle && showDriver ? 4 : showVehicle || showDriver ? 3 : 2}>
              {t("common.total")}
            </td>
            <td className="table-cell num">{formatCurrency(totalAmount(fines), lang)}</td>
            <td className="table-cell" colSpan={3} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default FinesTable;

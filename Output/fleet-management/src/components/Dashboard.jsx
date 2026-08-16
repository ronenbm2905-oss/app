import { useMemo } from "react";
import {
  CalendarClock,
  Receipt,
  Clock,
  UserX,
  Gauge,
  FileWarning,
  Wrench,
  CheckCircle2,
  ClipboardCheck,
  ShieldAlert,
} from "lucide-react";
import { useI18n } from "../hooks/useI18n.jsx";
import Card, { Stat } from "./ui/Card.jsx";
import Pill from "./ui/Pill.jsx";
import { computeAlerts, ALERT_GROUPS } from "../utils/alerts.js";
import { vehicleLabel, driverName, monthlyCostOf } from "../utils/options.js";
import { formatCurrency, formatDate, formatNumber } from "../utils/format.js";
import { todayIso } from "../utils/dates.js";
import { isFineOpen, totalAmount } from "../utils/fines.js";

const GROUP_META = {
  assignmentsNeedingReview: { Icon: ClipboardCheck },
  driversWithoutNotice: { Icon: ShieldAlert },
  contractEnding: { Icon: CalendarClock },
  finesAwaitingTransfer: { Icon: Receipt },
  finesDueSoon: { Icon: Clock },
  vehiclesWithoutDriver: { Icon: UserX },
  kmOverage: { Icon: Gauge },
  documentsExpiring: { Icon: FileWarning },
  serviceDue: { Icon: Wrench },
};

// מסך 5 — דשבורד ההתראות (סעיף 5 באפיון).
export function Dashboard({ data, onOpenVehicle, onOpenFines, onOpenReview, onOpenDriver }) {
  const { t, lang } = useI18n();
  const today = todayIso();
  const alerts = useMemo(() => computeAlerts(data, today, data.settings), [data, today]);

  const vehicles = data.vehicles || [];
  const activeVehicles = vehicles.filter((v) => v.status !== "returned");
  const openFines = (data.fines || []).filter(isFineOpen);
  // D1 — סכימת העלויות מהמסמכים הפרטיים (אדמין בלבד).
  const monthly = activeVehicles.reduce((s, v) => s + monthlyCostOf(data, v.id), 0);
  const activeDrivers = (data.drivers || []).filter((d) => d.status === "active").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-semibold text-slate-900">{t("dash.title")}</h1>
        {alerts.total > 0 && (
          <Pill tone={alerts.danger ? "red" : "amber"}>{t("dash.alerts", { n: alerts.total })}</Pill>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("lobby.sum.vehicles")} value={formatNumber(activeVehicles.length, lang)} />
        <Stat label={t("lobby.sum.monthly")} value={formatCurrency(monthly, lang)} />
        <Stat
          label={t("lobby.sum.openFines")}
          value={`${formatNumber(openFines.length, lang)} · ${formatCurrency(totalAmount(openFines), lang)}`}
          tone={openFines.length ? "amber" : "slate"}
        />
        <Stat label={t("driver.title")} value={formatNumber(activeDrivers, lang)} />
      </div>

      {alerts.total === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <CheckCircle2 size={28} className="text-emerald-500" />
            <p className="text-sm font-medium text-slate-800">{t("dash.allClear")}</p>
            <p className="text-xs text-slate-500">{t("dash.allClearSub")}</p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {ALERT_GROUPS.filter((g) => alerts.groups[g].length > 0).map((g) => {
            const { Icon } = GROUP_META[g];
            const items = alerts.groups[g];
            const titleVars = g === "contractEnding" ? { n: data.settings?.contractAlertDays ?? 90 } : undefined;
            return (
              <Card
                key={g}
                title={
                  <span className="flex items-center gap-2">
                    <Icon size={15} className="text-slate-500" />
                    {t(`dash.${g}`, titleVars)}
                    <Pill tone={items.some((i) => i.severity === "danger") ? "red" : "amber"}>{items.length}</Pill>
                  </span>
                }
                padded={false}
              >
                <p className="border-b border-slate-100 px-4 py-2 text-xs text-slate-500">{t(`dash.${g}.desc`)}</p>
                <ul className="divide-y divide-slate-100">
                  {items.map((a) => (
                    <li key={a.key}>
                      <button
                        type="button"
                        onClick={() =>
                          g === "finesAwaitingTransfer" || g === "finesDueSoon"
                            ? onOpenFines()
                            : g === "assignmentsNeedingReview"
                            ? onOpenReview?.()
                            : g === "driversWithoutNotice"
                            ? onOpenDriver?.(a.driverId)
                            : onOpenVehicle(a.vehicleId)
                        }
                        className="flex w-full items-center justify-between gap-3 px-4 py-2 text-start hover:bg-slate-50"
                      >
                        {/* קבוצת היידוע היא היחידה שהישות שלה היא **עובד**
                            ולא רכב — ולכן גם התווית וגם היעד שונים. */}
                        <span className="num text-sm text-slate-800">
                          {g === "driversWithoutNotice"
                            ? driverName(data.drivers, a.driverId, "—", t)
                            : vehicleLabel(data.vehicles, a.vehicleId)}
                        </span>
                        <span className="flex items-center gap-2 text-xs">
                          <AlertDetail group={g} alert={a} data={data} />
                          <Pill tone={a.severity === "danger" ? "red" : "amber"}>
                            {pillLabel(t, g, a)}
                          </Pill>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// תווית ה-Pill פר-קבוצה: ימים כשיש, אחרת ניסוח ייעודי לקבוצה.
function pillLabel(t, group, a) {
  if (a.daysLeft !== null && a.daysLeft !== undefined) {
    return a.daysLeft < 0 ? t("dash.overdueBy", { n: Math.abs(a.daysLeft) }) : t("dash.inDays", { n: a.daysLeft });
  }
  if (group === "assignmentsNeedingReview") return t("reviewx.pillBlocked");
  if (group === "driversWithoutNotice") {
    return a.fineCount > 0 ? t("dash.noticeBlocking") : t("driver.noticeMissingShort");
  }
  if (group === "kmOverage") return t(`km.status.${a.severity === "danger" ? "over" : "warning"}`);
  if (group === "vehiclesWithoutDriver") return t("common.unassigned");
  if (group === "finesAwaitingTransfer") return t("fine.status.received");
  if (group === "serviceDue") return t("dash.serviceDue");
  return t(`common.${a.severity === "danger" ? "yes" : "no"}`);
}

function AlertDetail({ group, alert, data }) {
  const { t, lang } = useI18n();
  if (group === "driversWithoutNotice") {
    return (
      <span className="num text-slate-500">
        {alert.fineCount > 0 ? t("dash.noticeFines", { n: alert.fineCount }) : t("dash.noticeNoFines")}
      </span>
    );
  }
  if (group === "contractEnding" || group === "documentsExpiring") {
    return (
      <span className="num text-slate-500">
        {group === "documentsExpiring" ? `${t(`doc.type.${alert.docType}`)} · ` : ""}
        {formatDate(alert.date, lang)}
      </span>
    );
  }
  if (group === "finesAwaitingTransfer") {
    return (
      <span className="num text-slate-500">
        {formatCurrency(alert.amount, lang)}
        {" · "}
        {alert.driverId ? driverName(data.drivers, alert.driverId, "—", t) : t("dash.noDriverToTransfer")}
      </span>
    );
  }
  if (group === "finesDueSoon") {
    return (
      <span className="num text-slate-500">
        {formatCurrency(alert.amount, lang)} · {formatDate(alert.date, lang)}
      </span>
    );
  }
  if (group === "kmOverage") {
    return (
      <span className="num text-slate-500">
        {alert.deltaKm > 0
          ? t("dash.overKm", { n: formatNumber(Math.round(alert.deltaKm), lang) })
          : t("dash.nearKm", { n: Math.round((alert.ratio || 0) * 100) })}
      </span>
    );
  }
  if (group === "serviceDue") {
    return (
      <span className="num text-slate-500">
        {alert.reason === "km" && alert.kmLeft !== null
          ? alert.kmLeft < 0
            ? t("service.overdueKm", { n: formatNumber(Math.abs(alert.kmLeft), lang) })
            : t("service.dueByKm", { n: formatNumber(alert.kmLeft, lang) })
          : ""}
      </span>
    );
  }
  return null;
}

export default Dashboard;

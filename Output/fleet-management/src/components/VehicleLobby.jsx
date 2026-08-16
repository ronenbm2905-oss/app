import { useMemo, useState } from "react";
import { Plus, Search, ArrowUpDown } from "lucide-react";
import { useI18n } from "../hooks/useI18n.jsx";
import Button from "./ui/Button.jsx";
import Pill from "./ui/Pill.jsx";
import { EmptyState } from "./ui/Card.jsx";
import { TextInput, Select } from "./ui/Field.jsx";
import { formatCurrency, formatDate, formatNumber } from "../utils/format.js";
import { currentDriverId } from "../utils/assignments.js";
import { currentKm } from "../utils/odometer.js";
import { openFinesForVehicle, totalAmount } from "../utils/fines.js";
import {
  vehicleStatusOptions,
  driverName,
  leaseCompanyName,
  monthlyCostOf,
  VEHICLE_STATUS_TONE,
} from "../utils/options.js";
import { todayIso, daysUntil } from "../utils/dates.js";

const COLUMNS = [
  { id: "plate", key: "vehicle.plate" },
  { id: "model", key: "vehicle.model" },
  { id: "driver", key: "vehicle.currentDriver" },
  { id: "lease", key: "vehicle.leaseCompany" },
  { id: "contractEnd", key: "vehicle.contractEnd" },
  { id: "monthlyCost", key: "vehicle.monthlyCost", numeric: true },
  { id: "km", key: "vehicle.currentKm", numeric: true },
  { id: "openFines", key: "vehicle.openFines", numeric: true },
  { id: "status", key: "vehicle.status" },
];

// מסך 1 — לובי רכבים: הטבלה של האקסל, עם חיפוש/פילטר/מיון ושורת סיכום.
export function VehicleLobby({ data, onOpenVehicle, onAddVehicle }) {
  const { t, lang } = useI18n();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [leaseId, setLeaseId] = useState("all");
  const [sort, setSort] = useState({ col: "plate", dir: 1 });
  const today = todayIso();

  const rows = useMemo(() => {
    return (data.vehicles || []).map((v) => {
      const drvId = currentDriverId(data.assignments, v.id, today);
      const open = openFinesForVehicle(data.fines, v.id);
      return {
        v,
        plate: v.plate || "",
        model: [v.manufacturer, v.model].filter(Boolean).join(" "),
        driver: drvId ? driverName(data.drivers, drvId, "", t) : "",
        lease: leaseCompanyName(data.leaseCompanies, v.leaseCompanyId, ""),
        contractEnd: v.contractEnd || "",
        // D1 — העלות מגיעה מהמסמך הפרטי, לא ממסמך הרכב.
        monthlyCost: monthlyCostOf(data, v.id),
        km: currentKm(data.odometerReadings, v.id),
        openFines: open.length,
        openFinesAmount: totalAmount(open),
        status: v.status,
      };
    });
  }, [data, today]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (leaseId !== "all" && r.v.leaseCompanyId !== (leaseId === "none" ? null : leaseId)) return false;
      if (!needle) return true;
      return [r.plate, r.model, r.driver, r.lease].join(" ").toLowerCase().includes(needle);
    });
  }, [rows, q, status, leaseId]);

  const sorted = useMemo(() => {
    const { col, dir } = sort;
    return [...filtered].sort((a, b) => {
      const av = a[col];
      const bv = b[col];
      if (typeof av === "number" || typeof bv === "number") {
        return ((av ?? -Infinity) - (bv ?? -Infinity)) * dir;
      }
      return String(av ?? "").localeCompare(String(bv ?? ""), lang === "he" ? "he" : "en") * dir;
    });
  }, [filtered, sort, lang]);

  const totals = useMemo(
    () => ({
      count: sorted.length,
      monthly: sorted.reduce((s, r) => s + r.monthlyCost, 0),
      fines: sorted.reduce((s, r) => s + r.openFines, 0),
      finesAmount: sorted.reduce((s, r) => s + r.openFinesAmount, 0),
    }),
    [sorted]
  );

  const toggleSort = (col) =>
    setSort((s) => (s.col === col ? { col, dir: -s.dir } : { col, dir: 1 }));

  if (!(data.vehicles || []).length) {
    return (
      <EmptyState
        title={t("vehicle.empty")}
        hint={t("vehicle.emptyHint")}
        action={
          <Button className="mt-2" onClick={onAddVehicle}>
            <Plus size={15} /> {t("vehicle.add")}
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-semibold text-slate-900">{t("lobby.title")}</h1>
        <span className="num text-xs text-slate-500">{t("common.results", { n: sorted.length })}</span>
        <Button className="ms-auto" onClick={onAddVehicle}>
          <Plus size={15} /> {t("vehicle.add")}
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-md border border-slate-200 bg-white p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={15} className="pointer-events-none absolute top-2.5 start-2.5 text-slate-400" />
          <TextInput
            className="ps-8"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("lobby.searchPh")}
            aria-label={t("common.search")}
          />
        </div>
        <label className="text-xs text-slate-600">
          <span className="mb-1 block">{t("lobby.filterStatus")}</span>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">{t("common.all")}</option>
            {vehicleStatusOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {t(o.key)}
              </option>
            ))}
          </Select>
        </label>
        <label className="text-xs text-slate-600">
          <span className="mb-1 block">{t("lobby.filterLease")}</span>
          <Select value={leaseId} onChange={(e) => setLeaseId(e.target.value)}>
            <option value="all">{t("common.all")}</option>
            {(data.leaseCompanies || []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            <option value="none">{t("common.unassigned")}</option>
          </Select>
        </label>
      </div>

      <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="table-head">
              {COLUMNS.map((c) => (
                <th key={c.id} scope="col" className="px-3 py-2 text-start">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-slate-900"
                    onClick={() => toggleSort(c.id)}
                  >
                    {t(c.key)}
                    <ArrowUpDown size={12} className={sort.col === c.id ? "text-brand-600" : "text-slate-400"} />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((r) => {
              const left = r.contractEnd ? daysUntil(r.contractEnd, today) : null;
              return (
                <tr
                  key={r.v.id}
                  className="row-link"
                  tabIndex={0}
                  onClick={() => onOpenVehicle(r.v.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onOpenVehicle(r.v.id);
                  }}
                >
                  <td className="table-cell num font-medium text-slate-900">{r.plate}</td>
                  <td className="table-cell">{r.model || "—"}</td>
                  <td className="table-cell">
                    {r.driver || <span className="text-amber-700">{t("common.unassigned")}</span>}
                  </td>
                  <td className="table-cell">{r.lease || "—"}</td>
                  <td className="table-cell num">
                    {r.contractEnd ? (
                      <span className={left !== null && left <= 90 ? "text-amber-700" : ""}>
                        {formatDate(r.contractEnd, lang)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="table-cell num">{r.monthlyCost ? formatCurrency(r.monthlyCost, lang) : "—"}</td>
                  <td className="table-cell num">{r.km === null ? "—" : formatNumber(r.km, lang)}</td>
                  <td className="table-cell num">
                    {r.openFines > 0 ? (
                      <Pill tone="amber">
                        {formatNumber(r.openFines, lang)} · {formatCurrency(r.openFinesAmount, lang)}
                      </Pill>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="table-cell">
                    <Pill tone={VEHICLE_STATUS_TONE[r.status]}>{t(`vehicle.status.${r.status}`)}</Pill>
                  </td>
                </tr>
              );
            })}
            {!sorted.length && (
              <tr>
                <td colSpan={COLUMNS.length} className="px-3 py-8 text-center text-sm text-slate-500">
                  {t("lobby.noResults")}
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
              <td className="table-cell">{t("common.total")}</td>
              <td className="table-cell num">{formatNumber(totals.count, lang)}</td>
              <td className="table-cell" />
              <td className="table-cell" />
              <td className="table-cell" />
              <td className="table-cell num">{formatCurrency(totals.monthly, lang)}</td>
              <td className="table-cell" />
              <td className="table-cell num">
                {totals.fines ? `${formatNumber(totals.fines, lang)} · ${formatCurrency(totals.finesAmount, lang)}` : "—"}
              </td>
              <td className="table-cell" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export default VehicleLobby;

import { useMemo, useState } from "react";
import { ArrowRight, ArrowLeft, Pencil, Trash2, Plus } from "lucide-react";
import { useI18n } from "../hooks/useI18n.jsx";
import Button from "./ui/Button.jsx";
import Pill from "./ui/Pill.jsx";
import DetailsTab from "./tabs/DetailsTab.jsx";
import AssignmentsTab from "./tabs/AssignmentsTab.jsx";
import OdometerTab from "./tabs/OdometerTab.jsx";
import ServiceTab from "./tabs/ServiceTab.jsx";
import DocumentsTab from "./tabs/DocumentsTab.jsx";
import FinesTable from "./FinesTable.jsx";
import FineForm from "./FineForm.jsx";
import VehicleForm from "./VehicleForm.jsx";
import { currentDriverId } from "../utils/assignments.js";
import { currentKm } from "../utils/odometer.js";
import { driverName, monthlyCostOf, VEHICLE_STATUS_TONE } from "../utils/options.js";
import { formatNumber } from "../utils/format.js";
import { cmpDay, todayIso } from "../utils/dates.js";

const TABS = [
  { id: "details", key: "tab.details" },
  { id: "assignments", key: "tab.assignments" },
  { id: "fines", key: "tab.fines" },
  { id: "odometer", key: "tab.odometer" },
  { id: "service", key: "tab.service" },
  { id: "documents", key: "tab.documents" },
];

// מסך 2 — דף רכב עם שישה טאבים.
export function VehiclePage({ vehicleId, data, orgId, actions, onBack }) {
  const { t, lang, dir } = useI18n();
  const [tab, setTab] = useState("details");
  const [editing, setEditing] = useState(false);
  const [fineEditing, setFineEditing] = useState(null);
  const [fineStatusError, setFineStatusError] = useState(null); // M4 — סיבת חסימה
  const today = todayIso();

  const vehicle = useMemo(
    () => (data.vehicles || []).find((v) => v.id === vehicleId) || null,
    [data.vehicles, vehicleId]
  );

  const fines = useMemo(
    () =>
      (data.fines || [])
        .filter((f) => f.vehicleId === vehicleId)
        .sort((a, b) => -cmpDay(a.violationDate, b.violationDate)),
    [data.fines, vehicleId]
  );

  if (!vehicle) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm text-slate-500">{t("common.notFound")}</p>
        <Button className="mt-3" variant="secondary" onClick={onBack}>
          {t("nav.back")}
        </Button>
      </div>
    );
  }

  const drvId = currentDriverId(data.assignments, vehicle.id, today);
  const km = currentKm(data.odometerReadings, vehicle.id);
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

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-slate-200 bg-white p-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="num text-lg font-semibold text-slate-900">{vehicle.plate}</h1>
            <Pill tone={VEHICLE_STATUS_TONE[vehicle.status]}>{t(`vehicle.status.${vehicle.status}`)}</Pill>
          </div>
          <p className="text-xs text-slate-500">
            {[vehicle.manufacturer, vehicle.model].filter(Boolean).join(" ") || "—"}
          </p>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
          <div>
            <div className="text-slate-500">{t("vehicle.currentDriver")}</div>
            <div className="text-sm font-medium text-slate-900">
              {drvId ? (
                driverName(data.drivers, drvId, "—", t)
              ) : (
                <span className="text-amber-700">{t("common.unassigned")}</span>
              )}
            </div>
          </div>
          <div>
            <div className="text-slate-500">{t("vehicle.currentKm")}</div>
            <div className="num text-sm font-medium text-slate-900">
              {km === null ? "—" : formatNumber(km, lang)}
            </div>
          </div>
        </div>
        <div className="ms-auto flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            <Pencil size={13} /> {t("common.edit")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (window.confirm(`${t("vehicle.deleteWarn")}\n\n${t("common.deleteConfirm")}`)) {
                actions.deleteVehicle(vehicle.id);
                onBack();
              }
            }}
          >
            <Trash2 size={13} /> {t("common.delete")}
          </Button>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-slate-200" role="tablist">
        {TABS.map((tb) => {
          const active = tab === tb.id;
          return (
            <button
              key={tb.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(tb.id)}
              className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm transition ${
                active
                  ? "border-brand-600 font-semibold text-brand-700"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              {t(tb.key)}
            </button>
          );
        })}
      </div>

      <div role="tabpanel">
        {tab === "details" && <DetailsTab vehicle={vehicle} data={data} />}
        {tab === "assignments" && (
          <AssignmentsTab vehicle={vehicle} data={data} orgId={orgId} actions={actions} />
        )}
        {tab === "fines" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-800">{t("fine.title")}</h3>
              <Button className="ms-auto" size="sm" onClick={() => setFineEditing("new")}>
                <Plus size={14} /> {t("fine.add")}
              </Button>
            </div>
            {/* M4 — פעולה שנחסמה בשער היידוע מסבירה את עצמה */}
            {fineStatusError && (
              <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {t(fineStatusError)}
              </p>
            )}
            <div className="rounded-md border border-slate-200 bg-white">
              <FinesTable
                fines={fines}
                data={data}
                showVehicle={false}
                onEdit={(f) => setFineEditing(f)}
                onStatus={async (f, next) => {
                  const res = await actions.setFineStatus(f.id, next);
                  setFineStatusError(res && res.ok === false ? res.errorKey : null);
                }}
              />
            </div>
          </div>
        )}
        {tab === "odometer" && (
          <OdometerTab vehicle={vehicle} data={data} orgId={orgId} actions={actions} />
        )}
        {tab === "service" && <ServiceTab vehicle={vehicle} data={data} orgId={orgId} actions={actions} />}
        {tab === "documents" && (
          <DocumentsTab vehicle={vehicle} data={data} orgId={orgId} actions={actions} />
        )}
      </div>

      {editing && (
        <VehicleForm
          open
          vehicle={vehicle}
          monthlyCost={monthlyCostOf(data, vehicle.id)}
          orgId={orgId}
          leaseCompanies={data.leaseCompanies}
          onClose={() => setEditing(false)}
          onSave={(v, cost) => actions.saveVehicle(v, cost)}
        />
      )}
      {fineEditing && (
        <FineForm
          open
          data={data}
          orgId={orgId}
          defaultVehicleId={vehicle.id}
          fine={fineEditing === "new" ? null : fineEditing}
          onClose={() => setFineEditing(null)}
          onSave={(f, extras) => actions.saveFine(f, extras)}
        />
      )}
    </div>
  );
}

export default VehiclePage;

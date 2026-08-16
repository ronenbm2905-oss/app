import { useMemo, useState } from "react";
import { Plus, Search, AlertTriangle } from "lucide-react";
import { useI18n } from "../hooks/useI18n.jsx";
import Button from "./ui/Button.jsx";
import { Stat } from "./ui/Card.jsx";
import { TextInput, Select, Checkbox } from "./ui/Field.jsx";
import FinesTable from "./FinesTable.jsx";
import FineForm from "./FineForm.jsx";
import { fineStatusOptions, vehicleLabel, driverName } from "../utils/options.js";
import { isFineOpen, totalAmount, isAwaitingTransfer } from "../utils/fines.js";
import { formatCurrency } from "../utils/format.js";
import { cmpDay } from "../utils/dates.js";

// מסך 3 — רשימת קנסות גלובלית + פילטר סטטוס + טופס הזנה עם סריקה.
export function FinesScreen({ data, orgId, actions }) {
  const { t, lang } = useI18n();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [openOnly, setOpenOnly] = useState(false);
  const [editing, setEditing] = useState(null); // null | 'new' | fine
  // M4 — פעולה שנחסמה בשער היידוע חייבת לומר למה. בלי זה הכפתור פשוט
  // "לא עובד", וזו החוויה שגורמת לאנשים לחפש עקיפה.
  const [statusError, setStatusError] = useState(null);

  const fines = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data.fines || [])
      .filter((f) => {
        if (status !== "all" && f.status !== status) return false;
        if (openOnly && !isFineOpen(f)) return false;
        if (!needle) return true;
        const hay = [
          f.referenceNumber,
          f.authority,
          f.violationType,
          vehicleLabel(data.vehicles, f.vehicleId, ""),
          f.driverId ? driverName(data.drivers, f.driverId, "", t) : "",
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(needle);
      })
      .sort((a, b) => -cmpDay(a.violationDate, b.violationDate));
  }, [data, q, status, openOnly]);

  const open = fines.filter(isFineOpen);
  const awaiting = fines.filter(isAwaitingTransfer);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-semibold text-slate-900">{t("fine.title")}</h1>
        <span className="num text-xs text-slate-500">{t("common.results", { n: fines.length })}</span>
        <Button className="ms-auto" onClick={() => setEditing("new")}>
          <Plus size={15} /> {t("fine.add")}
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <Stat label={t("fine.openOnly")} value={open.length} tone={open.length ? "amber" : "slate"} />
        <Stat
          label={t("lobby.sum.finesAmount")}
          value={formatCurrency(totalAmount(open), lang)}
          tone={open.length ? "amber" : "slate"}
        />
        <Stat
          label={t("dash.finesAwaitingTransfer")}
          value={awaiting.length}
          tone={awaiting.length ? "red" : "green"}
        />
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-md border border-slate-200 bg-white p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={15} className="pointer-events-none absolute top-2.5 start-2.5 text-slate-400" />
          <TextInput
            className="ps-8"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("fine.searchPh")}
            aria-label={t("common.search")}
          />
        </div>
        <label className="text-xs text-slate-600">
          <span className="mb-1 block">{t("fine.status")}</span>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">{t("common.all")}</option>
            {fineStatusOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {t(o.key)}
              </option>
            ))}
          </Select>
        </label>
        <Checkbox
          className="pb-2"
          label={t("fine.openOnly")}
          checked={openOnly}
          onChange={(e) => setOpenOnly(e.target.checked)}
        />
      </div>

      {statusError && (
        <p className="flex items-start gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          {t(statusError)}
        </p>
      )}

      <div className="rounded-md border border-slate-200 bg-white">
        <FinesTable
          fines={fines}
          data={data}
          onEdit={(f) => setEditing(f)}
          onStatus={async (f, next) => {
            const res = await actions.setFineStatus(f.id, next);
            setStatusError(res && res.ok === false ? res.errorKey : null);
          }}
        />
      </div>

      {editing && (
        <FineForm
          open
          data={data}
          orgId={orgId}
          fine={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={(fine, extras) => actions.saveFine(fine, extras)}
        />
      )}
    </div>
  );
}

export default FinesScreen;

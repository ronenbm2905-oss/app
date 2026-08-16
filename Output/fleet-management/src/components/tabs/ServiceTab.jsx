import { useMemo, useState } from "react";
import { Plus, Trash2, Wrench } from "lucide-react";
import { useI18n } from "../../hooks/useI18n.jsx";
import Button from "../ui/Button.jsx";
import Modal from "../ui/Modal.jsx";
import Field, { DateInput, NumberInput, Select, TextArea, TextInput } from "../ui/Field.jsx";
import { createServiceRecord } from "../../schema.js";
import { serviceTypeOptions } from "../../utils/options.js";
import { formatCurrency, formatDate, formatNumber } from "../../utils/format.js";
import { serviceDue } from "../../utils/odometer.js";
import { cmpDay, todayIso } from "../../utils/dates.js";

export function ServiceTab({ vehicle, data, orgId, actions }) {
  const { t, lang } = useI18n();
  const [adding, setAdding] = useState(false);
  const today = todayIso();

  const list = useMemo(
    () =>
      (data.serviceRecords || [])
        .filter((s) => s.vehicleId === vehicle.id)
        .sort((a, b) => -cmpDay(a.date, b.date)),
    [data.serviceRecords, vehicle.id]
  );

  const due = useMemo(
    () => serviceDue(vehicle, data.serviceRecords, data.odometerReadings, today),
    [vehicle, data.serviceRecords, data.odometerReadings, today]
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-slate-800">{t("service.title")}</h3>
        <Button className="ms-auto" size="sm" onClick={() => setAdding(true)}>
          <Plus size={14} /> {t("service.add")}
        </Button>
      </div>

      {due.due && (
        <p className="flex items-center gap-2 rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <Wrench size={14} />
          {due.reason === "date"
            ? due.daysLeft < 0
              ? t("service.overdueDate", { n: Math.abs(due.daysLeft) })
              : t("service.dueByDate", { n: due.daysLeft })
            : due.kmLeft < 0
            ? t("service.overdueKm", { n: Math.abs(due.kmLeft) })
            : t("service.dueByKm", { n: due.kmLeft })}
        </p>
      )}

      <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
        {list.length ? (
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="table-head">
                <th className="px-3 py-2 text-start">{t("service.date")}</th>
                <th className="px-3 py-2 text-start">{t("service.type")}</th>
                <th className="px-3 py-2 text-start">{t("service.km")}</th>
                <th className="px-3 py-2 text-start">{t("service.cost")}</th>
                <th className="px-3 py-2 text-start">{t("service.garage")}</th>
                <th className="px-3 py-2 text-start">{t("service.nextKm")}</th>
                <th className="px-3 py-2 text-start">{t("service.nextDate")}</th>
                <th className="px-3 py-2 text-start">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="table-cell num">{formatDate(s.date, lang)}</td>
                  <td className="table-cell">{t(`service.type.${s.type}`)}</td>
                  <td className="table-cell num">{s.km ? formatNumber(s.km, lang) : "—"}</td>
                  <td className="table-cell num">{s.cost ? formatCurrency(s.cost, lang) : "—"}</td>
                  <td className="table-cell">{s.garage || "—"}</td>
                  <td className="table-cell num">{s.nextServiceKm ? formatNumber(s.nextServiceKm, lang) : "—"}</td>
                  <td className="table-cell num">{s.nextServiceDate ? formatDate(s.nextServiceDate, lang) : "—"}</td>
                  <td className="table-cell">
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={t("common.delete")}
                      onClick={() => {
                        if (window.confirm(t("common.deleteConfirm"))) actions.remove("serviceRecords", s.id);
                      }}
                    >
                      <Trash2 size={13} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="py-6 text-center text-sm text-slate-500">{t("service.empty")}</p>
        )}
      </div>

      {adding && (
        <ServiceForm
          vehicleId={vehicle.id}
          orgId={orgId}
          onClose={() => setAdding(false)}
          onSave={(rec) => actions.upsert("serviceRecords", rec)}
        />
      )}
    </div>
  );
}

function ServiceForm({ vehicleId, orgId, onClose, onSave }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(() =>
    createServiceRecord({ orgId, vehicleId, date: todayIso(), type: "periodic" })
  );
  const set = (k) => (e) => setDraft({ ...draft, [k]: e.target.value });

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={t("service.add")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={() => {
              onSave({
                ...draft,
                km: Number(draft.km) || 0,
                cost: Number(draft.cost) || 0,
                nextServiceKm: draft.nextServiceKm ? Number(draft.nextServiceKm) : null,
                nextServiceDate: draft.nextServiceDate || null,
              });
              onClose();
            }}
          >
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("service.date")} required>
          <DateInput value={draft.date || ""} onChange={set("date")} />
        </Field>
        <Field label={t("service.type")}>
          <Select value={draft.type} onChange={set("type")}>
            {serviceTypeOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {t(o.key)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("service.km")}>
          <NumberInput value={draft.km || ""} onChange={set("km")} />
        </Field>
        <Field label={t("service.cost")}>
          <NumberInput value={draft.cost || ""} onChange={set("cost")} />
        </Field>
        <Field label={t("service.garage")}>
          <TextInput value={draft.garage} onChange={set("garage")} />
        </Field>
        <Field label={t("service.nextKm")}>
          <NumberInput value={draft.nextServiceKm ?? ""} onChange={set("nextServiceKm")} />
        </Field>
        <Field label={t("service.nextDate")}>
          <DateInput value={draft.nextServiceDate || ""} onChange={set("nextServiceDate")} />
        </Field>
        <Field label={t("service.notes")} className="sm:col-span-2">
          <TextArea value={draft.notes} onChange={set("notes")} />
        </Field>
      </div>
    </Modal>
  );
}

export default ServiceTab;

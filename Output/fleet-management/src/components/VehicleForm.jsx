import { useState } from "react";
import { useI18n } from "../hooks/useI18n.jsx";
import Modal from "./ui/Modal.jsx";
import Button from "./ui/Button.jsx";
import Field, { TextInput, NumberInput, DateInput, TextArea, Select } from "./ui/Field.jsx";
import { createVehicle } from "../schema.js";
import { vehicleStatusOptions } from "../utils/options.js";

// D1 — `monthlyCost` אינו שדה של Vehicle: הוא נשמר במסמך נפרד אדמין-בלבד
// (vehiclesPrivate), כי firestore.rules לא יודעים להסתיר שדה בודד ממסמך.
// הטופס עורך את שניהם יחד, אבל הם נשמרים בשני מסמכים.
export function VehicleForm({ open, onClose, onSave, orgId, leaseCompanies, vehicle, monthlyCost }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(() => vehicle || createVehicle({ orgId }));
  const [cost, setCost] = useState(() => monthlyCost ?? 0);
  const set = (k) => (e) => setDraft({ ...draft, [k]: e.target.value });
  const [err, setErr] = useState(null);

  const submit = () => {
    if (!String(draft.plate).trim()) {
      setErr("vehicle.plate");
      return;
    }
    onSave(
      {
      ...draft,
      plate: String(draft.plate).trim(),
      annualKmAllowance: Number(draft.annualKmAllowance) || 0,
      startKm: Number(draft.startKm) || 0,
      year: draft.year ? Number(draft.year) : null,
      contractStart: draft.contractStart || null,
      contractEnd: draft.contractEnd || null,
      leaseCompanyId: draft.leaseCompanyId || null,
      updatedAt: new Date().toISOString(),
      },
      Number(cost) || 0
    );
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={vehicle ? t("vehicle.edit") : t("vehicle.add")}
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
        <Field label={t("vehicle.plate")} required error={err === "vehicle.plate" ? t("common.required") : null}>
          <TextInput dir="ltr" value={draft.plate} onChange={set("plate")} autoFocus />
        </Field>
        <Field label={t("vehicle.model")}>
          <TextInput value={draft.model} onChange={set("model")} />
        </Field>
        <Field label={t("vehicle.manufacturer")}>
          <TextInput value={draft.manufacturer} onChange={set("manufacturer")} />
        </Field>
        <Field label={t("vehicle.year")}>
          <NumberInput value={draft.year ?? ""} onChange={set("year")} />
        </Field>
        <Field label={t("vehicle.leaseCompany")}>
          <Select value={draft.leaseCompanyId || ""} onChange={set("leaseCompanyId")}>
            <option value="">{t("common.select")}</option>
            {(leaseCompanies || []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("vehicle.status")}>
          <Select value={draft.status} onChange={set("status")}>
            {vehicleStatusOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {t(o.key)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("vehicle.contractStart")}>
          <DateInput value={draft.contractStart || ""} onChange={set("contractStart")} />
        </Field>
        <Field label={t("vehicle.contractEnd")}>
          <DateInput value={draft.contractEnd || ""} onChange={set("contractEnd")} />
        </Field>
        <Field label={t("vehicle.monthlyCost")} hint={t("vehicle.monthlyCostPrivate")}>
          <NumberInput value={cost} onChange={(e) => setCost(e.target.value)} />
        </Field>
        <Field label={t("vehicle.annualKmAllowance")}>
          <NumberInput value={draft.annualKmAllowance} onChange={set("annualKmAllowance")} />
        </Field>
        <Field label={t("vehicle.startKm")} hint={t("km.needData")}>
          <NumberInput value={draft.startKm} onChange={set("startKm")} />
        </Field>
        <Field label={t("vehicle.notes")} className="sm:col-span-2">
          <TextArea value={draft.notes} onChange={set("notes")} />
        </Field>
      </div>
    </Modal>
  );
}

export default VehicleForm;

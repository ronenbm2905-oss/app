import { useState } from "react";
import { Car, Check } from "lucide-react";
import { useI18n } from "../hooks/useI18n.jsx";
import Button from "./ui/Button.jsx";
import Field, { TextInput, DateInput, NumberInput, Select } from "./ui/Field.jsx";
import { createLeaseCompany, createVehicle } from "../schema.js";
import { vehicleStatusOptions } from "../utils/options.js";

// מסך 0 — הקמה ראשונית: שם ארגון → חברת ליסינג ראשונה → רכב ראשון.
// חשוב (באג שנתפס ב-property-management): לא לשמור באמצע ולסמן onboarded
// לפני מסך הסיום — אחרת המשתמש נזרק ללובי ומדלג על השלב האחרון.
export function Onboarding({ orgId, onComplete }) {
  const { t } = useI18n();
  const TOTAL = 3;
  const [step, setStep] = useState(0);
  const [orgName, setOrgName] = useState("");
  const [lease, setLease] = useState({ name: "", contactName: "", phone: "", email: "" });
  const [vehicle, setVehicle] = useState({
    plate: "",
    model: "",
    manufacturer: "",
    contractStart: "",
    contractEnd: "",
    monthlyCost: "",
    annualKmAllowance: "",
    status: "active",
  });
  const [done, setDone] = useState(false);

  const canNext =
    (step === 0 && orgName.trim().length > 0) ||
    (step === 1 && lease.name.trim().length > 0) ||
    (step === 2 && vehicle.plate.trim().length > 0);

  const finish = () => {
    const company = createLeaseCompany({ orgId, ...lease });
    // D1 — monthlyCost לא נכנס למסמך הרכב; הוא נשמר בנפרד (vehiclesPrivate).
    const { monthlyCost, ...vehicleFields } = vehicle;
    const veh = createVehicle({
      orgId,
      ...vehicleFields,
      leaseCompanyId: company.id,
      contractStart: vehicle.contractStart || null,
      contractEnd: vehicle.contractEnd || null,
    });
    onComplete({
      orgName: orgName.trim(),
      company,
      vehicle: veh,
      monthlyCost: Number(monthlyCost) || 0,
    });
    setDone(true);
  };

  if (done) {
    return (
      <Shell step={TOTAL} total={TOTAL}>
        <div className="text-center">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <Check size={26} />
          </span>
          <h2 className="text-lg font-semibold text-slate-900">{t("onb.doneTitle")}</h2>
          <p className="mt-1 text-sm text-slate-600">{t("onb.doneBody")}</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell step={step + 1} total={TOTAL}>
      {step === 0 && (
        <>
          <h2 className="text-lg font-semibold text-slate-900">{t("onb.welcomeTitle")}</h2>
          <p className="mt-1 text-sm text-slate-600">{t("onb.welcomeBody")}</p>
          <Field className="mt-4" label={t("onb.orgName")} required>
            <TextInput
              value={orgName}
              placeholder={t("onb.orgNamePh")}
              onChange={(e) => setOrgName(e.target.value)}
              autoFocus
            />
          </Field>
        </>
      )}

      {step === 1 && (
        <>
          <h2 className="text-lg font-semibold text-slate-900">{t("onb.leaseTitle")}</h2>
          <p className="mt-1 text-sm text-slate-600">{t("onb.leaseBody")}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label={t("lease.name")} required className="sm:col-span-2">
              <TextInput value={lease.name} onChange={(e) => setLease({ ...lease, name: e.target.value })} />
            </Field>
            <Field label={t("lease.contactName")}>
              <TextInput
                value={lease.contactName}
                onChange={(e) => setLease({ ...lease, contactName: e.target.value })}
              />
            </Field>
            <Field label={t("lease.phone")}>
              <TextInput
                dir="ltr"
                value={lease.phone}
                onChange={(e) => setLease({ ...lease, phone: e.target.value })}
              />
            </Field>
            <Field label={t("lease.email")} className="sm:col-span-2">
              <TextInput
                dir="ltr"
                type="email"
                value={lease.email}
                onChange={(e) => setLease({ ...lease, email: e.target.value })}
              />
            </Field>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <h2 className="text-lg font-semibold text-slate-900">{t("onb.vehicleTitle")}</h2>
          <p className="mt-1 text-sm text-slate-600">{t("onb.vehicleBody")}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label={t("vehicle.plate")} required>
              <TextInput
                dir="ltr"
                value={vehicle.plate}
                onChange={(e) => setVehicle({ ...vehicle, plate: e.target.value })}
              />
            </Field>
            <Field label={t("vehicle.model")}>
              <TextInput value={vehicle.model} onChange={(e) => setVehicle({ ...vehicle, model: e.target.value })} />
            </Field>
            <Field label={t("vehicle.contractStart")}>
              <DateInput
                value={vehicle.contractStart}
                onChange={(e) => setVehicle({ ...vehicle, contractStart: e.target.value })}
              />
            </Field>
            <Field label={t("vehicle.contractEnd")}>
              <DateInput
                value={vehicle.contractEnd}
                onChange={(e) => setVehicle({ ...vehicle, contractEnd: e.target.value })}
              />
            </Field>
            <Field label={t("vehicle.monthlyCost")}>
              <NumberInput
                value={vehicle.monthlyCost}
                onChange={(e) => setVehicle({ ...vehicle, monthlyCost: e.target.value })}
              />
            </Field>
            <Field label={t("vehicle.annualKmAllowance")}>
              <NumberInput
                value={vehicle.annualKmAllowance}
                onChange={(e) => setVehicle({ ...vehicle, annualKmAllowance: e.target.value })}
              />
            </Field>
            <Field label={t("vehicle.status")}>
              <Select value={vehicle.status} onChange={(e) => setVehicle({ ...vehicle, status: e.target.value })}>
                {vehicleStatusOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {t(o.key)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </>
      )}

      <div className="mt-6 flex items-center justify-between gap-2">
        <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          {t("common.prev")}
        </Button>
        {step < TOTAL - 1 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
            {t("common.next")}
          </Button>
        ) : (
          <Button onClick={finish} disabled={!canNext}>
            {t("common.finish")}
          </Button>
        )}
      </div>
    </Shell>
  );
}

function Shell({ step, total, children }) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-screen items-start justify-center bg-slate-50 p-4 sm:items-center">
      <div className="w-full max-w-xl rounded-md border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded bg-brand-600 text-white">
            <Car size={20} />
          </span>
          <div>
            <div className="text-sm font-semibold text-slate-900">{t("onb.title")}</div>
            <div className="text-xs text-slate-500">{t("onb.step", { n: step, total })}</div>
          </div>
        </div>
        <div className="mb-5 flex gap-1" aria-hidden="true">
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              className={`h-1 flex-1 rounded ${i < step ? "bg-brand-600" : "bg-slate-200"}`}
            />
          ))}
        </div>
        {children}
      </div>
    </div>
  );
}

export default Onboarding;

import { useState } from "react";
import { useI18n } from "../hooks/useI18n.jsx";
import { Field, Select, Checkbox, Textarea } from "./ui/Field.jsx";
import { Button } from "./ui/Button.jsx";
import { enumOptions } from "../utils/options.js";
import {
  COUNTRIES,
  CURRENCIES,
  PROPERTY_TYPES,
  PROPERTY_STATUSES,
  ATTACHMENTS,
  CURRENCY_BY_COUNTRY,
} from "../constants.js";

// טופס פרטי נכס. mode="onboarding" מציג רק כתובת+סוג (זרימה מקוצרת, מסך 0);
// mode="full" מציג את כל השדות כולל פרטים כלכליים (מסך 4 → עריכה).
export function PropertyForm({ initial, mode = "full", onSubmit, onCancel }) {
  const { t } = useI18n();
  const [p, setP] = useState(() => JSON.parse(JSON.stringify(initial)));

  const setAddr = (k, v) => setP({ ...p, address: { ...p.address, [k]: v } });
  const setFin = (k, v) => setP({ ...p, finance: { ...p.finance, [k]: v } });
  const setFinancing = (k, v) =>
    setP({ ...p, finance: { ...p.finance, financing: { ...p.finance.financing, [k]: v } } });
  const setExtra = (k, v) =>
    setP({ ...p, finance: { ...p.finance, extraCosts: { ...p.finance.extraCosts, [k]: v } } });

  // בעת שינוי מדינה — מציע מטבע ברירת מחדל תואם (מטבע נשאר שדה נפרד וניתן לשינוי).
  const onCountryChange = (country) => {
    setP({
      ...p,
      address: { ...p.address, country },
      currency: CURRENCY_BY_COUNTRY[country] || p.currency,
    });
  };

  const toggleAttachment = (a) => {
    const has = p.attachments.includes(a);
    setP({
      ...p,
      attachments: has ? p.attachments.filter((x) => x !== a) : [...p.attachments, a],
    });
  };

  const num = (v) => (v === "" ? null : Number(v));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(p);
      }}
      className="space-y-5"
    >
      {/* כתובת + סוג — תמיד */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select
          label={t("gen.country")}
          value={p.address.country}
          onChange={onCountryChange}
          options={enumOptions(COUNTRIES, "country", t)}
        />
        <Select
          label={t("gen.currency")}
          value={p.currency}
          onChange={(v) => setP({ ...p, currency: v })}
          options={CURRENCIES.map((c) => ({ value: c, label: c }))}
        />
        <Field label={t("addr.city")} value={p.address.city} onChange={(v) => setAddr("city", v)} />
        <Field label={t("addr.street")} value={p.address.street} onChange={(v) => setAddr("street", v)} />
        <Field label={t("addr.number")} value={p.address.number} onChange={(v) => setAddr("number", v)} />
        <Field label={t("addr.apartment")} value={p.address.apartment} onChange={(v) => setAddr("apartment", v)} />
        <Field label={t("addr.floor")} value={p.address.floor} onChange={(v) => setAddr("floor", v)} />
        <Select
          label={t("gen.type")}
          value={p.type}
          onChange={(v) => setP({ ...p, type: v })}
          options={enumOptions(PROPERTY_TYPES, "propertyType", t)}
        />
      </div>

      {mode === "full" && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              label={t("gen.status")}
              value={p.status}
              onChange={(v) => setP({ ...p, status: v })}
              options={enumOptions(PROPERTY_STATUSES, "propertyStatus", t)}
            />
            <Field label={t("gen.area")} type="number" value={p.area ?? ""} onChange={(v) => setP({ ...p, area: num(v) })} />
            <Field label={t("gen.rooms")} type="number" value={p.rooms ?? ""} onChange={(v) => setP({ ...p, rooms: num(v) })} />
            <Field label={t("gen.block")} value={p.block} onChange={(v) => setP({ ...p, block: v })} />
            <Field label={t("gen.parcel")} value={p.parcel} onChange={(v) => setP({ ...p, parcel: v })} />
          </div>

          <div>
            <span className="mb-2 block text-sm font-medium text-ink-body">{t("gen.attachments")}</span>
            <div className="flex flex-wrap gap-3">
              {ATTACHMENTS.map((a) => (
                <Checkbox
                  key={a}
                  label={t(`enum.attachment.${a}`)}
                  checked={p.attachments.includes(a)}
                  onChange={() => toggleAttachment(a)}
                />
              ))}
            </div>
          </div>

          <Textarea label={t("gen.planningNote")} value={p.planningNote} onChange={(v) => setP({ ...p, planningNote: v })} rows={2} />
          <Checkbox label={t("gen.shortTerm")} checked={p.shortTerm} onChange={(v) => setP({ ...p, shortTerm: v })} />

          {/* פרטים כלכליים — בסיס לחישוב התשואה */}
          <fieldset className="rounded-xl border border-border p-4">
            <legend className="px-2 text-sm font-semibold text-ink-body">{t("gen.finance")}</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t("gen.purchaseDate")} type="date" value={p.finance.purchaseDate} onChange={(v) => setFin("purchaseDate", v)} />
              <Field label={t("gen.purchasePrice")} type="number" value={p.finance.purchasePrice ?? ""} onChange={(v) => setFin("purchasePrice", num(v))} />
              <Field label={t("gen.equity")} type="number" value={p.finance.equity ?? ""} onChange={(v) => setFin("equity", num(v))} />
            </div>

            <div className="mt-3">
              <span className="mb-2 block text-sm font-medium text-ink-body">{t("gen.financing")}</span>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label={t("gen.financing.amount")} type="number" value={p.finance.financing.amount ?? ""} onChange={(v) => setFinancing("amount", num(v))} />
                <Field label={t("gen.financing.lender")} value={p.finance.financing.lender} onChange={(v) => setFinancing("lender", v)} />
                <Field label={t("gen.financing.monthly")} type="number" value={p.finance.financing.monthlyPayment ?? ""} onChange={(v) => setFinancing("monthlyPayment", num(v))} />
                <Field label={t("gen.financing.balance")} type="number" value={p.finance.financing.balance ?? ""} onChange={(v) => setFinancing("balance", num(v))} />
              </div>
            </div>

            <div className="mt-3">
              <span className="mb-2 block text-sm font-medium text-ink-body">{t("gen.extraCosts")}</span>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label={t("gen.purchaseTax")} type="number" value={p.finance.extraCosts.purchaseTax ?? ""} onChange={(v) => setExtra("purchaseTax", num(v))} />
                <Field label={t("gen.notary")} type="number" value={p.finance.extraCosts.notary ?? ""} onChange={(v) => setExtra("notary", num(v))} />
                <Field label={t("gen.registration")} type="number" value={p.finance.extraCosts.registration ?? ""} onChange={(v) => setExtra("registration", num(v))} />
                <Field label={t("gen.renovation")} type="number" value={p.finance.extraCosts.renovation ?? ""} onChange={(v) => setExtra("renovation", num(v))} />
                <Field label={t("gen.brokerage")} type="number" value={p.finance.extraCosts.brokerage ?? ""} onChange={(v) => setExtra("brokerage", num(v))} />
                <Field label={t("gen.legal")} type="number" value={p.finance.extraCosts.legal ?? ""} onChange={(v) => setExtra("legal", num(v))} />
              </div>
            </div>
          </fieldset>
        </>
      )}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
        )}
        <Button type="submit">{t("common.save")}</Button>
      </div>
    </form>
  );
}

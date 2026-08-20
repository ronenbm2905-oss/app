import { useState } from "react";
import { useI18n } from "../../hooks/useI18n.jsx";
import { Button, Pill } from "../ui/Button.jsx";
import { Modal } from "../ui/Modal.jsx";
import { IconEdit } from "../ui/icons.jsx";
import { PropertyForm } from "../PropertyForm.jsx";
import { formatCurrency, formatDate, formatNumber } from "../../utils/format.js";

// טאב כללי — תצוגת פרטי הנכס + עריכה מלאה (כולל פרטים כלכליים).
export function GeneralTab({ property, onSave, canEdit }) {
  const { t, lang } = useI18n();
  const [editing, setEditing] = useState(false);
  const c = property.currency;

  return (
    <div className="space-y-5">
      {canEdit && (
        <div className="flex justify-end">
          <Button variant="secondary" onClick={() => setEditing(true)}>
            <IconEdit size={16} /> {t("prop.editProperty")}
          </Button>
        </div>
      )}

      <Section title={t("gen.address")}>
        <Row label={t("gen.country")} value={t(`enum.country.${property.address.country}`)} />
        <Row label={t("addr.city")} value={property.address.city} />
        <Row label={t("addr.street")} value={`${property.address.street} ${property.address.number}`} />
        <Row label={t("addr.apartment")} value={property.address.apartment} />
        <Row label={t("addr.floor")} value={property.address.floor} />
        <Row label={t("gen.currency")} value={c} />
      </Section>

      <Section title={t("gen.type")}>
        <Row label={t("gen.type")} value={t(`enum.propertyType.${property.type}`)} />
        <Row label={t("gen.status")} value={<Pill tone="blue">{t(`enum.propertyStatus.${property.status}`)}</Pill>} />
        <Row label={t("gen.area")} value={property.area ? formatNumber(property.area, lang) : "—"} />
        <Row label={t("gen.rooms")} value={property.rooms ?? "—"} />
        <Row
          label={t("gen.attachments")}
          value={property.attachments.length ? property.attachments.map((a) => t(`enum.attachment.${a}`)).join(", ") : "—"}
        />
        <Row label={t("gen.block")} value={property.block} />
        <Row label={t("gen.parcel")} value={property.parcel} />
        <Row label={t("gen.shortTerm")} value={property.shortTerm ? t("common.yes") : t("common.no")} />
        {property.planningNote && <Row label={t("gen.planningNote")} value={property.planningNote} />}
      </Section>

      <Section title={t("gen.finance")}>
        <Row label={t("gen.purchaseDate")} value={property.finance.purchaseDate ? formatDate(property.finance.purchaseDate, lang) : "—"} />
        <Row label={t("gen.purchasePrice")} value={formatCurrency(property.finance.purchasePrice, c, lang)} />
        <Row label={t("gen.equity")} value={formatCurrency(property.finance.equity, c, lang)} />
        <Row label={t("gen.financing.amount")} value={formatCurrency(property.finance.financing.amount, c, lang)} />
        <Row label={t("gen.financing.lender")} value={property.finance.financing.lender} />
        <Row label={t("gen.financing.monthly")} value={formatCurrency(property.finance.financing.monthlyPayment, c, lang)} />
        <Row label={t("gen.financing.balance")} value={formatCurrency(property.finance.financing.balance, c, lang)} />
      </Section>

      {editing && (
        <Modal title={t("prop.editProperty")} wide onClose={() => setEditing(false)}>
          <PropertyForm
            initial={property}
            mode="full"
            onSubmit={(p) => {
              onSave(p);
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
          />
        </Modal>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-ink-body">{title}</h3>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">{children}</dl>
    </div>
  );
}

function Row({ label, value }) {
  const display = value === "" || value === null || value === undefined ? "—" : value;
  return (
    <div className="flex justify-between gap-4 border-b border-border py-1 text-sm">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-start font-medium text-navy">{display}</dd>
    </div>
  );
}

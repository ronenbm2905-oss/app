import { Phone, MessageCircle, Mail, Lock } from "lucide-react";
import { useI18n } from "../../hooks/useI18n.jsx";
import Card from "../ui/Card.jsx";
import Pill from "../ui/Pill.jsx";
import { formatCurrency, formatDate, formatNumber, telLink, whatsappLink } from "../../utils/format.js";
import { byId, monthlyCostOf, VEHICLE_STATUS_TONE } from "../../utils/options.js";
import { daysUntil, todayIso } from "../../utils/dates.js";

function Row({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 py-1.5 last:border-0">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-900">{children}</dd>
    </div>
  );
}

export function DetailsTab({ vehicle, data }) {
  const { t, lang } = useI18n();
  const company = byId(data.leaseCompanies, vehicle.leaseCompanyId);
  const monthlyCost = monthlyCostOf(data, vehicle.id);
  const left = vehicle.contractEnd ? daysUntil(vehicle.contractEnd, todayIso()) : null;

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card title={t("common.details")}>
        <dl>
          <Row label={t("vehicle.plate")}>
            <span className="num font-medium">{vehicle.plate || "—"}</span>
          </Row>
          <Row label={t("vehicle.manufacturer")}>{vehicle.manufacturer || "—"}</Row>
          <Row label={t("vehicle.model")}>{vehicle.model || "—"}</Row>
          <Row label={t("vehicle.year")}>
            <span className="num">{vehicle.year || "—"}</span>
          </Row>
          <Row label={t("vehicle.status")}>
            <Pill tone={VEHICLE_STATUS_TONE[vehicle.status]}>{t(`vehicle.status.${vehicle.status}`)}</Pill>
          </Row>
          <Row label={t("vehicle.notes")}>{vehicle.notes || "—"}</Row>
        </dl>
      </Card>

      <Card title={t("vehicle.leaseCompany")}>
        <dl>
          <Row label={t("lease.name")}>{company?.name || "—"}</Row>
          <Row label={t("vehicle.contractStart")}>
            <span className="num">{formatDate(vehicle.contractStart, lang)}</span>
          </Row>
          <Row label={t("vehicle.contractEnd")}>
            <span className={`num ${left !== null && left <= 90 ? "font-medium text-amber-700" : ""}`}>
              {formatDate(vehicle.contractEnd, lang)}
              {left !== null && (
                <span className="ms-2 text-xs">
                  {left < 0 ? t("dash.overdueBy", { n: Math.abs(left) }) : t("dash.inDays", { n: left })}
                </span>
              )}
            </span>
          </Row>
          <Row label={t("vehicle.monthlyCost")}>
            {/* D1 — מגיע ממסמך אדמין-בלבד נפרד; לא נשלח למכשיר של נהג. */}
            <span className="num inline-flex items-center gap-1">
              <Lock size={11} className="text-slate-400" />
              {monthlyCost ? formatCurrency(monthlyCost, lang) : "—"}
            </span>
          </Row>
          <Row label={t("vehicle.annualKmAllowance")}>
            <span className="num">
              {vehicle.annualKmAllowance ? formatNumber(vehicle.annualKmAllowance, lang) : "—"}
            </span>
          </Row>
          <Row label={t("vehicle.startKm")}>
            <span className="num">{formatNumber(vehicle.startKm || 0, lang)}</span>
          </Row>
        </dl>

        {company && (company.contactName || company.phone || company.email) && (
          <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-medium text-slate-600">{t("lease.contactName")}</div>
            <div className="text-sm text-slate-900">{company.contactName || "—"}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {company.phone && (
                <>
                  <a
                    href={telLink(company.phone)}
                    className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                  >
                    <Phone size={13} /> {t("lease.call")}
                    <span className="num ms-1 text-slate-500">{company.phone}</span>
                  </a>
                  <a
                    href={whatsappLink(company.phone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                  >
                    <MessageCircle size={13} /> {t("lease.whatsapp")}
                  </a>
                </>
              )}
              {company.email && (
                <a
                  href={`mailto:${company.email}`}
                  className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                >
                  <Mail size={13} />
                  <span className="num">{company.email}</span>
                </a>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

export default DetailsTab;

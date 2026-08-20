import { useI18n } from "../hooks/useI18n.jsx";
import { Button, Pill } from "./ui/Button.jsx";
import { IconPlus, IconWhatsapp } from "./ui/icons.jsx";
import { addressLine, activeLeaseFor, tenantById } from "../utils/display.js";
import { formatCurrency, formatPercent, formatDate, daysUntil, whatsappLink } from "../utils/format.js";
import {
  computeYield,
  openDebtForProperty,
  openTicketsForProperty,
  portfolioTotals,
} from "../utils/finance.js";

// מסך 1 — לובי / רשימת נכסים.
export function Lobby({ data, onOpenProperty, onAddProperty, canEdit }) {
  const { t, lang } = useI18n();
  const { properties, leases, tenants, transactions, debts, tickets } = data;
  const totals = portfolioTotals(data);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-navy">{t("lobby.title")}</h1>
        {canEdit && (
          <Button onClick={onAddProperty}>
            <IconPlus size={16} /> {t("lobby.addProperty")}
          </Button>
        )}
      </div>

      {/* שורת סיכום */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard label={t("lobby.summary.income")} value={formatCurrency(totals.totalAnnualIncome, "ILS", lang)} />
        <SummaryCard label={t("lobby.summary.avgYield")} value={formatPercent(totals.avgYield, lang)} />
        <SummaryCard label={t("lobby.summary.openDebt")} value={formatCurrency(totals.openDebt, "ILS", lang)} tone={totals.openDebt > 0 ? "red" : "slate"} />
      </div>

      {properties.length === 0 ? (
        <div className="rounded-2xl bg-white p-10 text-center text-ink-muted shadow-sm">
          {t("lobby.empty")}
        </div>
      ) : (
        <div className="table-scroll rounded-2xl bg-white shadow-sm">
          <table className="w-full min-w-[880px] text-start text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-ink-muted">
                <Th>{t("lobby.col.address")}</Th>
                <Th>{t("lobby.col.type")}</Th>
                <Th>{t("lobby.col.tenant")}</Th>
                <Th>{t("lobby.col.rent")}</Th>
                <Th>{t("lobby.col.payDay")}</Th>
                <Th>{t("lobby.col.leaseEnd")}</Th>
                <Th>{t("lobby.col.debt")}</Th>
                <Th>{t("lobby.col.tickets")}</Th>
                <Th>{t("lobby.col.yield")}</Th>
              </tr>
            </thead>
            <tbody>
              {properties.map((p) => {
                const lease = activeLeaseFor(p.id, leases);
                const tenant = lease ? tenantById(lease.tenantId, tenants) : null;
                const debt = openDebtForProperty(p.id, debts);
                const openTk = openTicketsForProperty(p.id, tickets);
                const y = computeYield(p, transactions, leases);
                const leaseDays = lease ? daysUntil(lease.endDate) : null;
                const leaseEnding = leaseDays !== null && leaseDays >= 0 && leaseDays <= 30;
                const wa = tenant ? whatsappLink(tenant.phone) : null;
                return (
                  <tr
                    key={p.id}
                    onClick={() => onOpenProperty(p.id)}
                    className="cursor-pointer border-b border-border hover:bg-surface-alt"
                  >
                    <Td>
                      <span className="font-medium text-navy">{addressLine(p)}</span>
                    </Td>
                    <Td className="text-ink-body">{t(`enum.propertyType.${p.type}`)}</Td>
                    <Td>
                      {tenant ? (
                        wa ? (
                          <a
                            href={wa}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-brand-600 hover:underline"
                          >
                            <IconWhatsapp size={14} /> {tenant.fullName}
                          </a>
                        ) : (
                          tenant.fullName
                        )
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td className="text-ink-body">
                      {lease?.monthlyRent ? formatCurrency(lease.monthlyRent, p.currency, lang) : "—"}
                    </Td>
                    <Td className="text-ink-body">
                      {lease?.paymentDay ? t("lobby.payDayShort", { day: lease.paymentDay }) : "—"}
                    </Td>
                    <Td>
                      {lease?.endDate ? (
                        <span className={leaseEnding ? "font-medium text-amber-700" : "text-ink-body"}>
                          {formatDate(lease.endDate, lang)}
                          {leaseEnding && <span className="ms-1">⚠</span>}
                        </span>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td>
                      {debt > 0 ? (
                        <Pill tone="red">{formatCurrency(debt, p.currency, lang)}</Pill>
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </Td>
                    <Td>
                      {openTk > 0 ? <Pill tone="amber">{openTk}</Pill> : <span className="text-ink-faint">—</span>}
                    </Td>
                    <Td>
                      <span className={y !== null && y < (data.settings?.lowYieldThreshold ?? 3) ? "font-medium text-red-600" : "text-ink-body"}>
                        {formatPercent(y, lang)}
                      </span>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, tone = "slate" }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="text-xs text-ink-muted">{label}</div>
      <div className={`mt-1 text-xl font-bold ${tone === "red" ? "text-red-600" : "text-navy"}`}>
        {value}
      </div>
    </div>
  );
}

function Th({ children }) {
  return <th className="px-3 py-2 text-start font-medium">{children}</th>;
}
function Td({ children, className = "" }) {
  return <td className={`px-3 py-3 ${className}`}>{children}</td>;
}

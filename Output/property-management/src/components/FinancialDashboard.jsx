import { useI18n } from "../hooks/useI18n.jsx";
import { IconBuilding, IconWallet, IconYield, IconWarning } from "./ui/icons.jsx";
import { addressLine, activeLeaseFor } from "../utils/display.js";
import { formatCurrency, formatPercent, daysUntil } from "../utils/format.js";
import { portfolioTotals, computeYield, openDebtForProperty } from "../utils/finance.js";

// מסך 2 — דשבורד כלכלי.
export function FinancialDashboard({ data, onOpenProperty }) {
  const { t, lang } = useI18n();
  const totals = portfolioTotals(data);
  const threshold = data.settings?.lowYieldThreshold ?? 3;
  const chart = monthlySeries(data.transactions);
  const critical = criticalSituations(data, threshold, t, lang);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="mb-4 text-xl font-bold text-navy">{t("fin.title")}</h1>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={<IconBuilding size={18} />} label={t("fin.kpi.properties")} value={totals.propertyCount} />
        <Kpi icon={<IconWallet size={18} />} label={t("fin.kpi.netMonthly")} value={formatCurrency(totals.netCashflowMonthly, "ILS", lang)} />
        <Kpi icon={<IconYield size={18} />} label={t("fin.kpi.avgYield")} value={formatPercent(totals.avgYield, lang)} />
        <Kpi icon={<IconWarning size={18} />} label={t("fin.kpi.lowYield")} value={formatPercent(totals.lowYieldPct, lang)} hint={t("fin.lowYieldHint", { threshold })} />
      </div>

      {/* גרף הכנסות/הוצאות */}
      <div className="mb-5 rounded-2xl bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-ink-body">{t("fin.chart.title")}</h3>
        {chart.length === 0 ? (
          <p className="text-sm text-ink-muted">{t("fin.chart.empty")}</p>
        ) : (
          <BarChart data={chart} lang={lang} labels={{ income: t("fin.chart.income"), expenses: t("fin.chart.expenses") }} />
        )}
      </div>

      {/* מצבים קריטיים */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-ink-body">{t("fin.critical.title")}</h3>
        {critical.length === 0 ? (
          <p className="text-sm text-ink-muted">{t("fin.critical.none")}</p>
        ) : (
          <ul className="space-y-2">
            {critical.map((c, i) => (
              <li
                key={i}
                onClick={() => onOpenProperty(c.propertyId)}
                className="flex cursor-pointer items-center justify-between rounded-lg bg-surface-alt px-3 py-2 text-sm hover:bg-surface-sunk"
              >
                <span className="font-medium text-ink-body">{c.address}</span>
                <span className="text-red-600">{c.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, hint }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs text-ink-muted">
        <span className="text-brand-500">{icon}</span>
        {label}
      </div>
      <div className="mt-1 text-xl font-bold text-navy">{value}</div>
      {hint && <div className="mt-1 text-[11px] text-ink-faint">{hint}</div>}
    </div>
  );
}

// גרף עמודות פשוט ב-SVG (בלי ספריות) — הכנסות מול הוצאות לכל חודש.
function BarChart({ data, lang, labels }) {
  const max = Math.max(...data.flatMap((d) => [d.income, d.expenses]), 1);
  const barW = 14;
  const gap = 8;
  const groupW = barW * 2 + gap;
  const chartW = data.length * (groupW + 16);
  const chartH = 160;
  return (
    <div className="space-y-3">
      <div className="table-scroll">
        <svg width={Math.max(chartW, 300)} height={chartH + 24} role="img" aria-label={labels.income + " / " + labels.expenses}>
          {data.map((d, i) => {
            const x = i * (groupW + 16) + 8;
            const incH = (d.income / max) * chartH;
            const expH = (d.expenses / max) * chartH;
            return (
              <g key={i}>
                <rect x={x} y={chartH - incH} width={barW} height={incH} rx={2} className="fill-green-500" />
                <rect x={x + barW + gap} y={chartH - expH} width={barW} height={expH} rx={2} className="fill-red-400" />
                <text x={x + barW} y={chartH + 16} textAnchor="middle" className="fill-ink-faint text-[9px]">
                  {d.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="flex gap-4 text-xs text-ink-body">
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-green-500" /> {labels.income}</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-red-400" /> {labels.expenses}</span>
      </div>
    </div>
  );
}

// אגרגציה חודשית של תנועות ל-12 החודשים האחרונים.
function monthlySeries(transactions) {
  if (!transactions || transactions.length === 0) return [];
  const months = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: `${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`, income: 0, expenses: 0 });
  }
  const idx = Object.fromEntries(months.map((m, i) => [m.key, i]));
  let any = false;
  for (const tx of transactions) {
    if (!tx.date) continue;
    const key = tx.date.slice(0, 7);
    if (idx[key] === undefined) continue;
    const amt = Number(tx.amount) || 0;
    if (tx.type === "income") months[idx[key]].income += amt;
    else months[idx[key]].expenses += amt;
    any = true;
  }
  return any ? months : [];
}

// רשימת מצבים קריטיים: תשואה נמוכה, חוב פתוח, חוזה מסתיים תוך 30 יום.
function criticalSituations(data, threshold, t, lang) {
  const out = [];
  for (const p of data.properties) {
    const addr = addressLine(p);
    const y = computeYield(p, data.transactions, data.leases);
    if (y !== null && y < threshold) {
      out.push({ propertyId: p.id, address: addr, text: t("fin.critical.lowYield", { yield: formatPercent(y, lang) }) });
    }
    const debt = openDebtForProperty(p.id, data.debts);
    if (debt > 0) {
      out.push({ propertyId: p.id, address: addr, text: t("fin.critical.debt", { amount: formatCurrency(debt, p.currency, lang) }) });
    }
    const lease = activeLeaseFor(p.id, data.leases);
    const days = lease ? daysUntil(lease.endDate) : null;
    if (days !== null && days >= 0 && days <= 30) {
      out.push({ propertyId: p.id, address: addr, text: t("fin.critical.leaseEnding", { days }) });
    }
  }
  return out;
}

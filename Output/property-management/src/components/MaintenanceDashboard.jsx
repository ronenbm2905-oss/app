import { useI18n } from "../hooks/useI18n.jsx";
import { Button, Pill } from "./ui/Button.jsx";
import { IconPlus } from "./ui/icons.jsx";
import { addressLine } from "../utils/display.js";
import { formatCurrency, formatDate, daysUntil } from "../utils/format.js";

const STATUS_TONE = { open: "amber", inProgress: "blue", closed: "green" };

// מסך 3 — דשבורד תקלות. מסך-רוחב: כל התקלות הפתוחות מכל הנכסים.
// מיון ברירת-מחדל: זמן פתיחה יורד (החדשות ראשונות).
export function MaintenanceDashboard({ data, onOpenProperty, onNewTicket, onEditTicket }) {
  const { t, lang } = useI18n();
  const propById = Object.fromEntries(data.properties.map((p) => [p.id, p]));

  const openTickets = data.tickets
    .filter((tk) => tk.status !== "closed")
    .sort((a, b) => (b.openedDate || "").localeCompare(a.openedDate || ""));

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy">{t("maint.title")}</h1>
          <p className="text-sm text-ink-muted">{t("maint.openCount", { count: openTickets.length })}</p>
        </div>
        <Button onClick={onNewTicket}>
          <IconPlus size={16} /> {t("maint.newTicket")}
        </Button>
      </div>

      {openTickets.length === 0 ? (
        <div className="rounded-2xl bg-white p-10 text-center text-ink-muted shadow-sm">{t("maint.empty")}</div>
      ) : (
        <div className="table-scroll rounded-2xl bg-white shadow-sm">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-ink-muted">
                <th className="px-3 py-2 text-start">{t("maint.col.property")}</th>
                <th className="px-3 py-2 text-start">{t("maint.col.opened")}</th>
                <th className="px-3 py-2 text-start">{t("maint.col.type")}</th>
                <th className="px-3 py-2 text-start">{t("maint.col.handler")}</th>
                <th className="px-3 py-2 text-start">{t("maint.col.daysOpen")}</th>
                <th className="px-3 py-2 text-start">{t("maint.col.cost")}</th>
                <th className="px-3 py-2 text-start">{t("maint.col.status")}</th>
              </tr>
            </thead>
            <tbody>
              {openTickets.map((tk) => {
                const p = propById[tk.propertyId];
                const days = daysUntil(tk.openedDate);
                const daysOpen = days === null ? "—" : Math.max(0, -days);
                return (
                  <tr
                    key={tk.id}
                    onClick={() => onEditTicket(tk.propertyId, tk.id)}
                    className="cursor-pointer border-b border-border hover:bg-surface-alt"
                  >
                    <td className="px-3 py-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenProperty(tk.propertyId);
                        }}
                        className="font-medium text-brand-600 hover:underline"
                      >
                        {p ? addressLine(p) : "—"}
                      </button>
                    </td>
                    <td className="px-3 py-3 text-ink-body">{formatDate(tk.openedDate, lang)}</td>
                    <td className="px-3 py-3 text-ink-body">{t(`enum.ticketType.${tk.type}`)}</td>
                    <td className="px-3 py-3 text-ink-body">{tk.handler?.name || "—"}</td>
                    <td className="px-3 py-3 text-ink-body">{daysOpen}</td>
                    <td className="px-3 py-3 text-ink-body">{formatCurrency(tk.cost ?? tk.quote, p?.currency || "ILS", lang)}</td>
                    <td className="px-3 py-3">
                      <Pill tone={STATUS_TONE[tk.status]}>{t(`enum.ticketStatus.${tk.status}`)}</Pill>
                    </td>
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

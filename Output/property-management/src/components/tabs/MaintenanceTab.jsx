import { useI18n } from "../../hooks/useI18n.jsx";
import { Button, Pill } from "../ui/Button.jsx";
import { IconPlus, IconEdit, IconDelete } from "../ui/icons.jsx";
import { formatCurrency, formatDate } from "../../utils/format.js";

const STATUS_TONE = { open: "amber", inProgress: "blue", closed: "green" };

// טאב תקלות (בתוך נכס). פתיחה/עריכה עוברות דרך TicketForm (מסך 5) ברמת האפליקציה.
export function MaintenanceTab({ property, data, onNewTicket, onEditTicket, onDelete, canEdit }) {
  const { t, lang } = useI18n();
  const c = property.currency;
  const tickets = data.tickets
    .filter((tk) => tk.propertyId === property.id)
    .sort((a, b) => (b.openedDate || "").localeCompare(a.openedDate || ""));

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink-body">{t("ptkt.title")}</h3>
        {canEdit && (
          <Button onClick={onNewTicket}>
            <IconPlus size={16} /> {t("ptkt.add")}
          </Button>
        )}
      </div>
      {tickets.length === 0 ? (
        <p className="text-sm text-ink-muted">{t("ptkt.none")}</p>
      ) : (
        <div className="table-scroll">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-ink-muted">
                <th className="px-2 py-2 text-start">{t("maint.col.opened")}</th>
                <th className="px-2 py-2 text-start">{t("maint.col.type")}</th>
                <th className="px-2 py-2 text-start">{t("maint.col.handler")}</th>
                <th className="px-2 py-2 text-start">{t("maint.col.cost")}</th>
                <th className="px-2 py-2 text-start">{t("maint.col.status")}</th>
                {canEdit && <th className="px-2 py-2"></th>}
              </tr>
            </thead>
            <tbody>
              {tickets.map((tk) => (
                <tr key={tk.id} className="border-b border-border">
                  <td className="px-2 py-2 text-ink-body">{formatDate(tk.openedDate, lang)}</td>
                  <td className="px-2 py-2 text-ink-body">{t(`enum.ticketType.${tk.type}`)}</td>
                  <td className="px-2 py-2 text-ink-body">{tk.handler?.name || "—"}</td>
                  <td className="px-2 py-2 text-ink-body">{formatCurrency(tk.cost ?? tk.quote, c, lang)}</td>
                  <td className="px-2 py-2">
                    <Pill tone={STATUS_TONE[tk.status]}>{t(`enum.ticketStatus.${tk.status}`)}</Pill>
                  </td>
                  {canEdit && (
                    <td className="px-2 py-2">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => onEditTicket(tk.id)} aria-label={t("common.edit")} className="text-ink-faint hover:text-brand-600">
                          <IconEdit size={16} />
                        </button>
                        <button onClick={() => onDelete(tk.id)} aria-label={t("common.delete")} className="text-ink-faint hover:text-red-600">
                          <IconDelete size={16} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

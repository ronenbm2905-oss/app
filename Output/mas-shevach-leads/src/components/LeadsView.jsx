import { useMemo, useState } from "react";
import { Inbox, Lock } from "lucide-react";
import { Banner } from "./ui/Banner";
import { LeadRow, LeadCard } from "./LeadRow";
import { t } from "../i18n";
import { LEAD_STATUS_VALUES } from "../constants";

export function LeadsView({ leads, loading, error, busyId, onStatusChange, dueForPurgeCount }) {
  const [filter, setFilter] = useState("all");

  const shown = useMemo(
    () => (filter === "all" ? leads : leads.filter((l) => (l.status || "new") === filter)),
    [leads, filter]
  );

  if (loading) {
    return <p className="py-16 text-center text-ink-soft">{t("loading")}</p>;
  }

  if (error) {
    return (
      <Banner tone="danger" title={t("loadFailed")}>
        <p>{t("loadFailedBody")}</p>
        <p className="mt-2">{t("notAuthorizedBody")}</p>
      </Banner>
    );
  }

  return (
    <div className="space-y-4">
      {dueForPurgeCount > 0 && (
        <Banner tone="warn">{t("duePurgeBanner", dueForPurgeCount)}</Banner>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-ink-soft">{t("total", leads.length)}</span>
        <div className="flex flex-wrap gap-1" role="group" aria-label={t("colStatus")}>
          {["all", ...LEAD_STATUS_VALUES].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              aria-pressed={filter === s}
              className={`rounded-full border px-3 py-1 text-xs transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                filter === s
                  ? "border-accent bg-accent text-white"
                  : "border-paper-line bg-paper-card text-ink-soft hover:border-accent/40"
              }`}
            >
              {s === "all" ? t("filterAll") : t(`status_${s}`)}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-lg border border-dashed border-paper-line bg-paper-card py-16 text-center">
          <Inbox className="mx-auto h-8 w-8 text-ink-faint" aria-hidden="true" />
          <p className="mt-3 font-medium text-ink">{t("emptyTitle")}</p>
          <p className="mt-1 text-sm text-ink-soft">{t("emptyBody")}</p>
        </div>
      ) : (
        <>
        {/* מובייל — כרטיסים. זו התצוגה העיקרית: משה עובד מהטלפון בזמן חיוג. */}
        <ul className="space-y-2 md:hidden">
          {shown.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              busy={busyId === lead.id}
              onStatusChange={onStatusChange}
            />
          ))}
        </ul>

        {/* דסקטופ — טבלה */}
        <div className="hidden overflow-x-auto rounded-lg border border-paper-line bg-paper-card md:block">
          <table className="w-full text-right">
            <caption className="sr-only">{t("appTitle")}</caption>
            <thead>
              <tr className="border-b border-paper-line bg-paper text-xs text-ink-soft">
                <th scope="col" className="px-3 py-2 font-medium">{t("colName")}</th>
                <th scope="col" className="px-3 py-2 font-medium">{t("colPhone")}</th>
                <th scope="col" className="px-3 py-2 font-medium">{t("colEmail")}</th>
                <th scope="col" className="px-3 py-2 font-medium">{t("colCreated")}</th>
                <th scope="col" className="px-3 py-2 font-medium">{t("colStatus")}</th>
                <th scope="col" className="px-3 py-2 font-medium">{t("colRetention")}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((lead) => (
                <LeadRow
                  key={lead.id}
                  lead={lead}
                  busy={busyId === lead.id}
                  onStatusChange={onStatusChange}
                />
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}

      {/* ====================================================================
          🔴 אין כאן כפתור ייצוא, ולא בטעות (עדי R-9).
          "אם משה קורא לידים מהטלפון הפרטי, מייצא ל-Excel או מעביר בוואטסאפ,
           כל R-1..R-8 מנוטרלים." רשימה שיצאה מהמערכת אינה מוגנת עוד בכללים
          שלה, ומחיקה שאינה כוללת אותה אינה מחיקה (S8(5)).
          ההודעה למטה קיימת כדי שהיעדר הכפתור ייקרא כהחלטה ולא כפיצ'ר חסר.
          ==================================================================== */}
      <div className="flex gap-3 rounded-lg border border-paper-line bg-paper p-3 text-xs text-ink-soft">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" aria-hidden="true" />
        <div>
          <p className="font-semibold text-ink">{t("noExportTitle")}</p>
          <p>{t("noExportBody")}</p>
        </div>
      </div>
    </div>
  );
}

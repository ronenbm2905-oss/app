// ============================================================================
// שתי תצוגות לאותו ליד:
//   · `LeadCard` — מובייל. זו התצוגה **העיקרית**: משה עובד מהטלפון בזמן
//     שהוא מחייג. טבלה ברוחב 860px על מסך 390px אינה נגישה גם כשהיא
//     גוללת אופקית, ובעברית (RTL) הגלישה גם דולפת ל-scroll של המסמך כולו.
//   · `LeadRow`  — שורת טבלה, מ-md ומעלה.
// הרכיבים המשותפים (סטטוס, שעון מחיקה) מוגדרים פעם אחת ומשמשים את שניהם.
// ============================================================================

import { Mail, Phone, ShieldCheck, Trash2 } from "lucide-react";
import { Badge } from "./ui/Badge";
import { t } from "../i18n";
import { LEAD_STATUS_VALUES } from "../constants";
import { daysUntilPurge } from "../utils/retention";
import { formatDateTime, formatPhone, formatSource } from "../utils/format";

const STATUS_TONE = {
  new: "accent",
  attempted: "warn",
  contacted: "good",
  refused: "danger",
  converted: "good",
};

export function RetentionCell({ lead }) {
  if (lead.purgedAt) {
    return (
      <Badge tone="neutral" title={t("purgedBody")}>
        <Trash2 className="h-3 w-3" aria-hidden="true" />
        {t("purged")}
      </Badge>
    );
  }
  const days = daysUntilPurge(lead);
  if (days == null) return <span className="text-ink-faint">—</span>;
  if (days < 0) return <Badge tone="danger">{t("retentionOverdue")}</Badge>;
  if (days === 0) return <Badge tone="danger">{t("retentionToday")}</Badge>;
  // מתחת ל-30 יום — צהוב. לא קישוט: זה החלון שבו עוד אפשר לפעול לפני
  // שהליד נמחק, והמחיקה אינה הפיכה.
  return <Badge tone={days <= 30 ? "warn" : "neutral"}>{t("retentionDue", days)}</Badge>;
}

export function StatusSelect({ lead, onStatusChange, busy, idPrefix }) {
  const id = `${idPrefix}-${lead.id}`;
  return (
    <>
      <label className="sr-only" htmlFor={id}>
        {t("statusChange")}
      </label>
      <select
        id={id}
        className="w-full rounded-md border border-paper-line bg-paper-card px-2 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50 sm:w-auto"
        value={lead.status || "new"}
        disabled={busy || Boolean(lead.purgedAt)}
        onChange={(e) => onStatusChange(lead.id, e.target.value)}
      >
        {LEAD_STATUS_VALUES.map((s) => (
          <option key={s} value={s}>
            {t(`status_${s}`)}
          </option>
        ))}
      </select>
    </>
  );
}

function NameCell({ lead }) {
  const purged = Boolean(lead.purgedAt);
  return (
    <div className="flex items-center gap-2">
      <span className={`font-medium ${purged ? "italic text-ink-faint" : "text-ink"}`}>
        {purged ? t("purged") : lead.firstName}
      </span>
      {lead.screened && (
        <Badge tone="good" title={t("screenedYes")}>
          <ShieldCheck className="h-3 w-3" aria-hidden="true" />
        </Badge>
      )}
    </div>
  );
}

function PhoneLink({ lead }) {
  if (lead.purgedAt) return <span className="text-ink-faint">—</span>;
  return (
    <a
      href={`tel:${lead.phone}`}
      className="inline-flex items-center gap-1 tabular-nums text-accent hover:underline"
    >
      <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {formatPhone(lead.phone)}
    </a>
  );
}

function EmailLink({ lead }) {
  if (lead.purgedAt || !lead.email) return <span className="text-ink-faint">{t("noEmail")}</span>;
  return (
    <a
      href={`mailto:${lead.email}`}
      className="inline-flex min-w-0 items-center gap-1 text-accent hover:underline"
    >
      <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">{lead.email}</span>
    </a>
  );
}

// -- מובייל -----------------------------------------------------------------
export function LeadCard({ lead, onStatusChange, busy }) {
  return (
    <li className="rounded-lg border border-paper-line bg-paper-card p-3">
      <div className="flex items-start justify-between gap-2">
        <NameCell lead={lead} />
        <RetentionCell lead={lead} />
      </div>

      <div className="mt-2 space-y-1 text-sm">
        <PhoneLink lead={lead} />
        <div className="min-w-0">
          <EmailLink lead={lead} />
        </div>
      </div>

      {/* 🔴 M4 — אין כאן תג דיוור. ההסכמה לדיוור ירדה לגמרי מהמערכת. */}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-faint">
        <span>{formatDateTime(lead.createdAt)}</span>
        <span aria-hidden="true">·</span>
        <span>{formatSource(lead.source)}</span>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <StatusSelect lead={lead} onStatusChange={onStatusChange} busy={busy} idPrefix="mstatus" />
        <Badge tone={STATUS_TONE[lead.status || "new"]}>
          {busy ? t("statusSaving") : t(`status_${lead.status || "new"}`)}
        </Badge>
      </div>
    </li>
  );
}

// -- דסקטופ -----------------------------------------------------------------
export function LeadRow({ lead, onStatusChange, busy }) {
  return (
    <tr className="border-b border-paper-line align-top last:border-0">
      <td className="px-3 py-3">
        <NameCell lead={lead} />
        <div className="mt-1 text-xs text-ink-faint">{formatSource(lead.source)}</div>
      </td>
      <td className="px-3 py-3">
        <PhoneLink lead={lead} />
      </td>
      <td className="max-w-[220px] px-3 py-3">
        <EmailLink lead={lead} />
      </td>
      <td className="px-3 py-3 text-sm text-ink-soft">{formatDateTime(lead.createdAt)}</td>
      <td className="px-3 py-3">
        <StatusSelect lead={lead} onStatusChange={onStatusChange} busy={busy} idPrefix="status" />
        <div className="mt-1">
          <Badge tone={STATUS_TONE[lead.status || "new"]}>
            {busy ? t("statusSaving") : t(`status_${lead.status || "new"}`)}
          </Badge>
        </div>
      </td>
      <td className="px-3 py-3">
        <RetentionCell lead={lead} />
      </td>
      {/* 🔴 M4 — עמודת הדיוור הוסרה יחד עם ההסכמה עצמה. */}
    </tr>
  );
}

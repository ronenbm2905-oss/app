import { ChevronLeft } from "lucide-react";
import { useI18n } from "../hooks/useI18n.jsx";
import { computeStatus, engineMessage, bucketForTask } from "../utils/reminders.js";
import { vehicleLabel } from "../utils/options.js";
import { formatDate } from "../utils/format.js";
import { StatusPill, ImportantMark } from "./ui/StatusPill.jsx";

// ============================================================================
// TaskCard — שורת משימה ברשימה. כרטיס-קישור: **כל הכרטיס** הוא יעד המגע,
// ולכן אין בתוכו כפתור מקונן.
// ============================================================================

export function TaskCard({ task, vehicle, today }) {
  const { t, lang } = useI18n();
  const status = computeStatus(task, today);
  const label = vehicleLabel(vehicle);
  const msg = engineMessage(task, label, today);
  const bucket = bucketForTask(task, today);

  // כותרת: משפט המנוע כשהמשימה בטווח; אחרת שם הסוג / מה שהמשתמש כתב.
  const title = msg ? t(msg.titleKey, { ...msg.vars, coverage: t(msg.vars.coverageKey) }) : task.title || t(`task.type.${task.type}`);

  return (
    <a
      href={`#/task/${task.id}`}
      className="block rounded-2xl border border-line bg-surface p-4 shadow-card transition hover:bg-brand-50 active:bg-brand-100"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-ink">{title}</h3>
          <p className="text-lg text-ink-muted">
            {label} · <span className="num">{formatDate(task.dueDate, lang)}</span>
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <StatusPill status={status} />
            {task.important && <ImportantMark />}
          </div>
        </div>
        <ChevronLeft size={24} className="icon-flip mt-1 shrink-0 text-ink-muted" aria-hidden="true" />
      </div>
      {/* הדלי לא מוצג כמספר — הוא כבר בתוך משפט המנוע. */}
      {bucket && msg && <p className="mt-3 max-w-prose text-lg text-ink-soft">{t(msg.subKey, msg.vars)}</p>}
    </a>
  );
}

export default TaskCard;

import { Circle, Clock, CalendarCheck, AlertTriangle, CheckCircle2, Star } from "lucide-react";
import { useI18n } from "../../hooks/useI18n.jsx";

// ============================================================================
// StatusPill — מקור: itai/Outputs/2026-08-13-nrcar-design.md §5.2.
//
// **שלושה סימנים בכל גלולה: צורת אייקון + מילה בעברית + צבע** (WCAG 1.4.1).
// גם בצילום שחור-לבן וגם לעיוור צבעים, המצב קריא. הגבול תמיד בצבע הטקסט —
// כך הוא עובר 3:1 מכוח החישוב של הטקסט, בלי טוקן נוסף.
//
// גלולה היא **תווית, לא כפתור**: אין לה יעד מגע ואין לה onClick.
// ============================================================================

const STATUS = {
  open: { icon: Circle, cls: "bg-surface-sunken text-ink-soft border-ink-soft" }, // 8.40:1 ✓
  upcoming: { icon: Clock, cls: "bg-warn-100 text-warn-700 border-warn-700" }, // 6.37:1 ✓
  inProgress: { icon: CalendarCheck, cls: "bg-brand-100 text-brand-700 border-brand-700" }, // 7.15:1 ✓
  overdue: { icon: AlertTriangle, cls: "bg-danger-100 text-danger-700 border-danger-700" }, // 6.80:1 ✓
  done: { icon: CheckCircle2, cls: "bg-ok-100 text-ok-700 border-ok-700" }, // 6.78:1 ✓
};

export function StatusPill({ status = "open", className = "" }) {
  const { t } = useI18n();
  const conf = STATUS[status] || STATUS.open;
  const Icon = conf.icon;
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1 text-base font-semibold ${conf.cls} ${className}`}
    >
      <Icon size={20} aria-hidden="true" />
      {t(`task.status.${status}`)}
    </span>
  );
}

// "חשוב" — העדיפות הבינארית של PRD §3.4. כוכבית **ועוד מילה**, לא כוכבית לבד.
export function ImportantMark({ className = "" }) {
  const { t } = useI18n();
  return (
    <span className={`inline-flex items-center gap-2 text-base font-semibold text-warn-600 ${className}`}>
      <Star size={20} className="fill-warn-600" aria-hidden="true" />
      {t("task.important.on")}
    </span>
  );
}

export default StatusPill;

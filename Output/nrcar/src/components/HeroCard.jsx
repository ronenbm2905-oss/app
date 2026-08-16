import { AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import { useI18n } from "../hooks/useI18n.jsx";
import {
  computeStatus,
  engineMessage,
  attributionFor,
  fixActionKey,
} from "../utils/reminders.js";
import { vehicleLabel } from "../utils/options.js";
import { formatDate } from "../utils/format.js";
import { StatusPill } from "./ui/StatusPill.jsx";
import Button, { LinkButton } from "./ui/Button.jsx";

// ============================================================================
// HeroCard — "מה דורש את תשומת הלב שלי עכשיו", בשנייה אחת (PRD §4.2).
//
// **הגיבור מדבר על משימה אחת בדיוק.** שתי דחיפויות בכרטיס אחד = בלבול.
// שלוש וריאציות לפי הסטטוס (מפרט איתי §6.1); הכותרת עוברת AA בכל אחת.
// ============================================================================

const VARIANTS = {
  overdue: {
    card: "bg-danger-50 border-2 border-danger-600",
    title: "text-danger-900", // 9.16:1 ✓
    icon: AlertTriangle,
    iconCls: "text-danger-600",
  },
  upcoming: {
    card: "bg-warn-100 border-2 border-warn-600",
    title: "text-ink-strong", // 13.14:1 ✓
    icon: Clock,
    iconCls: "text-warn-700",
  },
  clear: {
    card: "bg-ok-50 border border-ok-600",
    title: "text-ink-strong",
    icon: CheckCircle2,
    iconCls: "text-ok-600",
  },
};

export function HeroCard({ task, vehicle, today, onFix }) {
  const { t, lang } = useI18n();

  // -- "הכול מסודר": אין פעולה, ולכן **אין כפתור ראשי** ------------------
  if (!task) {
    const v = VARIANTS.clear;
    const Icon = v.icon;
    return (
      <section aria-live="polite" className={`space-y-3 rounded-2xl p-4 shadow-hero ${v.card}`}>
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-surface">
          <Icon size={32} className={v.iconCls} aria-hidden="true" />
        </span>
        <h2 className={`text-balance text-2xl font-bold ${v.title}`}>{t("dashboard.allClear.title")}</h2>
        <p className="max-w-prose text-lg text-ink">{t("dashboard.allClear.sub")}</p>
      </section>
    );
  }

  const status = computeStatus(task, today);
  const v = VARIANTS[status === "overdue" ? "overdue" : "upcoming"];
  const Icon = v.icon;
  const label = vehicleLabel(vehicle);
  const msg = engineMessage(task, label, today);
  const attribution = attributionFor(task, vehicle, today);

  const title = msg
    ? t(msg.titleKey, { ...msg.vars, coverage: t(msg.vars.coverageKey) })
    : task.title || t(`task.type.${task.type}`);
  const sub = msg ? t(msg.subKey, { ...msg.vars, coverage: t(msg.vars.coverageKey) }) : "";

  return (
    <section aria-live="polite" className={`space-y-3 rounded-2xl p-4 shadow-hero ${v.card}`}>
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-surface">
        <Icon size={32} className={v.iconCls} aria-hidden="true" />
      </span>

      <p className="text-sm font-medium text-ink-soft">{t("dashboard.hero.label")}</p>
      <h2 className={`text-balance text-2xl font-bold ${v.title}`}>{title}</h2>
      {sub && <p className="max-w-prose text-lg text-ink">{sub}</p>}

      <p className="text-lg text-ink">
        {t("task.due", { date: "" })}
        <span className="num">{formatDate(task.dueDate, lang)}</span>
      </p>

      {/* ★ שורת ייחוס-העובדה. מפרידה בין הכלל (של החוק) לעובדה (שלנו). */}
      {attribution && (
        <p className="max-w-prose text-sm text-ink-soft">{t(attribution.key, attribution.vars)}</p>
      )}

      <StatusPill status={status} />

      {/* ★ פעולת התיקון בלחיצה אחת — יציאה מיידית כשהאפליקציה טועה. */}
      {status === "overdue" && onFix && (
        <Button variant="confirm" onClick={() => onFix(task)}>
          {t(fixActionKey(task))}
        </Button>
      )}
      <LinkButton
        href={`#/task/${task.id}`}
        variant={status === "overdue" ? "secondary" : "primary"}
      >
        {t("dashboard.hero.cta.open")}
      </LinkButton>
    </section>
  );
}

export default HeroCard;

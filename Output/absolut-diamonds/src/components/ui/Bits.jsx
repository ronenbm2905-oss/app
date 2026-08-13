import { useI18n } from "../../hooks/useI18n.jsx";

// רכיבים קטנים משותפים. יושבים יחד כי כל אחד מהם קצר מדי לקובץ משלו.

export function Badge({ children, tone = "neutral", className = "" }) {
  const tones = {
    neutral: "bg-sand text-ink border-line",
    rose: "bg-rose-50 text-rose-800 border-rose-200",
    gold: "bg-amber-50 text-gold-600 border-amber-200",
    warn: "bg-amber-100 text-amber-900 border-amber-300",
    danger: "bg-red-50 text-red-800 border-red-200",
    success: "bg-emerald-50 text-emerald-800 border-emerald-200",
    lab: "bg-sky-50 text-sky-900 border-sky-200",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-sm font-medium ${
        tones[tone] || tones.neutral
      } ${className}`}
    >
      {children}
    </span>
  );
}

// צ'יפ סינון — כפתור דו-מצבי. aria-pressed הוא מה שהופך אותו לנגיש;
// בלעדיו קורא מסך שומע "עגול" ולא יודע שהוא נבחר.
export function Chip({ selected, children, className = "", ...props }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`min-h-11 rounded-full border px-4 text-base transition-colors ${
        selected
          ? "border-rose-600 bg-rose-600 text-white"
          : "border-line bg-white text-ink hover:border-rose-300 hover:bg-rose-50"
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function SectionTitle({ children, sub, id, className = "" }) {
  return (
    <div className={`mb-6 ${className}`}>
      <h2 id={id} className="text-2xl font-semibold sm:text-3xl">
        {children}
      </h2>
      {sub ? <p className="mt-2 text-muted">{sub}</p> : null}
    </div>
  );
}

export function EmptyState({ title, body, action }) {
  return (
    <div className="card px-6 py-12 text-center">
      <p className="text-lg font-medium">{title}</p>
      {body ? <p className="mx-auto mt-2 max-w-md text-muted">{body}</p> : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Spinner({ label }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-muted" role="status">
      <span
        className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-rose-600"
        aria-hidden="true"
      />
      <span>{label || t("common.loading")}</span>
    </div>
  );
}

// באנר הודעה. role="alert" רק לשגיאות — אחרת קורא מסך מקטיע את המשתמש
// על כל הודעה אינפורמטיבית.
export function Notice({ tone = "info", children, className = "" }) {
  const tones = {
    info: "border-line bg-white text-ink",
    warn: "border-amber-300 bg-amber-50 text-amber-950",
    danger: "border-red-300 bg-red-50 text-red-900",
    success: "border-emerald-300 bg-emerald-50 text-emerald-900",
  };
  return (
    <div
      role={tone === "danger" ? "alert" : undefined}
      className={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${tones[tone] || tones.info} ${className}`}
    >
      {children}
    </div>
  );
}

import { Check, X } from "lucide-react";
import { useI18n } from "../../hooks/useI18n.jsx";

// רכיבים קטנים משותפים. יושבים יחד כי כל אחד מהם קצר מדי לקובץ משלו.

// ---------------------------------------------------------------------------
// Badge — כמעט מיותר בשפה החדשה. נשאר ניטרלי בלבד: קו שיער + טקסט.
// **אין tone צבעוני.** גילוי לא נישא בצבע (O5.4), ואזהרה נישאת ב-`.flag`.
// ---------------------------------------------------------------------------
export function Badge({ children, className = "" }) {
  return (
    <span
      className={`inline-flex items-center gap-1 border border-line-strong px-2.5 py-0.5 text-meta text-ink ${className}`}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Chip — **פילטר רב-בחירתי**. ה-✕ כשנבחר הוא ההסרה, וזה מה שמבדיל אותו
// מ-`Selector`. `aria-pressed` הוא מה שהופך אותו לנגיש.
// ---------------------------------------------------------------------------
export function Chip({ selected, children, dismissible = true, className = "", ...props }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`inline-flex min-h-11 items-center gap-2 rounded-pill border px-5 text-spec
        transition-colors duration-hover ${
          selected
            ? "border-ink bg-surface font-medium text-ink outline outline-1 -outline-offset-2 outline-ink"
            : "border-line-strong text-ink-80 hover:border-ink-80"
        } ${className}`}
      {...props}
    >
      {children}
      {/* ה-✕ שייך ל**הסרה**. על צ'יפ "הכול" אין מה להסיר, ולכן הוא מדוכא —
          אחרת הוא מבטיח פעולה שלא קיימת. */}
      {selected && dismissible ? <X size={14} strokeWidth={1.5} aria-hidden="true" /> : null}
    </button>
  );
}

// ---------------------------------------------------------------------------
// 🆕 Selector — **בחירה יחידה.** אי אפשר "להסיר" גוון מתכת, ולכן ה-✕ של
// הפילטר שגוי כאן סמנטית ויזואלית כאחד.
//
// המצב הנבחר נשען על **שלושה ערוצים לא-צבעוniים**: עובי גבול, משקל טקסט
// ומילוי — עומד ב-1.4.1 בלי לגעת בפלטה.
//
// ⚠️ הגבול העבה מיושם כ-`border 1px` + `outline 1px` עם `outline-offset:-2px`
// ולא כ-`border-2` — אחרת הבחירה מזיזה את כל השורה (layout shift).
//
// `swatch` — דגימת חומר 12px. **יוצא הדופן היחיד לצבע בממשק**, ותמיד
// לצד התווית המילולית ולעולם לא במקומה (1.4.1).
// ---------------------------------------------------------------------------
export function SelectorGroup({ label, children, className = "" }) {
  return (
    <div role="radiogroup" aria-label={label} className={`flex flex-wrap gap-2 ${className}`}>
      {children}
    </div>
  );
}

export function Selector({ selected, children, swatch, disabled, className = "", ...props }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={Boolean(selected)}
      disabled={disabled}
      className={`inline-flex min-h-11 items-center gap-2 rounded-pill border px-5 text-spec
        transition-colors duration-hover disabled:cursor-not-allowed ${
          selected
            ? "border-ink bg-surface font-medium text-ink outline outline-1 -outline-offset-2 outline-ink"
            : "border-line-strong text-ink-80 hover:border-ink-80 disabled:border-line disabled:text-muted"
        } ${className}`}
      {...props}
    >
      {swatch ? (
        <span
          className="h-3 w-3 shrink-0 rounded-pill border border-line-strong"
          style={{ background: swatch }}
          aria-hidden="true"
        />
      ) : null}
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// 🔴 Flag — המנגנון היחיד ל"עובדה שחייבים לקרוא".
// קו ink 2px ב-inline-start + משקל 600. בלי ענבר, בלי אייקון, בלי רקע.
// מחליף את כל ה-`Notice tone="warn"` באתר הפומבי.
// ---------------------------------------------------------------------------
export function Flag({ children, note, danger = false, role, className = "" }) {
  return (
    <div role={role} className={`flag ${danger ? "flag-danger" : ""} ${className}`}>
      <p className={`text-spec font-semibold ${danger ? "text-danger" : "text-ink"}`}>{children}</p>
      {note ? <p className="mt-1 text-meta text-ink-80">{note}</p> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// כותרת מקטע. בעברית אין uppercase, ולכן ההיררכיה נבנית מ**משקל + קו + רווח**
// (§2.5). בלטינית חוזרים ה-caps וה-tracking הרחב — שם הם באמת עובדים.
// `latin` — צימוד דו-לשוני, מותר בכותרות מקטע ובאריחי קטגוריה בלבד.
// ---------------------------------------------------------------------------
export function SectionTitle({ children, sub, eyebrow, latin, id, className = "" }) {
  const { lang } = useI18n();
  const en = lang === "en";
  return (
    <div className={`mb-8 ${className}`}>
      {eyebrow ? <p className="eyebrow mb-3">{eyebrow}</p> : null}
      <h2
        id={id}
        className={`text-section font-medium lg:text-sectionLg lg:font-light ${
          en ? "uppercase tracking-enSection" : "tracking-heLabel"
        }`}
      >
        {children}
      </h2>
      {latin && !en ? <p className="micro-en mt-1.5">{latin}</p> : null}
      {sub ? <p className="mt-3 max-w-prose text-body text-muted">{sub}</p> : null}
    </div>
  );
}

// כותרת עמוד (H1 פנימי). משקל 300 — 200 מותר רק מ-44px ומעלה.
export function PageTitle({ children, sub, id, className = "" }) {
  return (
    <div className={`mb-8 ${className}`}>
      <h1 id={id} className="text-display2 font-light lg:text-display2Lg">
        {children}
      </h1>
      {sub ? <p className="mt-3 max-w-prose text-body text-muted">{sub}</p> : null}
    </div>
  );
}

// מצב ריק — בלי `.card`. המסגור הוא קו שיער ורווח.
export function EmptyState({ title, body, action }) {
  return (
    <div className="border-y border-line py-12 text-center">
      <p className="text-titleLg font-medium">{title}</p>
      {body ? <p className="mx-auto mt-3 max-w-prose text-body text-muted">{body}</p> : null}
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Spinner({ label }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-muted" role="status">
      <span
        className="h-5 w-5 animate-spin rounded-pill border border-line border-t-ink"
        aria-hidden="true"
      />
      <span className="text-meta">{label || t("common.loading")}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notice — **מסך הניהול בלבד.** באתר הפומבי אין באנר אזהרה צבעוני; גילוי
// יושב ב-`Flag` ובטבלת המפרט. נשמר כאן כי לאדמין מותר להיות כלי.
// ---------------------------------------------------------------------------
export function Notice({ tone = "info", children, className = "" }) {
  const tones = {
    info: "border-line-strong text-ink",
    warn: "border-ink text-ink",
    danger: "border-danger text-danger",
    success: "border-line-strong text-ink",
  };
  return (
    <div
      role={tone === "danger" ? "alert" : undefined}
      className={`border-s-2 bg-surface px-4 py-3 text-meta leading-relaxed ${
        tones[tone] || tones.info
      } ${className}`}
    >
      {children}
    </div>
  );
}

// סימן "נבחר" — ✓ ink. לא עיגול ורוד, ולא צבע כנושא מידע.
export function CheckMark({ size = 20, srLabel }) {
  const { t } = useI18n();
  return (
    <span className="inline-flex shrink-0 items-center text-ink">
      <Check size={size} strokeWidth={1.5} aria-hidden="true" />
      <span className="sr-only">{srLabel || t("common.chosen")}</span>
    </span>
  );
}

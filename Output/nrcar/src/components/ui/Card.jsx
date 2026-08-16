// ============================================================================
// Card — מקור: itai/Outputs/2026-08-13-nrcar-design.md §5.3.
// צל **לא** מחליף גבול: כל כרטיס מקבל גם `border border-line`.
// כרטיס שהוא קישור — **כל הכרטיס** הוא יעד המגע, ואסור לקנן בו כפתור.
// ============================================================================

export function Card({ children, className = "", as: Tag = "article", ...rest }) {
  return (
    <Tag
      className={`overflow-hidden rounded-2xl border border-line bg-surface shadow-card ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function CardLink({ href, children, className = "", ...rest }) {
  return (
    <a
      href={href}
      className={`block overflow-hidden rounded-2xl border border-line bg-surface shadow-card
        transition hover:bg-brand-50 active:bg-brand-100 ${className}`}
      {...rest}
    >
      {children}
    </a>
  );
}

// ============================================================================
// EmptyState — PRD §9.3. **כפתור אחד בלבד**: שני כפתורים במסך ריק הם שתי
// החלטות למי שעוד לא הבין את המוצר.
// האילוסטרציה דקורטיבית (alt="") — הכותרת כבר אומרת הכול.
// ============================================================================
export function EmptyState({ illustration, title, body, action, className = "" }) {
  return (
    <div className={`flex flex-col items-center gap-4 py-8 text-center ${className}`}>
      {illustration && (
        <img src={illustration} alt="" aria-hidden="true" className="w-[240px] max-w-full" />
      )}
      <h2 className="text-2xl font-bold text-ink-strong text-balance">{title}</h2>
      {body && <p className="max-w-prose text-lg text-ink-muted">{body}</p>}
      {action}
    </div>
  );
}

// ============================================================================
// Notice — כרטיס הודעה. **ענבר לשחזיר שאינו אשמת המשתמש**, אדום רק לכשל
// אמיתי, כחול למידע. לכל הודעה יש פעולת המשך; בלי קודי שגיאה, בלי "Oops".
// לא toast — toast נעלם לפני שמבוגר סיים לקרוא.
// ============================================================================
const TONES = {
  info: "bg-brand-50 border-2 border-brand-600 text-ink",
  warn: "bg-warn-50 border-2 border-warn-600 text-warn-700",
  danger: "bg-danger-50 border-2 border-danger-600 text-danger-900",
  ok: "bg-ok-50 border border-ok-600 text-ink-strong",
};

export function Notice({ tone = "info", icon, title, children, action, className = "" }) {
  return (
    <div className={`space-y-3 rounded-2xl p-4 ${TONES[tone] || TONES.info} ${className}`}>
      <div className="flex items-start gap-3">
        {icon && <span aria-hidden="true">{icon}</span>}
        <div className="space-y-1">
          {title && <p className="text-xl font-semibold">{title}</p>}
          {children && <div className="max-w-prose text-lg">{children}</div>}
        </div>
      </div>
      {action}
    </div>
  );
}

export default Card;

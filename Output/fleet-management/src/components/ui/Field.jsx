import { Children, cloneElement, isValidElement, useId } from "react";

const inputCls =
  "w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 " +
  "placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 " +
  "aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus:ring-red-500 " +
  "disabled:bg-slate-50 disabled:text-slate-500";

// ============================================================================
// Field — תווית, רמז ושגיאה, **מחוברים לשדה ולא רק מוצגים לידו.**
//
// ============================================================================
// A5 בהכוונת הנגישות של עדי (2026-08-17)
// ============================================================================
// המימוש הקודם עטף את הכל ב-`<label>` יחיד, כולל ה-`hint` וה-`error`. התוצאה
// הייתה שהשם הנגיש של השדה הוא **"תווית + רמז + שגיאה" מחובר**: קורא מסך
// הכריז את כל הפסקה בכל פעם שהפוקוס נכנס לשדה. בנוסף:
//   • לא היה `aria-invalid`, ולכן שגיאה הייתה **צבע בלבד** — בלתי נגישה;
//   • לא היה `aria-describedby`, ולכן טקסט השגיאה לא הוכרז כלל;
//   • `required` היה **כוכבית ויזואלית** (`<span>*</span>`) ולא מאפיין אמיתי,
//     ולכן "שדה חובה" לא הגיע לטכנולוגיה מסייעת ולא לוולידציה של הדפדפן.
//
// התיקון: מיכל `<div>`, `<label htmlFor>` מפורש, וה-child משוכפל עם
// `id` / `required` / `aria-invalid` / `aria-describedby`. הרמז והשגיאה יוצאים
// מה-label ומקבלים מזהים משלהם.
//
// זה **לא תיקון לפורטל** — זה תיקון בקומפוננטה שכל טופס באפליקציה יושב עליה,
// ולכן הוא מתקן גם את מסכי האדמין הקיימים.
// ============================================================================
export function Field({ label, hint, error, required, children, className = "" }) {
  const auto = useId();
  const only = Children.count(children) === 1 ? Children.only(children) : null;
  const child = isValidElement(only) ? only : null;
  const id = child?.props?.id || `${auto}-input`;
  const hintId = `${auto}-hint`;
  const errId = `${auto}-err`;

  const describedBy = [error ? errId : null, hint && !error ? hintId : null]
    .filter(Boolean)
    .join(" ");

  const control = child
    ? cloneElement(child, {
        id,
        // `required` אמיתי, לא כוכבית. אם הקורא כבר העביר ערך — הוא מנצח.
        required: child.props.required ?? Boolean(required),
        "aria-invalid": error ? true : child.props["aria-invalid"],
        "aria-describedby": describedBy || child.props["aria-describedby"] || undefined,
      })
    : children;

  return (
    <div className={`block ${className}`}>
      {label && (
        <label htmlFor={id} className="mb-1 block text-xs font-medium text-slate-600">
          {label}
          {/* aria-hidden: הכוכבית היא חיווי ויזואלי בלבד; `required` על השדה
              עצמו הוא מה שמוכרז. בלי זה קורא המסך אומר "כוכבית". */}
          {required && (
            <span className="text-red-700" aria-hidden="true">
              {" *"}
            </span>
          )}
        </label>
      )}
      {control}
      {hint && !error && (
        <span id={hintId} className="mt-1 block text-xs text-slate-600">
          {hint}
        </span>
      )}
      {/* role=alert: שגיאה שמופיעה אחרי שליחה חייבת להיות מוכרזת, לא רק אדומה. */}
      {error && (
        <span id={errId} role="alert" className="mt-1 block text-xs text-red-700">
          {error}
        </span>
      )}
    </div>
  );
}

export function TextInput({ className = "", ...rest }) {
  return <input className={`${inputCls} ${className}`} {...rest} />;
}

export function NumberInput({ className = "", ...rest }) {
  return <input type="number" inputMode="numeric" className={`${inputCls} ${className}`} {...rest} />;
}

export function DateInput({ className = "", ...rest }) {
  // dir=ltr על שדות תאריך/מספר — הדפדפן מציג אותם LTR גם בעמוד RTL.
  return <input type="date" dir="ltr" className={`${inputCls} ${className}`} {...rest} />;
}

export function TimeInput({ className = "", ...rest }) {
  return <input type="time" dir="ltr" className={`${inputCls} ${className}`} {...rest} />;
}

export function TextArea({ className = "", rows = 3, ...rest }) {
  return <textarea rows={rows} className={`${inputCls} ${className}`} {...rest} />;
}

export function Select({ className = "", children, ...rest }) {
  return (
    <select className={`${inputCls} ${className}`} {...rest}>
      {children}
    </select>
  );
}

// A11 — יעד מגע. תיבת 16×16px אינה עומדת ב-SC 2.5.8 (24×24 מינימום), ולכן
// הקופסה נשארת ויזואלית h-4 אבל ה-**יעד** הוא ה-label כולו, עם padding
// שמביא את הגובה מעל 24px. הרחבת הקופסה עצמה הייתה משנה כל טופס באפליקציה.
export function Checkbox({ label, className = "", ...rest }) {
  const id = useId();
  return (
    <div className={`flex items-center ${className}`}>
      <label
        htmlFor={id}
        className="flex min-h-[24px] cursor-pointer select-none items-center gap-2 py-1 text-sm text-slate-700"
      >
        <input
          id={id}
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          {...rest}
        />
        {label}
      </label>
    </div>
  );
}

export default Field;

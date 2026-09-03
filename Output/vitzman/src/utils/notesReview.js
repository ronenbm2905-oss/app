// ============================================================================
// notesReview.js — סיווג 212 ההערות לפני שהן עולות לענן. פונקציות טהורות.
//
// ⚠ **למה זה קיים** (דגל B5 של עדי, חוסם): `note.text` הועתק מהאקסל כפי שהוא,
// ותוכנו אינו מוגדר. ידוע שיש שם מספרי טלפון; ייתכנו שמות דיירים והערכות
// אישיות על ספקים. הערה היא מידע שאדם **זכאי לעיין בו**, והיא חשופה לטענת
// לשון הרע.
//
// ⚠ **ולמה דווקא עכשיו:** לפני הסנכרון הראשון זו עבודה על מחשב אחד, על 212
// פריטים, במסך אחד. אחריו זו עבודה על שני מחשבים מול נתונים חיים. זה החלון
// הזול היחיד.
//
// הקוד **מסמן ולא מוחק**. סיווג אוטומטי שמוחק היה מוחק גם את מה שלא הבין;
// ההכרעה על כל הערה היא של רונן.
// ============================================================================

/**
 * תבניות טלפון ישראליות. מכוון ל**רגישות ולא לדיוק** — עדיף לסמן הערה תמימה
 * מאשר לפספס טלפון. `\D` בקצוות מונע התאמה בתוך מספר ארוך יותר.
 */
const PHONE = /(?:^|\D)(0\d{1,2}[-\s]?\d{7}|\d{3}[-\s]?\d{7})(?:\D|$)/;

/** ״USER:״ / ״User:״ — שאריות של מחבר ההערה מאקסל, לא תוכן. */
const AUTHOR_PREFIX = /^\s*users?\s*:\s*/i;

export const stripAuthorPrefix = (text) => String(text || "").replace(AUTHOR_PREFIX, "").trim();

/**
 * דגלים על הערה בודדת. `severity` קובע את סדר הטיפול:
 *   2 — מכילה מספר שנראה כמו טלפון (הכי דחוף)
 *   1 — טקסט חופשי ארוך שאיש לא קרא
 *   0 — קצרה ומובנית, כנראה בטוחה
 */
export function classifyNote(note) {
  const raw = String(note?.text || "");
  const text = stripAuthorPrefix(raw);
  const hasPhone = PHONE.test(text);
  // הערות מסוג `priceChange`/`vatExempt` וכו׳ נגזרו ממבנה הגיליון ולא נכתבו
  // חופשית, ולכן הן פחות חשודות — אבל `general` הוא בדיוק ״מישהו כתב משהו״.
  const freeform = note?.kind === "general" || note?.kind === "contact";
  const long = text.length > 60;

  const flags = [];
  if (hasPhone) flags.push("טלפון");
  if (freeform && long) flags.push("טקסט חופשי ארוך");
  if (AUTHOR_PREFIX.test(raw)) flags.push("קידומת USER");

  return {
    id: note?.id,
    hasPhone,
    freeform,
    flags,
    severity: hasPhone ? 2 : freeform && long ? 1 : 0,
    cleanText: text,
    changed: text !== raw,
  };
}

/** סיכום לכל התיק — מה נשאר לעבור עליו. */
export function reviewSummary(notes) {
  const rows = (notes || []).map(classifyNote);
  return {
    total: rows.length,
    withPhone: rows.filter((r) => r.hasPhone).length,
    freeformLong: rows.filter((r) => r.severity === 1).length,
    withAuthorPrefix: rows.filter((r) => r.changed).length,
    clean: rows.filter((r) => r.severity === 0).length,
  };
}

/**
 * ניקוי הקידומת ב-212 ההערות בבת אחת — התיקון הבטוח היחיד שאפשר לעשות
 * אוטומטית, כי ״USER:״ הוא ארטיפקט של אקסל ולא תוכן שמישהו כתב.
 * מחזיר תוכנית `applyBatch`, בדיוק כמו שאר המערכת.
 */
export function planStripAuthorPrefixes(notes) {
  const updates = [];
  for (const n of notes || []) {
    const c = classifyNote(n);
    if (c.changed) updates.push({ id: n.id, patch: { text: c.cleanText } });
  }
  return { updates, creates: [] };
}

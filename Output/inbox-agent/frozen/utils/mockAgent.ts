// ============================================================================
// mockAgent.ts — סוכן דמה **דטרמיניסטי**, בלי מפתח ובלי רשת.
//
// תבנית: `mockExtract` מ-`Output/property-management/src/utils/aiExtract.js`.
// אותו עיקרון בדיוק — המוק מחזיר את **צורת הסכימה המלאה** שהמודל האמיתי יחזיר,
// כדי שזרימת ה-UI (סינון → סיווג → תצוגה → משימה) תיבדק במלואה לפני שיש מפתח,
// לפני OAuth ולפני שער משפטי. בפרוסה 1 מוחלפת הפונקציה הזו בקריאה ל-Cloud
// Function; **כל שאר הקוד לא משתנה**, כי הטיפוס `AgentOutput` זהה.
//
// דטרמיניסטי במפורש: אותו קלט → אותו פלט, תמיד. מוק אקראי הופך כל מבחן ל"רץ
// בדרך כלל", וזה גרוע יותר מאין מבחן.
//
// ---------------------------------------------------------------------------
// מה שכן אמיתי כאן, ולא דמה
// ---------------------------------------------------------------------------
// שתי הבקרות למטה אינן חיקוי של המודל אלא **לוגיקת צד-שרת** שהתוכנית דורשת
// שתהיה בקוד לפני שער עדי, ולכן הן נכתבות עכשיו ועוברות כמות שהן לפרוסה 1:
//   `detectInjection` — tripwire שמדליק `needsHumanReview`.
// בפרוסה 1 היא עוברת ל-`shared/lib/validateOutput.ts` ורצה על פלט המודל
// האמיתי; המוק פשוט יפסיק לקרוא לה בעצמו. הדריסה על מידע רגיש כבר יושבת
// בנפרד ב-`redactSensitive.ts` (**נמחק** — ראה `frozen/README.md`), כי היא נוגעת גם ב-`subject`.
// ============================================================================

import type { AgentOutput, Category, MessageMeta, Urgency } from '../types';

export const MOCK_MODEL_ID = 'mock:v1';

// הדריסה על מידע רגיש **אינה** יושבת כאן.
//
// ההיגיון (דגל M1 של עדי, מ-coachtrack): תיבה עסקית תכיל מידע רפואי, פיננסי או
// משפטי, ואם הנגזרות **שלנו** מכילות אותו — המאגר שלנו עולה לרמת אבטחה בינונית.
// אבל הדריסה חייבת לכסות את `subject` לא פחות מאת `summaryHe`, וכותרת אינה
// חלק מפלט המודל. לכן היא רצה ברמת הפריט הנשמר, ב-
// `redactSensitive.ts` (**נמחק** — ראה `frozen/README.md`), כצעד האחרון לפני הכתיבה. כאן המוק רק
// **מסמן** `containsSensitive`, בדיוק כמו שהמודל האמיתי יעשה.

// ---------------------------------------------------------------------------
// מילוני זיהוי (סיווג דמה לפי נושא + גוף מנוקה)
// ---------------------------------------------------------------------------

const CATEGORY_HINTS: Array<{ category: Category; words: string[] }> = [
  { category: 'accounting', words: ['רו"ח', 'רואה חשבון', 'מע"מ', 'מקדמות', 'שומה', 'חשבונית', 'ניכויים', 'דוח שנתי'] },
  { category: 'scheduling', words: ['פגישה', 'לתאם', 'תיאום', 'יומן', 'זום', 'מועד', 'נפגש'] },
  { category: 'sharingTool', words: ['שיתף', 'שיתפה', 'ערך את', 'תיקייה', 'מסמך משותף', 'קובץ'] },
  { category: 'clientInquiry', words: ['הצעת מחיר', 'שאלה', 'מעוניינת', 'מעוניין', 'ליווי', 'סדנה', 'הרצאה', 'ייעוץ', 'לקוחה', 'לקוח'] },
  { category: 'admin', words: ['ביטוח', 'חידוש', 'ספק', 'הזמנה', 'משלוח', 'תמיכה'] },
  { category: 'marketing', words: ['מבצע', 'הנחה', 'ווביינר', 'ניוזלטר', 'הרשמה', 'קידום'] },
];

const HIGH_URGENCY_WORDS = ['היום', 'מחר', 'עד סוף השבוע', 'דחוף', 'ממתין לתשובה', 'תזכורת שנייה', 'לא קיבלתי'];

/** רפואי / פיננסי-אישי / משפטי. הרשימה שמרנית בכוונה — עדיף דריסה עודפת. */
const SENSITIVE_WORDS = [
  'רפואי', 'אבחון', 'טיפול', 'פסיכולוג', 'תרופה', 'מחלה', 'נכות', 'בריאות',
  'עורך דין', 'עו"ד', 'תביעה', 'גירושין', 'צוואה', 'הליך משפטי',
  'חשבון בנק', 'הלוואה', 'עיקול', 'חובות', 'תלוש שכר',
];

const PAYMENT_WORDS = ['תשלום', 'להעביר כסף', 'העברה בנקאית', 'פרטי חשבון', 'אשראי', 'חשבון בנק', 'iban', 'תשלמי', 'לשלם'];

const CREDENTIAL_WORDS = ['סיסמה', 'סיסמא', 'קוד אימות', 'קוד חד פעמי', 'אימות דו-שלבי', 'התחבר/י לחשבון', 'אמת/י את החשבון', 'עדכון פרטי גישה'];

// ה-tripwire להזרקת פקודות עבר ל-`frozen/lib/detectInjection.ts` בפרוסה 0.5:
// מפרוסה 0.5 יש לו שני צרכנים — סיווג מייל **וחילוץ חשבונית** — ושניהם צריכים
// לראות בדיוק את אותה רשימה. הוא מיוצא מכאן מחדש כדי ששום ייבוא קיים לא ישבר.
import { detectInjection } from '../lib/detectInjection';

export { detectInjection };

// ---------------------------------------------------------------------------
// המוק
// ---------------------------------------------------------------------------

function pickCategory(haystack: string): Category {
  for (const { category, words } of CATEGORY_HINTS) {
    if (words.some((w) => haystack.includes(w))) return category;
  }
  return 'other';
}

function hits(haystack: string, words: readonly string[]): boolean {
  const low = haystack.toLowerCase();
  return words.some((w) => low.includes(w.toLowerCase()));
}

/** `+N` ימים מהיום שהמייל התקבל, בפורמט `YYYY-MM-DD`. */
function dueDateFrom(receivedAt: string, days: number): string {
  const base = new Date(receivedAt);
  const d = isNaN(base.getTime()) ? new Date() : base;
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${out.getFullYear()}-${p(out.getMonth() + 1)}-${p(out.getDate())}`;
}

function firstSentence(text: string, max = 200): string {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!clean) return 'אין תוכן לסיכום';
  const cut = clean.split(/(?<=[.!?])\s/)[0] || clean;
  return cut.length <= max ? cut : `${cut.slice(0, max - 1).trimEnd()}…`;
}

/**
 * "קריאת המודל". מקבלת מטא + הגוף **המנוקה** (אחרי `sanitizeEmailBody`) —
 * ולא את ה-HTML הגולמי, בדיוק כמו בפרוסה 1.
 */
export function mockAgentClassify(msg: MessageMeta, sanitizedBody: string): AgentOutput {
  const subject = String(msg.subject ?? '');
  const body = String(sanitizedBody ?? '');
  const hay = `${subject}\n${body}`;

  const category = pickCategory(hay);
  const containsSensitive = hits(hay, SENSITIVE_WORDS);
  const mentionsPayment = hits(hay, PAYMENT_WORDS);
  const requestsCredentials = hits(hay, CREDENTIAL_WORDS);
  const needsHumanReview = detectInjection(hay);

  const actionable = category === 'clientInquiry' || category === 'accounting' || category === 'scheduling';
  const urgent = hits(hay, HIGH_URGENCY_WORDS);

  const urgency: Urgency = actionable && urgent ? 'high' : actionable ? 'medium' : category === 'sharingTool' ? 'medium' : 'low';

  // משימה מוצעת **רק** לקטגוריות שיש בהן פעולה. הצעה על ניוזלטר היא רעש שעבר
  // שלב — היא מייצרת עבודה במקום לחסוך אותה.
  const suggestedTaskTitle = actionable && !needsHumanReview
    ? `${category === 'accounting' ? 'לענות לרו״ח' : category === 'scheduling' ? 'לתאם מועד' : 'לחזור ללקוח'}: ${firstSentence(subject, 80)}`
    : null;

  const raw: AgentOutput = {
    category,
    urgency,
    summaryHe: firstSentence(body || subject),
    actionRequired: actionable && !needsHumanReview,
    suggestedTaskTitle,
    suggestedDueDate: suggestedTaskTitle ? dueDateFrom(msg.receivedAt, urgency === 'high' ? 1 : 3) : null,
    containsSensitive,
    mentionsPayment,
    requestsCredentials,
    needsHumanReview,
  };

  // הפריט **לא** נדרס כאן. `redactSensitive` רץ על הפריט השלם, בצינור,
  // כצעד האחרון לפני הכתיבה — שם הוא רואה גם את הכותרת.
  return raw;
}

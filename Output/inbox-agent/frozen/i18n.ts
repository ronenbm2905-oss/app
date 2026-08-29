// ============================================================================
// frozen/i18n.ts — המחרוזות של המסכים שהוקפאו.
//
// `t()` כאן עוטף את המילון של `src/i18n.ts` ומוסיף עליו את מה ששייך למסכים
// שירדו מהמסך. כך `src/i18n.ts` מכיל **רק** טקסט שהמשתמשת באמת יכולה לראות,
// ואפשר לקרוא אותו בישיבה אחת ולדעת מה האפליקציה אומרת — וזו הייתה כל הסיבה
// שהמודול הזה קיים מלכתחילה.
// ============================================================================

import { HE as BASE } from '../src/i18n';

// ★ מה שאין כאן: המחרוזות של דוח הבוקר (`levelAction`, `stats*`,
// `badgeSensitive`, `quickActionsBlocked`...). הן נמחקו יחד עם המסך ועם אוסף
// `items` — ראה `frozen/README.md`. מילון ששומר טקסט של מסך שנמחק הוא הדרך
// שבה מסך חוזר: מישהו מוצא מחרוזות מוכנות ומרכיב מהן ממשק.
const FROZEN_HE = {
  appSubtitle: 'לוח משימות',

  tabTasks: 'לוח משימות',
  tabInvoices: 'חשבוניות',
  tabPlanned: 'מה עומד לקרות',

  readOnlyBanner: 'צפייה בלבד — אין לך הרשאת עריכה במסך הזה.',

  taskNew: 'משימה חדשה',
  taskTitlePlaceholder: 'מה צריך לעשות?',
  taskAdd: 'הוספה',
  taskWhen: 'מתי',
  taskNoTime: 'בלי מועד',
  taskDone: 'בוצע',
  taskOpen: 'פתוח',
  taskDelete: 'מחיקה',
  tasksEmpty: 'אין עדיין משימות. אפשר להוסיף כאן.',
  tasksExportIcs: 'ייצוא ליומן (ICS)',
  tasksExportHint: 'רק משימות עם מועד נכנסות לקובץ — משימה בלי זמן אינה אירוע.',
  tasksExportEmpty: 'אין משימה עם מועד לייצא.',

  invoicesTitle: 'החשבוניות שלך',
  invoicesNoneYet: 'עוד לא אספתי אף חשבונית.',
  invoicesEmpty:
    'אין כאן חשבוניות. ברגע שתגיע חשבונית עם קובץ מצורף, היא תופיע כאן ותישמר בתיקייה לפי חודש.',
  invoicesNeedYouTitle: 'יש כמה שאני צריך שתסתכלי עליהן',
  invoicesExport: 'הורדת קובץ לרו״ח',
  invoicesExportHint:
    'הקובץ נפתח באקסל. חשבונית שלא הצלחתי לקרוא במלואה מופיעה בו עם עמודות סכום ריקות ועם הסבר — כדי שלא יגיע לרו״ח מספר שאף אחד לא בדק.',
  invoicesNoTotal: 'אין סכום שאפשר לסמוך עליו',

  colDate: 'תאריך',
  colSupplier: 'ספק',
  colNumber: 'מספר חשבונית',
  colVat: 'מע״מ',
  colTotal: 'סה״כ',
  colStatus: 'מצב',

  invoiceAmountUnreadable: 'לא הצלחתי לקרוא',
  invoiceNeedsYou: 'תסתכלי עליה',
  invoiceOk: 'נקרא במלואו',
  invoiceReviewed: 'בדקת',
  invoiceShowSource: 'איפה זה שמור',
  invoiceMarkChecked: 'בדקתי, זה בסדר',
  invoiceUnmark: 'ביטול הסימון',
  invoiceSourceMail: 'המייל שממנו הגיעה',
  invoiceFileName: 'שם הקובץ',
  invoiceSavedAt: 'נשמר ב',
  invoiceUnverifiedAmount: 'הסכום שקראתי ולא הצלחתי לוודא',

  invoiceQuestionsTitle: 'מיילים שנראו לי קשורים לחשבוניות, ולא נגעתי בהם',
  invoiceQuestionsBody:
    'אלה מיילים שיכול להיות שיש בהם חשבונית, ולא הוספתי אותם לטבלה. כתוב ליד כל אחד למה.',

  plannedTitle: 'מה אעשה בתיבה שלך',
  plannedNothingYet:
    'כרגע אני לא נוגע בתיבה בכלל — המסך הזה מראה לך מה הייתי עושה, כדי שתוכלי להגיד לי מראש אם משהו לא בסדר.',
  plannedNoArchive: 'היום אין מה לארכב.',
  plannedArchiveTitle: 'אלה יצאו מהתיבה',
  plannedArchiveBody:
    'אני לא מוחק כלום. כל מייל כאן מקבל תווית ונשאר בגוגל — לחיצה אחת על "להשאיר בתיבה" מחזירה אותו, ולתמיד.',
  plannedArchiveEmpty: 'אין כרגע מייל שעומד לצאת מהתיבה.',
  plannedKeep: 'להשאיר בתיבה',
  plannedRelease: 'לבטל את ההשארה',
  plannedKeptTitle: 'ביקשת להשאיר',
  plannedKeptBody: 'אלה לא ייצאו מהתיבה. גם לא בפעם הבאה, וגם לא בעוד חודש.',
  plannedStayTitle: 'אלה נשארים ואני לא נוגע בהם',
  plannedStayShow: 'להראות למה',
  plannedStayHide: 'לסגור',
  plannedNone: 'אין כאן כלום.',

  breakerTitle: 'עצרתי',
  breakerBody:
    'יצא לי לארכב הרבה יותר מיילים מהרגיל, וזה נראה לי לא נכון. לא נגעתי בכלום. אם זה נראה לך תקין — רונן יכול להריץ שוב; אם לא, כדאי שהוא יסתכל.',

  badgeInvoice: 'יש כאן חשבונית',

  fromLabel: 'מאת',
  reasonLabel: 'למה שמתי את זה כאן',
  sourceMail: 'מתוך מייל',
} as const;

const ALL = { ...BASE, ...FROZEN_HE };

export type FrozenTranslationKey = keyof typeof ALL;

/** כמו `t()` של הבנייה, על מילון מורחב. מפתח חסר מוחזר כמות שהוא. */
export function t(key: FrozenTranslationKey): string {
  return ALL[key] ?? (key as string);
}

// ★ `CATEGORY_HE` ירד גם הוא: הוא תרגם קטגוריות שהמודל החזיר, לתצוגה
// בכרטיס פריט. אין מודל, אין קטגוריות, ואין כרטיס.

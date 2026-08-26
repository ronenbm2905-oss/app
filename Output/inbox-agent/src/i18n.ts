// ============================================================================
// i18n.ts — מילון עברית + `t()`.
//
// מודול ולא מחרוזות מפוזרות: כשכל טקסט שהמשתמשת רואה יושב במקום אחד, אפשר
// לקרוא את כל מה שהאפליקציה אומרת בישיבה אחת. זה גם מה שמאפשר לשירה לעבור
// על הניסוח בלי לפתוח קובץ JSX.
// ============================================================================

const HE = {
  appTitle: 'סוכן תיבה',
  appSubtitle: 'דוח בוקר ולוח משימות',

  tabBrief: 'דוח הבוקר',
  tabTasks: 'לוח משימות',

  demoBannerTitle: 'מצב הדגמה — נתונים מסונתזים',
  demoBannerBody:
    'התיבה שמוצגת כאן היא קובץ דוגמה שנכתב במיוחד. אין חיבור לגוגל, לא נקרא אף מייל אמיתי, ושום דבר לא נשלח לשום שרת. המשימות נשמרות בדפדפן הזה בלבד.',

  readOnlyBanner: 'צפייה בלבד — אין לך הרשאת עריכה במסך הזה.',

  levelAction: 'מחכה לך',
  levelReview: 'שווה שתציצי',
  levelNoise: 'פרסומות ועדכונים',
  noiseGroupShow: 'להראות מה יש שם',
  noiseGroupHide: 'לסגור',
  emptyLevel: 'אין כאן כלום.',

  // ★ נכתב מחדש בפרוסה 0.5. הגרסה הקודמת ("סוננו לפני המודל", "נשלחו
  // לסיווג") הייתה כתובה לנו ולא לה: היא לא צריכה לדעת מה זה מודל, ולא
  // אכפת לה כמה טוקנים נחסכו. מה שכן אכפת לה: כמה מיילים היא צריכה לפתוח
  // הבוקר, וכמה כבר לא.
  statsTitle: 'מה עברתי עליו הבוקר',
  statsFetched: 'מיילים נכנסו',
  statsFiltered: 'פרסומות שאפשר לדלג עליהן',
  statsLlm: 'כדאי שתראי',
  statsSaved: 'חסכתי לך',
  statsRateLabel: 'כמה מהתיבה זה פרסומות',
  statsExplain:
    'את הפרסומות זיהיתי לפי כללים קבועים — מי שלח, ומה כתוב בכותרות של המייל עצמו. אף אחד מהם לא נפתח ולא נקרא.',
  statsSavedUnit: 'מיילים שלא צריך לפתוח',

  badgeNeedsReview: 'כדאי שתפתחי את המייל',
  badgeSensitive: 'יש כאן משהו אישי',
  badgePayment: 'מדובר כאן בכסף',
  badgeCredentials: 'מבקשים ממך סיסמה',
  badgeHidden: 'היה במייל טקסט מוסתר',
  badgeInvisible: 'היו במייל תווים שלא רואים',

  // ★ לא 'פעולות מהירות מושבתות' — זה מתאר את המערכת. זה מתאר מה לעשות.
  quickActionsBlocked:
    'במייל הזה יש משהו שלא נראה לי בסדר, אז לא נתתי לפתוח ממנו משימה. כדאי לפתוח את המייל עצמו ולהחליט בעצמך.',

  actionCreateTask: 'צור משימה',
  actionMarkHandled: 'סמן כטופל',
  actionMarkUnhandled: 'החזר לרשימה',
  handled: 'טופל',

  taskNew: 'משימה חדשה',
  taskTitlePlaceholder: 'מה צריך לעשות?',
  taskAdd: 'הוספה',
  taskWhen: 'מתי',
  taskNoTime: 'בלי מועד',
  taskDone: 'בוצע',
  taskOpen: 'פתוח',
  taskDelete: 'מחיקה',
  tasksEmpty: 'אין עדיין משימות. אפשר להוסיף כאן, או ליצור משימה מפריט בדוח הבוקר.',
  tasksExportIcs: 'ייצוא ליומן (ICS)',
  tasksExportHint: 'רק משימות עם מועד נכנסות לקובץ — משימה בלי זמן אינה אירוע.',
  tasksExportEmpty: 'אין משימה עם מועד לייצא.',


  // --- לשוניות ---
  tabInvoices: 'חשבוניות',
  tabPlanned: 'מה עומד לקרות',

  // --- חשבוניות ---
  invoicesTitle: 'החשבוניות שלך',
  invoicesNoneYet: 'עוד לא אספתי אף חשבונית.',
  invoicesEmpty: 'אין כאן חשבוניות. ברגע שתגיע חשבונית עם קובץ מצורף, היא תופיע כאן ותישמר בתיקייה לפי חודש.',
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

  // ★ הניסוח הזה הוא ההנחיה מרונן, מילה במילה: לא "דורש בדיקה" אלא מה
  // שקרה בפועל, בגוף ראשון, ובלי להאשים אותה.
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

  // --- מה עומד לקרות ---
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

export type TranslationKey = keyof typeof HE;

/** `t('tabBrief')` → 'דוח הבוקר'. מפתח חסר מוחזר כמות שהוא, כדי שייראה. */
export function t(key: TranslationKey): string {
  return HE[key] ?? (key as string);
}

export const CATEGORY_HE: Record<string, string> = {
  clientInquiry: 'פנייה של לקוח',
  accounting: 'הנהלת חשבונות',
  scheduling: 'תיאום',
  sharingTool: 'כלי שיתוף',
  marketing: 'שיווק',
  admin: 'תפעול',
  other: 'אחר',
};

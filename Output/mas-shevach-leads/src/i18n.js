// ============================================================================
// i18n.js — מילון עברית. כל מלל שנראה על המסך עובר דרך כאן.
//
// שני יתרונות מעבר לתרגום: (1) `npm run check` סורק את המילון הזה מול
// FORBIDDEN_STRINGS במקום לסרוק JSX מפוזר; (2) שינוי ניסוח משפטי הוא שינוי
// בקובץ אחד.
// ============================================================================

export const he = {
  appTitle: "קונסולת לידים",
  appSubtitle: "החזרי מס שבח — ייצוג מורשה",

  // -- התחברות --
  signIn: "כניסה עם Google",
  signOut: "יציאה",
  signingIn: "מתחבר…",
  signInTitle: "כניסה לקונסולה",
  signInBody:
    "הקונסולה מכילה פרטי אנשים שפנו דרך הדף. הגישה מוגבלת לחשבון המורשה בלבד.",
  notAuthorized: "החשבון הזה אינו מורשה לצפות במאגר.",
  notAuthorizedBody:
    "הגישה נקבעת ברשימת ההרשאות של המאגר, ולא בעצם ההתחברות. אם זו טעות — יש להוסיף את החשבון ב-firestore.rules או להקצות לו את ההרשאה.",

  // -- מצבים --
  loading: "טוען…",
  loadFailed: "טעינת הנתונים נכשלה",
  loadFailedBody:
    "ייתכן שהחשבון אינו מורשה, או שהכללים חוסמים את הקריאה. פרטים בקונסולת הדפדפן.",
  emptyTitle: "אין לידים",
  emptyBody: "לידים חדשים יופיעו כאן מיד עם שליחת הטופס בדף.",

  localModeTitle: "מצב מקומי — לבדיקה בלבד",
  localModeBody:
    "אין הגדרות ענן, והנתונים נשמרים בדפדפן הזה בלבד. אין להזין כאן פרטים של אדם אמיתי.",
  appCheckMissing: "App Check אינו מוגדר — חוסם עלייה לאוויר.",

  // -- טבלה --
  colName: "שם",
  colPhone: "טלפון",
  colEmail: "אימייל",
  colCreated: "התקבל",
  colStatus: "סטטוס",
  colRetention: "מחיקה",
  colSource: "מקור",

  screenedYes: "עבר סינון",
  screenedNo: "לא עבר סינון",
  noEmail: "—",
  purged: "נמחק",
  purgedBody: "פרטי הקשר נמחקו לפי מדיניות השמירה. נותרה רשומה לספירה בלבד.",

  // -- סטטוסים --
  status_new: "חדש",
  status_attempted: "ניסיון ללא מענה",
  status_contacted: "נוצר קשר",
  status_refused: "סירב",
  status_converted: "הפך ללקוח",

  statusChange: "עדכון סטטוס",
  statusSaving: "מעדכן…",
  statusFailed: "העדכון נכשל",

  // -- שמירה ומחיקה --
  retentionTitle: "מדיניות שמירה",
  retentionDue: (n) => `נמחק בעוד ${n} ימים`,
  retentionOverdue: "מיועד למחיקה",
  retentionToday: "נמחק היום",
  retentionUnanswered: "ללא מענה — 6 חודשים",
  retentionContacted: "לאחר מגע — 12 חודשים",
  retentionImmediate: "מחיקה מיידית",
  duePurgeBanner: (n) =>
    `${n} לידים חרגו מתקופת השמירה. הג'וב היומי ימחק אותם בסבב הקרוב.`,

  // -- אזהרות תפעוליות --
  noExportTitle: "אין ייצוא מהמערכת",
  noExportBody:
    "אין כאן כפתור ייצוא, ולא בטעות. רשימה שיוצאה לגיליון או נשלחה בהודעה כבר אינה מוגנת בכללי המערכת, ומחיקה שאינה כוללת אותה אינה מחיקה.",

  // -- כללי --
  refresh: "רענון",
  total: (n) => `${n} לידים`,
  filterAll: "הכול",
  addTestLead: "הוספת ליד בדיקה",
  clearLocal: "ניקוי הנתונים המקומיים",
  testLeadNote: "זמין במצב מקומי בלבד, עם נתונים מומצאים.",
};

export function t(key, ...args) {
  const v = he[key];
  if (typeof v === "function") return v(...args);
  return v ?? key;
}

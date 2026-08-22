/**
 * הגדרות רוחביות לאתר.
 *
 * ⚠️ שדות המסומנים ב-TODO חוסמים עלייה לאוויר. ראה החלטות פתוחות 11.3 ו-11.4 באפיון.
 */

export const site = {
  /** TODO: שם המשרד הרשמי כפי שיופיע בפוטר ובעמודי המשפט */
  officeName: '{{שם המשרד}}',

  /** TODO: כתובת מלאה */
  officeAddress: '{{כתובת המשרד}}',

  /**
   * TODO: מספר רישיון — יועץ מס / רו"ח / עו"ד.
   * חובה רגולטורית לייצוג מול רשות המסים, וגם אלמנט אמון חזק בדף.
   */
  licenseNumber: '{{מספר רישיון}}',

  /** נלקח מהשאלון המקורי — TODO: לאישור רונן */
  phone: '050-8688488',
  /** פורמט בינלאומי ללינק wa.me */
  whatsappNumber: '972508688488',

  /** TODO: כתובת לקבלת התראות על לידים חדשים */
  notificationEmail: '{{מייל להתראות}}',

  /** TODO */
  domain: 'https://example.co.il',

  /** גרסת מדיניות הפרטיות שנשמרת עם כל ליד. להעלות בכל שינוי מהותי במדיניות */
  policyVersion: '1.0',

  /** תקופת שמירת ליד בימים. נכתבת כ-purgeAfter על כל מסמך (תיקון 13) */
  leadRetentionDays: 730,

  /** הודעה מוכנה בלחיצה על כפתור וואטסאפ */
  whatsappPrefill: {
    'mas-hachnasa': 'שלום, מילאתי את שאלון החזר המס באתר ואשמח לבדיקה',
    'mas-shevach': 'שלום, מילאתי את שאלון החזר מס השבח באתר ואשמח לבדיקה',
  },
} as const;

export function whatsappLink(slug: keyof typeof site.whatsappPrefill): string {
  const text = encodeURIComponent(site.whatsappPrefill[slug]);
  return `https://wa.me/${site.whatsappNumber}?text=${text}`;
}

/**
 * שורת סמלי האמון מתחת לקיפול. זהה בשני הדפים.
 *
 * ⚠️ "הנתונים מוצפנים" היא הצהרת אבטחה. היא נכונה במבנה הנוכחי
 * (HTTPS + Firestore + כתיבה דרך Cloud Function בלבד), אבל דורשת אישור
 * מפורש לפני עלייה לאוויר — ראה §9.5 באפיון.
 */
export const trustBadges = [
  'הבדיקה חינם',
  'ללא התחייבות',
  'הנתונים מוצפנים',
  'מענה תוך 24 שעות',
] as const;

/**
 * דגלי פיצ'רים.
 * ENABLE_DOC_UPLOAD נשאר false בגרסה 1 — ראה §9.4 באפיון.
 * העלאת מסמכי זיהוי מקפיצה נטישה ומכניסה את המשרד לחובות אבטחת מידע מחמירות.
 */
export const flags = {
  ENABLE_DOC_UPLOAD: false,
} as const;

/**
 * ⚠️ CONVERSION_VALUES הוסר.
 *
 * הוא שכפל את `tier.conversionValue` שיושב בקונפיגים — שני מקורות אמת לאותו
 * מספר, שהיו נשארים תואמים בדיוק עד לפעם הראשונה שמישהו מעדכן רק אחד מהם.
 * ערך ההמרה נלקח מה-tier ש**השרת** החזיר. ראה §7.2 באפיון.
 */

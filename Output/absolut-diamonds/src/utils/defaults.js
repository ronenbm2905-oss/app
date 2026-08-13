import { BRAND_PLACEHOLDER } from "../brand.js";

// ============================================================================
// defaults.js — מסמכי `settings`.
//
// 🔴 A6.5 — **מפוצל לשני מסמכים.** מסמך אחד עם הכול הוא דליפה שקטה:
//   • `settings/public`  — וואטסאפ, hero, סיפור, FAQ, רשתות. קריא לכולם.
//   • `settings/private` — מייל פנימי, יעדי התראה, הערות. אדמין בלבד.
//
// ⚠️ **כל הטקסט כאן זמני.** הוא לא קופי של שירה ולא אושר ע"י הלקוח. הוא קיים
// כדי שהאפליקציה לא תיראה שבורה לפני הזנת תוכן — ובדיוק לשם כך הוא ב-
// `settings` ולא בקוד: הצוות מחליף אותו במסך הניהול, בלי מפתח ובלי deploy.
//
// ⚠️ פרטי הקשר ריקים בכוונה — מספר וואטסאפ/מייל/רשתות הם חוסם פתוח (7.6).
// ============================================================================

// A7.2 — גרסאות שנשמרות על כל הסכמה. שינוי נוסח = העלאת גרסה, אחרת אי אפשר
// לדעת על מה בדיוק המשתמש הסכים.
export const POLICY_VERSION = "0.1-draft";
export const LEAD_FORM_VERSION = "1";

// A7.1 — **הטקסט המדויק שמוצג ליד כל תיבה**, נשמר יחד עם ההסכמה.
// שמירת הטקסט שהמשתמש ראה היא מה שמונע פרשנות מחדש של הסכמות ישנות.
export const CONSENT_TEXT = {
  he: {
    contact: "אני מאשר/ת שתחזרו אליי בנוגע לפנייה זו.",
    marketing: "אשמח לקבל עדכונים על קולקציות ומבצעים.",
  },
  en: {
    contact: "I agree that you may contact me regarding this enquiry.",
    marketing: "I'd like to receive updates about collections and promotions.",
  },
};

export const DEFAULT_SETTINGS_PUBLIC = {
  brand: { ...BRAND_PLACEHOLDER },

  contact: {
    whatsapp: "", // 🔴 חסר — ממתין ללקוח. בלי זה כפתורי הוואטסאפ מוסתרים.
    phone: "",
    instagram: "",
    facebook: "",
    // U2 — זהות בעל השליטה. תקנות 1995 דורשות **שם וכתובת העוסק** במסמך
    // הגילוי, ולכן זה גם מה שנכנס להודעת הוואטסאפ (O1).
    legalEntityName: "",
    legalEntityId: "",
    legalEntityAddress: "",
    publicEmail: "",
    // U1 — רכז נגישות. חוסם את הצהרת הנגישות (O5.9).
    accessibilityContactName: "",
    accessibilityContactEmail: "",
    accessibilityContactPhone: "",
  },

  content: {
    heroImage: "",
    he: {
      heroTitle: "יהלום שנבחר בקפידה, בשיבוץ שאתם בוחרים",
      heroSubtitle:
        "בוחרים דגם, בוחרים אבן מהמלאי שלנו — ורואים את המחיר המלא לפני שמדברים איתנו.",
      storyTitle: "הסיפור שלנו",
      storyBody:
        "אנחנו עובדים עם יהלומים כבר שנים, ומאמינים ששקיפות היא חלק מהתכשיט: כל אבן מגיעה עם תעודה, כל מחיר מוצג במלואו וכולל מע״מ, וכל דגם אפשר להתאים בדיוק למה שרציתם. אנחנו כאן כדי לעזור לבחור — לא כדי למכור מהר.",
      faq: [
        {
          // A2.6 — דף ה-FAQ הוא נכס משפטי. הסבר הוגן ומאוזן, כולל **פער הערך**,
          // הוא ההפחתה הזולה ביותר לטענת הטעיה.
          q: "מה ההבדל בין יהלום טבעי ליהלום מעבדה?",
          a: "יהלום מעבדה זהה ליהלום טבעי בהרכב הכימי, בקשיות ובמראה — ההבדל הוא בדרך שבה נוצר. יהלום טבעי נכרה מהאדמה לאורך מיליוני שנים, ויהלום מעבדה נוצר בתנאים מבוקרים תוך שבועות. חשוב שתדעו: **יהלומי מעבדה זולים משמעותית מיהלומים טבעיים באותו מפרט, ושווי המכירה החוזרת שלהם נמוך בהרבה.** אצלנו כל אבן מסומנת במפורש — טבעי או מעבדה — בכל מקום שבו היא מופיעה.",
        },
        {
          q: "איך בוחרים יהלום לטבעת אירוסין?",
          a: "מתחילים מהתקציב, ואז מחליטים מה הכי חשוב לכם מבין ארבעת ה-C: קראט (גודל), צבע, ניקיון וליטוש. עצה מעשית — ליטוש טוב משפיע על הברק יותר מכל פרמטר אחר, וניקיון SI1 נראה נקי לעין בלי זכוכית מגדלת. אפשר לסנן באתר לפי כל פרמטר ולראות איך המחיר משתנה.",
        },
        {
          q: "מה זו תעודה גמולוגית, ומה היא אומרת?",
          a: "תעודה של מעבדה גמולוגית מתעדת את נתוני האבן — משקל, צורה, צבע, ניקיון, ליטוש, והאם האבן טבעית או מעבדה. לכל אבן במלאי שלנו מוצגים מספר התעודה וקובץ התעודה עצמו, ואפשר לאמת אותה באופן עצמאי באתר המעבדה דרך הקישור שבדף האבן.",
        },
        {
          q: "מה זה ״אבן מטופלת״?",
          a: "חלק מהיהלומים עוברים טיפולי השבחה — למשל מילוי סדקים או טיפול צבע — שמשפרים את המראה. טיפול כזה משפיע על המראה ועל הערך, ולכן החוק מחייב לגלות אותו. אצלנו הוא מופיע בסמיכות למחיר, ולא בהערת שוליים. אבן שכתוב עליה ״ללא טיפול״ נבדקה ולא טופלה.",
        },
        {
          q: "מה ההבדל בין זהב 14k ל-18k?",
          a: "18k מכיל אחוז זהב גבוה יותר (75% לעומת 58.5%), ולכן הוא עשיר יותר בגוון ויקר יותר. 14k קשיח יותר ועמיד יותר לשריטות בשימוש יומיומי. שתי האפשרויות מצוינות — זו העדפה אישית.",
        },
        {
          q: "המחיר באתר הוא המחיר הסופי?",
          a: "המחיר המוצג הוא המחיר המלא של הקונפיגורציה שהרכבתם, **כולל מע״מ**, וכולל את השיבוץ, המתכת והאבן. הוא אינו כולל התאמת מידה, חריטה, משלוח או הערכת שמאי. הסכום מחושב לפי הרכיבים שבחרתם ואינו הצעה מחייבת — המחיר הסופי וזמינות האבן מאושרים מולנו בעת ההזמנה.",
        },
      ],
    },
    en: {
      heroTitle: "A carefully chosen diamond, in a setting you choose",
      heroSubtitle:
        "Pick a setting, pick a stone from our inventory — and see the full price before you talk to us.",
      storyTitle: "Our story",
      storyBody:
        "We have worked with diamonds for years, and we believe transparency is part of the jewel: every stone comes with a certificate, every price is shown in full including VAT, and every setting can be matched to exactly what you had in mind. We are here to help you choose — not to sell you quickly.",
      faq: [
        {
          q: "What is the difference between a natural and a lab-grown diamond?",
          a: "A lab-grown diamond is identical to a natural one in chemical composition, hardness and appearance — the difference is how it formed. A natural diamond is mined over millions of years; a lab-grown diamond is created under controlled conditions within weeks. Important to know: **lab-grown stones cost significantly less than natural stones at the same specification, and their resale value is considerably lower.** Every stone on our site is explicitly marked as natural or lab-grown, everywhere it appears.",
        },
        {
          q: "How do you choose a diamond for an engagement ring?",
          a: "Start from the budget, then decide which of the four Cs matters most to you: carat (size), color, clarity and cut. A practical tip — cut affects sparkle more than any other parameter, and SI1 clarity looks clean to the naked eye. You can filter by each parameter on the site and watch how the price changes.",
        },
        {
          q: "What is a gemological certificate, and what does it tell me?",
          a: "A gemological laboratory report documents the stone's data — weight, shape, color, clarity, cut, and whether the stone is natural or lab-grown. For every stone in our inventory we show the certificate number and the certificate file itself, and you can verify it independently on the laboratory's website via the link on the stone page.",
        },
        {
          q: "What is a \"treated stone\"?",
          a: "Some diamonds undergo enhancement treatments — such as fracture filling or color treatment — that improve their appearance. Such treatment affects both appearance and value, and the law requires it to be disclosed. We show it next to the price, not in a footnote. A stone marked \"no treatment\" has been checked and is untreated.",
        },
        {
          q: "What is the difference between 14k and 18k gold?",
          a: "18k contains a higher proportion of gold (75% versus 58.5%), so its tone is richer and it costs more. 14k is harder and more scratch-resistant for daily wear. Both are excellent — it is a personal preference.",
        },
        {
          q: "Is the price on the site the final price?",
          a: "The price shown is the full price of the configuration you built, **including VAT**, covering the setting, the metal and the stone. It does not include resizing, engraving, shipping or an appraisal. The amount is calculated from the components you selected and is not a binding offer — the final price and stone availability are confirmed with us when you order.",
        },
      ],
    },
  },

  // ⚠️ נוסחי המסמכים המשפטיים **לא נכתבים על ידי מפתח.** הם ריקים, והמסכים
  // מציגים באנר טיוטה עד שעדי/עו"ד ממלאים אותם דרך מסך הניהול (L1, L2).
  legal: {
    policyVersion: POLICY_VERSION,
    privacy_he: "",
    privacy_en: "",
    terms_he: "",
    terms_en: "",
    accessibility_he: "",
    accessibility_en: "",
  },

  updatedAt: null,
};

// 🔴 אדמין בלבד. לעולם לא נקרא מהמסכים הציבוריים.
export const DEFAULT_SETTINGS_PRIVATE = {
  internalEmail: "",
  notifyEmails: [],
  internalNotes: "",
  updatedAt: null,
};

export function contentFor(settings, lang = "he") {
  const def = DEFAULT_SETTINGS_PUBLIC.content;
  const c = settings?.content || {};
  const block = c[lang] || c.he || def[lang] || def.he;
  const fallback = def[lang] || def.he;
  return {
    heroImage: c.heroImage ?? def.heroImage,
    heroTitle: block?.heroTitle || fallback.heroTitle,
    heroSubtitle: block?.heroSubtitle || fallback.heroSubtitle,
    storyTitle: block?.storyTitle || fallback.storyTitle,
    storyBody: block?.storyBody || fallback.storyBody,
    faq: Array.isArray(block?.faq) && block.faq.length ? block.faq : fallback.faq,
  };
}

export function contactFor(settings) {
  return { ...DEFAULT_SETTINGS_PUBLIC.contact, ...(settings?.contact || {}) };
}

export function legalFor(settings, lang = "he") {
  const l = { ...DEFAULT_SETTINGS_PUBLIC.legal, ...(settings?.legal || {}) };
  return {
    policyVersion: l.policyVersion || POLICY_VERSION,
    privacy: l[`privacy_${lang}`] || l.privacy_he || "",
    terms: l[`terms_${lang}`] || l.terms_he || "",
    accessibility: l[`accessibility_${lang}`] || l.accessibility_he || "",
  };
}

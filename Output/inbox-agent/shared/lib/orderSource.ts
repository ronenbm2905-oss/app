// ============================================================================
// orderSource.ts — ★★ אתר הקריאה היחיד. כל גוף הודעה שנקרא, נקרא כאן.
//
// ---------------------------------------------------------------------------
// למה הקובץ הזה קיים לפני שיש בכלל Gmail
// ---------------------------------------------------------------------------
// גם פסקת היידוע באתר וגם מסך ההסבר אומרים למשתמשת **"רק מההודעות שחברת
// התשלומים שולחת"**. הסקירה (B12) קבעה שזו הצהרה שחייב להיות מאחוריה מנגנון:
//
// > *"הצהרה בלי מנגנון היא מצג שווא — אותה צורת כשל בדיוק כמו 'קבצים אחרים
// > אינם נשמרים' ו'אינם מועברים לספק חיצוני'. פעם שלישית באותו פרויקט."*
//
// מנגנון שנבנה **אחרי** ששכבת השליפה קיימת נבנה סביב הקוד שכבר יש; מנגנון
// שנבנה לפניה קובע לה את הצורה. לכן שלושת הדברים כאן עכשיו, כשעוד אין רשת:
//
//  1. **שאילתה קבועה בקוד** (`ORDER_SOURCE_QUERY`) — לא נערכת מהממשק ולא
//     מהקונפיג. אין `import.meta.env`, אין פרמטר, ואין setter.
//  2. **קריאת גוף רק למי שעבר את בדיקת השולח.** לא "מסננים אחר כך" — הגוף
//     של הודעה משולח אחר פשוט לא נקרא, והפונקציה מחזירה עליה `refused`.
//  3. **אתר יחיד.** `scripts/check-order-source.mjs` מפיל את ה-build אם
//     קובץ אחר בגרף הבנייה ניגש ל-`.bodyHtml` של הודעה.
//
// ---------------------------------------------------------------------------
// ★★ ומה שנוסף כאן אחרי שנבדקה הודעה אמיתית
// ---------------------------------------------------------------------------
// אתר הקריאה היחיד הוא גם המקום היחיד שבו אפשר להבטיח **מה בדיוק** נקרא,
// ולכן שתי ההחלטות האלה יושבות כאן ולא בפרסר:
//
//  1. ★★ **חיתוך ל-`l=` לפני הכול.** לחתימת הספק יש תג אורך גוף, וכל מה
//     שמעבר לו אינו חתום — אבל החתימה עדיין עוברת. תוקף שקנה מהחנות בעצמו
//     יכול לקחת הודעה אמיתית, להדביק בסופה טבלת הזמנה שנייה עם הכתובת שלו,
//     ולשלוח. כאן זה נחתך, **לפני שמישהו קרא ערך אחד**.
//
//  2. **בוחרים את `text/plain`.** ההודעה היא `multipart/alternative`; חלק
//     הטקסט אומר בדיוק אותו דבר כמו ה-HTML, בלי תגיות ובלי קידוד. `parts`
//     מדווח מה נבחר בפועל, מאותה סיבה ש-`sources` קיים.
//
// ---------------------------------------------------------------------------
// ★ ומה שהופך את זה למשהו שהיא יכולה לראות (M18)
// ---------------------------------------------------------------------------
// `readCount` ו-`sources` אינם דיבוג. הם מה שמוצג במסך: **"הכלי קרא 20
// הודעות, כולן מחברת התשלומים"**. הבטחה שאפשר להסתכל עליה שווה יותר
// מהבטחה שכתובה יפה, וזו הסיבה ש-`sources` נגזר ממה שנקרא בפועל ולא נכתב
// כמחרוזת קבועה במסך.
// ============================================================================

import type { MessageMeta } from '../types/message';
import {
  isOrderSender,
  ORDER_SENDER_ADDRESS,
  ORDER_SIGNING_DOMAIN,
  ORDER_SUBJECT_HE,
} from './orderParse';
import { domainOf } from './addresses';
// ★★ החיתוך לגוף החתום קורה **כאן**, לפני שהגוף עובר הלאה. ראה למטה.
import { limitToSignedBody, signatureForDomain } from './dkimSignature';
import { selectReadablePart } from './mimeBody';

/**
 * ★ חלון הזמן של השליפה, בימים.
 *
 * 180 ולא "הכול": מה שמעבר לחלון הזה ממילא עבר את מדיניות המחיקה, ושליפה
 * שמביאה הודעות שאין לנו זכות להחזיק היא קריאה מיותרת של מידע — גם אם היא
 * נזרקת מיד אחר כך.
 */
export const ORDER_SOURCE_WINDOW_DAYS = 180;

/**
 * ★★ השאילתה. **קבועה. לא נערכת מהממשק, לא מהקונפיג, ולא בזמן ריצה.**
 *
 * היא נבנית מ-`ORDER_SENDER_ADDRESS` ו-`ORDER_SUBJECT_HE` שיושבים
 * ב-`orderParse.ts`, כדי שלא יהיו שתי הגדרות ל"מהי הודעת הזמנה": אחת
 * לשליפה ואחת לפענוח. שתי הגדרות כאלה נפרדות בדיוק ברגע שמישהו מתקן אחת
 * מהן.
 *
 * בפרוסה 1 היא נשלחת כמות שהיא ל-`users.messages.list`. אין נתיב שמרכיב
 * שאילתה אחרת.
 */
export const ORDER_SOURCE_QUERY =
  `from:${ORDER_SENDER_ADDRESS} subject:"${ORDER_SUBJECT_HE}" newer_than:${ORDER_SOURCE_WINDOW_DAYS}d` as const;

/** הודעה כפי שהיא מגיעה מהמקור. הגוף אופציונלי — ולא כל אחד יקרא אותו. */
export interface OrderSourceCandidate extends MessageMeta {
  /**
   * ★ הגוף הגולמי של ההודעה, כפי שהוא על החוט: גבולות MIME, כותרות חלקים
   * וקידוד. **זה הקלט הנכון**, כי `l=` נמדד בבתים שלו ולא של חלק מפוענח.
   */
  bodyRaw?: string;
  /** חלק מפוענח, כשהמקור מחזיר חלקים ולא גוף גולמי. */
  bodyText?: string;
  bodyHtml?: string;
  authenticationResults?: string | null;
  /** כותרת/כותרות `DKIM-Signature`. נקראות כדי לדעת מה החתימה מכסה. */
  dkimSignature?: string | readonly string[] | null;
}

/** ★ מה שנקרא מהודעה אחת: החלק שנבחר, וכמה בתים ירדו כי לא היו חתומים. */
export interface OrderBodyPart {
  /** `text` = נקרא מ-`text/plain`, וזה המצב הרצוי. */
  kind: 'text' | 'html' | 'unknown';
  body: string;
  /** בתים שהיו מעבר ל-`l=` ולכן **לא הועברו הלאה**. `0` = הכול היה חתום. */
  unsignedBytes: number;
}

export interface OrderBodyRead {
  /** `messageId` → החלק שנקרא. **בזיכרון בלבד**, ומת עם הרענון. */
  bodies: ReadonlyMap<string, OrderBodyPart>;
  /** כמה הודעות נקרא מהן גוף. זה המספר שמוצג במסך. */
  readCount: number;
  /** כמה הודעות נבדקו ולא נקרא מהן דבר. */
  refusedCount: number;
  /**
   * הדומיינים שמהם **נקרא** גוף בפועל, ממוינים.
   * אמור להיות `['tranzila.com']` תמיד. אם יופיע כאן משהו אחר — זה באג,
   * והמסך יראה אותו לפני שאנחנו נראה.
   */
  sources: string[];
  /**
   * ★ מאיזה חלק MIME נקרא בפועל, ממוין. אמור להיות `['text']`.
   * נגזר ממה שקרה, בדיוק כמו `sources` — כדי ש"קוראים מהטקסט הנקי" יהיה
   * דבר שאפשר למדוד ולא רק להצהיר.
   */
  parts: string[];
  /** כמה הודעות היה בהן זנב לא חתום שנחתך. כל אחת מהן תסומן לבדיקה. */
  unsignedTailCount: number;
}

/**
 * ★★ אתר הקריאה היחיד.
 *
 * הבדיקה היא על **השולח בלבד**, ולא על הנושא: הנושא הוא טקסט שאפשר לזייף,
 * והוא כבר נבדק ב-`parseOrderMessage` יחד עם החתימה. כאן ההחלטה היא צרה
 * ומכנית — האם מותר בכלל לגעת בגוף.
 *
 * שים לב שההודעות שנדחו **אינן** מוחזרות עם סיבה מפורטת ולא עם שום שדה
 * מתוכן. הפונקציה הזאת לא מספרת דבר על מייל שאינו הזמנה, גם לא "מה היה בו".
 */
export function readOrderBodies(
  messages: readonly OrderSourceCandidate[],
): OrderBodyRead {
  const bodies = new Map<string, OrderBodyPart>();
  const sources = new Set<string>();
  const parts = new Set<string>();
  let refusedCount = 0;
  let unsignedTailCount = 0;

  for (const msg of messages) {
    // ★ הבדיקה קודמת לגישה. לא `const body = msg.bodyRaw` ואז תנאי —
    // אחרת הערך כבר נשלף, וכל refactor עתידי יעביר אותו הלאה.
    if (!isOrderSender(msg.fromAddress)) {
      refusedCount++;
      continue;
    }

    const part = readOne(msg);
    if (!part) {
      // שולח נכון, אין גוף. זה לא סירוב אבטחתי אלא הודעה ריקה — הפענוח
      // יסמן אותה "לא הצלחתי לקרוא", וזה המסלול הנכון בשבילה.
      continue;
    }

    bodies.set(msg.messageId, part);
    sources.add(domainOf(msg.fromAddress));
    parts.add(part.kind);
    if (part.unsignedBytes > 0) unsignedTailCount++;
  }

  return {
    bodies,
    readCount: bodies.size,
    refusedCount,
    sources: Array.from(sources).sort(),
    parts: Array.from(parts).sort(),
    unsignedTailCount,
  };
}

/**
 * ★★ קריאת הודעה אחת: **קודם חותכים לחתום, ואז בוחרים חלק.**
 *
 * ---------------------------------------------------------------------------
 * למה דווקא בסדר הזה
 * ---------------------------------------------------------------------------
 * `l=` נמדד על הגוף הגולמי — עם גבולות ה-MIME, כותרות החלקים והקידוד. לכן
 * החיתוך חייב לקרות **לפני** הפירוק: אם היינו מפרקים קודם ואז חותכים את
 * החלק המפוענח, היינו מודדים בתים אחרים לגמרי מאלה שנחתמו, ובדיוק בכיוון
 * המסוכן — משאירים יותר ממה שנחתם.
 *
 * ומכאן גם התוצאה שחשובה באמת: תוכן שהתוקף הדביק בסוף ההודעה — בין אם
 * כטקסט ובין אם כחלק MIME נוסף שלם — **יורד כאן, לפני שמישהו בכלל יודע
 * שהיה שם משהו.** מה שעובר הלאה הוא רק מה שחברת הסליקה חתמה עליו.
 *
 * הנפילה לאחור (`bodyText`/`bodyHtml`) קיימת למקור שמחזיר חלקים מפוענחים
 * ולא גוף גולמי. גם היא עוברת דרך אותו חיתוך — מדידה פחות מדויקת, אבל לא
 * מסלול שני שבו הכלל לא חל.
 */
function readOne(msg: OrderSourceCandidate): OrderBodyPart | null {
  const sig = signatureForDomain(msg.dkimSignature, ORDER_SIGNING_DOMAIN);
  const limit = sig.matchesDomain ? sig.bodyLengthLimit : null;

  const raw = msg.bodyRaw;
  if (typeof raw === 'string' && raw.length > 0) {
    const signed = limitToSignedBody(raw, limit);
    const picked = selectReadablePart(signed.body);
    if (picked.body.length === 0) return null;
    return { kind: picked.kind, body: picked.body, unsignedBytes: signed.bytesDropped };
  }

  const decoded =
    typeof msg.bodyText === 'string' && msg.bodyText.length > 0
      ? { kind: 'text' as const, body: msg.bodyText }
      : typeof msg.bodyHtml === 'string' && msg.bodyHtml.length > 0
        ? { kind: 'html' as const, body: msg.bodyHtml }
        : null;
  if (!decoded) return null;

  const signed = limitToSignedBody(decoded.body, limit);
  return { kind: decoded.kind, body: signed.body, unsignedBytes: signed.bytesDropped };
}

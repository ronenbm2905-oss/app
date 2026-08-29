// ============================================================================
// orderParse.ts — ★ פענוח הזמנה. דטרמיניסטי לחלוטין, בלי מודל, בלי רשת.
//
// ---------------------------------------------------------------------------
// ★★ למה אין כאן מודל, ולמה זו החלטה ולא קיצור דרך
// ---------------------------------------------------------------------------
// שלוש סיבות, וכל אחת מהן לבדה מספיקה:
//
//  1. **השדות קבועים.** הודעת הסליקה נוצרת במכונה, מאותה תבנית, בכל פעם.
//     רגקס על מבנה ידוע אינו "פחות חכם" ממודל — הוא **מדויק יותר**, כי הוא
//     לא ממציא ערך כשהוא לא מוצא אחד. מודל שמתבקש להחזיר כתובת יחזיר כתובת.
//
//  2. **זה עולה אפס**, ורץ בלי רשת, בלי מפתח, ובלי תקרת שימוש.
//
//  3. ★★ **כתובות המגורים של הלקוחות לא יוצאות מהבית.** שום הזמנה לא נשלחת
//     ל-LLM. אף פעם. אלה כתובות פיזיות של נשים שקנו מדבקות ולא הסכימו לשום
//     דבר מעבר לזה. ההחלטה הזאת מוציאה את כל הפיצ׳ר מהשאלה "מה נשלח לצד
//     שלישי בארה״ב", ומייתרת גם את שאלת ההזרקה: אין למה להזריק.
//
// ---------------------------------------------------------------------------
// ★ אימות מקור לפני פענוח — ולמה זה חמור כאן יותר מבכל מקום אחר במערכת
// ---------------------------------------------------------------------------
// הודעת "התקבל תשלום" היא יעד זיוף נפוץ, מהסיבה הפשוטה שהיא עובדת. במערכת
// אחרת זיוף כזה גורם למספר שגוי על מסך. **כאן הוא גורם לבעלת העסק לארוז
// חבילה אמיתית, להדביק עליה כתובת של זר, ולשלוח אותה על חשבונה.** התוקף לא
// צריך לפרוץ לשום דבר — מספיק שהמסך שלנו יציג לו כתובת ליד כפתור "העתקה".
//
// לכן שלושה תנאים **מצטברים**, וכל אחד מהם וטו:
//
//     שולח נכון  ∧  נושא נכון  ∧  מבנה מוכר
//
// ואם אחד מהם נופל — **אין פענוח חלקי.** לא "נקרא מה שאפשר", לא "כתובת עם
// סימן שאלה". מוחזרת רשומה ריקה עם `needsHumanReview` והסבר. פענוח חלקי הוא
// בדיוק המנגנון שהופך זיוף לחבילה: מספיק שדה אחד שנקרא בהצלחה כדי שהמסך
// ייראה כמו הזמנה רגילה.
//
// ---------------------------------------------------------------------------
// ★★ ולמה שלושת התנאים האלה לא הספיקו — התנאי הרביעי
// ---------------------------------------------------------------------------
// סקירת עדי פירקה את שלושתם בשורה אחת כל אחד:
//
//   **השולח** הוא מחרוזת שהשולח כותב בעצמו. `From` ניתן לזיוף ברמת SMTP.
//   **הנושא והמבנה** ניתנים להעתקה מילה במילה מהודעה אמיתית — שכל תוקף
//   יכול להשיג בעצמו, בעשרה שקלים, על ידי קנייה כלשהי דרך אותו ספק סליקה.
//
// כלומר "אימות משולש" נשמע חזק והיה, בפועל, שלוש בדיקות על טקסט שהתוקף
// שולט בו במלואו. לכן נוסף תנאי רביעי שאינו כזה:
//
//   ★ **`dkim=pass` עם `d=` של ספק הסליקה.** חתימה קריפטוגרפית שמאמתת שגוף
//     ההודעה והכותרות אכן נשלחו מהדומיין הזה. אותה לא מזייפים בהעתקה.
//
// בפרוסה הנוכחית זה שדה ב-fixture; ב-Functions זו קריאה אמיתית ל-
// `Authentication-Results` שגוגל כבר חישבה. **היעדר הכותרת אינו "אין מידע"
// אלא כישלון** — אותו היגיון כמו `containsSensitive === undefined` בשער
// החשבוניות: היעדר תשובה אינו תשובה חיובית.
//
// ---------------------------------------------------------------------------
// ★★ ומה שהודעה אמיתית אחת לימדה אותנו על החתימה הזאת
// ---------------------------------------------------------------------------
// בדיקה של הודעת סליקה אמיתית אישרה `dkim=pass` עם `d=tranzila.com` — וגם
// חשפה שהחתימה **צרה משחשבנו**, בשלוש נקודות שכולן מיושמות כאן:
//
//  1. ★★ **`l=` — החתימה מכסה רק את N הבתים הראשונים של הגוף.** תוקף קונה
//     בעצמו, מקבל הודעה חתומה, מוסיף בסופה טבלת הזמנה שנייה עם הכתובת שלו,
//     ושולח הלאה: `dkim=pass` נשאר תקף. לכן הגוף **נחתך ל-`l` בתים לפני
//     שנקרא ממנו ולו ערך אחד**, וכל חיתוך כזה הוא ממצא חוסם — לא ניקוי שקט.
//     המימוש ב-`dkimSignature.ts`.
//
//  2. **`h=Received:From:To:Subject`** — ה-`Date` וה-`Message-ID` **אינם
//     חתומים**. לכן אין להישען עליהם: התאריך שמוצג הוא זמן הקליטה שלנו,
//     וזיהוי כפילות נעשה לפי מפתח תוכן (`fingerprint.ts`) ולא לפי מזהה.
//     ומנגד — אם `h=` **אינו** מכסה את `From` או את `Subject`, שתי הבדיקות
//     הראשונות כאן חדלות להיות שוות משהו, ולכן ההודעה נדחית.
//
//  3. ★★ **`p=none` ב-DMARC של הספק.** ראה `ORDER_SENDER_DMARC_POLICY`.
//
// ---------------------------------------------------------------------------
// ★ קוראים מ-`text/plain`, לא מה-HTML
// ---------------------------------------------------------------------------
// ההודעה היא `multipart/alternative` ויש בה חלק טקסט נקי: זוגות תווית/ערך
// בשורות נפרדות, וטבלת המוצרים כשורות. משם קוראים. ה-HTML מקודד ומלא תגיות
// — משטח תקיפה גדול יותר ופרסור שביר יותר, בלי שום יתרון. הבחירה עצמה
// נעשית ב-`orderSource.ts` (אתר הקריאה), וכאן רק מתקבל החלק שנבחר: `bodyText`
// נקרא כטקסט, `bodyHtml` כ-HTML.
//
// ---------------------------------------------------------------------------
// ⚠️ מה שהאימות הזה **אינו** עושה, וחייב להיות כתוב ולא מונח
// ---------------------------------------------------------------------------
// הוא מגן מפני **הודעה מזויפת**, לא מפני **הזמנה מזויפת**.
//
// כרטיס אשראי גנוב מייצר עסקה אמיתית אצל ספק הסליקה, ולכן הודעה אמיתית,
// חתומה כהלכה, שעוברת את כל ארבעת התנאים. שום דבר בצינור הזה לא יתפוס את
// זה — ואי אפשר לתפוס את זה מתוך מייל. הכלי אומר "ההודעה הזאת באמת הגיעה
// מספק הסליקה", ולא "העסקה הזאת כשרה". ההגנה מפני הונאת רכישה יושבת אצל
// ספק הסליקה ובחברת האשראי, לא כאן. זה כתוב כדי שאף אחד לא יסיק מהמסך
// הנקי שהוא מכסה יותר ממה שהוא מכסה.
//
// ---------------------------------------------------------------------------
// ★ שלוש המלכודות שנמצאו בהזמנות אמיתיות
// ---------------------------------------------------------------------------
//  1. **שורה במחיר 0 שאינה פריט לארוז.** שורת הטבת משלוח מופיעה בכל הזמנה
//     עם כמות 1 ומחיר 0. פרסר תמים אומר "לארוז 2 פריטים" במקום 1.
//     → `isPackable = unitPrice > 0`, במקום אחד, עם מבחן ייעודי.
//
//  2. **הכמות משתנה בין הזמנות** (נראו 1 ו-4 של אותו מוצר בדיוק).
//     → כמות שלא נקראה בוודאות **פוסלת את ההזמנה**. אין ברירת מחדל 1.
//        ברירת מחדל כאן היא הטעות היקרה ביותר שהפרסר הזה יכול לעשות.
//
//  3. **`סכום ששולם` הוא הכולל, `מחיר ליחידה` נפרד.** אין להסיק אחד מהשני.
//     → `Σ(כמות × מחיר) ≟ סכום ששולם`. לא מסתדר → **לבדיקה, לא ניחוש.**
//
// ---------------------------------------------------------------------------
// למה לא משתמשים כאן ב-`sanitizeEmailBody`
// ---------------------------------------------------------------------------
// הוא מוחק כתובות מייל ומחליף URL-ים — בדיוק השדות שצריך לקרוא. הוא נכתב
// כדי להגן על מודל מפני טקסט עוין, ומודל כבר אין בכלל.
//
// ★ ובכל זאת `sanitize.ts` נשאר בבנייה, ומיובא מכאן. לא סתירה: ההגנה על
// המודל הייתה רק אחד השימושים שלו. הלקוחה עדיין מקלידה שם ורחוב בטופס,
// וכפתור "העתקת הכתובת" עדיין הופך תו כיווניות מוסתר למשלוח לכתובת
// שגויה. מה שנלקח משם הוא
// ניקוי התווים הבלתי-נראים: RLO בתוך שם עיר משנה את מה שהעין רואה בלי לשנות
// את מה שמועתק ללוח, ובאפליקציה עברית אף אחד לא מבחין בזה.
// ============================================================================

import type {
  OrderIssue,
  OrderIssueCode,
  OrderIssueSeverity,
  OrderItem,
  OrderRecipient,
} from '../types/order';
import { EMPTY_RECIPIENT } from '../types/order';
import type { MessageMeta } from '../types/message';
// ★ מ-`addresses` ולא מ-`triageFilter`.
//
// היה כאן `import { normalizeAddress } from './triageFilter'`, שהוא ייצוא-
// מחדש של אותה פונקציה בדיוק. כלומר מסלול ההזמנות היה תלוי במסנן הטריאז׳
// **על הנייר בלבד** — אבל תלות על הנייר היא קשת אמיתית בגרף הייבוא, והיא
// הייתה גוררת את `triageFilter.ts` לתוך הבנייה גם אחרי שכל מה שקורא לו
// הוקפא. בדרך זה גם סוגר מעגל ייבוא שהיה קיים כאן מאז שנוסף המסלול
// `order` (`triageFilter` → `orderParse` → `triageFilter`).
import { normalizeAddress } from './addresses';

// ★ רשימת התווים הבלתי-נראים מגיעה מ-`sanitize.ts`, ולא מוגדרת כאן שוב.
// ראה ההערה בסוף אותו קובץ: שתי רשימות שאמורות להיות זהות הן שתי רשימות
// שיסטו, וכאן זה עולה חבילה שיוצאת לכתובת שגויה.
import { CONTROL_RE, INVISIBLE_RE } from './sanitize';

// ★★ היקף החתימה — `l=` ו-`h=`. ראה את ההערה בראש `dkimSignature.ts`.
import {
  limitToSignedBody,
  signatureForDomain,
  signsHeader,
} from './dkimSignature';
// ★ הנושא מגיע מקודד (RFC 2047). בלי הפענוח, השוואת הנושא בעברית נכשלת תמיד.
import { decodeMimeWords } from './mimeBody';
// ★ מפתח כפילות מהתוכן החתום, ולא מ-`Message-ID` שאינו חתום.
import { contentFingerprint } from './fingerprint';

// ---------------------------------------------------------------------------
// ★ המקור המורשה. שתי קבועות, במקום אחד.
// ---------------------------------------------------------------------------

/** כתובת השולח היחידה שהזמנה יכולה להגיע ממנה. */
export const ORDER_SENDER_ADDRESS = 'pay@tranzila.com';

/** הנושא הקבוע של הודעת העסקה. */
export const ORDER_SUBJECT_HE = 'עסקה חדשה מדף סליקה טרנזילה';

/** התוויות בגוף ההודעה. מקור אחד — גם לפענוח וגם לבדיקת המבנה. */
export const ORDER_LABELS = {
  name: 'שם לקוח',
  email: 'כתובת מייל',
  phone: 'טלפון',
  street: 'כתובת',
  city: 'עיר',
  country: 'מדינה',
  postalCode: 'מיקוד',
  paidTotal: 'סכום ששולם',
  installments: 'תשלומים',
} as const;

/** כותרות טבלת המוצרים. */
export const ORDER_TABLE_HEADERS = {
  productName: 'שם מוצר',
  quantity: 'כמות',
  unitPrice: 'מחיר ליחידה',
} as const;

/**
 * ★ מה חייב להופיע כדי שהמבנה ייחשב מוכר.
 *
 * הרשימה מכוונת ומצומצמת: אלה השדות שבלעדיהם אי אפשר לשלוח חבילה, ולכן
 * היעדרם פירושו שזו לא ההודעה שאנחנו חושבים שהיא. `טלפון` ו`מיקוד` **אינם**
 * ברשימה בכוונה — הם חשובים, אבל הזמנה בלי מיקוד היא עדיין הזמנה, ופסילת
 * המבנה בגללם הייתה הופכת חוסר נפוץ לאירוע חשוד.
 */
const REQUIRED_LABELS: readonly string[] = [
  ORDER_LABELS.name,
  ORDER_LABELS.street,
  ORDER_LABELS.city,
  ORDER_LABELS.paidTotal,
];

/** תקרת אורך לשדה כתובת. מעבר לזה זה כבר לא כתובת. */
const MAX_FIELD_LENGTH = 120;

/** סובלנות להשוואת סכומים. אגורה, לא יותר. */
const TOTAL_TOLERANCE = 0.011;

// ---------------------------------------------------------------------------
// ניקוי טקסט
// ---------------------------------------------------------------------------

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  shy: '',
};

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => safeCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => safeCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[String(name).toLowerCase()] ?? m);
}

function safeCodePoint(code: number): string {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return '';
  try {
    return String.fromCodePoint(code);
  } catch {
    return '';
  }
}

/**
 * ★ HTML → שורות ותאים.
 *
 * `</td>` הופך ל-טאב ו-`</tr>` לשורה חדשה, כך שטבלה נשמרת כמבנה ולא נמעכת
 * לטקסט רץ. זה מה שמאפשר לקרוא זוג תווית/ערך שיושב בשני תאים — הצורה
 * שבה הודעת הסליקה בנויה בפועל.
 *
 * ★ רווחים כפולים **אינם** נמעכים, בניגוד ל-`sanitize`. בהודעה שנשלחה
 * כטקסט ולא כטבלה, רצף רווחים הוא המפריד היחיד בין תא לתא.
 */
export function orderBodyToLines(raw: string): string[] {
  let s = String(raw ?? '').normalize('NFKC');

  // ★★ תווים בלתי-נראים מנוקים **רק בתוך תגים**, ולא מהטקסט.
  //
  // הניקוי בתוך התגים הכרחי כדי ש-`<sty{ZWSP}le>` לא יתחמק מזיהוי התג.
  // אבל ניקוי גורף של כל הגוף היה **משמיד את הראיה**: אילו התו היה נמחק
  // כאן, שם רחוב שהוקלד עם RLO היה מגיע לשדה נקי לגמרי — והבדיקה
  // ב-`sanitizeTypedValue` שנועדה לתפוס בדיוק את זה לא הייתה נדלקת לעולם.
  // בקרה שרצה אחרי מי שכבר ניקה את הזירה היא בקרה שאי אפשר להפעיל.
  //
  // לכן: התגים מנוקים כדי שהפענוח יעבוד, והערכים מגיעים **כמו שהם** לשדה
  // שיודע מה לעשות איתם.
  s = s.replace(/<[^>]*>/g, (tag) => tag.replace(INVISIBLE_RE, ''));

  // תוכן שלא אמור להיקרא בכלל.
  s = s.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ');
  s = s.replace(/<!--[\s\S]*?-->/g, ' ');

  // מבנה → תווי הפרדה.
  s = s.replace(/<\/t[dh]\s*>/gi, '\t');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/(tr|p|div|li|h[1-6]|table|thead|tbody)\s*>/gi, '\n');

  // כל השאר יורד.
  s = s.replace(/<[^>]*>/g, ' ');
  s = decodeEntities(s);

  return s
    .replace(/\r\n?/g, '\n')
    .replace(/\u00A0/g, ' ')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, '').trim())
    .filter((line) => line.length > 0);
}

/**
 * ★★ טקסט נקי (`text/plain`) → שורות.
 *
 * זה המסלול המועדף, וההבדל ממנו ל-`orderBodyToLines` הוא מה ש**לא** קורה
 * כאן: אין הסרת תגיות ואין פענוח ישויות. בטקסט נקי `<` הוא סימן קטן-מ,
 * ו-`&amp;` הוא חמישה תווים — הפעלת ניקוי HTML עליהם הייתה **משנה ערך
 * שנקרא**, וזו בדיוק צורת הכשל שהמעבר לטקסט נועד למחוק.
 *
 * מה שנשמר זהה: הרווחים והטאבים **אינם** נמעכים, כי בטבלת המוצרים הם
 * המפריד היחיד בין עמודה לעמודה; והתווים הבלתי-נראים נשארים בערכים, כדי
 * ש-`sanitizeTypedValue` יוכל לתפוס אותם במקום שבו הם עולים כסף.
 */
export function orderTextToLines(raw: string): string[] {
  return String(raw ?? '')
    .normalize('NFKC')
    .replace(/\r\n?/g, '\n')
    .replace(/ /g, ' ')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, '').trim())
    .filter((line) => line.length > 0);
}

/**
 * שורה → תאים.
 * מפרידים: טאב, `|`, נקודתיים אחרי תווית, או שני רווחים ומעלה.
 */
function splitCells(line: string): string[] {
  return line
    .split(/\t|\s*\|\s*|\s{2,}/)
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
}

/** מסיר נקודתיים סופיות מתווית: `"עיר:"` → `"עיר"`. */
function cleanLabel(s: string): string {
  return s.replace(/[:：]\s*$/, '').trim();
}

// ---------------------------------------------------------------------------
// מספרים
// ---------------------------------------------------------------------------

const CURRENCY_SIGNS: Array<[RegExp, string]> = [
  [/₪|ש["״']?ח\b|\bNIS\b|\bILS\b/i, 'ILS'],
  [/\$|\bUSD\b/i, 'USD'],
  [/€|\bEUR\b/i, 'EUR'],
];

/** זיהוי מטבע מתוך מחרוזת. `null` כשאין סימן — לא מניחים שקל. */
export function detectCurrency(raw: string): string | null {
  const s = String(raw ?? '');
  for (const [re, code] of CURRENCY_SIGNS) if (re.test(s)) return code;
  return null;
}

/**
 * ★ מחרוזת → מספר, או `null`.
 *
 * `null` הוא תוצאה לגיטימית ולא כישלון: ערך שלא ניתן לקרוא בוודאות **לא
 * מנוחש**. `parseFloat` לבדו היה מחזיר כאן 1 עבור `"1 יחידה"` ו-4 עבור
 * `"4-6 ימי עסקים"` — בדיוק סוג הטעות ששולחת חבילה לא נכונה.
 */
export function parseAmount(raw: string | null | undefined): number | null {
  const s = String(raw ?? '')
    .normalize('NFKC')
    .replace(INVISIBLE_RE, '')
    .trim();
  if (!s) return null;

  // מסירים סימני מטבע ורווחים, ומשאירים ספרות ומפרידים.
  const cleaned = s.replace(/[₪$€]/g, '').replace(/\b(NIS|ILS|USD|EUR|ש["״']?ח)\b/gi, '').trim();

  // אם נשאר משהו שאינו ספרה/מפריד/סימן — לא קוראים. אות בתוך מספר פירושה
  // שזה לא מספר אלא משפט שיש בו מספר.
  if (!/^[-+]?[\d.,\s]+$/.test(cleaned)) return null;

  let digits = cleaned.replace(/\s/g, '');
  const hasDot = digits.includes('.');
  const hasComma = digits.includes(',');

  if (hasDot && hasComma) {
    // `1,234.50` — הפסיק הוא אלפים.
    digits = digits.replace(/,/g, '');
  } else if (hasComma) {
    // `1,50` הוא עשרוני; `1,234` הוא אלפים.
    digits = /,\d{1,2}$/.test(digits) ? digits.replace(',', '.') : digits.replace(/,/g, '');
  }

  // יותר מנקודה עשרונית אחת — לא מפרשים.
  if ((digits.match(/\./g) ?? []).length > 1) return null;

  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

/**
 * ★ כמות. מספר שלם חיובי בלבד.
 *
 * אין כאן ברירת מחדל, ואין עיגול. ראה מלכודת 2: `"שתיים"`, `"1-2"` ו-`"1.5"`
 * כולם מחזירים `null`, וההזמנה כולה יוצאת לבדיקה. עדיף שתפתח מייל אחד מאשר
 * שתשלח יחידה אחת במקום ארבע.
 */
export function parseQuantity(raw: string | null | undefined): number | null {
  const s = String(raw ?? '')
    .normalize('NFKC')
    .replace(INVISIBLE_RE, '')
    .trim();
  if (!/^\d{1,4}$/.test(s)) return null;
  const n = Number(s);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

// ---------------------------------------------------------------------------
// אימות מקור
// ---------------------------------------------------------------------------

/**
 * ★ האם הכתובת היא **בדיוק** כתובת הסליקה.
 *
 * השוואה מלאה ולא `endsWith` ולא `includes`. שלוש הצורות שזה חוסם:
 *   `pay@tranzila.com.billing-secure.example`  — הדומיין האמיתי כתת-מחרוזת
 *   `pay@tranzi1a.com`                          — הומוגליף
 *   `"pay@tranzila.com" <x@evil.example>`       — זיוף בשם התצוגה
 *
 * השלישית נחסמת בזכות `normalizeAddress`, שלוקח את מה שבתוך `<>` — כלומר
 * את הכתובת האמיתית ולא את מה שהעין רואה.
 */
export function isOrderSender(fromAddress: string | null | undefined): boolean {
  return normalizeAddress(fromAddress) === ORDER_SENDER_ADDRESS;
}

/**
 * נורמליזציה של נושא לפני השוואה.
 *
 * ★★ הפענוח של RFC 2047 חייב להיות **ראשון**. כותרת `Subject` בעברית מגיעה
 * מקודדת מהחוט, וגם מ-Gmail היא חוזרת כפי שהיא. השוואה ישירה מול המחרוזת
 * העברית נכשלת אז **תמיד** — כלומר כל הזמנה אמיתית הייתה נדחית ב"הנושא אינו
 * הנושא הקבוע", וזו צורת כשל שנראית כמו זהירות ובעצם היא שבירות.
 */
function normalizeSubject(raw: string | null | undefined): string {
  return decodeMimeWords(String(raw ?? ''))
    .normalize('NFKC')
    .replace(INVISIBLE_RE, '')
    .replace(CONTROL_RE, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isOrderSubject(subject: string | null | undefined): boolean {
  return normalizeSubject(subject) === ORDER_SUBJECT_HE;
}

// ---------------------------------------------------------------------------
// ★★ התנאי הרביעי — DKIM
// ---------------------------------------------------------------------------

/** הדומיין שהחתימה חייבת להיות שלו. נגזר מכתובת הסליקה, לא מוקלד פעמיים. */
export const ORDER_SIGNING_DOMAIN = ORDER_SENDER_ADDRESS.slice(
  ORDER_SENDER_ADDRESS.lastIndexOf('@') + 1,
);

/**
 * ★★ מדיניות ה-DMARC של ספק הסליקה, כפי שנמדדה בהודעה אמיתית: **`p=none`.**
 *
 * ---------------------------------------------------------------------------
 * למה זה כתוב כאן, ליד הבדיקה, ולא בתיעוד
 * ---------------------------------------------------------------------------
 * `p=none` פירושו שהספק **מבקש מהעולם לא לעשות כלום** עם הודעה שמתחזה אליו
 * ונכשלת באימות. כלומר: הודעה מזויפת בשמו לא תידחה על ידי גוגל ולא תיזרק
 * לספאם — **היא תגיע לתיבה ותיראה בדיוק כמו הודעת עסקה.**
 *
 * מכאן נובע דבר אחד, והוא הסיבה שהמשפט הזה יושב בקוד: **הבדיקה שלנו היא
 * ההגנה היחידה.** אין רשת ביטחון מאחוריה, ואי אפשר להקל בה בטענה ש"גוגל
 * ממילא מסננת". מי שיבוא לרכך כאן תנאי — למשל לקבל `dkim=none` בתקלה זמנית
 * אצל הספק — צריך לדעת שהוא מסיר את השכבה האחרונה, לא אחת מכמה.
 *
 * הערך מתועד ואינו נקרא מההודעה בכוונה: `dmarc=` ב-`Authentication-Results`
 * מדווח על **תוצאה**, לא על המדיניות, ולכן הוא לא יכול לשמש כאן כתחליף.
 */
export const ORDER_SENDER_DMARC_POLICY = 'none' as const;

export interface DkimVerdict {
  pass: boolean;
  /** הדומיין החתום (`d=`), אם נמצא. */
  domain: string | null;
  /** האם הכותרת בכלל הייתה שם. `false` הוא כישלון, לא "אין מידע". */
  present: boolean;
}

/**
 * קורא `Authentication-Results` ומחזיר את פסק ה-DKIM בלבד.
 *
 * ★ **רק `dkim`.** `spf=pass` בכוונה אינו מספיק: SPF מאמת את שרת השליחה מול
 * ה-envelope sender, שאינו בהכרח ה-`From` שהמשתמשת רואה — כלומר אפשר לעבור
 * SPF ועדיין להציג כתובת שולח אחרת לגמרי. DKIM חותם על הכותרות עצמן.
 */
export function parseDkim(rawHeader: string | null | undefined): DkimVerdict {
  const raw = String(rawHeader ?? '').trim();
  if (!raw) return { pass: false, domain: null, present: false };

  const segment = raw
    .split(';')
    .map((s) => s.trim())
    .find((s) => /^dkim\s*=/i.test(s));
  if (!segment) return { pass: false, domain: null, present: false };

  const pass = /^dkim\s*=\s*pass\b/i.test(segment);
  const d = /(?:header\.)?d=([a-z0-9._-]+)/i.exec(segment);
  return { pass, domain: d ? d[1].toLowerCase() : null, present: true };
}

/**
 * ★ החתימה תקפה **ושייכת לספק הסליקה**.
 *
 * שתי הבדיקות יחד ולא כל אחת לחוד: `dkim=pass` לבדו אומר רק "מישהו חתם על
 * ההודעה הזאת כהלכה" — וכל תוקף יכול לחתום כהלכה על הדומיין של עצמו. הערך
 * כולו נמצא ב-`d=`.
 *
 * תת-דומיין של החותם מתקבל (`mail.tranzila.com` עבור `tranzila.com`), כי
 * ספקים אמיתיים חותמים מתת-דומיין. הכיוון ההפוך — לא.
 */
export function isOrderSignatureValid(rawHeader: string | null | undefined): boolean {
  const v = parseDkim(rawHeader);
  if (!v.present || !v.pass || !v.domain) return false;
  return v.domain === ORDER_SIGNING_DOMAIN || v.domain.endsWith(`.${ORDER_SIGNING_DOMAIN}`);
}

/**
 * ★ האם ההודעה **מתיימרת** להיות הזמנה — שולח ונושא בלבד.
 *
 * ---------------------------------------------------------------------------
 * ★★ למה DKIM **אינו** חלק מהבדיקה הזאת, למרות שהוא תנאי לפענוח
 * ---------------------------------------------------------------------------
 * לפונקציה הזאת שני צרכנים, ולשניהם `false` הוא התשובה המסוכנת:
 *
 *  1. **חסינות מארכוב** (`archivePolicy`, כלל 11) — `false` פירושו שהודעה
 *     שנראית כמו הזמנה עלולה לרדת מהתיבה.
 *  2. **המסלול `order` במסנן** — `false` פירושו שההודעה ממשיכה לשלב הסיווג,
 *     כלומר **גוף שיש בו כתובת מגורים נשלח למודל**.
 *
 * הוספת DKIM כאן הייתה הופכת כל כשל חתימה — כולל תקלה זמנית אצל הספק — לאחד
 * משני אלה. לכן הבדיקה הרחבה שומרת על שתי ההגנות הפסיביות, וה-DKIM חוסם את
 * הפעולה **האקטיבית** היחידה: הצגת כתובת להעתקה.
 *
 * הכיוון היחיד שבו טעות כאן פוגעת הוא "מייל מיותר נשאר בתיבה ולא נשלח
 * למודל" — מחיר שאנחנו משלמים בשמחה.
 */
export function isOrderMessage(msg: Pick<MessageMeta, 'fromAddress' | 'subject'>): boolean {
  return isOrderSender(msg.fromAddress) && isOrderSubject(msg.subject);
}

// ---------------------------------------------------------------------------
// תוצאת הפענוח
// ---------------------------------------------------------------------------

export interface OrderParseResult {
  /** שולח ונושא תואמים — כלומר ההודעה מתיימרת להיות הזמנה. */
  isOrderCandidate: boolean;
  /** ★ שלושת התנאים התקיימו. `false` פירושו שאין כאן שום נתון. */
  sourceVerified: boolean;

  recipient: OrderRecipient;
  items: OrderItem[];
  paidTotal: number | null;
  currency: string | null;
  installments: number | null;

  needsHumanReview: boolean;
  issues: OrderIssue[];

  /**
   * ★★ מפתח כפילות, נגזר **מהגוף החתום שנקרא בפועל**.
   *
   * לא `Message-ID`: הוא אינו ב-`h=`, כלומר אינו חתום, וניתן לשנותו בהודעה
   * אמיתית ולשלוח אותה שוב. `null` כשלא נקרא גוף. ראה `fingerprint.ts`.
   */
  contentKey: string | null;

  /**
   * ★ משפט אחד בעברית שמסביר את ההחלטה — כמו `reasonHe` ב-`triageFilter`.
   * מוצג על המסך כמו שהוא. מי שמסתכל על הזמנה שלא נקראה צריך לדעת למה בלי
   * לפתוח קוד ובלי לשאול.
   */
  reasonHe: string;
}

function issue(
  field: OrderIssue['field'],
  code: OrderIssueCode,
  severity: OrderIssueSeverity,
  messageHe: string,
): OrderIssue {
  return { field, code, severity, messageHe };
}

/** תוצאה ריקה — ★ בלי פענוח חלקי. ראה ההערה בראש הקובץ. */
function refused(
  isOrderCandidate: boolean,
  issues: OrderIssue[],
  reasonHe: string,
): OrderParseResult {
  return {
    isOrderCandidate,
    sourceVerified: false,
    recipient: { ...EMPTY_RECIPIENT },
    items: [],
    paidTotal: null,
    currency: null,
    installments: null,
    needsHumanReview: true,
    issues,
    contentKey: null,
    reasonHe,
  };
}

// ---------------------------------------------------------------------------
// ★ הפענוח
// ---------------------------------------------------------------------------

export interface OrderSourceMessage extends Pick<MessageMeta, 'fromAddress' | 'subject'> {
  /** החלק שנבחר לקריאה כשהוא `text/html`. */
  bodyHtml?: string;
  /** ★ החלק שנבחר לקריאה כשהוא `text/plain`. **זה המסלול המועדף.** */
  bodyText?: string;
  /**
   * ★ כותרת `Authentication-Results` כפי שגוגל חישבה אותה.
   * בפרוסה הנוכחית מגיעה מה-fixture; בפרוסה 1 מכותרות ההודעה האמיתית.
   */
  authenticationResults?: string | null;
  /**
   * ★★ כותרת/כותרות `DKIM-Signature` כפי שהן. **לא לאימות** — הן נקראות רק
   * כדי לדעת מה החתימה מכסה: `l=` (כמה בתים מהגוף) ו-`h=` (אילו כותרות).
   *
   * היעדרן פירושו "אין מידע על ההיקף", ולא "ההיקף מלא". ראה
   * `signatureScopeUnknown` למטה — זה ממצא גלוי ולא הנחה שקטה.
   */
  dkimSignature?: string | readonly string[] | null;
  /**
   * ★ בתים שאתר הקריאה כבר חתך מהגוף כי היו מחוץ ל-`l=`.
   *
   * החיתוך עצמו נעשה שם, לפני שהגוף עבר הלאה; מה שעובר לכאן הוא רק
   * **העובדה** שהוא נעשה, כדי שהיא תיהפך לממצא. בלי הדיווח הזה החיתוך היה
   * שקט — כלומר הודעה שמישהו הוסיף לה תוכן הייתה נראית כמו הזמנה תקינה.
   */
  unsignedTailBytes?: number;
}

export function parseOrderMessage(msg: OrderSourceMessage): OrderParseResult {
  // --- 1. שולח. ------------------------------------------------------------
  if (!isOrderSender(msg.fromAddress)) {
    return refused(
      false,
      [
        issue(
          'source',
          'senderMismatch',
          'block',
          'ההודעה הזאת לא הגיעה מכתובת הסליקה, גם אם היא נראית כמו הזמנה. לא קראתי ממנה שום פרט',
        ),
      ],
      'לא קראתי את ההודעה הזאת — היא לא הגיעה מכתובת הסליקה',
    );
  }

  // --- 2. נושא. ------------------------------------------------------------
  if (!isOrderSubject(msg.subject)) {
    return refused(
      false,
      [
        issue(
          'source',
          'subjectMismatch',
          'block',
          'הנושא של ההודעה אינו הנושא הקבוע של הודעת עסקה, אז לא קראתי ממנה פרטי משלוח',
        ),
      ],
      'לא קראתי את ההודעה הזאת — הנושא שלה אינו הנושא הקבוע של הודעת עסקה',
    );
  }

  // --- 3. ★★ חתימה. התנאי היחיד שהתוקף לא יכול פשוט להעתיק. ---------------
  const dkim = parseDkim(msg.authenticationResults);
  if (!isOrderSignatureValid(msg.authenticationResults)) {
    return refused(
      true,
      [
        issue(
          'source',
          dkim.present ? 'dkimFail' : 'dkimMissing',
          'block',
          dkim.present
            ? 'החתימה הדיגיטלית של ההודעה אינה של חברת הסליקה. ככל הנראה מישהו מנסה להתחזות — לא קראתי ממנה שום פרט, וכדאי לא ללחוץ על שום דבר בתוכה'
            : 'להודעה הזאת אין חתימה דיגיטלית שאפשר לבדוק, אז לא סמכתי עליה ולא קראתי ממנה פרטי משלוח',
        ),
      ],
      dkim.present
        ? 'ההודעה נראית כמו הזמנה, אבל החתימה הדיגיטלית שלה אינה של חברת הסליקה'
        : 'ההודעה נראית כמו הזמנה, אבל אין לה חתימה דיגיטלית שאפשר לבדוק',
    );
  }

  // --- 3ב. ★★ היקף החתימה. מה היא מכסה, ולא רק שהיא תקפה. ------------------
  //
  // כאן נסגר הפער שהודעה אמיתית חשפה: `dkim=pass` אומר "החתימה תקפה", ולא
  // "החתימה מכסה את מה שאני עומד לקרוא". שלושת המקרים למטה הם בדיוק המצבים
  // שבהם התשובה לשאלה השנייה שלילית.
  const sig = signatureForDomain(msg.dkimSignature, ORDER_SIGNING_DOMAIN);

  if (sig.present && !sig.matchesDomain) {
    // צורפה חתימה, והיא של מישהו אחר. אי אפשר להסיק ממנה שום דבר על ההיקף
    // של חתימת הספק — ולכן לא קוראים.
    return refused(
      true,
      [
        issue(
          'source',
          'dkimFail',
          'block',
          'החתימה הדיגיטלית שמצורפת להודעה אינה של חברת הסליקה. לא קראתי ממנה שום פרט',
        ),
      ],
      'ההודעה נראית כמו הזמנה, אבל החתימה שמצורפת לה אינה של חברת הסליקה',
    );
  }

  if (sig.present && sig.bodyLengthMalformed) {
    return refused(
      true,
      [
        issue(
          'source',
          'signatureScopeUnreadable',
          'block',
          'לא הצלחתי להבין איזה חלק מההודעה הזאת באמת חתום, אז לא קראתי ממנה כלום. כדאי לפתוח את המייל המקורי',
        ),
      ],
      'לא הצלחתי להבין איזה חלק מההודעה חתום, ולכן לא קראתי ממנה כלום',
    );
  }

  // ★ `h=` שאינו מכסה את השולח או את הנושא הופך את שתי הבדיקות הראשונות
  // לחסרות ערך: אפשר לשנות בהודעה חתומה בדיוק את שני השדות שאנחנו בודקים.
  if (sig.present && sig.signedHeaders.length > 0) {
    const covers = signsHeader(sig, 'from') && signsHeader(sig, 'subject');
    if (!covers) {
      return refused(
        true,
        [
          issue(
            'source',
            'signatureScopeMismatch',
            'block',
            'החתימה של ההודעה הזאת לא מכסה את השולח ואת הנושא, כלומר אפשר היה לשנות אותם בלי לשבור אותה. לא סמכתי עליה',
          ),
        ],
        'החתימה של ההודעה אינה מכסה את השולח ואת הנושא, ולכן לא קראתי ממנה כלום',
      );
    }
  }

  // --- 4. ★★ הגוף החתום בלבד, ואז המבנה. ----------------------------------
  //
  // החיתוך קודם ל**כל** קריאה של ערך. לא "נקרא ואז נבדוק אם זה היה בתוך
  // הטווח": ערך שנקרא כבר קיים במשתנה, וכל refactor עתידי יעביר אותו הלאה.
  const isPlainText = typeof msg.bodyText === 'string' && msg.bodyText.length > 0;
  const rawBody = isPlainText ? (msg.bodyText as string) : (msg.bodyHtml ?? '');
  const signed = limitToSignedBody(rawBody, sig.bodyLengthLimit);

  // הבתים שאתר הקריאה כבר חתך נספרים כאן גם הם — החיתוך יכול לקרות שם
  // (על הגוף הגולמי, שהוא המקום הנכון) או כאן, אבל **הממצא אחד**.
  const unsignedBytes = signed.bytesDropped + Math.max(0, msg.unsignedTailBytes ?? 0);

  const lines = isPlainText ? orderTextToLines(signed.body) : orderBodyToLines(signed.body);
  const { fields, labelsSeen, duplicates } = collectFields(lines);

  // ★ בדיקת המבנה שואלת אם ה**תוויות** קיימות, לא אם יש להן ערך.
  // ההפרדה הזאת אינה קוסמטית: הודעה עם תווית `עיר` וערך ריק היא הודעת סליקה
  // תקינה שחסר בה שדה — ובעלת העסק צריכה לשמוע "אין בהודעה עיר" ולא "המבנה
  // שונה". הודעה שאין בה בכלל תווית `עיר` היא משהו אחר לגמרי. שתי תקלות
  // שונות שדורשות ממנה שתי פעולות שונות, ולכן שני מסלולים.
  const missingStructure = REQUIRED_LABELS.filter((label) => !labelsSeen.has(label));
  const table = findProductTable(lines);

  if (missingStructure.length > 0 || !table) {
    // ★ שני מצבים שנראים אותו דבר מבחוץ ואינם אותו דבר: "התבנית השתנתה" מול
    // "החלק החתום נגמר לפני שהמבנה הושלם". השני פירושו שמישהו נגע בהודעה,
    // והנימוק חייב להגיד את זה — אחרת היא תיראה כמו תקלה של הספק.
    return unsignedBytes > 0
      ? refused(
          true,
          [issue('source', 'unsignedBodyTail', 'block', UNSIGNED_TAIL_HE)],
          'בהודעה הזאת יש תוספת שאינה חתומה — לא קראתי אותה, ומה שכן חתום אינו הזמנה שלמה',
        )
      : refused(
          true,
          [
            issue(
              'source',
              'structureMismatch',
              'block',
              'ההודעה הגיעה מכתובת הסליקה, אבל היא בנויה אחרת מהודעת עסקה רגילה. לא קראתי ממנה פרטי משלוח — כדאי לפתוח אותה ולראות מה זה',
            ),
          ],
          'ההודעה הגיעה מכתובת הסליקה אבל המבנה שלה שונה. לא קראתי ממנה כלום',
        );
  }

  // --- מכאן: המקור אומת. אוספים ממצאים ולא עוצרים. -------------------------
  const issues: OrderIssue[] = [];

  // ★★ תוספת לא חתומה. **חוסם**, גם כשמה שנקרא נראה מושלם.
  //
  // וזה העיקר: מה שמעבר לגבול לא נקרא בכלל, ולכן טבלת ההזמנה שהתוקף הדביק
  // בסוף אינה יכולה להגיע לכרטיס. הסימון כאן אינו מה שמגן — הוא מה שמספר
  // לבעלת העסק שמישהו ניסה.
  if (unsignedBytes > 0) {
    issues.push(issue('source', 'unsignedBodyTail', 'block', UNSIGNED_TAIL_HE));
  }

  // ★ אין כותרת חתימה לבדוק את היקפה. לא חוסם — הודעה כזאת עדיין עברה
  // `dkim=pass` אצל גוגל — אבל גם לא נבלע בשקט: "לא ידעתי" חייב להיראות,
  // אחרת שכבת ההגנה הזאת יכולה להיעלם בלי שאיש ישים לב.
  if (!sig.present) {
    issues.push(
      issue(
        'document',
        'signatureScopeUnknown',
        'warn',
        'לא יכולתי לבדוק אם מישהו הוסיף משהו להודעה הזאת אחרי שהיא נחתמה. קראתי אותה כרגיל',
      ),
    );
  }

  // ★ אותה תווית פעמיים עם שני ערכים שונים. הודעה אמיתית לא נראית כך —
  // וזו הצורה שבה מזייפים "כתובת שרואים" מול "כתובת שנקראת".
  for (const label of duplicates) {
    issues.push(
      issue(
        'document',
        'suspiciousValue',
        'block',
        `השדה "${label}" מופיע בהודעה יותר מפעם אחת עם ערכים שונים. זה לא נראה תקין, אז לא סמכתי על מה שקראתי`,
      ),
    );
  }

  const recipient = buildRecipient(fields, issues);
  const items = buildItems(table, issues);
  const paidRaw = fields[ORDER_LABELS.paidTotal] ?? '';
  const paidTotal = parseAmount(paidRaw);
  const currency = detectCurrency(paidRaw);
  const installments = parseQuantity(fields[ORDER_LABELS.installments] ?? '');

  if (paidTotal === null) {
    issues.push(
      issue('total', 'priceUnreadable', 'block', 'לא הצלחתי לקרוא את הסכום ששולם'),
    );
  }

  // --- ★ מלכודת 3: המכפלה מול הסכום ששולם. ---------------------------------
  // ההשוואה נעשית רק כששני הצדדים נקראו במלואם. אחרת היינו מדווחים על
  // "אי-התאמה" שכל כולה נובעת משדה שלא נקרא — הודעת שגיאה שמצביעה למקום הלא
  // נכון גרועה מהיעדר הודעה.
  const itemsReadable = items.length > 0 && !issues.some((i) => i.code === 'quantityUnreadable' || i.code === 'priceUnreadable');
  if (itemsReadable && paidTotal !== null) {
    const sum = round2(items.reduce((acc, i) => acc + i.lineTotal, 0));
    if (Math.abs(sum - paidTotal) > TOTAL_TOLERANCE) {
      issues.push(
        issue(
          'total',
          'totalMismatch',
          'block',
          `החישוב לא מסתדר: לפי המוצרים יוצא ${formatNumber(sum)} ולפי ההודעה שולם ${formatNumber(paidTotal)}. לא ניחשתי מי מהם נכון — כדאי לפתוח את המייל`,
        ),
      );
    }
  }

  const needsHumanReview = issues.some((i) => i.severity === 'block');

  return {
    isOrderCandidate: true,
    sourceVerified: true,
    recipient,
    items,
    paidTotal,
    currency,
    installments,
    needsHumanReview,
    issues,
    // ★ נגזר מ**הגוף החתום שנקרא**, ולא מהגוף המקורי: שתי הודעות שההבדל
    // ביניהן הוא רק בזנב הלא-חתום הן אותה הזמנה, וכך הן ייספרו.
    contentKey: contentFingerprint(signed.body),
    reasonHe: unsignedBytes > 0
      ? 'בהודעה הזאת יש תוספת שאינה חתומה — לא קראתי אותה, ולא הצגתי כתובת להעתקה'
      : needsHumanReview
        ? 'קראתי את ההודעה ומשהו בה לא מסתדר. לא הצגתי כתובת להעתקה — כדאי לפתוח את המייל המקורי'
        : 'קראתי את ההזמנה במלואה: השולח, הנושא והמבנה תואמים, והחישוב מסתדר',
  };
}

/**
 * ★★ המשפט שנאמר לבעלת העסק כשהיה זנב לא חתום.
 *
 * מנוסח כמו שהיא צריכה לשמוע אותו: **מה עשיתי** ("לא קראתי אותה"), ולא
 * "כשל אימות היקף חתימה". הוא יושב בקבוע אחד כי הוא מופיע בשני מסלולים —
 * כשמה שנשאר הוא הזמנה שלמה, וכשלא.
 */
const UNSIGNED_TAIL_HE =
  'בהודעה הזאת יש תוספת שנוספה אחרי שחברת הסליקה חתמה עליה — לא קראתי אותה, ולא הצגתי מכאן כתובת. סביר שמישהו ניסה להוסיף להזמנה כתובת משלו, וכדאי לא ללחוץ על שום דבר במייל הזה';

// ---------------------------------------------------------------------------
// איסוף זוגות תווית/ערך
// ---------------------------------------------------------------------------

const ALL_LABELS: readonly string[] = Object.values(ORDER_LABELS);

/**
 * אוסף זוגות תווית/ערך משלוש הצורות שבהן הם מופיעים בפועל:
 *   `עיר:\tתל אביב`   (שני תאים בטבלה)
 *   `עיר: תל אביב`     (טקסט עם נקודתיים)
 *   `עיר` / `תל אביב`  (תווית בשורה אחת, ערך בשורה הבאה)
 *
 * ★ **התאמה מדויקת של התווית**, לא `includes`. הסיבה: `כתובת` ו`כתובת מייל`
 * הן שתי תוויות שונות שאחת מהן מכילה את השנייה. `includes` היה גורם לכתובת
 * המייל להיכתב לשדה הרחוב — ואז החבילה יוצאת לכתובת שהיא בכלל כתובת מייל.
 * הסדר בקובץ המקור אינו מובטח, ולכן אי אפשר להישען עליו.
 */
function collectFields(lines: readonly string[]): {
  fields: Record<string, string>;
  /** ★ תוויות שהופיעו בהודעה — **גם כשהערך שלהן ריק**. זו בדיקת המבנה. */
  labelsSeen: Set<string>;
  duplicates: string[];
} {
  const fields: Record<string, string> = {};
  const labelsSeen = new Set<string>();
  const duplicates: string[] = [];

  const put = (label: string, value: string): void => {
    labelsSeen.add(label);
    const v = value.trim();
    if (!v) return;
    if (label in fields) {
      if (fields[label] !== v && !duplicates.includes(label)) duplicates.push(label);
      return; // הראשון קובע. השני מדווח כחשוד ולא דורס.
    }
    fields[label] = v;
  };

  for (let i = 0; i < lines.length; i++) {
    const cells = splitCells(lines[i]);

    // צורה א׳ + ב׳: תווית בתא/מקטע ראשון, ערך בשני.
    if (cells.length >= 2) {
      const label = cleanLabel(cells[0]);
      if (ALL_LABELS.includes(label)) {
        put(label, cells.slice(1).join(' '));
        continue;
      }
    }

    // `עיר: תל אביב` בתוך תא אחד.
    const colon = /^([^:：]{1,20})[:：]\s*(.+)$/.exec(lines[i]);
    if (colon) {
      const label = cleanLabel(colon[1]);
      if (ALL_LABELS.includes(label)) {
        put(label, colon[2]);
        continue;
      }
    }

    // צורה ג׳: תווית לבדה, ערך בשורה הבאה.
    //
    // ★ השורה הבאה נלקחת **רק** אם היא תא בודד. בלי התנאי הזה, תווית עם תא
    // ריק (`<td>עיר</td><td>&nbsp;</td>`) הייתה בולעת את השורה שאחריה
    // ומקבלת את הערך `מדינה` כשם העיר — שדה שגוי שנראה תקין לגמרי, וחבילה
    // שיוצאת לעיר שלא קיימת.
    const bare = cleanLabel(lines[i]);
    if (ALL_LABELS.includes(bare)) {
      labelsSeen.add(bare);
      const nextCells = i + 1 < lines.length ? splitCells(lines[i + 1]) : [];
      if (nextCells.length === 1 && !ALL_LABELS.includes(cleanLabel(nextCells[0]))) {
        put(bare, nextCells[0]);
        i++;
      }
    }
  }

  return { fields, labelsSeen, duplicates };
}

// ---------------------------------------------------------------------------
// טבלת המוצרים
// ---------------------------------------------------------------------------

interface ProductTable {
  /** אינדקס העמודה של כל שדה, כפי שנקרא **משורת הכותרת**. */
  columns: { productName: number; quantity: number; unitPrice: number };
  rows: string[][];
}

/**
 * מאתר את שורת הכותרת ואת השורות שאחריה.
 *
 * ★ סדר העמודות נקרא מהכותרת ולא מונח. הודעה שבה `כמות` ו`מחיר ליחידה`
 * מחליפות מקום היא בדיוק המקרה שבו פרסר עם אינדקסים קשיחים ידווח על 24
 * יחידות במחיר 2 ש״ח — בלי שום שגיאה ובלי שאף אחד ישים לב.
 */
function findProductTable(lines: readonly string[]): ProductTable | null {
  for (let i = 0; i < lines.length; i++) {
    const cells = splitCells(lines[i]).map(cleanLabel);
    const productName = cells.indexOf(ORDER_TABLE_HEADERS.productName);
    const quantity = cells.indexOf(ORDER_TABLE_HEADERS.quantity);
    const unitPrice = cells.indexOf(ORDER_TABLE_HEADERS.unitPrice);
    if (productName === -1 || quantity === -1 || unitPrice === -1) continue;

    const needed = Math.max(productName, quantity, unitPrice) + 1;
    const rows: string[][] = [];
    for (let j = i + 1; j < lines.length; j++) {
      const row = splitCells(lines[j]);
      // שורה שאינה בגודל הטבלה מסיימת אותה. תווית מוכרת מסיימת אותה גם היא —
      // בהודעות שראינו טבלת המוצרים באה אחרונה, אבל אין סיבה להישען על זה.
      if (row.length < needed) break;
      if (ALL_LABELS.includes(cleanLabel(row[0]))) break;
      rows.push(row);
    }
    return { columns: { productName, quantity, unitPrice }, rows };
  }
  return null;
}

/**
 * ★ שורות → פריטים, כולל הכרעת `isPackable`.
 *
 * שים לב לאסימטריה בין שני סוגי הכשל:
 *  - **כמות שלא נקראה** → ממצא חוסם. אין ברירת מחדל. (מלכודת 2)
 *  - **מחיר 0** → לא כשל בכלל, אלא **הכרעה**: השורה נשמרת ואינה פריט אריזה.
 *    (מלכודת 1)
 */
function buildItems(table: ProductTable, issues: OrderIssue[]): OrderItem[] {
  const items: OrderItem[] = [];

  for (const row of table.rows) {
    const rawName = (row[table.columns.productName] ?? '').trim();
    const rawQty = row[table.columns.quantity] ?? '';
    const rawPrice = row[table.columns.unitPrice] ?? '';

    const quantity = parseQuantity(rawQty);
    const unitPrice = parseAmount(rawPrice);

    // ★ שם המוצר עובר את אותו ניקוי כמו שדה מוקלד — היא **קוראת** אותו כדי
    // לדעת מה לשים במעטפה, ולכן RLO בתוכו הוא אותו כשל בדיוק כמו בכתובת.
    const cleanName = sanitizeTypedValue(rawName);
    if (cleanName.removed > 0) {
      issues.push(
        issue(
          'items',
          'invisibleChars',
          'block',
          'באחת משורות המוצר יש תווים מוסתרים שמשנים את מה שרואים על המסך. לא סמכתי עליה',
        ),
      );
      continue;
    }
    const name = cleanName.value.slice(0, MAX_FIELD_LENGTH) || 'מוצר ללא שם';

    if (quantity === null) {
      issues.push(
        issue(
          'items',
          'quantityUnreadable',
          'block',
          `לא הצלחתי לקרוא כמה יחידות יש מ"${name}". לא ניחשתי — כדאי לפתוח את המייל ולבדוק`,
        ),
      );
      continue;
    }
    if (unitPrice === null) {
      issues.push(
        issue('items', 'priceUnreadable', 'block', `לא הצלחתי לקרוא את המחיר של "${name}"`),
      );
      continue;
    }

    items.push({
      productName: name,
      quantity,
      unitPrice,
      // ★ מלכודת 1, במקום אחד ויחיד.
      isPackable: unitPrice > 0,
      lineTotal: round2(quantity * unitPrice),
    });
  }

  if (items.length === 0) {
    issues.push(
      issue('items', 'noItems', 'block', 'לא מצאתי שום שורת מוצר בהודעה הזאת'),
    );
    return items;
  }

  if (!items.some((i) => i.isPackable)) {
    issues.push(
      issue(
        'items',
        'noPackableItems',
        'block',
        'כל השורות בהזמנה הזאת במחיר 0, כלומר אין כאן מוצר לארוז. כדאי לפתוח את המייל ולראות מה קרה',
      ),
    );
  }

  return items;
}

// ---------------------------------------------------------------------------
// הנמענת
// ---------------------------------------------------------------------------

/** URL בתוך שדה כתובת. לא כותבים כתובת אינטרנט על חבילה. */
const URL_IN_FIELD_RE = /(https?:\/\/|www\.)/i;

/**
 * ★★ ניקוי שדה שאדם **הקליד**.
 *
 * ---------------------------------------------------------------------------
 * למה שדה מוקלד מסוכן יותר מהשאר, ולמה דווקא כאן
 * ---------------------------------------------------------------------------
 * שאר השדות בהודעה נוצרו במכונה. השם והרחוב **הוקלדו בטופס** בידי מי שקנתה
 * — כלומר בידי מי שאיננו מכירים, ובאותה מידה בידי מי שרוצה לנצל את זה.
 *
 * התרחיש שסקירת עדי הצביעה עליו קונקרטי ולא תיאורטי: **תו RLO (U+202E) בתוך
 * שם רחוב, במסך RTL.** התצוגה מציגה רצף אחד, והמחרוזת שיוצאת ללוח ההעתקה
 * היא רצף אחר. במסך עברי, שבו כיווניות מעורבת היא ברירת המחדל, אף אחד לא
 * מבחין בתו נוסף — וכפתור "העתקת הכתובת" הופך את זה מבאג תצוגה ל**חבילה
 * שיוצאת לכתובת שאינה זו שהמסך הראה**.
 *
 * לכן רשימת התווים מיובאת מ-`sanitize.ts` עצמו — לא מועתקת ממנו — ובנוסף: **כל הסרה כזאת מדליקה ממצא.** כתובת אמיתית שהוקלדה
 * בעברית אינה מכילה RLO בשוגג, ולכן נוכחות התו היא עובדה על מי שהקליד — לא
 * לכלוך שצריך לשטוף בשקט.
 */
function sanitizeTypedValue(raw: string): { value: string; removed: number } {
  const before = String(raw ?? '').normalize('NFKC');
  const stripped = before.replace(INVISIBLE_RE, '').replace(CONTROL_RE, '');
  return {
    value: stripped.replace(/\s+/g, ' ').trim(),
    removed: before.length - stripped.length,
  };
}

function buildRecipient(fields: Record<string, string>, issues: OrderIssue[]): OrderRecipient {
  const take = (
    label: string,
    field: keyof OrderRecipient,
    required: boolean,
    missingHe: string,
  ): string | null => {
    const cleaned = sanitizeTypedValue(fields[label] ?? '');
    const raw = cleaned.value;
    if (!raw) {
      issues.push(issue(field, 'missingField', required ? 'block' : 'warn', missingHe));
      return null;
    }
    // ★ תו בלתי נראה בשדה מוקלד. חוסם, ולא רק מנקה: המחרוזת שנוקתה אולי
    // תקינה, אבל מי שהקליד אותה ניסה משהו — ובחבילה זה עולה כסף אמיתי.
    if (cleaned.removed > 0) {
      issues.push(
        issue(
          field,
          'invisibleChars',
          'block',
          `בשדה "${label}" היו תווים מוסתרים שגורמים לטקסט להיראות אחרת ממה שהוא באמת. לא הצגתי אותו — כדאי לפתוח את המייל המקורי`,
        ),
      );
      return null;
    }
    if (raw.length > MAX_FIELD_LENGTH) {
      issues.push(
        issue(
          field,
          'fieldTooLong',
          'block',
          `השדה "${label}" ארוך בצורה חריגה. לא הצגתי אותו — כדאי לפתוח את המייל`,
        ),
      );
      return null;
    }
    if (URL_IN_FIELD_RE.test(raw)) {
      issues.push(
        issue(
          field,
          'suspiciousValue',
          'block',
          `בשדה "${label}" יש קישור אינטרנט במקום טקסט רגיל. זה לא נראה תקין, אז לא הצגתי אותו`,
        ),
      );
      return null;
    }
    return raw;
  };

  const name = take(ORDER_LABELS.name, 'name', true, 'אין בהודעה שם לקוחה, ובלעדיו אין למי לשלוח');
  const street = take(ORDER_LABELS.street, 'street', true, 'אין בהודעה רחוב ומספר בית');
  const city = take(ORDER_LABELS.city, 'city', true, 'אין בהודעה עיר');
  const phone = take(
    ORDER_LABELS.phone,
    'phone',
    false,
    'אין בהודעה טלפון. אפשר לשלוח בלעדיו, אבל שליחים מבקשים אותו',
  );
  const email = take(ORDER_LABELS.email, 'email', false, 'אין בהודעה כתובת מייל של הלקוחה');
  const postalCode = take(ORDER_LABELS.postalCode, 'postalCode', false, 'אין בהודעה מיקוד');
  const countryCode = take(ORDER_LABELS.country, 'countryCode', false, 'אין בהודעה מדינה');

  if (countryCode && !/^[A-Za-z]{2}$/.test(countryCode)) {
    issues.push(
      issue(
        'countryCode',
        'malformedCountry',
        'warn',
        'המדינה בהודעה אינה בקוד הרגיל של שתי אותיות. הכתובת עצמה בסדר',
      ),
    );
  }
  if (postalCode && !/^\d{5}(\d{2})?$/.test(postalCode.replace(/\s|-/g, ''))) {
    issues.push(
      issue(
        'postalCode',
        'malformedPostalCode',
        'warn',
        'המיקוד לא נראה כמו מיקוד ישראלי רגיל. כדאי לוודא אותו לפני שאת כותבת אותו',
      ),
    );
  }

  return {
    name,
    phone,
    email,
    street,
    city,
    postalCode,
    countryCode: countryCode ? countryCode.toUpperCase() : null,
  };
}

// ---------------------------------------------------------------------------
// עזרים קטנים
// ---------------------------------------------------------------------------

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

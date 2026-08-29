// ============================================================================
// sanitize.ts — ניקוי טקסט. פונקציה טהורה, בלי DOM ובלי תלויות.
//
// ============================================================================
// ★★★ קרא את זה לפני שאתה מוחק את הקובץ הזה
// ============================================================================
//
// הקובץ נכנס לפרויקט כשכבת הגנה מפני **הזרקת פקודות למודל**. המודל הוסר.
// המסקנה המתבקשת — "אין מודל, אין הזרקה, אפשר למחוק" — **שגויה**, והיא
// סומנה בסקירה של עדי (8ב.1, סעיף ב') כ**סכנת המחיקה של הסבב הזה**:
//
// > *"`sanitize.ts` נכנס עם סיפור ההזרקה. מוחקים את המודל, ומישהו ימחק אותו
// > איתו בהיגיון 'אין מודל, אין הזרקה'. **כאן הוא לא מגן על המודל — הוא מגן
// > על המסך.** `U+202E` בתוך שם רחוב גורם לכתובת להיראות על המסך שונה ממה
// > שיועתק לתווית המשלוח, בלי שום מודל בסביבה. רשמו את זה ליד הקוד."*
//
// זה קונקרטי, וזה בדיוק המוצר שנשאר: **הלקוחה מקלידה את השם והרחוב בעצמה**,
// בטופס של חברת הסליקה. השדות האלה נכתבו בידי מי שאנחנו לא מכירים. במסך RTL
// תו כיווניות אחד משנה את סדר התצוגה בלי לשנות את רצף התווים — והמסך שלנו
// מציג כתובת לצד כפתור "העתקת הכתובת". כלומר: מה שהעין רואה ומה שנדבק על
// החבילה יכולים להיות שני דברים שונים, ואף אחד לא יבחין.
//
// המשתמשים בפועל היום:
//   · `orderParse.ts` — מייבא מכאן את `INVISIBLE_RE`/`CONTROL_RE`, ומנקה
//     בעזרתן כל שדה מוקלד (`sanitizeTypedValue`). כל הסרה כזאת גם **חוסמת**
//     את ההזמנה ומדליקה ממצא — כתובת אמיתית לא מכילה RLO בשוגג.
//   · `sanitizeEmailBody` עצמו — משמש היום את מודול החשבוניות המוקפא בלבד.
//     הוא נשאר כאן, בשלמותו, כי הפירוק שלו "כי חלק ממנו לא בשימוש" הוא
//     בדיוק הדרך שבה נמחקת גם החלק שכן.
//
// ---------------------------------------------------------------------------
// מה זה מגן מפניו (ההקשר המקורי, שעדיין נכון לחלק `sanitizeEmailBody`)
// ---------------------------------------------------------------------------
// גוף המייל נכתב על ידי אדם לא מוכר. כשהיה מודל, הטקסט שהגיע אליו היה חייב
// להיות מנוקה **לפני** שהוא מגיע אליו, ולא "בזכות" ניסוח חכם ב-prompt.
//
// ---------------------------------------------------------------------------
// למה סדר הפעולות הוא לא עניין של טעם
// ---------------------------------------------------------------------------
// 1. NFKC **ראשון**. `＜script＞` בתווים רחבים אינו תג HTML, ומחלץ תגים לא
//    ייגע בו — אבל אחרי נרמול הוא הופך ל-`<script>`. נרמול אחרי חילוץ התגים
//    היה מייצר תג חי בטקסט שכבר "נוקה".
// 2. הסרת תווי Bidi ו-zero-width **לפני** חילוץ התגים. `<scr{ZWSP}ipt>` מחמיק
//    מכל regex של תגים, ואחרי הסרת התו הוא שוב תג.
// 3. פענוח ישויות HTML **אחרי** חילוץ התגים, לא לפני. `&lt;script&gt;` בקוד
//    המקור הוא **טקסט מוצג**; פענוח מוקדם היה הופך אותו לתג אמיתי.
//
// ---------------------------------------------------------------------------
// Bidi ו-zero-width — באפליקציה בעברית זו לא פינה
// ---------------------------------------------------------------------------
// U+202E (RLO) הופך את כיוון התצוגה. טקסט שנראה למשתמשת כמו משפט תמים יכול
// להיות, ברמת רצף התווים שהמודל קורא, משפט אחר לגמרי. באפליקציה עברית שבה
// כיווניות מעורבת היא ברירת המחדל, אף אחד לא יבחין בתו נוסף. אותו דבר
// ל-zero-width: הם בלתי נראים לחלוטין ומפרקים כל התאמת מחרוזת.
// ============================================================================

/** תוצאת הניקוי. ה-URL-ים **לא** מוחזרים — ראה `redactUrls` למטה. */
export interface SanitizeResult {
  /** הטקסט הנקי, מוכן לשליחה בתוך content block נפרד. */
  text: string;
  /** האם נחתך ב-`maxChars`. */
  truncated: boolean;
  /** כמה URL-ים ייחודיים הוחלפו. */
  linkCount: number;
  /** כמה כתובות מייל בגוף הוסתרו. */
  emailCount: number;
  /** כמה בלוקים מוסתרים (display:none / לבן-על-לבן / גודל 0) הוסרו. */
  hiddenBlocksRemoved: number;
  /** כמה תווי Bidi/zero-width נמחקו. אות אזהרה בפני עצמו. */
  invisibleCharsRemoved: number;
}

export interface SanitizeOptions {
  /** ברירת מחדל 6,000. */
  maxChars?: number;
}

const DEFAULT_MAX_CHARS = 6000;

/**
 * תווים בלתי נראים שנמחקים בלי יוצא מן הכלל:
 *  U+200B‑U+200D  zero-width space / non-joiner / joiner
 *  U+200E‑U+200F  LRM / RLM — סימני כיווניות
 *  U+061C         ALM (סימן כיווניות ערבי, מופיע בטקסט מעורב)
 *  U+202A‑U+202E  embedding / override — כולל RLO
 *  U+2066‑U+2069  isolates
 *  U+FEFF         BOM / zero-width no-break space
 *  U+00AD         soft hyphen — בלתי נראה ומפרק מילים
 */
export const INVISIBLE_RE = /[\u200B-\u200F\u061C\u202A-\u202E\u2066-\u2069\uFEFF\u00AD]/g;

/** תווי בקרה (מלבד טאב/שורה חדשה) — אין להם מה לעשות בטקסט מייל. */
export const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

// ---------------------------------------------------------------------------
// אלמנטים מוסתרים
// ---------------------------------------------------------------------------

/**
 * `style` שמסתיר תוכן מהעין אך לא מהמודל.
 *
 * "לבן-על-לבן" הוא הווקטור הקלאסי: הטקסט קיים במסמך, בלתי נראה לקורא האנושי,
 * ונקרא במלואו על ידי כל מי שמעבד את המקור. אנחנו לא מנסים לדמות מנוע CSS —
 * אנחנו מזהים את הצורות שבהן זה נעשה בפועל.
 */
const HIDDEN_STYLE_RE = new RegExp(
  [
    'display\\s*:\\s*none',
    'visibility\\s*:\\s*hidden',
    'opacity\\s*:\\s*0(?!\\.[1-9])',
    'font-size\\s*:\\s*0',
    'max-height\\s*:\\s*0',
    'color\\s*:\\s*#f{3,6}\\b', // #fff / #ffffff
    'color\\s*:\\s*white',
    'color\\s*:\\s*rgb\\(\\s*255\\s*,\\s*255\\s*,\\s*255\\s*\\)',
    'text-indent\\s*:\\s*-\\d{3,}',
  ].join('|'),
  'i',
);

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  '#39': "'",
  '#160': ' ',
};

/** תגים שסופם שורה חדשה — אחרת כל המייל נדבק למשפט אחד ארוך. */
const BLOCK_TAGS = 'p|div|br|tr|li|h[1-6]|table|blockquote|section|article|header|footer';

// ---------------------------------------------------------------------------
// שלבים
// ---------------------------------------------------------------------------

function stripInvisible(s: string): { out: string; removed: number } {
  const matches = s.match(INVISIBLE_RE);
  return { out: s.replace(INVISIBLE_RE, '').replace(CONTROL_RE, ''), removed: matches ? matches.length : 0 };
}

/**
 * הסרת אלמנטים מוסתרים, על התוכן שלהם.
 * מוגבל לתגים "עוטפים" נפוצים — הרעיון אינו לכסות כל HTML חוקי אלא להסיר את
 * מה שנועד להיקרא בלי להיראות.
 */
function removeHiddenElements(html: string): { out: string; removed: number } {
  let removed = 0;
  const re = /<(div|span|p|td|table|section|a)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  let prev: string;
  let out = html;
  // מספר סבבים: הסתרה מקוננת (span מוסתר בתוך div מוסתר) לא נפתרת במעבר יחיד.
  let guard = 0;
  do {
    prev = out;
    out = out.replace(re, (full, _tag, attrs) => {
      const a = String(attrs);
      if (HIDDEN_STYLE_RE.test(a) || /\bhidden\b/i.test(a) || /aria-hidden\s*=\s*["']true/i.test(a)) {
        removed++;
        return ' ';
      }
      return full;
    });
    guard++;
  } while (out !== prev && guard < 5);
  return { out, removed };
}

function htmlToText(html: string): string {
  return (
    html
      // הערות HTML — מקום מועדף להחביא בו הוראות.
      .replace(/<!--[\s\S]*?-->/g, ' ')
      // סקריפט וסגנון על התוכן שלהם, כולל תג לא סגור עד סוף המחרוזת.
      .replace(/<script\b[\s\S]*?(?:<\/script>|$)/gi, ' ')
      .replace(/<style\b[\s\S]*?(?:<\/style>|$)/gi, ' ')
      .replace(/<(?:head|title|noscript)\b[\s\S]*?(?:<\/(?:head|title|noscript)>|$)/gi, ' ')
      .replace(new RegExp(`</?(?:${BLOCK_TAGS})\\b[^>]*>`, 'gi'), '\n')
      .replace(/<[^>]*>/g, ' ')
  );
}

function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (full, name: string) => {
    const key = name.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(ENTITIES, key)) return ENTITIES[key];
    const dec = /^#(\d+)$/.exec(name);
    if (dec) {
      const code = Number(dec[1]);
      // חוסם החזרה של תווים בלתי נראים דרך הדלת האחורית של ישויות מספריות.
      return code > 0 && code < 0x10ffff ? String.fromCodePoint(code) : ' ';
    }
    const hex = /^#x([0-9a-fA-F]+)$/.exec(name);
    if (hex) {
      const code = parseInt(hex[1], 16);
      return code > 0 && code < 0x10ffff ? String.fromCodePoint(code) : ' ';
    }
    return full;
  });
}

/**
 * ★ כל URL → `[קישור-N]`.
 *
 * שתי סיבות, ושתיהן מספיקות לבדן:
 *  1. **ערוץ exfiltration.** אם המודל מחזיר טקסט שמכיל URL, וה-URL הזה מוצג
 *     או נלחץ, מייל עוין יכול להבריח מידע מהתיבה החוצה בתוך query string.
 *     כשאין URL בקלט — אין מה להבריח.
 *  2. **"היכנס/י לכאן".** קישור בתוך סיכום הופך את הסיכום למנוף פישינג.
 *
 * URL-ים זהים מקבלים אותו מספר, כך שהמודל עדיין רואה ש"אותו קישור חוזר".
 * ה-URL עצמו **אינו** מוחזר מהפונקציה: הוא זמין למשתמשת בפתיחת המייל המקורי,
 * וזה המקום הנכון היחיד לראות אותו.
 */
function redactUrls(s: string): { out: string; count: number } {
  const seen = new Map<string, number>();
  const out = s.replace(
    /\b(?:https?:\/\/|www\.)[^\s<>"'()\[\]]+/gi,
    (url) => {
      const key = url.toLowerCase().replace(/[.,;:!?]+$/, '');
      if (!seen.has(key)) seen.set(key, seen.size + 1);
      return `[קישור-${seen.get(key)}]`;
    },
  );
  return { out, count: seen.size };
}

/**
 * כתובות מייל **בגוף** → `[כתובת]`.
 * הנמענים האמיתיים נגזרים אך ורק מכותרות RFC. כתובת שכתובה בתוך הטקסט היא
 * טענה של הכותב, ואם היא זולגת לסיכום היא נראית כמו עובדה מהמערכת.
 */
function redactEmails(s: string): { out: string; count: number } {
  let count = 0;
  const out = s.replace(/\b[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}\b/gi, () => {
    count++;
    return '[כתובת]';
  });
  return { out, count };
}

function collapseWhitespace(s: string): string {
  return s
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t\u00A0\u2000-\u200A\u3000]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ---------------------------------------------------------------------------
// ★ הפונקציה
// ---------------------------------------------------------------------------

export function sanitizeEmailBody(raw: string, opts: SanitizeOptions = {}): SanitizeResult {
  const maxChars = opts.maxChars ?? DEFAULT_MAX_CHARS;
  let invisibleCharsRemoved = 0;

  // 1. NFKC — לפני כל דבר שמחפש תגים. ראה ההערה בראש הקובץ.
  let s = String(raw ?? '').normalize('NFKC');

  // 2. תווים בלתי נראים — לפני חילוץ התגים, כדי ש-`<scr{ZWSP}ipt>` לא ייעלם
  //    מתחת לרדאר של ה-regex.
  const pass1 = stripInvisible(s);
  s = pass1.out;
  invisibleCharsRemoved += pass1.removed;

  // 3. אלמנטים מוסתרים — כולל התוכן שלהם.
  const hidden = removeHiddenElements(s);
  s = hidden.out;

  // 4. HTML → טקסט.
  s = htmlToText(s);

  // 5. ישויות — רק עכשיו.
  s = decodeEntities(s);

  // 6. ...ולכן צריך מעבר שני על הבלתי-נראים: `&#8203;` היה ישות עד לפני רגע.
  const pass2 = stripInvisible(s);
  s = pass2.out;
  invisibleCharsRemoved += pass2.removed;

  // 7. הסתרות.
  const urls = redactUrls(s);
  s = urls.out;
  const emails = redactEmails(s);
  s = emails.out;

  // 8. רווחים, ואז חיתוך.
  s = collapseWhitespace(s);
  const truncated = s.length > maxChars;
  if (truncated) s = `${s.slice(0, maxChars).trimEnd()}\n[הטקסט קוצר]`;

  return {
    text: s,
    truncated,
    linkCount: urls.count,
    emailCount: emails.count,
    hiddenBlocksRemoved: hidden.removed,
    invisibleCharsRemoved,
  };
}

// ---------------------------------------------------------------------------
// ★ למה שתי הקבועות למעלה מיוצאות
// ---------------------------------------------------------------------------
// `orderParse.ts` צריך **בדיוק** את אותה רשימת תווים, והחזיק עד עכשיו עותק
// משלו עם ההערה "אותה רשימה כמו ב-sanitize.ts". שתי רשימות שאמורות להיות
// זהות הן שתי רשימות שיסטו: מישהו יוסיף כאן תו חדש שהתגלה, ולא שם — ואז
// אותו תו ייחסם בגוף מייל וייעבור בשקט דווקא בשדה שהלקוחה הקלידה, שהוא
// המקום שבו זה עולה חבילה.
//
// שימי לב שהן `/g`, ולכן יש להן `lastIndex`. שני הקבצים משתמשים בהן
// ב-`replace` וב-`match` בלבד — שתי פעולות שמאפסות את המצב. **אין להשתמש
// בהן ב-`.test()`**, שם `/g` משמר מיקום בין קריאות ומחזיר תשובות מתחלפות
// על אותו קלט.

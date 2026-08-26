// ============================================================================
// sanitize.ts — שלב 2 של הצינור. פונקציה טהורה, בלי DOM ובלי תלויות.
//
// ---------------------------------------------------------------------------
// מה זה מגן מפניו
// ---------------------------------------------------------------------------
// גוף המייל נכתב על ידי אדם לא מוכר, ונשלח למודל. זהו גבול אמון, ולכן הטקסט
// שמגיע למודל חייב להיות מנוקה **לפני** שהוא מגיע אליו, ולא "בזכות" ניסוח
// חכם ב-prompt. ההגנה העיקרית בתוכנית היא אחרת לגמרי (סעיף 6.1: לקריאה
// שמעבדת מייל אין כלים — אפס), והקובץ הזה הוא השכבה השנייה.
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
const INVISIBLE_RE = /[\u200B-\u200F\u061C\u202A-\u202E\u2066-\u2069\uFEFF\u00AD]/g;

/** תווי בקרה (מלבד טאב/שורה חדשה) — אין להם מה לעשות בטקסט מייל. */
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

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

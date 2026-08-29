// ============================================================================
// dkimSignature.ts — ★★ מה בדיוק החתימה מכסה, ומה היא לא.
//
// ---------------------------------------------------------------------------
// למה הקובץ הזה נולד
// ---------------------------------------------------------------------------
// עד עכשיו הבדיקה שלנו הייתה `dkim=pass` עם `d=tranzila.com` מתוך
// `Authentication-Results` — כלומר "גוגל אימתה חתימה של הספק". הודעה אמיתית
// אחת שנבדקה הראתה שזה **נכון אבל לא מספיק**, בשני מקומות:
//
//  1. ★★ **`l=3694`.** לחתימה יש תג אורך גוף. משמעותו: החתימה מכסה רק את
//     3694 הבתים הראשונים של הגוף. כל מה שמעבר להם **אינו חתום, והחתימה
//     עדיין עוברת.**
//
//     התקיפה אינה תיאורטית ולא דורשת שום פריצה: תוקף קונה מהחנות בעצמו,
//     מקבל הודעת עסקה אמיתית וחתומה, **מוסיף בסוף הגוף טבלת הזמנה שנייה עם
//     הכתובת שלו**, ושולח אותה הלאה. `dkim=pass`. פרסר שקורא את כל הגוף
//     קולט את התוספת — ובעלת העסק אורזת חבילה ושולחת אותה לתוקף על חשבונה.
//
//     ההגנה היחידה היא לחתוך: **קוראים אך ורק את `l` הבתים הראשונים.**
//
//  2. **`h=Received:From:To:Subject`.** רשימת הכותרות החתומות אינה כוללת
//     `Date` ואינה כוללת `Message-ID`. כלומר שתיהן ניתנות לשינוי בלי לשבור
//     את החתימה, ולכן **אסור להישען עליהן** — לא לתאריך ההזמנה, לא למיון,
//     ולא לזיהוי כפילויות. ראה `orderPipeline.ts` ו-`message.ts`.
//
// ---------------------------------------------------------------------------
// ★★ בתים, לא תווים
// ---------------------------------------------------------------------------
// `l=` נמדד ב**בתים** של הגוף כפי שהוא עבר על החוט. בעברית ב-UTF-8 כל אות
// היא שני בתים, ולכן חיתוך לפי `string.slice(0, l)` היה משאיר בערך פי שניים
// ממה שנחתם — כלומר משאיר בדיוק את מה שהחיתוך נועד למחוק. זו הטעות הקלה
// ביותר לעשות כאן, ולכן היא כתובה כאן ולא מונחת.
//
// כשהגבול נופל באמצע תו רב-בתי, התו **יורד כולו**: חצי תו אינו חתום, ואין
// שום ערך בלהשאיר אותו.
//
// ---------------------------------------------------------------------------
// ⚠️ ומה שהקובץ הזה עדיין לא עושה
// ---------------------------------------------------------------------------
// הוא **לא מאמת חתימה קריפטוגרפית**. הוא קורא את התגים שלה כדי לדעת מה
// היקפה. האימות עצמו נעשה אצל גוגל, ומגיע אלינו כ-`dkim=pass`. הפרדה זו
// מכוונת: אין לנו את המפתח הציבורי, ואין סיבה לשכפל עבודה שהשרת כבר עשה.
// מה שכן חסר שם ולכן נעשה כאן — **גבולות ההיקף.**
// ============================================================================

export interface DkimSignatureTags {
  /** האם צורפה כותרת `DKIM-Signature` בכלל. */
  present: boolean;
  /** האם החתימה שנבחרה היא של הדומיין שביקשנו. */
  matchesDomain: boolean;
  /** `d=` */
  domain: string | null;
  /** `s=` */
  selector: string | null;
  /** `h=`, באותיות קטנות. רשימה ריקה = התג לא הופיע. */
  signedHeaders: string[];
  /** ★ `l=`. `null` = אין תג, כלומר **כל הגוף חתום** — וזה המצב הטוב. */
  bodyLengthLimit: number | null;
  /** `l=` שאינו מספר שלם אי-שלילי. אין לדעת מה חתום → לא קוראים. */
  bodyLengthMalformed: boolean;
}

const EMPTY_TAGS: DkimSignatureTags = {
  present: false,
  matchesDomain: false,
  domain: null,
  selector: null,
  signedHeaders: [],
  bodyLengthLimit: null,
  bodyLengthMalformed: false,
};

/** פורס כותרת מקופלת (המשך שורה בתחילת רווח) לשורה אחת. */
function unfold(raw: string): string {
  return String(raw ?? '').replace(/\r?\n[ \t]+/g, ' ');
}

/**
 * קורא את תגי החתימה מכותרת `DKIM-Signature` אחת.
 *
 * ★ אין כאן שום אימות. הפונקציה אומרת **מה החתימה מתיימרת לכסות**, ומי
 * שקורא לה מחליט מה לעשות עם זה.
 */
export function parseDkimSignature(raw: string | null | undefined): DkimSignatureTags {
  const text = unfold(raw ?? '').trim();
  if (!text) return { ...EMPTY_TAGS };

  const tags = new Map<string, string>();
  for (const segment of text.split(';')) {
    const m = /^\s*([a-z][a-z0-9_]*)\s*=\s*([\s\S]*)$/i.exec(segment);
    if (!m) continue;
    const key = m[1].toLowerCase();
    if (!tags.has(key)) tags.set(key, m[2].trim());
  }

  if (tags.size === 0) return { ...EMPTY_TAGS };

  const domain = (tags.get('d') ?? '').toLowerCase() || null;
  const selector = (tags.get('s') ?? '') || null;

  const hTag = tags.get('h');
  const signedHeaders =
    hTag === undefined
      ? []
      : hTag
          .split(':')
          .map((h) => h.trim().toLowerCase())
          .filter((h) => h.length > 0);

  const lTag = tags.get('l');
  let bodyLengthLimit: number | null = null;
  let bodyLengthMalformed = false;
  if (lTag !== undefined) {
    // ★ `l=` ריק, שלילי, עשרוני או עם רווחים אינו "אין הגבלה" — הוא חתימה
    // שאי אפשר לדעת מה היקפה. היעדר תשובה אינו תשובה חיובית.
    if (/^\d{1,12}$/.test(lTag)) bodyLengthLimit = Number(lTag);
    else bodyLengthMalformed = true;
  }

  return {
    present: true,
    matchesDomain: false, // נקבע ב-`signatureForDomain`
    domain,
    selector,
    signedHeaders,
    bodyLengthLimit,
    bodyLengthMalformed,
  };
}

function domainMatches(domain: string | null, expected: string): boolean {
  if (!domain) return false;
  return domain === expected || domain.endsWith(`.${expected}`);
}

/**
 * ★ בוחר את החתימה של הדומיין המבוקש מתוך כל כותרות `DKIM-Signature`.
 *
 * להודעה אמיתית יכולות להיות כמה חתימות (הספק, ואחר כך רשימת דיוור או ממסר
 * שהוסיף אחת משלו). התגים `l=` ו-`h=` שייכים לחתימה **מסוימת**, ולכן קריאה
 * של התג מהחתימה הלא נכונה גרועה מלא לקרוא בכלל: היא הייתה מרחיבה את היקף
 * מה שנחשב "חתום על ידי הספק" לפי כותרת שמישהו אחר כתב.
 *
 * כשאין אף חתימה של הדומיין המבוקש אבל יש חתימות אחרות, מוחזר `present:true`
 * עם `matchesDomain:false` — כלומר "יש חתימה, והיא לא שלו". זה **לא** אותו
 * דבר כמו "אין חתימה", ולכן זה לא מדווח כאותו דבר.
 */
export function signatureForDomain(
  headers: string | readonly string[] | null | undefined,
  expectedDomain: string,
): DkimSignatureTags {
  const list = (Array.isArray(headers) ? headers : headers ? [headers as string] : []).filter(
    (h): h is string => typeof h === 'string' && h.trim().length > 0,
  );
  if (list.length === 0) return { ...EMPTY_TAGS };

  const parsed = list.map(parseDkimSignature).filter((t) => t.present);
  if (parsed.length === 0) return { ...EMPTY_TAGS };

  const match = parsed.find((t) => domainMatches(t.domain, expectedDomain));
  if (match) return { ...match, matchesDomain: true };

  return { ...parsed[0], matchesDomain: false };
}

/** האם הכותרת הזאת נכללת ב-`h=`. שם הכותרת אינו רגיש לאותיות. */
export function signsHeader(tags: DkimSignatureTags, header: string): boolean {
  return tags.signedHeaders.includes(String(header ?? '').toLowerCase());
}

// ---------------------------------------------------------------------------
// ★★ חיתוך לגוף החתום
// ---------------------------------------------------------------------------

export interface SignedBodySlice {
  /** הגוף עד גבול החתימה. זה **הדבר היחיד** שמותר לקרוא ממנו ערך. */
  body: string;
  /** כמה בתים ירדו כי לא היו חתומים. `0` = הכול היה חתום. */
  bytesDropped: number;
  /** ★ `true` פירושו שמישהו הוסיף לגוף אחרי שהוא נחתם. */
  truncated: boolean;
  /** האם בכלל הייתה הגבלה (`l=`). */
  limited: boolean;
}

function utf8LenOf(cp: number): number {
  if (cp < 0x80) return 1;
  if (cp < 0x800) return 2;
  if (cp < 0x10000) return 3;
  return 4;
}

/** אורך המחרוזת ב**בתים** של UTF-8. */
export function utf8ByteLength(raw: string): number {
  let n = 0;
  for (const ch of String(raw ?? '')) n += utf8LenOf(ch.codePointAt(0) ?? 0);
  return n;
}

/**
 * ★★ חותך את הגוף ל-`limit` בתים.
 *
 * `limit === null` (אין `l=`) מחזיר את הגוף כמו שהוא — **כל הגוף חתום, וזה
 * המצב הטוב.** אין לדרוש `l=`; היעדרו הוא חדשות טובות ולא חסר.
 *
 * החיתוך נעשה על גבול תו: תו רב-בתי שהגבול עובר באמצעו יורד כולו.
 */
export function limitToSignedBody(raw: string, limit: number | null): SignedBodySlice {
  const body = String(raw ?? '');
  if (limit === null || !Number.isFinite(limit) || limit < 0) {
    return { body, bytesDropped: 0, truncated: false, limited: false };
  }

  let used = 0;
  let cut = -1;
  let index = 0;

  for (const ch of body) {
    const size = utf8LenOf(ch.codePointAt(0) ?? 0);
    if (used + size > limit) {
      cut = index;
      break;
    }
    used += size;
    index += ch.length;
  }

  if (cut === -1) {
    // הגוף כולו נכנס בתוך הגבול. זה גם המקרה של גוף באורך `l` בדיוק.
    return { body, bytesDropped: 0, truncated: false, limited: true };
  }

  return {
    body: body.slice(0, cut),
    bytesDropped: utf8ByteLength(body) - used,
    truncated: true,
    limited: true,
  };
}

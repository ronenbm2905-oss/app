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

/**
 * ★ קנוניזציית הגוף, מרשימה **סגורה**.
 *
 * `'other'` אינו ערך מהכותרת — הוא הדיווח שלנו על כך שלא זיהינו אותו.
 * כותרת החתימה נכתבת על ידי מי ששלח, וערך חופשי ממנה היה טקסט של זר
 * שנכתב ל-Firestore ומוצג במסך.
 */
export type BodyCanonicalization = 'simple' | 'relaxed' | 'other';

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
  /**
   * ★★ `c=` — **על איזה גוף `l=` נספר.**
   *
   * ---------------------------------------------------------------------------
   * למה התג הזה נקרא עכשיו, אחרי שהוא לא נקרא קודם
   * ---------------------------------------------------------------------------
   * `l=` אינו סופר בתים "כפי שהם על החוט". הוא סופר בתים של הגוף **אחרי
   * קנוניזציה**, ו-`c=` הוא שאומר איזו. ב-`relaxed` הקנוניזציה מכווצת
   * רצפי רווחים, מוחקת רווחים בסוף שורה, ומסירה שורות ריקות בסוף הגוף —
   * כלומר הגוף שנספר **קצר** מהגוף הגולמי.
   *
   * ולכן, כשחותכים גוף גולמי ב-`l=` בתים בלי לדעת את `c=`, החיתוך נופל
   * **מוקדם מדי** בדיוק כשהקנוניזציה היא `relaxed` — ומוקדם מדי פירושו
   * "ההזמנה נגמרה באמצע" על הודעה תקינה לגמרי. זו השערה שאפשר למדוד, וזה
   * בדיוק מה שהשדה הזה נועד לאפשר.
   *
   * ★ הערך מוגבל ל**רשימה סגורה**: `'simple' | 'relaxed' | 'other'`. כותרת
   * החתימה ניתנת לכתיבה על ידי מי ששלח את ההודעה, ולכן ערך חופשי ממנה היה
   * טקסט של זר שנכתב ל-Firestore ומוצג במסך. הוא לא. היעדר `c=` הוא
   * `'simple'` — ברירת המחדל של RFC 6376, ולא "לא ידוע".
   */
  bodyCanonicalization: BodyCanonicalization;
}

const EMPTY_TAGS: DkimSignatureTags = {
  present: false,
  matchesDomain: false,
  domain: null,
  selector: null,
  signedHeaders: [],
  bodyLengthLimit: null,
  bodyLengthMalformed: false,
  bodyCanonicalization: 'simple',
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

  // ★ `c=header-canon[/body-canon]`. כשהחלק השני חסר — `simple` (RFC 6376
  // §3.5). כשהתג כולו חסר — `simple/simple`.
  const cTag = (tags.get('c') ?? '').toLowerCase();
  const bodyCanonRaw = cTag.includes('/') ? cTag.split('/')[1].trim() : 'simple';
  const bodyCanonicalization: BodyCanonicalization =
    bodyCanonRaw === 'simple' ? 'simple' : bodyCanonRaw === 'relaxed' ? 'relaxed' : 'other';

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
    bodyCanonicalization,
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
  /**
   * ★★ אורך הגוף ה**מקונן** בבתים — כלומר הגוף שעליו `l=` נמדד.
   *
   * ההפרש בינו לבין אורך הגוף הגולמי הוא בדיוק מה שהקנוניזציה הורידה, והוא
   * הסיבה שהחיתוך הישן נפל מוקדם מדי. ראה `canonicalizeBody`.
   */
  canonBytes: number;
}

// ---------------------------------------------------------------------------
// ★★ קנוניזציה — RFC 6376 §3.4.4, והבאג שהיא מתקנת
// ---------------------------------------------------------------------------

/**
 * ★★ קנוניזציית גוף `relaxed`, עם מיפוי חזרה לגוף הגולמי.
 *
 * ---------------------------------------------------------------------------
 * הבאג שזה מתקן, ולמה הוא נראה כמו התקפה
 * ---------------------------------------------------------------------------
 * `l=` **אינו** סופר בתים כפי שהם על החוט. הוא סופר בתים של הגוף אחרי
 * הקנוניזציה שהוכרזה ב-`c=`. הספק שלנו חותם `c=relaxed/relaxed`, כלומר
 * `l=3694` מתייחס לגוף שבו רצפי רווחים כווצו, רווחים בסוף שורה נמחקו
 * ושורות ריקות בסוף הוסרו — **גוף קצר מהגולמי**.
 *
 * עד היום חתכנו את הגוף ה**גולמי** ב-`l=` בתים, בלי לקרוא את `c=` בכלל.
 * התוצאה: החיתוך נפל שיטתית מוקדם מדי, ההזמנה נגמרה באמצע, והמסך אמר
 * *"החלק שחברת הסליקה חתמה עליו נגמר לפני שההזמנה הושלמה"* — על 60 מתוך 60
 * הזמנות תקינות, בלי שאיש נגע בהן. באג אריתמטי שנראה כמו ממצא אבטחה.
 *
 * ---------------------------------------------------------------------------
 * ★★ ולמה יש כאן **מיפוי** ולא רק קנוניזציה
 * ---------------------------------------------------------------------------
 * הפיתוי הוא לקנן, לחתוך, ולפרסר את הגוף המקונן. זה שגוי בכיוון אחר:
 * הקנוניזציה **מוחקת טאבים** (הם WSP, והם מתכווצים לרווח יחיד), וטבלת
 * המוצרים של הספק מופרדת בטאבים. פירסור של הגוף המקונן היה מחליף באג אחד
 * באחר — הפעם "לא מצאתי טבלת מוצרים", על כל הזמנה.
 *
 * לכן: **הגוף המקונן קובע כמה נחתם, והגוף הגולמי הוא מה שנקרא.** מוצאים את
 * המקום בגוף המקונן שבו `l=` נגמר, וחוזרים ממנו למקום המקביל בגולמי. שני
 * הקטעים מתארים את אותו תוכן בדיוק — ההבדל היחיד ביניהם הוא הרווחים, ש-
 * `relaxed` מכריז עליהם במפורש כחסרי משמעות לחתימה.
 *
 * ⚠️ מה שזה כן אומר, וצריך להיאמר: ב-`relaxed` תוקף **יכול** לשנות רווחים
 * בלי לשבור את החתימה. זה נכון גם היום וגם אתמול — זו תכונה של `relaxed`
 * ולא של הקוד הזה — ואינו משתנה מהתיקון.
 */
function relaxedBodyWithMap(raw: string): { canon: string; map: number[] } {
  const s = String(raw ?? '');
  const n = s.length;
  let canon = '';
  /** `map[i]` = האינדקס בגוף הגולמי שממנו נולד התו ה-`i` במקונן. */
  const map: number[] = [];
  let i = 0;

  while (i <= n) {
    let lineEnd = i;
    while (lineEnd < n && s[lineEnd] !== '\n' && s[lineEnd] !== '\r') lineEnd++;

    // ★ §3.4.4: רצף WSP מתכווץ לרווח אחד, ו-WSP בסוף שורה נמחק לגמרי.
    let j = i;
    while (j < lineEnd) {
      const ch = s[j];
      if (ch === ' ' || ch === '\t') {
        const runStart = j;
        while (j < lineEnd && (s[j] === ' ' || s[j] === '\t')) j++;
        // רץ שנגמר בסוף השורה נמחק; אחרת הוא נהיה רווח אחד.
        if (j < lineEnd) {
          canon += ' ';
          map.push(runStart);
        }
        continue;
      }
      canon += ch;
      map.push(j);
      j++;
    }

    if (lineEnd >= n) break;

    // מפריד השורות נורמלי ל-CRLF. שני התווים ממופים לתחילת המפריד הגולמי.
    canon += '\r\n';
    map.push(lineEnd, lineEnd);
    i = lineEnd + (s[lineEnd] === '\r' && s[lineEnd + 1] === '\n' ? 2 : 1);
  }

  return { canon, map };
}

/** ★ שורות ריקות בסוף הגוף אינן נספרות (§3.4.4). הגוף נגמר ב-CRLF אחד. */
function trimTrailingEmptyLines(canon: string): string {
  const trimmed = canon.replace(/(?:\r\n)+$/, '');
  return trimmed.length === 0 ? '' : `${trimmed}\r\n`;
}

/**
 * ★ הגוף כפי ש-`l=` סופר אותו. `simple` מוחזר כמות שהוא.
 *
 * ל-`simple` יש אמנם כלל משלו על שורות ריקות בסוף, אבל ההתנהגות הקיימת —
 * הגוף כמו שהוא — היא שמרנית לכיוון הנכון (חותכת מוקדם יותר, לא מאוחר),
 * והיא זו שרצה היום. אין סיבה לשנות אותה יחד עם תיקון אחר.
 */
export function canonicalizeBody(raw: string, canon: BodyCanonicalization): string {
  if (canon !== 'relaxed') return String(raw ?? '');
  return trimTrailingEmptyLines(relaxedBodyWithMap(raw).canon);
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
export function limitToSignedBody(
  raw: string,
  limit: number | null,
  /**
   * ★★ הקנוניזציה שהוכרזה ב-`c=`. ברירת המחדל `'simple'` שומרת על
   * ההתנהגות הקודמת לכל קורא שלא עודכן — ובמיוחד למבחנים שנכתבו לפניה.
   */
  canon: BodyCanonicalization = 'simple',
): SignedBodySlice {
  const body = String(raw ?? '');

  if (canon === 'relaxed') return limitRelaxed(body, limit);

  const canonBytes = utf8ByteLength(body);
  if (limit === null || !Number.isFinite(limit) || limit < 0) {
    return { body, bytesDropped: 0, truncated: false, limited: false, canonBytes };
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
    return { body, bytesDropped: 0, truncated: false, limited: true, canonBytes };
  }

  return {
    body: body.slice(0, cut),
    bytesDropped: utf8ByteLength(body) - used,
    truncated: true,
    limited: true,
    canonBytes,
  };
}

/**
 * ★★ `relaxed`: מודדים על המקונן, חותכים בגולמי.
 *
 * ראה את ההערה על `relaxedBodyWithMap` — שם מוסבר למה הפירסור נשאר על
 * הגולמי ולא עובר למקונן.
 */
function limitRelaxed(body: string, limit: number | null): SignedBodySlice {
  const { canon, map } = relaxedBodyWithMap(body);
  const trimmed = trimTrailingEmptyLines(canon);
  const canonBytes = utf8ByteLength(trimmed);

  if (limit === null || !Number.isFinite(limit) || limit < 0) {
    return { body, bytesDropped: 0, truncated: false, limited: false, canonBytes };
  }

  // ★ הגוף החתום כולו בתוך הגבול. זה המצב הרגיל אצל הספק — וזה המצב
  // שהחישוב הישן פספס, כי הוא השווה את `l=` לאורך הגולמי.
  if (canonBytes <= limit) {
    return { body, bytesDropped: 0, truncated: false, limited: true, canonBytes };
  }

  // מוצאים את המקום במקונן שבו הגבול נגמר, וממפים אותו חזרה לגולמי.
  let used = 0;
  let canonIndex = 0;
  for (const ch of trimmed) {
    const size = utf8LenOf(ch.codePointAt(0) ?? 0);
    if (used + size > limit) break;
    used += size;
    canonIndex += ch.length;
  }

  const rawCut = canonIndex < map.length ? map[canonIndex] : body.length;
  const kept = body.slice(0, rawCut);

  return {
    body: kept,
    bytesDropped: utf8ByteLength(body) - utf8ByteLength(kept),
    truncated: rawCut < body.length,
    limited: true,
    canonBytes,
  };
}

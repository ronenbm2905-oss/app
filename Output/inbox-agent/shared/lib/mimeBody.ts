// ============================================================================
// mimeBody.ts — פירוק גוף MIME ובחירת החלק שקוראים ממנו.
//
// ---------------------------------------------------------------------------
// ★ למה בכלל, ולמה `text/plain`
// ---------------------------------------------------------------------------
// הודעת הסליקה האמיתית היא `multipart/alternative`: אותו תוכן בדיוק פעמיים,
// פעם כטקסט נקי ופעם כ-HTML מקודד `quoted-printable`. שני החלקים אומרים את
// אותו דבר, ולכן השאלה היחידה היא ממה **קוראים**:
//
//   · `text/plain` — זוגות תווית/ערך בשורות נפרדות, וטבלת המוצרים כשורות.
//     אין תגיות, אין סגנונות, אין ישויות, ואין קידוד באמצע מילה.
//   · `text/html`  — אותו מידע, עטוף בעשרות תגיות ומקודד `quoted-printable`,
//     כלומר משטח תקיפה גדול יותר ופרסור שביר יותר **בלי שום יתרון**.
//
// לכן: קוראים מ-`text/plain` כשהוא קיים. ה-HTML הוא נפילה לאחור בלבד, למקרה
// שהודעה תגיע בלי חלק טקסט — ולא ברירת המחדל.
//
// ---------------------------------------------------------------------------
// ★★ הגבול נלקח מתוך הגוף, ולא מכותרת `Content-Type`
// ---------------------------------------------------------------------------
// זו לא קיצור דרך אלא החלטת אבטחה. תג ה-`h=` בחתימה של הספק מכסה
// `Received:From:To:Subject` בלבד — כלומר **`Content-Type` אינו חתום**, וכל
// מי שמעביר את ההודעה הלאה יכול לשנות בו את מחרוזת ה-boundary בלי לשבור את
// החתימה. אילו היינו לוקחים ממנה את הגבול, שינוי בכותרת לא-חתומה היה משנה
// את הפירוק של גוף **חתום** — כלומר משנה מה נקרא.
//
// שורות הגבול עצמן יושבות **בתוך הגוף**, ולכן הן בתוך מה שנחתם (עד `l=`,
// ראה `dkimSignature.ts`). הגבול נגזר מהן.
// ============================================================================

/** עומק קינון מקסימלי של multipart בתוך multipart. */
const MAX_DEPTH = 3;

/**
 * שורת גבול. הטוקן לפי RFC 2046 (עד 70 תווים), ו**לפחות 6 תווים** אצלנו:
 * שורת תוכן שמתחילה במקף כפול היא דבר שקורה, וטוקן קצר היה הופך אותה לגבול.
 */
// ★ הכמת עצל (`{6,70}?`) ולא חמדן, כי המקף נמצא בתוך מחלקת התווים: גבול
// שנפוץ להתחיל אותו במקפים (`----=_Part_1`) היה בולע בצורה החמדנית גם את
// שני המקפים של שורת **הסגירה**, ואז שורת הסגירה נראית כמו גבול אחר לגמרי
// — כלומר החלק האחרון לא נסגר לעולם.
const BOUNDARY_LINE = /^--([0-9A-Za-z'()+_,\-./:=?]{6,70}?)(--)?[ \t]*$/;

export interface MimePart {
  /** `text/plain` וכדומה, באותיות קטנות ובלי פרמטרים. ריק כשלא הוצהר. */
  contentType: string;
  charset: string;
  encoding: string;
  /** הגוף המפוענח. */
  body: string;
  /** `false` כשהחלק לא נסגר בגבול תקין — כלומר הוא נחתך. */
  complete: boolean;
}

export interface ReadablePart {
  /** `text` = נקרא מ-`text/plain`. זה המצב שאנחנו רוצים לראות. */
  kind: 'text' | 'html' | 'unknown';
  body: string;
  contentType: string | null;
  /** כמה חלקים נמצאו בגוף. 1 = לא היה פירוק MIME בכלל. */
  partCount: number;
}

// ---------------------------------------------------------------------------
// בתים ↔ טקסט
// ---------------------------------------------------------------------------

function decodeBytes(bytes: number[], charset: string): string {
  const buf = new Uint8Array(bytes);
  const label = (charset || 'utf-8').toLowerCase();
  try {
    return new TextDecoder(label).decode(buf);
  } catch {
    // קידוד שהסביבה לא מכירה. UTF-8 הוא הניחוש הנכון היחיד שיש לנו, והוא
    // גם מה שהספק שולח בפועל.
    return new TextDecoder('utf-8').decode(buf);
  }
}

/** תו → בתים ב-UTF-8. משמש כשהקלט כבר טקסט ולא בתים. */
function pushUtf8(out: number[], ch: string): void {
  const cp = ch.codePointAt(0) ?? 0;
  if (cp < 0x80) out.push(cp);
  else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
  else if (cp < 0x10000)
    out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
  else
    out.push(
      0xf0 | (cp >> 18),
      0x80 | ((cp >> 12) & 0x3f),
      0x80 | ((cp >> 6) & 0x3f),
      0x80 | (cp & 0x3f),
    );
}

const HEX_PAIR = /^[0-9A-Fa-f]{2}$/;

/**
 * quoted-printable → בתים.
 *
 * ★ שתי הצורות שחייבות להיות נכונות כאן, כי שתיהן מופיעות בהודעה אמיתית
 * בעברית: בית מקודד, ו-`=` בסוף שורה (שבירה רכה, שאינה חלק מהטקסט). שבירה
 * רכה שלא מטופלת שוברת מילה עברית באמצע — ואז שם רחוב נקרא חצי.
 */
export function quotedPrintableToBytes(raw: string): number[] {
  const s = String(raw ?? '');
  const out: number[] = [];

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch !== '=') {
      pushUtf8(out, ch);
      continue;
    }
    const pair = s.slice(i + 1, i + 3);
    if (HEX_PAIR.test(pair)) {
      out.push(parseInt(pair, 16));
      i += 2;
      continue;
    }
    if (s[i + 1] === '\r' && s[i + 2] === '\n') {
      i += 2;
      continue;
    }
    if (s[i + 1] === '\n') {
      i += 1;
      continue;
    }
    // `=` שאינו קידוד ואינו שבירה — נשאר כמו שהוא ולא נבלע.
    pushUtf8(out, ch);
  }

  return out;
}

/** base64 → בתים. קלט פגום מחזיר רשימה ריקה ולא זורק. */
export function base64ToBytes(raw: string): number[] {
  const clean = String(raw ?? '').replace(/[^A-Za-z0-9+/=]/g, '');
  if (!clean) return [];
  try {
    const bin = atob(clean);
    const out: number[] = new Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i) & 0xff;
    return out;
  } catch {
    return [];
  }
}

function decodePartBody(body: string, encoding: string, charset: string): string {
  switch (encoding) {
    case 'quoted-printable':
      return decodeBytes(quotedPrintableToBytes(body), charset);
    case 'base64':
      return decodeBytes(base64ToBytes(body), charset);
    default:
      // 7bit / 8bit / binary / לא הוצהר — הטקסט כבר טקסט.
      return body;
  }
}

// ---------------------------------------------------------------------------
// פירוק
// ---------------------------------------------------------------------------

/**
 * מאתר את מחרוזת הגבול **מתוך הגוף עצמו**.
 *
 * מועמד מתקבל רק אם הוא מופיע יותר מפעם אחת. הדרישה הזאת מסננת שורת תוכן
 * אקראית שמתחילה במקף כפול, שאותה נראה בדיוק פעם אחת.
 *
 * ★ הודעה שנחתכה ב-`l=` עשויה לאבד את גבול הסגירה. גם אז נשארות **שתי**
 * הופעות כשיש שני חלקים, ולכן הזיהוי עדיין עובד — וזה המקרה שחשוב שיעבוד.
 */
function findBoundary(lines: readonly string[]): string | null {
  const counts = new Map<string, number>();
  for (const line of lines) {
    const m = BOUNDARY_LINE.exec(line);
    if (m) counts.set(m[1], (counts.get(m[1]) ?? 0) + 1);
  }

  const firstContent = lines.findIndex((l) => l.trim().length > 0);

  for (let i = 0; i < lines.length; i++) {
    const m = BOUNDARY_LINE.exec(lines[i]);
    if (!m) continue;
    if ((counts.get(m[1]) ?? 0) >= 2) return m[1];

    // ★★ הופעה **אחת** מתקבלת רק בצורה אחת: היא השורה הראשונה בגוף, ומיד
    // אחריה כותרת חלק. זה בדיוק המצב של הודעה שנחתכה ב-`l=` — נשאר לה חלק
    // אחד בלי גבול סוגר — ובלי החריג הזה היינו מפרשים את **כותרות החלק**
    // כתוכן, כלומר קוראים ערכים מתוך `Content-Type`.
    if (i === firstContent && !m[2]) {
      const next = lines.slice(i + 1).find((l) => l.trim().length > 0);
      if (next && /^[A-Za-z][A-Za-z0-9-]*[ \t]*:/.test(next)) return m[1];
    }
  }

  return null;
}

function parseHeaders(chunk: readonly string[]): {
  headers: Record<string, string>;
  bodyLines: string[];
} {
  const headers: Record<string, string> = {};
  let last = '';
  let i = 0;

  for (; i < chunk.length; i++) {
    const line = chunk[i];
    if (line.trim() === '') {
      i++;
      break;
    }
    if (/^[ \t]/.test(line) && last) {
      headers[last] += ' ' + line.trim();
      continue;
    }
    const m = /^([A-Za-z0-9-]+)[ \t]*:[ \t]*(.*)$/.exec(line);
    if (!m) continue;
    last = m[1].toLowerCase();
    headers[last] = m[2].trim();
  }

  return { headers, bodyLines: chunk.slice(i) };
}

function paramOf(value: string, name: string): string {
  const m = new RegExp(`${name}\\s*=\\s*"?([^";]+)"?`, 'i').exec(value);
  return m ? m[1].trim().toLowerCase() : '';
}

function finishPart(chunk: readonly string[], complete: boolean, depth: number): MimePart {
  const { headers, bodyLines } = parseHeaders(chunk);
  const contentTypeRaw = headers['content-type'] ?? '';
  const contentType = contentTypeRaw.split(';')[0].trim().toLowerCase();
  const charset = paramOf(contentTypeRaw, 'charset') || 'utf-8';
  const encoding = (headers['content-transfer-encoding'] ?? '').trim().toLowerCase();
  const rawBody = bodyLines.join('\n');

  // multipart בתוך multipart — קורה כשיש גם תמונות משובצות. יורדים פנימה עד
  // עומק סביר, כדי שחלק הטקסט לא ייעלם בגלל עטיפה.
  if (contentType.startsWith('multipart/') && depth < MAX_DEPTH) {
    const inner = splitMimeParts(rawBody, depth + 1);
    if (inner && inner.length > 0) {
      const picked = pickFrom(inner);
      if (picked) return { ...picked, complete: complete && picked.complete };
    }
  }

  return {
    contentType,
    charset,
    encoding,
    body: decodePartBody(rawBody, encoding, charset),
    complete,
  };
}

function pickFrom(parts: readonly MimePart[]): MimePart | null {
  const nonEmpty = parts.filter((p) => p.body.trim().length > 0);
  return (
    nonEmpty.find((p) => p.contentType === 'text/plain') ??
    nonEmpty.find((p) => p.contentType === 'text/html') ??
    nonEmpty[0] ??
    null
  );
}

/**
 * גוף גולמי → חלקים. `null` כשאין פירוק MIME בכלל (הודעה שאינה multipart).
 */
export function splitMimeParts(raw: string, depth = 0): MimePart[] | null {
  const lines = String(raw ?? '').split(/\r\n|\n|\r/);
  const boundary = findBoundary(lines);
  if (!boundary) return null;

  const parts: MimePart[] = [];
  let current: string[] | null = null;

  for (const line of lines) {
    const m = BOUNDARY_LINE.exec(line);
    if (m && m[1] === boundary) {
      if (current) parts.push(finishPart(current, true, depth));
      current = m[2] ? null : [];
      continue;
    }
    if (current) current.push(line);
  }

  // חלק שלא נסגר — כלומר ההודעה נחתכה באמצע. הוא נשמר ומסומן.
  if (current && current.length > 0) parts.push(finishPart(current, false, depth));

  return parts;
}

/**
 * ★ החלק שקוראים ממנו. `text/plain` קודם, HTML רק אם אין.
 *
 * גוף שאינו multipart מוחזר כמו שהוא עם `kind: 'unknown'` — כלומר הקורא
 * מטפל בו כמו קודם. אין כאן ניחוש של קידוד: בלי כותרות אין מה להסיק.
 */
export function selectReadablePart(raw: string): ReadablePart {
  const text = String(raw ?? '');
  const parts = splitMimeParts(text);

  if (!parts || parts.length === 0) {
    return { kind: 'unknown', body: text, contentType: null, partCount: 1 };
  }

  const picked = pickFrom(parts);
  if (!picked) {
    return { kind: 'unknown', body: '', contentType: null, partCount: parts.length };
  }

  const kind: ReadablePart['kind'] =
    picked.contentType === 'text/plain'
      ? 'text'
      : picked.contentType === 'text/html'
        ? 'html'
        : 'unknown';

  return {
    kind,
    body: picked.body,
    contentType: picked.contentType || null,
    partCount: parts.length,
  };
}

// ---------------------------------------------------------------------------
// ★ RFC 2047 — הנושא מגיע מקודד
// ---------------------------------------------------------------------------

/**
 * מילה מקודדת בכותרת → טקסט.
 *
 * ★ למה זה לא קוסמטי: הנושא הוא אחד משלושת התנאים לפענוח, וההשוואה מולו היא
 * השוואת מחרוזת מדויקת. בהודעה אמיתית הכותרת מגיעה **מקודדת** — ולכן בלי
 * הפענוח הזה כל הזמנה אמיתית הייתה נופלת ב"הנושא אינו הנושא הקבוע", כלומר
 * הכלי היה מסרב לקרוא בדיוק את מה שהוא נבנה לקרוא.
 *
 * רווח בין שתי מילים מקודדות סמוכות אינו חלק מהטקסט (RFC 2047 §6.2) ולכן
 * מוסר לפני הפענוח. רווח בין מילה מקודדת לטקסט רגיל נשמר.
 */
export function decodeMimeWords(raw: string): string {
  const s = String(raw ?? '');
  if (!s.includes('=?')) return s;

  const joined = s.replace(/\?=[ \t]+(?==\?)/g, '?=');

  return joined.replace(
    /=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g,
    (whole: string, charset: string, enc: string, payload: string) => {
      try {
        const bytes =
          enc.toLowerCase() === 'b'
            ? base64ToBytes(payload)
            : quotedPrintableToBytes(payload.replace(/_/g, ' '));
        const decoded = decodeBytes(bytes, charset);
        // פענוח שהחזיר כלום מול קלט לא-ריק פירושו קידוד שלא הצלחנו לקרוא.
        // מחזירים את המקור — טוב יותר מלמחוק את הנושא בשקט.
        return decoded.length > 0 || payload.length === 0 ? decoded : whole;
      } catch {
        return whole;
      }
    },
  );
}

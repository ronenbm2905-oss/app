// ============================================================================
// xlsx.ts — ★★ קריאת קובץ Excel בדפדפן, **בלי ספרייה.**
//
// ---------------------------------------------------------------------------
// למה לא `sheetjs`
// ---------------------------------------------------------------------------
// שני הקבצים שהכלי הזה קורא נמדדו: גיליון אחד, שורת כותרת אחת, בלי נוסחאות,
// בלי מאקרו, בלי עיצוב מותנה. מולם עומדת ספרייה של מאות קילובייטים עם
// היסטוריית CVE, שנכנסת לחבילה שעליה כתוב "הקבצים נשארים במחשב שלך".
//
// ★ ההכרעה: קוראים לבד. קובץ xlsx הוא ZIP, והדפדפן יודע לפרוס deflate לבד
// דרך `DecompressionStream`. מה שנשאר זה לקרוא את טבלת התוכן של ה-ZIP ואת
// שני קובצי ה-XML שבאמת מעניינים — הגיליון ומחרוזות המשנה.
//
// ⚠️ ומה שזה **לא**: מימוש מלא של התקן. אין כאן ZIP64, אין הצפנה, אין
// קידודי דחיסה מלבד שניים, ואין פירוש נוסחאות. קובץ שחורג מזה מקבל שגיאה
// בעברית — ולא פירוש שגוי בשקט. זה בדיוק ההבדל שנשרפו עליו סבבים בפרסר
// ההזמנות: פרסר שמנחש גרוע מפרסר שמסרב.
//
// ---------------------------------------------------------------------------
// ★★ נקודת הממשק היחידה שמוחלפת במבחן
// ---------------------------------------------------------------------------
// `InflateRaw`. בדפדפן — `DecompressionStream`; במבחן (ב-jsdom הוא לא קיים)
// — `zlib.inflateRawSync` של Node. **כל השאר זהה**: אותו פרסר ZIP, אותו
// פרסר XML, אותה בניית טבלה. המסלול שנבדק הוא המסלול שרץ אצלה.
// ============================================================================

// ---------------------------------------------------------------------------
// טיפוסים
// ---------------------------------------------------------------------------

/** תא בגיליון. `num` הוא `null` כשהתא אינו מספרי — ואז `text` הוא מה שיש. */
export interface Cell {
  readonly text: string;
  readonly num: number | null;
}

export interface SheetRow {
  /** מספר השורה **כפי שהוא באקסל** — כדי שנוכל לומר לה "שורה 47". */
  readonly rowIndex: number;
  readonly cells: readonly Cell[];
}

/** גיליון אחרי פרסור: שורת כותרות, ואחריה השורות. */
export interface SheetGrid {
  /** שורה 1, כמחרוזות מנורמלות. */
  readonly header: readonly string[];
  /** משורה 2 והלאה. שורות ריקות לגמרי אינן נכללות. */
  readonly rows: readonly SheetRow[];
}

/** פריסת deflate-raw. הנקודה היחידה שמתחלפת בין דפדפן למבחן. */
export type InflateRaw = (bytes: Uint8Array) => Promise<Uint8Array>;

/** תא ריק. מוחזר עבור עמודה שאין לה תא בשורה — וזה נפוץ בקובצי אקסל. */
export const EMPTY_CELL: Cell = { text: '', num: null };

// ---------------------------------------------------------------------------
// פריסה בדפדפן
// ---------------------------------------------------------------------------

/**
 * ★ `DecompressionStream('deflate-raw')` — קיים בכל דפדפן שהיא משתמשת בו,
 * ואינו נוגע ברשת: הוא מקבל בייטים ומחזיר בייטים.
 *
 * הקריאה נעשית בלולאת `getReader` ולא דרך `new Response(stream)` בכוונה:
 * `Response` הוא טיפוס של שכבת הרשת, ושם כזה בגרף של מסך שמבטיח "שום דבר
 * לא נשלח" הוא בדיוק סוג הרעש שגורם למישהו לפתוח חריג בשער.
 */
export const inflateRawInBrowser: InflateRaw = async (bytes) => {
  const stream = new DecompressionStream('deflate-raw');
  const writer = stream.writable.getWriter();
  // עותק על מאגר רגיל: `Uint8Array` יכול לשבת גם על `SharedArrayBuffer`,
  // שאינו קלט חוקי לזרם. העלות זניחה, והחלופה היא המרת-טיפוס עיוורת.
  const input = new Uint8Array(bytes.length);
  input.set(bytes);
  void writer.write(input);
  void writer.close();

  const reader = stream.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.length;
    }
  }

  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
};

// ---------------------------------------------------------------------------
// ZIP
// ---------------------------------------------------------------------------

/** שגיאה שאפשר להראות למשתמשת. כל כשל בקריאה עובר דרכה. */
export class XlsxError extends Error {
  constructor(public readonly reasonHe: string) {
    super(reasonHe);
    this.name = 'XlsxError';
  }
}

const SIG_EOCD = 0x06054b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_LOCAL = 0x04034b50;

/** רוחב מקסימלי של הערת ה-ZIP, ולכן כמה אחורה צריך לחפש את סוף הטבלה. */
const EOCD_MAX_SCAN = 65_557;

interface ZipEntry {
  readonly name: string;
  readonly method: number;
  readonly compressedSize: number;
  readonly uncompressedSize: number;
  readonly localOffset: number;
}

function viewOf(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function findEocd(view: DataView): number {
  const start = Math.max(0, view.byteLength - EOCD_MAX_SCAN);
  for (let at = view.byteLength - 22; at >= start; at -= 1) {
    if (view.getUint32(at, true) === SIG_EOCD) return at;
  }
  throw new XlsxError('הקובץ הזה אינו קובץ אקסל — לא מצאתי בתוכו את המבנה הצפוי.');
}

/**
 * טבלת התוכן של ה-ZIP.
 *
 * ★ קוראים את **הטבלה המרכזית** ולא סורקים כותרות מקומיות: הכותרת המקומית
 * יכולה לשקר על הגודל (דגל data-descriptor), והטבלה המרכזית היא מקור האמת
 * היחיד בפורמט.
 */
function readCentralDirectory(bytes: Uint8Array): ZipEntry[] {
  const view = viewOf(bytes);
  const eocd = findEocd(view);
  const count = view.getUint16(eocd + 10, true);
  const dirOffset = view.getUint32(eocd + 16, true);

  if (dirOffset === 0xffff_ffff) {
    throw new XlsxError('הקובץ הזה שמור בצורה שאני עוד לא יודעת לקרוא (ZIP64).');
  }

  const decoder = new TextDecoder('utf-8');
  const entries: ZipEntry[] = [];
  let at = dirOffset;

  for (let i = 0; i < count; i += 1) {
    if (at + 46 > bytes.length || view.getUint32(at, true) !== SIG_CENTRAL) {
      throw new XlsxError('הקובץ הזה נראה פגום — טבלת התוכן שלו נקטעה באמצע.');
    }
    const method = view.getUint16(at + 10, true);
    const compressedSize = view.getUint32(at + 20, true);
    const uncompressedSize = view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const localOffset = view.getUint32(at + 42, true);
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));

    if (compressedSize === 0xffff_ffff || localOffset === 0xffff_ffff) {
      throw new XlsxError('הקובץ הזה שמור בצורה שאני עוד לא יודעת לקרוא (ZIP64).');
    }

    entries.push({ name, method, compressedSize, uncompressedSize, localOffset });
    at += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

/** תוכן של רשומה אחת, כטקסט. שני קידודי דחיסה בלבד — שניהם מה שאקסל כותב. */
async function readEntryText(
  bytes: Uint8Array,
  entry: ZipEntry,
  inflate: InflateRaw,
): Promise<string> {
  const view = viewOf(bytes);
  if (view.getUint32(entry.localOffset, true) !== SIG_LOCAL) {
    throw new XlsxError('הקובץ הזה נראה פגום — אחד החלקים שבתוכו לא נמצא במקום שלו.');
  }
  const nameLength = view.getUint16(entry.localOffset + 26, true);
  const extraLength = view.getUint16(entry.localOffset + 28, true);
  const from = entry.localOffset + 30 + nameLength + extraLength;
  const raw = bytes.subarray(from, from + entry.compressedSize);

  let data: Uint8Array;
  if (entry.method === 0) {
    // STORED — אקסל כותב כך קבצים קטנים מאוד.
    data = raw;
  } else if (entry.method === 8) {
    data = await inflate(raw);
  } else {
    throw new XlsxError('הקובץ הזה דחוס בשיטה שאני עוד לא יודעת לפרוס.');
  }

  if (entry.uncompressedSize > 0 && data.length !== entry.uncompressedSize) {
    throw new XlsxError('הקובץ הזה נראה פגום — החלק שנפרס יצא בגודל אחר מהצפוי.');
  }

  // ★ התוכן בתוך xlsx הוא UTF-8 **תמיד**, לפי התקן — גם כשהקובץ נוצר
  // בעברית ובווינדוס. אין כאן שאלת קידוד, ולכן אין כאן ניחוש קידוד.
  return new TextDecoder('utf-8').decode(data);
}

// ---------------------------------------------------------------------------
// XML
// ---------------------------------------------------------------------------

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

/** פענוח ישויות XML. ‎`&#8;`‎ ו-‎`&#x41;`‎ כלולים — אקסל כותב אותם. */
export function unescapeXml(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body.startsWith('#x') || body.startsWith('#X')) {
      const code = Number.parseInt(body.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    if (body.startsWith('#')) {
      const code = Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[body] ?? whole;
  });
}

/** כל ה-`<t>` שבתוך קטע — משורשרים. טקסט מעוצב נשמר כפסקה אחת. */
function textRuns(xml: string): string {
  let out = '';
  const re = /<t\b[^>]*?(?:\/>|>([\s\S]*?)<\/t>)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml)) !== null) {
    out += unescapeXml(match[1] ?? '');
  }
  return out;
}

/** `xl/sharedStrings.xml` → מערך מחרוזות לפי אינדקס. */
export function parseSharedStrings(xml: string): string[] {
  const out: string[] = [];
  const re = /<si\b[^>]*?(?:\/>|>([\s\S]*?)<\/si>)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml)) !== null) {
    out.push(textRuns(match[1] ?? ''));
  }
  return out;
}

/** `"BC12"` → 54. ‎`A`‎ הוא 0. */
export function columnIndexOf(ref: string): number {
  let index = 0;
  for (const ch of ref) {
    const code = ch.charCodeAt(0);
    if (code < 65 || code > 90) break;
    index = index * 26 + (code - 64);
  }
  return index - 1;
}

function attr(tag: string, name: string): string | null {
  const match = new RegExp(`\\b${name}="([^"]*)"`).exec(tag);
  return match ? match[1] : null;
}

/**
 * `xl/worksheets/sheetN.xml` → שורות ותאים.
 *
 * ★ regex ולא DOM: ‎`DOMParser`‎ אינו קיים ב-Worker, וגיליון של אלפי שורות
 * הופך אצלו לעץ של עשרות אלפי צמתים. הקבצים כאן שטוחים לגמרי — אין קינון
 * מעבר ל-`row > c > v` — וזה בדיוק המקרה שבו regex הוא הכלי הנכון ולא קיצור
 * דרך.
 */
export function parseSheet(xml: string, shared: readonly string[]): SheetRow[] {
  const rows: SheetRow[] = [];
  const rowRe = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g;
  let rowMatch: RegExpExecArray | null;
  let fallbackIndex = 0;

  while ((rowMatch = rowRe.exec(xml)) !== null) {
    fallbackIndex += 1;
    const declared = attr(rowMatch[1] ?? '', 'r');
    const rowIndex = declared === null ? fallbackIndex : Number(declared);
    const body = rowMatch[2] ?? '';

    const cells: Cell[] = [];
    const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cellMatch: RegExpExecArray | null;
    let nextColumn = 0;

    while ((cellMatch = cellRe.exec(body)) !== null) {
      const tag = cellMatch[1] ?? '';
      const inner = cellMatch[2] ?? '';
      const ref = attr(tag, 'r');
      const column = ref === null ? nextColumn : columnIndexOf(ref);
      nextColumn = column + 1;
      while (cells.length < column) cells.push(EMPTY_CELL);
      cells[column] = readCell(attr(tag, 't'), inner, shared);
    }

    if (cells.some((cell) => cell.text !== '')) rows.push({ rowIndex, cells });
  }

  return rows;
}

function readCell(type: string | null, inner: string, shared: readonly string[]): Cell {
  if (type === 'inlineStr') return { text: textRuns(inner).trim(), num: null };

  const valueMatch = /<v\b[^>]*?(?:\/>|>([\s\S]*?)<\/v>)/.exec(inner);
  const raw = unescapeXml(valueMatch?.[1] ?? '');

  if (type === 's') {
    const index = Number(raw);
    return { text: (shared[index] ?? '').trim(), num: null };
  }
  if (type === 'str' || type === 'e' || type === 'd') return { text: raw.trim(), num: null };
  if (type === 'b') return { text: raw === '1' ? 'TRUE' : 'FALSE', num: null };

  if (raw === '') return EMPTY_CELL;
  const num = Number(raw);
  return Number.isFinite(num) ? { text: raw.trim(), num } : { text: raw.trim(), num: null };
}

// ---------------------------------------------------------------------------
// הרכבה
// ---------------------------------------------------------------------------

/**
 * ★ נירמול כותרת. גרשיים עבריים (״) וגרש (׳) הם אותו תו מבחינתה, ולא
 * מבחינת השוואת מחרוזות — ו"סה״כ ברוטו" מול `סה"כ ברוטו` הוא בדיוק סוג
 * ההבדל שמפיל זיהוי קובץ בלי שאף אחד יבין למה.
 */
export function normalizeHeader(text: string): string {
  return text
    .replace(/[״“”]/g, '"')
    .replace(/[׳‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** שם העמודה → מיקומה בשורה, או ‎`-1`‎. */
export function headerIndex(grid: SheetGrid, name: string): number {
  const wanted = normalizeHeader(name);
  return grid.header.findIndex((value) => value === wanted);
}

/** האם כל הכותרות האלה קיימות. זו כל שאלת "איזה קובץ זה". */
export function hasHeaders(grid: SheetGrid, names: readonly string[]): boolean {
  return names.every((name) => headerIndex(grid, name) >= 0);
}

/** תא לפי מיקום, בלי ליפול על שורה קצרה. */
export function cellAt(row: SheetRow, index: number): Cell {
  if (index < 0) return EMPTY_CELL;
  return row.cells[index] ?? EMPTY_CELL;
}

/**
 * ★ סריאל של אקסל → ISO.
 *
 * בסיס 1899-12-30 (ולא 1900-01-01: אקסל סופר את 29 בפברואר 1900 שמעולם לא
 * היה, והבסיס המוזז הוא מה שמנטרל את זה). **החלק העשרוני נחתך** — בטרנזילה
 * הוא השעה, ולנו יש רק שאלה ברמת יום.
 */
export function serialToIso(serial: number): string | null {
  if (!Number.isFinite(serial)) return null;
  const days = Math.floor(serial);
  // 1 = 31.12.1899, ו-2_958_465 = 31.12.9999. מחוץ לזה זה לא תאריך אלא מספר.
  if (days < 1 || days > 2_958_465) return null;
  const at = new Date(Date.UTC(1899, 11, 30) + days * 86_400_000);
  return at.toISOString().slice(0, 10);
}

const SHEET_RE = /^xl\/worksheets\/[^/]+\.xml$/;

/**
 * קובץ xlsx (בייטים) → הגיליון הראשון כטבלה.
 *
 * ⚠️ **הגיליון הראשון בלבד.** שני הקבצים שנמדדו הם גיליון אחד, ובחירה בין
 * גיליונות היא החלטת מוצר (איזה? על פי מה?) ולא פרט טכני. קובץ עם כמה
 * גיליונות יקרא את הראשון — ואם זה יתברר כלא נכון, זה ייראה מיד כ"עוד לא
 * מכירים את הפורמט" ולא כנתון שגוי.
 */
export async function readSheetGrid(
  bytes: Uint8Array,
  inflate: InflateRaw = inflateRawInBrowser,
): Promise<SheetGrid> {
  if (bytes.length < 22) {
    throw new XlsxError('הקובץ הזה ריק או קטן מדי מכדי להיות קובץ אקסל.');
  }
  if (!(bytes[0] === 0x50 && bytes[1] === 0x4b)) {
    throw new XlsxError('הקובץ הזה אינו קובץ אקסל.');
  }

  const entries = readCentralDirectory(bytes);
  const sheets = entries.filter((entry) => SHEET_RE.test(entry.name)).sort(
    (x, y) => (x.name < y.name ? -1 : x.name > y.name ? 1 : 0),
  );
  if (sheets.length === 0) throw new XlsxError('לא מצאתי גיליון בתוך הקובץ הזה.');

  const sharedEntry = entries.find((entry) => entry.name === 'xl/sharedStrings.xml');
  const shared = sharedEntry
    ? parseSharedStrings(await readEntryText(bytes, sharedEntry, inflate))
    : [];

  const rows = parseSheet(await readEntryText(bytes, sheets[0], inflate), shared);
  if (rows.length === 0) return { header: [], rows: [] };

  const [first, ...rest] = rows;
  return {
    header: first.cells.map((cell) => normalizeHeader(cell.text)),
    rows: rest,
  };
}

// ============================================================================
// tests/fixtures/xlsxBuilder.ts — ★★ בונה קובצי xlsx **מסונתזים** למבחנים.
//
// ---------------------------------------------------------------------------
// ⛔ למה אין כאן אף בייט מהקבצים האמיתיים
// ---------------------------------------------------------------------------
// שני הקבצים נמדדו, והם **אינם בריפו ולא יהיו**: בקובץ של טרנזילה יש ת.ז,
// טוקן כרטיס וכתובת IP, והריפו הזה ציבורי. לכן כל מה שכאן נבנה בקוד, עם
// שמות כמו "עסק לדוגמה" וסכומים שאינם מהקובץ האמיתי.
//
// מה שכן נלקח מהמדידה זה **המבנה**: שמות העמודות, טיפוס התאריך (סריאל עם
// שבר של שעה), וההתנהגות של עמודת הסטטוס. זה בדיוק מה שמותר להעתיק, וזה
// גם ההבדל בין פרסר שאומת מול קלט שאנחנו המצאנו לבין פרסר שאומת מול הצורה
// האמיתית.
//
// ---------------------------------------------------------------------------
// ★ ולמה בונים ZIP ביד ולא שומרים קובץ בינארי
// ---------------------------------------------------------------------------
// קובץ בינארי בריפו הוא קופסה סגורה: אי אפשר לקרוא בו את הכוונה, אי אפשר
// לשנות בו שורה אחת ב-diff, ואי אפשר לוודא שאין בו מה שאסור. בנייה בקוד
// היא נראית לעין — ובונוס: היא מאפשרת לייצר גם קובץ פגום, גם STORED וגם
// deflate, כלומר לבדוק את **הענפים** של הקורא ולא רק את המסלול המאושר.
// ============================================================================

import { deflateRawSync, inflateRawSync } from 'node:zlib';
import type { InflateRaw } from '../../shared/lib/xlsx';

/**
 * ★★ פריסת deflate לסביבת המבחן.
 *
 * `DecompressionStream` אינו קיים ב-jsdom. זו **הנקודה היחידה** שמוחלפת:
 * כל השאר — פרסור ה-ZIP, ה-XML, בניית הטבלה, הזיהוי והפרסור — הוא אותו קוד
 * בדיוק שרץ בדפדפן.
 */
export const nodeInflateRaw: InflateRaw = async (bytes) =>
  new Uint8Array(inflateRawSync(Buffer.from(bytes)));

// ---------------------------------------------------------------------------
// ZIP
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export interface ZipFile {
  readonly name: string;
  readonly text: string;
}

/** בונה ZIP. `stored` מכריח שיטה 0 — כדי לבדוק גם את הענף הזה בקורא. */
export function buildZip(files: readonly ZipFile[], stored = false): Uint8Array {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const name = encoder.encode(file.name);
    const raw = encoder.encode(file.text);
    const data = stored ? raw : new Uint8Array(deflateRawSync(Buffer.from(raw)));
    const method = stored ? 0 : 8;
    const crc = crc32(raw);

    const local = new Uint8Array(30 + name.length + data.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(8, method, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, raw.length, true);
    localView.setUint16(26, name.length, true);
    local.set(name, 30);
    local.set(data, 30 + name.length);
    locals.push(local);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(10, method, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, raw.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint32(42, offset, true);
    central.set(name, 46);
    centrals.push(central);

    offset += local.length;
  }

  const centralSize = centrals.reduce((sum, c) => sum + c.length, 0);
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true);
  eocdView.setUint16(8, files.length, true);
  eocdView.setUint16(10, files.length, true);
  eocdView.setUint32(12, centralSize, true);
  eocdView.setUint32(16, offset, true);

  const total =
    locals.reduce((sum, l) => sum + l.length, 0) + centralSize + eocd.length;
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of [...locals, ...centrals, eocd]) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

// ---------------------------------------------------------------------------
// גיליון
// ---------------------------------------------------------------------------

/** ערך תא: מחרוזת (נכנסת ל-sharedStrings) או מספר (נכתב ישירות). */
export type CellValue = string | number | null;

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function columnName(index: number): string {
  let n = index + 1;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

export interface SheetOptions {
  /** שמירה בלי דחיסה — לבדיקת ענף STORED. */
  readonly stored?: boolean;
  /** בלי `sharedStrings.xml`: מחרוזות נכתבות inline. */
  readonly inlineStrings?: boolean;
}

/**
 * טבלה דו-ממדית → קובץ xlsx אמיתי.
 *
 * ★ שורה 1 היא הכותרות, בדיוק כמו בשני הקבצים שנמדדו. `null` בתא מייצר תא
 * שאינו קיים בכלל ב-XML — וזה **לא** קישוט: אקסל באמת משמיט תאים ריקים,
 * וקורא שמניח שהתאים רציפים נשבר על השורה הראשונה שחסר בה משהו.
 */
export function buildXlsx(grid: readonly (readonly CellValue[])[], options: SheetOptions = {}): Uint8Array {
  const shared: string[] = [];
  const sharedIndex = new Map<string, number>();

  const rowsXml = grid
    .map((row, r) => {
      const cells = row
        .map((value, c) => {
          if (value === null || value === '') return '';
          const ref = `${columnName(c)}${r + 1}`;
          if (typeof value === 'number') return `<c r="${ref}"><v>${value}</v></c>`;
          if (options.inlineStrings) {
            return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
          }
          let index = sharedIndex.get(value);
          if (index === undefined) {
            index = shared.length;
            shared.push(value);
            sharedIndex.set(value, index);
          }
          return `<c r="${ref}" t="s"><v>${index}</v></c>`;
        })
        .join('');
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join('');

  const sheetXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetData>${rowsXml}</sheetData></worksheet>`;

  const sharedXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${shared.length}" uniqueCount="${shared.length}">` +
    shared.map((value) => `<si><t>${escapeXml(value)}</t></si>`).join('') +
    `</sst>`;

  const files: ZipFile[] = [
    {
      name: '[Content_Types].xml',
      text:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        `<Default Extension="xml" ContentType="application/xml"/></Types>`,
    },
    {
      name: '_rels/.rels',
      text:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`,
    },
    {
      name: 'xl/workbook.xml',
      text:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
        `<sheets><sheet name="גיליון1" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    },
    { name: 'xl/worksheets/sheet1.xml', text: sheetXml },
  ];

  if (!options.inlineStrings) files.push({ name: 'xl/sharedStrings.xml', text: sharedXml });

  return buildZip(files, options.stored === true);
}

// ---------------------------------------------------------------------------
// ★ סריאל של אקסל — ההפך מ-`serialToIso`, לצורך בניית הקלט
// ---------------------------------------------------------------------------

/** ISO → סריאל של אקסל. `hours` מוסיף את השבר העשרוני שטרנזילה כותבת. */
export function isoToSerial(iso: string, hours = 0): number {
  const [y, m, d] = iso.split('-').map(Number);
  const days = (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86_400_000;
  return days + hours / 24;
}

// ---------------------------------------------------------------------------
// ★★ שני הקבצים, בצורתם המדודה ובנתונים מומצאים
// ---------------------------------------------------------------------------

/**
 * טרנזילה: 33 עמודות, שורה לכל עסקה.
 *
 * ⚠️ העמודות הרגישות **קיימות כאן בכותרת** — וזו כל הנקודה: המבחן צריך
 * לוודא שהאדפטר לא נוגע בהן גם כשהן בקובץ. הערכים בתוכן מומצאים לחלוטין.
 */
export const TRANZILA_HEADERS = [
  'סוג תנועה', // A
  'שם בעל הכרטיס', // B
  'מטבע', // C
  'תשלומים', // D
  'סוג כרטיס', // E
  'מספר כרטיס', // F
  'תוקף', // G
  'מנפיק', // H
  'ת.ז', // I
  'טלפון', // J
  'מספר אישור', // K
  'שם מסוף', // L
  'סוג עסקה', // M
  'מקור', // N
  'אמצעי', // O
  'מועדון', // P
  'קופון', // Q
  'הערה', // R
  'כתובת IP', // S
  'מספר עסקה', // T
  'תאריך ושעה', // U
  'סכום', // V
  'מספר שידור', // W
  "4 ספ' אחרונות", // X
  'מזהה לקוח', // Y
  'סטטוס', // Z
  'אסמכתא פנימית', // AA
  'מספר חשבון', // AB
  'סניף', // AC
  'קוד בנק', // AD
  'שם בנק', // AE
  'מייל', // AF
  'הערות', // AG
] as const;

export interface FakeTranzilaRow {
  readonly date: string;
  readonly hours?: number;
  readonly shekels: number;
  readonly settlement: string;
  readonly approval?: string;
  readonly transaction?: string;
  readonly status?: string;
  readonly movement?: string;
}

/** שורת טרנזילה מלאה, כולל ערכים בעמודות הרגישות — כדי שיהיה מה לא לקרוא. */
export function tranzilaRow(row: FakeTranzilaRow): CellValue[] {
  const cells: CellValue[] = new Array(TRANZILA_HEADERS.length).fill(null);
  cells[0] = row.movement ?? 'חיוב';
  cells[1] = 'לקוחה לדוגמה';
  cells[2] = 'ILS';
  cells[5] = '458123XXXXXX9012';
  cells[8] = '000000000';
  cells[10] = row.approval ?? '1234567';
  cells[11] = 'עסק לדוגמה';
  cells[18] = '203.0.113.7';
  cells[19] = row.transaction ?? '900001';
  cells[20] = isoToSerial(row.date, row.hours ?? 10.5);
  cells[21] = row.shekels;
  cells[22] = row.settlement === '' ? null : row.settlement;
  cells[23] = '9012';
  cells[25] = row.status ?? null;
  cells[27] = '12345678';
  return cells;
}

export function buildTranzilaXlsx(
  rows: readonly FakeTranzilaRow[],
  options: SheetOptions = {},
): Uint8Array {
  return buildXlsx([[...TRANZILA_HEADERS], ...rows.map(tranzilaRow)], options);
}

/** גמא: 12 עמודות, שורה לכל (שידור × מותג). */
export const GAMMA_HEADERS = [
  'מסוף',
  'שם מסוף',
  'מותג',
  'מ.שידור',
  'ת.שידור',
  'סה"כ ברוטו',
  'סליקה ע.תפעולי',
  'ניכיון ע.מימוני',
  'הנחה ע.מועדון',
  'מע"מ',
  "נטו לתש'",
  'ת.תשלום',
] as const;

export interface FakeGammaRow {
  readonly date: string;
  readonly shekels: number;
  readonly settlement: string;
  readonly brand?: string;
  /**
   * שיעור העמלה. ⛔ ברירת המחדל **מומצאת** ואינה השיעור שנמדד: שיעור
   * העמלה של עסק מזוהה הוא מידע מסחרי, והריפו הזה ציבורי. מה שהמבחן צריך
   * לוודא הוא שהחשבון עקבי, לא שהמספר נכון.
   */
  readonly feeRatio?: number;
  /** שיעור המע"מ על העמלה. */
  readonly vatRatio?: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function gammaRow(row: FakeGammaRow): CellValue[] {
  const fee = round2(row.shekels * (row.feeRatio ?? 0.012));
  const vat = round2(fee * (row.vatRatio ?? 0.18));
  const net = round2(row.shekels - fee - vat);
  return [
    '1234567',
    'עסק לדוגמה',
    row.brand ?? 'ויזה~',
    row.settlement,
    isoToSerial(row.date),
    row.shekels,
    fee,
    0,
    0,
    vat,
    net,
    null,
  ];
}

export function buildGammaXlsx(
  rows: readonly FakeGammaRow[],
  options: SheetOptions = {},
): Uint8Array {
  return buildXlsx([[...GAMMA_HEADERS], ...rows.map(gammaRow)], options);
}

// ============================================================================
// xlsxRead.test.ts — ★★ הקורא: **אותו קוד שרץ בדפדפן.**
//
// ---------------------------------------------------------------------------
// מה נבדק כאן, ומה **לא**
// ---------------------------------------------------------------------------
// נבדק: פרסור ה-ZIP, פרסור ה-XML, מחרוזות משנה, תאים חסרים, סריאל תאריך עם
// שבר של שעה, וכל אחד ממצבי הכשל שבהם הקורא **מסרב** במקום לנחש.
//
// לא נבדק: `DecompressionStream` עצמו. הוא לא קיים ב-jsdom, והוא גם לא הקוד
// שלנו — הוא פונקציית פריסה סטנדרטית. מה שכן נבדק הוא שכל השאר עובר דרך
// **נקודת ממשק אחת** (`InflateRaw`), כך שמה שרץ כאן הוא בדיוק מה שרץ אצלה
// פרט לאותה פונקציה.
//
// ★ ולראיה שזה לא תירוץ: ענף STORED (בלי דחיסה כלל) נבדק גם הוא, ושם אין
// פריסה בכלל — כלומר המסלול נבדק גם בלי שום תלות בהחלפה.
// ============================================================================

import { describe, expect, it } from 'vitest';
import {
  columnIndexOf,
  hasHeaders,
  headerIndex,
  normalizeHeader,
  parseSharedStrings,
  parseSheet,
  readSheetGrid,
  serialToIso,
  unescapeXml,
  XlsxError,
} from '../shared/lib/xlsx';
import { buildXlsx, buildZip, isoToSerial, nodeInflateRaw } from './fixtures/xlsxBuilder';

// ---------------------------------------------------------------------------

describe('★★ קריאת קובץ xlsx מלא', () => {
  it('שורה 1 היא הכותרות, והשאר הן הנתונים', async () => {
    const bytes = buildXlsx([
      ['שם', 'סכום'],
      ['עסק לדוגמה', 12.5],
      ['עסק אחר', 7],
    ]);
    const grid = await readSheetGrid(bytes, nodeInflateRaw);

    expect(grid.header).toEqual(['שם', 'סכום']);
    expect(grid.rows).toHaveLength(2);
    expect(grid.rows[0].rowIndex).toBe(2);
    expect(grid.rows[0].cells[0].text).toBe('עסק לדוגמה');
    expect(grid.rows[0].cells[1].num).toBe(12.5);
  });

  it('★ מספר הוא מספר, ומחרוזת אינה מספר', async () => {
    const grid = await readSheetGrid(
      buildXlsx([
        ['א', 'ב'],
        [42, '42'],
      ]),
      nodeInflateRaw,
    );
    expect(grid.rows[0].cells[0].num).toBe(42);
    // ★ ההבחנה הזאת היא מה שמונע פירוש של מספר שידור כמספר. מספר שידור הוא
    //   מזהה, ומספר שידור שעבר דרך `Number` מאבד אפסים מובילים בשקט.
    expect(grid.rows[0].cells[1].num).toBeNull();
    expect(grid.rows[0].cells[1].text).toBe('42');
  });

  it('★★ תא שחסר בקובץ אינו מזיז את העמודות אחריו', async () => {
    // אקסל משמיט תאים ריקים. קורא שמניח רצף היה מקבל את הסכום במקום
    // התאריך — כלומר תוצאה שגויה בשקט, ולא שגיאה.
    const bytes = buildXlsx([
      ['א', 'ב', 'ג'],
      ['ראשון', null, 'שלישי'],
    ]);
    const grid = await readSheetGrid(bytes, nodeInflateRaw);
    expect(grid.rows[0].cells[0].text).toBe('ראשון');
    expect(grid.rows[0].cells[1].text).toBe('');
    expect(grid.rows[0].cells[2].text).toBe('שלישי');
  });

  it('שורה ריקה לגמרי אינה נספרת', async () => {
    const grid = await readSheetGrid(
      buildXlsx([
        ['א'],
        [null],
        ['יש'],
      ]),
      nodeInflateRaw,
    );
    expect(grid.rows).toHaveLength(1);
    // ★ ומספר השורה נשאר **של אקסל** — 3, ולא 2. זה מה שמאפשר לומר לה
    //   "שורה 3" ולהצביע על מה שהיא באמת רואה בקובץ.
    expect(grid.rows[0].rowIndex).toBe(3);
  });

  it('★ מחרוזות inline נקראות גם הן', async () => {
    const grid = await readSheetGrid(
      buildXlsx([['כותרת'], ['ערך']], { inlineStrings: true }),
      nodeInflateRaw,
    );
    expect(grid.header).toEqual(['כותרת']);
    expect(grid.rows[0].cells[0].text).toBe('ערך');
  });

  it('★★ ענף STORED — קובץ בלי דחיסה כלל', async () => {
    const grid = await readSheetGrid(
      buildXlsx([['כותרת'], ['בלי דחיסה']], { stored: true }),
      // ★ במכוון פונקציה שזורקת: אם הקורא יקרא לפריסה על רשומה שאינה דחוסה,
      //   המבחן ייפול. כך אנחנו יודעים שהענף באמת נפרד.
      async () => {
        throw new Error('לא אמורים לפרוס כאן');
      },
    );
    expect(grid.rows[0].cells[0].text).toBe('בלי דחיסה');
  });

  it('גרשיים עבריים בכותרת מנורמלים — "סה״כ" ו-`סה"כ` הם אותו דבר', async () => {
    const grid = await readSheetGrid(buildXlsx([['סה״כ  ברוטו'], [1]]), nodeInflateRaw);
    expect(grid.header[0]).toBe('סה"כ ברוטו');
    expect(hasHeaders(grid, ['סה"כ ברוטו'])).toBe(true);
    expect(headerIndex(grid, 'סה״כ ברוטו')).toBe(0);
  });
});

// ---------------------------------------------------------------------------

describe('★★ כשהקובץ אינו מה שחשבנו — הקורא מסרב, ולא מנחש', () => {
  it('קובץ שאינו ZIP', async () => {
    const bytes = new TextEncoder().encode('שלום'.repeat(20));
    await expect(readSheetGrid(bytes, nodeInflateRaw)).rejects.toBeInstanceOf(XlsxError);
  });

  it('קובץ קצר מדי', async () => {
    await expect(readSheetGrid(new Uint8Array([0x50, 0x4b]), nodeInflateRaw)).rejects.toThrow(
      /ריק או קטן מדי/,
    );
  });

  it('★ ZIP תקין בלי גיליון בפנים', async () => {
    const bytes = buildZip([{ name: 'readme.txt', text: 'לא גיליון' }]);
    await expect(readSheetGrid(bytes, nodeInflateRaw)).rejects.toThrow(/לא מצאתי גיליון/);
  });

  it('★★ וההודעה היא בעברית שהיא יכולה לקרוא, בלי מונח טכני', async () => {
    const bytes = new TextEncoder().encode('x'.repeat(100));
    const error = await readSheetGrid(bytes, nodeInflateRaw).catch((e) => e);
    expect(error).toBeInstanceOf(XlsxError);
    for (const term of ['ZIP header', 'signature', 'undefined', 'Error:']) {
      expect(error.reasonHe).not.toContain(term);
    }
    expect(error.reasonHe).toContain('אקסל');
  });
});

// ---------------------------------------------------------------------------

describe('★★ סריאל תאריך של אקסל', () => {
  it('הבסיס הוא 1899-12-30, ולא 1900-01-01', () => {
    // 1 = 31.12.1899. הבסיס המוזז הוא מה שמנטרל את 29 בפברואר 1900 שאקסל
    // סופר ושמעולם לא היה.
    expect(serialToIso(1)).toBe('1899-12-31');
    expect(serialToIso(45000)).toBe('2023-03-15');
  });

  it('★★ שבר של שעה נחתך, ולא מעגל את היום קדימה', () => {
    // בטרנזילה התאריך הוא סריאל עם שעה. 23:45 בעיגול היה קופץ ליום הבא —
    // וביום האחרון של החודש זה היה מוציא עסקה מהתקופה שהיא בחרה.
    const serial = isoToSerial('2026-08-31', 23.75);
    expect(serialToIso(serial)).toBe('2026-08-31');
    expect(serialToIso(isoToSerial('2026-08-02', 0.25))).toBe('2026-08-02');
  });

  it('מספר שאינו תאריך אינו מתפרש כתאריך', () => {
    expect(serialToIso(0)).toBeNull();
    expect(serialToIso(-5)).toBeNull();
    expect(serialToIso(9_999_999)).toBeNull();
    expect(serialToIso(Number.NaN)).toBeNull();
  });

  it('★ וההמרה הלוך-חזור יציבה על כל ימי אוגוסט', () => {
    for (let day = 1; day <= 31; day += 1) {
      const iso = `2026-08-${String(day).padStart(2, '0')}`;
      expect(serialToIso(isoToSerial(iso, 13.37))).toBe(iso);
    }
  });
});

// ---------------------------------------------------------------------------

describe('פרטי הפרסור', () => {
  it('ישויות XML מפוענחות', () => {
    expect(unescapeXml('א&amp;ב &lt;ג&gt; &quot;ד&quot; &#65;&#x42;')).toBe('א&ב <ג> "ד" AB');
  });

  it('מחרוזת מפוצלת לקטעי עיצוב חוזרת כמחרוזת אחת', () => {
    // אקסל מפצל טקסט מעוצב לכמה `<r><t>`. חיבור שלהם הוא מה שמחזיר את
    // הכותרת המקורית — ובלעדיו הזיהוי לפי כותרות היה נכשל על קובץ מעוצב.
    const xml = '<sst><si><r><t>סה"כ </t></r><r><t>ברוטו</t></r></si></sst>';
    expect(parseSharedStrings(xml)).toEqual(['סה"כ ברוטו']);
  });

  it('שמות עמודות', () => {
    expect(columnIndexOf('A1')).toBe(0);
    expect(columnIndexOf('Z9')).toBe(25);
    expect(columnIndexOf('AA1')).toBe(26);
    expect(columnIndexOf('AD12')).toBe(29);
  });

  it('נירמול כותרת מכווץ רווחים וגרשיים', () => {
    expect(normalizeHeader('  נטו   לתש׳ ')).toBe("נטו לתש'");
  });

  it('★ תא שסגור בעצמו (`<c/>`) אינו מפיל את השורה', () => {
    const rows = parseSheet('<row r="2"><c r="A2"/><c r="B2"><v>5</v></c></row>', []);
    expect(rows[0].cells[1].num).toBe(5);
  });
});

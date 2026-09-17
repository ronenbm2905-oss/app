// ============================================================================
// readDiagnostics.test.ts — ★★ מונים, לא תוכן.
//
// ---------------------------------------------------------------------------
// למה הקובץ הזה קיים
// ---------------------------------------------------------------------------
// 60 מתוך 60 ההזמנות האמיתיות של המשתמשת נחסמו — שלוש פעמים ברצף, ובכל פעם
// מסיבה אחרת שהוסקה מהמבנה **בלי שיש בריפו אף גוף הודעה אמיתי**. כלומר: כל
// הסקה כזאת הייתה ספקולציה, וספקולציה שנכתבת כקוד נראית כמו תיקון.
//
// המדידה היא היציאה מזה. אבל מדידה שנכתבת ל-Firestore ומוצגת במסך היא גם
// **נתיב דליפה חדש**: הדרך הקלה ביותר להבין "למה זה נשבר" היא לשמור קטע מהגוף
// — ואז שם, טלפון וכתובת מגורים של לקוחה יושבים באוסף שלא אמור להכיל אותם.
//
// ★★ \`check-order-logging.mjs\` **לא** תופסת את זה. היא שומרת על Cloud Logging
// (\`console.\`), והיא לא יודעת דבר על אוסף שאנחנו כותבים אליו בעצמנו. השמירה
// על הגבול הזה היא של הקובץ הזה, ורק שלו.
//
// שלוש טענות נבדקות כאן:
//
//  1. **המדידה אומרת איפה זה נשבר.** הודעה שגבול \`l=\` חותך באמצעה מדווחת
//     בדיוק אילו תוויות הספיקו להיקרא ואילו לא — וזו התשובה שחיפשנו.
//  2. ⛔ **אין בה ערך מההודעה.** המבחן בונה הודעה עם שם, טלפון וכתובת
//     ייחודיים, מריץ את כל הצינור, ומוודא שאף אחד מהם אינו מופיע ב-JSON.
//  3. **הסיכום מצרף נכון**: טווח, חיתוך תוויות, ומונה חלקים.
// ============================================================================

import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { OrdersView } from '../src/components/OrdersView';
import { syncOrdersForUser } from '../functions/src/lib/orderSync';
import { runOrderPipeline } from '../src/utils/orderPipeline';
import { readOrderBodies } from '../shared/lib/orderSource';
import { ORDER_SUBJECT_HE, parseOrderMessage } from '../shared/lib/orderParse';
import type { OrderStructureMeasure } from '../shared/lib/orderParse';
import { summarizeReads, formatRange } from '../shared/lib/readDiagnostics';
import { canonicalizeBody, utf8ByteLength } from '../shared/lib/dkimSignature';
import type { OrderSourceCandidate } from '../shared/lib/orderSource';

// ---------------------------------------------------------------------------
// ★ ההודעה. ערכים ייחודיים בכוונה — הם מה שהמבחן מחפש שלא יופיע.
// ---------------------------------------------------------------------------

const UNIQUE = {
  name: 'זהבית קרנפלד־אשכנזי',
  phone: '050-7654321',
  street: 'סמטת התאנה 17ב',
  city: 'כפר ורדים',
  email: 'zehavit.unique@example.com',
} as const;

const AUTH =
  'mx.google.com; dkim=pass header.i=@tranzila.com header.s=default header.b=Gw8Sjv7L; spf=pass';

/** גוף MIME אמיתי במבנה: multipart/alternative עם text/plain ראשון. */
function rawBody(): string {
  return [
    '--==_Part_9001',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    `שם לקוח: ${UNIQUE.name}`,
    `כתובת מייל: ${UNIQUE.email}`,
    `טלפון: ${UNIQUE.phone}`,
    `כתובת: ${UNIQUE.street}`,
    `עיר: ${UNIQUE.city}`,
    'מדינה: ישראל',
    'מיקוד: 2514700',
    'סכום ששולם: 240.00 ₪',
    'תשלומים: 1',
    '',
    'שם מוצר\tכמות\tמחיר ליחידה',
    'סבון לבנדר\t2\t120.00',
    '',
    '--==_Part_9001--',
  ].join('\r\n');
}

function candidate(dkimSignature: string | null): OrderSourceCandidate {
  return {
    messageId: 'msg-diag-1',
    threadId: 'thr-diag-1',
    fromAddress: 'pay@tranzila.com',
    // ★ הנושא הקבוע מהקוד, לא מחרוזת שנכתבה כאן: מחרוזת שנראית סבירה
    // הייתה גורמת לפענוח להיעצר בשלב הנושא, והמבחן היה "עובר" על מסלול
    // אחר לגמרי מזה שהוא מתיימר לבדוק.
    subject: ORDER_SUBJECT_HE,
    receivedAt: '2026-09-16T06:12:00.000Z',
    bodyRaw: rawBody(),
    authenticationResults: AUTH,
    dkimSignature,
  } as OrderSourceCandidate;
}

/** ★ \`l=\` שנופל בדיוק אחרי \`טלפון\` — כלומר חותך את ההזמנה באמצע. */
function limitBeforeCity(): number {
  const body = rawBody();
  const cut = body.indexOf('כתובת: ');
  return utf8ByteLength(body.slice(0, cut));
}

const sigWithLimit = (l: number) =>
  `v=1; a=rsa-sha256; d=tranzila.com; s=default; h=Received:From:To:Subject; l=${l}; bh=x; b=y`;

const sigNoLimit =
  'v=1; a=rsa-sha256; d=tranzila.com; s=default; h=Received:From:To:Subject; bh=x; b=y';

// ---------------------------------------------------------------------------

describe('★★ המדידה אומרת איפה הקריאה נשברת', () => {
  it('גבול l= שנופל באמצע ההזמנה — התוויות שאחריו מדווחות כחסרות', () => {
    const result = runOrderPipeline([candidate(sigWithLimit(limitBeforeCity()))]);
    const d = result.stats.diagnostics;

    expect(d.messages).toBe(1);
    // ★ החיתוך קרה בפועל, וזה מה שמספר הבתים אומר.
    expect(d.bytesDropped.min).toBeGreaterThan(0);
    expect(d.signedLimit.min).toBe(limitBeforeCity());
    expect(d.signedLimitAbsent).toBe(0);
    expect(d.bodyBytesRaw.min).toBe(utf8ByteLength(rawBody()));

    // ★★ וזו התשובה שלא הייתה לנו: עד איפה זה הגיע.
    expect(d.labelsFound).toContain('שם לקוח');
    expect(d.labelsFound).toContain('טלפון');
    expect(d.labelsMissing).toContain('עיר');
    expect(d.labelsMissing).toContain('סכום ששולם');
    expect(d.productTableFound).toBe(0);
    expect(d.structuresMeasured).toBe(1);

    // ★ החלק שנבחר נגמר באמצע — אין לו גבול סגירה.
    expect(d.partsSelected.text).toBe(1);
    expect(d.partsIncomplete).toBe(1);
    expect(d.partBytes.min).toBeLessThan(d.bodyBytesRaw.min ?? 0);

    // וההזמנה אכן נחסמה — כלומר המדידה מתארת בדיוק את המצב שבשטח.
    expect(result.needsAttention).toHaveLength(1);
  });

  it('בלי l= — שום דבר לא נחתך, כל התוויות נמצאות, והטבלה נמצאת', () => {
    const result = runOrderPipeline([candidate(sigNoLimit)]);
    const d = result.stats.diagnostics;

    expect(d.signedLimit.min).toBeNull();
    expect(d.signedLimitAbsent).toBe(1);
    expect(d.bytesDropped.max).toBe(0);
    expect(d.labelsMissing).toEqual([]);
    expect(d.productTableFound).toBe(1);
    expect(d.partsIncomplete).toBe(0);
    expect(result.needsAttention).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// ★★ `c=` — התג שמכריע אם החיתוך שלנו נופל במקום הנכון בכלל
// ---------------------------------------------------------------------------

describe('★★ הקנוניזציה שעליה l= נספר', () => {
  it('אין c= → simple, שזו ברירת המחדל של RFC 6376 ולא "לא ידוע"', () => {
    const d = runOrderPipeline([candidate(sigNoLimit)]).stats.diagnostics;
    expect(d.bodyCanon).toEqual({ simple: 1, relaxed: 0, other: 0 });
  });

  it('c=relaxed/relaxed → relaxed, כלומר l= נספר על גוף מכווץ', () => {
    const sig = `v=1; d=tranzila.com; s=default; c=relaxed/relaxed; h=From:Subject; bh=x; b=y`;
    const d = runOrderPipeline([candidate(sig)]).stats.diagnostics;
    expect(d.bodyCanon.relaxed).toBe(1);
  });

  it('★ c=relaxed בלי חלק שני → גוף simple (RFC 6376 §3.5)', () => {
    const sig = `v=1; d=tranzila.com; s=default; c=relaxed; h=From:Subject; bh=x; b=y`;
    const d = runOrderPipeline([candidate(sig)]).stats.diagnostics;
    expect(d.bodyCanon.simple).toBe(1);
  });

  it('⛔ ערך זר ב-c= אינו נכתב כמות שהוא — הוא נספר כ"אחר"', () => {
    const sig = `v=1; d=tranzila.com; s=default; c=relaxed/<script>גנבתי</script>; h=From:Subject; bh=x; b=y`;
    const d = runOrderPipeline([candidate(sig)]).stats.diagnostics;
    expect(d.bodyCanon.other).toBe(1);
    // ★★ כותרת החתימה נכתבת על ידי מי ששלח. לולא הרשימה הסגורה, הטקסט
    // שלו היה נכתב ל-Firestore ומוצג במסך.
    expect(JSON.stringify(d)).not.toContain('גנבתי');
  });
});

describe('⛔ אין במדידה שום ערך מההודעה', () => {
  const values = Object.values(UNIQUE);

  it('הסיכום של הצינור המקומי — לא שם, לא טלפון, לא כתובת', () => {
    const json = JSON.stringify(
      runOrderPipeline([candidate(sigWithLimit(limitBeforeCity()))]).stats.diagnostics,
    );
    for (const v of values) expect(json).not.toContain(v);
    // ★ גם לא קטע גוף: שום חלק של ההודעה אינו מופיע.
    expect(json).not.toContain('סבון לבנדר');
    expect(json).not.toContain(ORDER_SUBJECT_HE);
    expect(json).not.toContain('tranzila');
  });

  it('★★ ההודעה **כן** מכילה את הערכים — כלומר המבחן באמת בודק משהו', () => {
    const body = rawBody();
    for (const v of values) expect(body).toContain(v);
  });

  it('כל שדה במדידה הוא מספר, בוליאני, או שם תווית מהקוד', () => {
    const d = runOrderPipeline([candidate(sigWithLimit(limitBeforeCity()))]).stats.diagnostics;
    const allowedLabels = new Set([...d.labelsFound, ...d.labelsMissing]);

    const walk = (value: unknown, path: string): void => {
      if (value === null) return;
      if (typeof value === 'number' || typeof value === 'boolean') return;
      if (Array.isArray(value)) {
        value.forEach((v, i) => walk(v, `${path}[${i}]`));
        return;
      }
      if (typeof value === 'object') {
        for (const [k, v] of Object.entries(value)) walk(v, `${path}.${k}`);
        return;
      }
      // ★ המחרוזות היחידות שמותרות הן שמות תוויות — קבועים מ-`ORDER_LABELS`.
      expect(allowedLabels.has(String(value)), `${path} = ${String(value)}`).toBe(true);
    };

    walk(d, 'diagnostics');
  });
});

/** מדידת מבנה עם ברירות מחדל — כדי שמבחן יציין רק את מה שהוא בודק. */
function measure(over: Partial<OrderStructureMeasure> = {}): OrderStructureMeasure {
  return {
    labelsFound: [],
    labelsMissing: [],
    productTableFound: false,
    productRows: 0,
    productCellMode: 'none',
    productRowsUnreadable: 0,
    ...over,
  };
}

describe('★ הצירוף', () => {
  it('טווח אחיד מוצג כמספר יחיד, וטווח ריק כמקף', () => {
    expect(formatRange({ min: 1200, max: 1200 })).toBe('1200');
    expect(formatRange({ min: 1200, max: 1400 })).toBe('1200-1400');
    expect(formatRange({ min: null, max: null })).toBe('—');
  });

  it('תווית נחשבת "נמצאה" רק אם נמצאה בכל ההודעות', () => {
    const d = summarizeReads(
      [],
      [
        measure({ labelsFound: ['עיר', 'טלפון'], labelsMissing: ['מיקוד'], productTableFound: true }),
        measure({ labelsFound: ['עיר'], labelsMissing: ['טלפון', 'מיקוד'], productTableFound: false }),
      ],
    );
    expect(d.labelsFound).toEqual(['עיר']);
    expect(d.labelsMissing).toEqual(['טלפון', 'מיקוד']);
    expect(d.productTableFound).toBe(1);
    expect(d.structuresMeasured).toBe(2);
    // ★ שתי הרשימות זרות ומכסות יחד את כל מה שנמדד.
    expect(d.labelsFound.filter((l) => d.labelsMissing.includes(l))).toEqual([]);
  });

  /**
   * ★★ המבחן שנולד מ-`missing=1` על 60 הודעות אמיתיות.
   *
   * הרשימה אמרה "מיקוד חסר" ולא אמרה **בכמה** הודעות — כלומר לא הבדילה בין
   * "המבנה השתנה" (חסר בכולן) ל"לקוחה אחת לא מילאה" (חסר באחת). שתי מסקנות
   * הפוכות מאותה שורה, ולכן המונה.
   */
  it('★★ לכל תווית חסרה יש מונה — כמה הודעות, לא רק "חסרה"', () => {
    const d = summarizeReads(
      [],
      [
        measure({ labelsFound: ['עיר', 'טלפון'], labelsMissing: ['מיקוד'] }),
        measure({ labelsFound: ['עיר', 'טלפון', 'מיקוד'], labelsMissing: [] }),
        measure({ labelsFound: ['עיר', 'טלפון', 'מיקוד'], labelsMissing: [] }),
      ],
    );
    expect(d.labelsMissing).toEqual(['מיקוד']);
    // ★ אחת מתוך שלוש — שדה ריק, לא מבנה שהשתנה.
    expect(d.labelsMissingCounts).toEqual([{ label: 'מיקוד', count: 1 }]);
    expect(d.structuresMeasured).toBe(3);
  });

  it('★ צורת הטבלה ומספר השורות נספרים', () => {
    const d = summarizeReads(
      [],
      [
        measure({ productTableFound: true, productCellMode: 'stacked', productRows: 2 }),
        measure({ productTableFound: true, productCellMode: 'stacked', productRows: 3 }),
        measure({ productTableFound: false, productCellMode: 'none', productRowsUnreadable: 1 }),
      ],
    );
    expect(d.productCellMode).toEqual({ inline: 0, stacked: 2, none: 1 });
    expect(d.productRows).toEqual({ min: 0, max: 3 });
    expect(d.rowsUnreadable).toBe(1);
  });

  it('★★ הודעה שלא נקרא ממנה חלק נספרת — ולא נעלמת', () => {
    const empty = { ...candidate(sigNoLimit), bodyRaw: '', bodyText: '', bodyHtml: '' };
    const read = readOrderBodies([empty as OrderSourceCandidate]);

    expect(read.readCount).toBe(0);
    // ★ זה בדיוק מה שנעלם עד עכשיו מכל מונה.
    expect(read.measures).toHaveLength(1);
    expect(read.measures[0].partSelected).toBe('none');
    expect(summarizeReads(read.measures, []).partsSelected.none).toBe(1);
  });

  it('סיכום ריק אינו זורק ואינו ממציא מספרים', () => {
    const d = summarizeReads([], []);
    expect(d.messages).toBe(0);
    expect(d.bodyBytesRaw).toEqual({ min: null, max: null });
    expect(d.labelsFound).toEqual([]);
  });
});

describe('★ הפענוח מחזיר מדידת מבנה רק כשהגיע לשלב המבנה', () => {
  it('נעצר בחתימה → אין מדידה, כי לא נקראה אף שורה', () => {
    const parsed = parseOrderMessage({
      fromAddress: 'pay@tranzila.com',
      subject: ORDER_SUBJECT_HE,
      bodyText: 'שם לקוח: פלונית',
      authenticationResults: 'mx.google.com; dkim=fail header.i=@tranzila.com',
    });
    expect(parsed.structure).toBeNull();
  });

  it('הגיע לשלב המבנה → יש מדידה, גם כשההזמנה נחסמה', () => {
    const parsed = parseOrderMessage({
      fromAddress: 'pay@tranzila.com',
      subject: ORDER_SUBJECT_HE,
      bodyText: 'שם לקוח: פלונית\nטלפון: 050-0000000',
      authenticationResults: AUTH,
    });
    expect(parsed.sourceVerified).toBe(false);
    expect(parsed.structure?.labelsFound).toContain('שם לקוח');
    expect(parsed.structure?.labelsMissing).toContain('עיר');
    expect(parsed.structure?.productTableFound).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ★★ המסך — השורה שרונן אמור לצלם
// ---------------------------------------------------------------------------

/** רינדור המסך עם רשימת הודעות נתונה. */
const screen = (messages: OrderSourceCandidate[]) =>
  renderToString(
    <OrdersView
      result={runOrderPipeline(messages)}
      canEdit
      onToggleShipped={() => {}}
      onPurgeRequest={() => ''}
    />,
  );

/**
 * ★★ גוף MIME במבנה שנמצא בהודעות האמיתיות: תא בשורה, שורות ריקות בין
 * הקבוצות. `missingCell` מפיל שורה אחת באמצע — כלומר בונה בדיוק את הקלט
 * שאסור שיפוך לניחוש.
 */
function rawStackedBody(missingCell = false): string {
  return [
    '--==_Part_9002',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    ' שם לקוח',
    ` ${UNIQUE.name}`,
    ' כתובת מייל',
    ` ${UNIQUE.email}`,
    ' טלפון',
    ` ${UNIQUE.phone}`,
    ' כתובת',
    ` ${UNIQUE.street}`,
    ' עיר',
    ` ${UNIQUE.city}`,
    ' מדינה',
    ' IL',
    ' מיקוד',
    ' 2514700',
    '',
    '',
    ' מוצרים עבורם בוצע החיוב:',
    '',
    '',
    ' שם מוצר',
    ' כמות',
    ' מחיר ליחידה',
    '',
    '',
    ' סבון לבנדר',
    ...(missingCell ? [] : [' 2']),
    ' 120.00',
    '',
    '',
    ' 2 מוצרים ומעלה משלוח ללא עלות',
    ' 1',
    ' 0',
    '',
    '',
    ' סכום ששולם',
    ' 240.00 ₪',
    ' תשלומים',
    ' 1',
    '',
    '--==_Part_9002--',
  ].join('\r\n');
}

const stackedCandidate = (id: string, missingCell = false): OrderSourceCandidate =>
  ({
    ...candidate(sigNoLimit),
    messageId: id,
    threadId: id,
    bodyRaw: rawStackedBody(missingCell),
  }) as OrderSourceCandidate;

/**
 * ★★ הצורה המוערמת, מקצה לקצה — ומה שהשורה הקומפקטית תגיד עליה.
 *
 * זה המבחן שסוגר את `table=0 מתוך 60`: אותו מבנה בדיוק, דרך אותו צינור
 * (`readOrderBodies` → `parseOrderMessage` → המסך), והפעם הטבלה נמצאת.
 */
describe('★★ הטבלה המוערמת במדידה ובמסך', () => {
  const result = runOrderPipeline([stackedCandidate('ok-1'), stackedCandidate('bad-1', true)]);
  const d = result.stats.diagnostics;

  it('נמצאת בשתי ההודעות, ונמדדת כצורה המוערמת', () => {
    expect(d.structuresMeasured).toBe(2);
    expect(d.productTableFound).toBe(2);
    expect(d.productCellMode).toEqual({ inline: 0, stacked: 2, none: 0 });
  });

  it('★ ההודעה השלמה נקראה, והשבורה נספרה כשורה שלא נקראה', () => {
    expect(d.productRows).toEqual({ min: 0, max: 2 });
    expect(d.rowsUnreadable).toBe(1);
    expect(result.needsAttention).toHaveLength(1);
    expect(result.toShip).toHaveLength(1);
  });

  it('★★ והשורה הקומפקטית נושאת את שלושת המדדים החדשים', () => {
    const html = screen([stackedCandidate('ok-2'), stackedCandidate('bad-2', true)]);
    expect(html).toContain('cellmode=i0/s2/n0');
    expect(html).toContain('rows=0-2');
    expect(html).toContain('badrows=1');
    expect(html).toContain('missmax=0');
  });
});

describe('★★ הפרטים הטכניים במסך', () => {
  it('מופיעים כשיש הזמנה חסומה — ובשורה אחת שאפשר לצלם', () => {
    const html = screen([candidate(sigWithLimit(limitBeforeCity()))]);

    expect(html).toContain('פרטים טכניים על הקריאה');
    // ★ השורה הקומפקטית: ASCII בלבד, כדי שהיא תצטלם ותיקרא כמו שהיא.
    expect(html).toContain('msgs=1');
    expect(html).toContain('incomplete=1');
    expect(html).toContain('table=0');
    // ★★ ושמות התוויות — זו התשובה ל"איפה זה נשבר".
    expect(html).toContain('שדות שלא נמצאו');
  });

  it('★ לא מופיעים כשהכול נקרא — מסך של בעלת עסק, לא לוח בקרה', () => {
    const html = screen([candidate(sigNoLimit)]);
    expect(html).not.toContain('פרטים טכניים על הקריאה');
    expect(html).not.toContain('msgs=');
  });

  it('⛔ וגם במסך עצמו אין ערך מההודעה בתוך הפרטים הטכניים', () => {
    const html = screen([candidate(sigWithLimit(limitBeforeCity()))]);
    const panel = html.slice(html.indexOf('פרטים טכניים על הקריאה'));
    for (const v of Object.values(UNIQUE)) expect(panel).not.toContain(v);
  });
});

// ---------------------------------------------------------------------------
// ★★ הענן — `syncRuns` ומסמך המשתמשת
// ---------------------------------------------------------------------------

interface Written {
  path: string;
  data: Record<string, unknown>;
}

/** Firestore מזויף — אותו אחד שב-`syncRunRecord.test.ts`, בקטן. */
function fakeDb() {
  const added: Written[] = [];
  const setDocs: Written[] = [];
  const db = {
    collection: (path: string) => ({
      add: async (data: Record<string, unknown>) => {
        added.push({ path, data });
        return { id: `doc-${added.length}` };
      },
      get: async () => ({ docs: [] as unknown[] }),
      doc: () => ({ set: async () => {} }),
    }),
    doc: (path: string) => ({
      get: async () => ({ exists: false, data: () => undefined }),
      set: async (data: Record<string, unknown>) => {
        setDocs.push({ path, data });
      },
    }),
  };
  return { db, added, setDocs };
}

describe('★★ המונים מגיעים לרשומת הריצה ולמסמך המשתמשת', () => {
  it('נכתבים לשניהם — ובלי אף ערך מההודעה', async () => {
    const { db, added, setDocs } = fakeDb();
    const msg = candidate(sigWithLimit(limitBeforeCity()));

    const summary = await syncOrdersForUser('u-dorit', {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      db: db as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tokens: { getAccessToken: async () => 'tok' } as any,
      makeClient: () =>
        ({
          listOrderMessageIds: async () => [msg.messageId],
          getOrderMessage: async () => msg,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any,
      trigger: 'manual',
      now: () => new Date('2026-09-16T06:30:00.000Z'),
    });

    // ★ הסיכום שחוזר מ-`syncOrdersNow`.
    expect(summary.diagnostics.messages).toBe(1);
    expect(summary.diagnostics.labelsMissing).toContain('עיר');
    expect(summary.diagnostics.partsIncomplete).toBe(1);

    // ★ רשומת הריצה.
    const run = added.find((w) => w.path.endsWith('/syncRuns'));
    expect(run?.data.diagnostics).toBeTruthy();

    // ★ מסמך המשתמשת — ממנו המסך קורא.
    const userDoc = setDocs.find((w) => 'lastDiagnostics' in w.data);
    expect(userDoc).toBeTruthy();

    // ⛔ ולא ערך אחד מההודעה, בשום אחד מהם.
    const json = JSON.stringify({ run: run?.data, user: userDoc?.data });
    for (const v of Object.values(UNIQUE)) expect(json).not.toContain(v);
    expect(json).not.toContain('סבון לבנדר');
  });
});

// ============================================================================
// ★★ `c=` — הבאג האריתמטי שנראה כמו תקיפה, והמבחן שמשחזר אותו
// ============================================================================
//
// ---------------------------------------------------------------------------
// מה קרה, במשפט אחד
// ---------------------------------------------------------------------------
// `l=3694` בחתימה של הספק **אינו** 3694 הבתים הראשונים של הגוף כפי שהוא על
// החוט. הספק חותם `c=relaxed/relaxed`, ולכן המספר נמדד על הגוף אחרי
// קנוניזציה: רצפי רווחים מכווצים, רווחים בסוף שורה נמחקים, שורות ריקות בסוף
// מוסרות. אנחנו חתכנו את הגולמי באותו מספר — כלומר חתכנו **מוקדם מדי**,
// ההזמנה נגמרה באמצע, והמסך אמר *"החלק שחברת הסליקה חתמה עליו נגמר לפני
// שההזמנה הושלמה"*. על 60 מתוך 60 הזמנות תקינות. בלי שאיש נגע בהן.
//
// ★ ולמה זה לא נתפס: **את `c=` לא קראנו בכלל.** כל ה-fixtures מצהירים
// `c=relaxed/relaxed` — והמבחנים חישבו את `l` מהבתים הגולמיים, כי כך הקוד
// עבד. כלומר המבחנים אימתו את הקוד מול חתימה שנבנתה לפי החישוב השגוי של
// עצמו. אותה מלכודת של `header.d=` מול `header.i=`, שכבה אחת עמוק יותר.
//
// ---------------------------------------------------------------------------
// ★★ ומה **לא** עשינו, בכוונה
// ---------------------------------------------------------------------------
// לא עברנו לפרסר את הגוף המקונן. הקנוניזציה מוחקת טאבים (הם WSP), וטבלת
// המוצרים מופרדת בטאבים — פירסור של המקונן היה מחליף באג אחד באחר, הפעם
// "לא מצאתי טבלת מוצרים" על כל הזמנה. לכן: **המקונן קובע כמה נחתם, הגולמי
// הוא מה שנקרא.** ראה `relaxedBodyWithMap` ב-`dkimSignature.ts`.
// ============================================================================

describe('★★ c=relaxed — הבאג שחסם 60 מתוך 60', () => {
  /**
   * ★ גוף עם בדיוק מה שהקנוניזציה נוגעת בו: רווחים כפולים בתוך שורות,
   * רווחים בסוף שורה, וטאבים בטבלה. זה מה שמייצר את הפער בין הגולמי למקונן.
   */
  const spacedBody = () =>
    [
      '--==_Part_7',
      'Content-Type: text/plain;   charset=UTF-8   ',
      'Content-Transfer-Encoding: 8bit',
      '',
      'שם לקוח:   פלונית אלמונית   ',
      'כתובת מייל:   p@example.com',
      'טלפון:   050-1111111   ',
      'כתובת:   הרצל 1   ',
      'עיר:   חיפה',
      'מדינה:   ישראל',
      'מיקוד:   3100000',
      'סכום ששולם:   240.00 ₪',
      'תשלומים:   1',
      '',
      'שם מוצר\tכמות\tמחיר ליחידה',
      'סבון\t2\t120.00',
      '',
      '--==_Part_7--',
      '',
    ].join('\r\n');

  const msg = (sig: string) =>
    ({
      messageId: 'm-canon',
      threadId: 't-canon',
      fromAddress: 'pay@tranzila.com',
      subject: ORDER_SUBJECT_HE,
      receivedAt: '2026-09-16T06:12:00.000Z',
      bodyRaw: spacedBody(),
      authenticationResults: AUTH,
      dkimSignature: sig,
    }) as unknown as OrderSourceCandidate;

  /** `l=` **כפי שהספק היה מחשב אותו**: על הגוף המקונן, לא על הגולמי. */
  const relaxedLen = utf8ByteLength(canonicalizeBody(spacedBody(), 'relaxed'));

  it('★★ l= שנמדד על המקונן → ההזמנה נקראת במלואה. זה הכשל של 60 ההודעות', () => {
    const sig = `v=1; d=tranzila.com; s=default; c=relaxed/relaxed; h=Received:From:To:Subject; l=${relaxedLen}; bh=x; b=y`;
    const result = runOrderPipeline([msg(sig)]);
    const d = result.stats.diagnostics;

    // ★ הגוף המקונן קצר מהגולמי — וזה בדיוק ההפרש שהפיל אותנו.
    expect(d.canonBodyBytes.min).toBeLessThan(d.bodyBytesRaw.min ?? 0);
    expect(d.bodyCanon.relaxed).toBe(1);

    // ★★ ומה שחשוב: כלום לא נחתך, המבנה שלם, וההזמנה עברה.
    expect(d.bytesDropped.max).toBe(0);
    expect(d.labelsMissing).toEqual([]);
    expect(d.productTableFound).toBe(1);
    expect(d.partsIncomplete).toBe(0);
    expect(result.needsAttention).toHaveLength(0);
    expect(result.toShip).toHaveLength(1);
    expect(result.toShip[0].recipient.city).toBe('חיפה');
    // ★ והטבלה שרדה — כלומר לא פירסרנו את המקונן, שבו הטאבים נמחקים.
    expect(result.toShip[0].items).toHaveLength(1);
    expect(result.toShip[0].items[0].quantity).toBe(2);
  });

  it('★ אותו l= בדיוק, אבל c=simple → מתנהג כמו קודם: נחתך באמצע', () => {
    const sig = `v=1; d=tranzila.com; s=default; c=simple/simple; h=Received:From:To:Subject; l=${relaxedLen}; bh=x; b=y`;
    const d = runOrderPipeline([msg(sig)]).stats.diagnostics;

    expect(d.bodyCanon.simple).toBe(1);
    // ★ ב-`simple` המקונן **הוא** הגולמי, ולכן אין פער ואין תיקון.
    expect(d.canonBodyBytes.min).toBe(d.bodyBytesRaw.min);
    expect(d.bytesDropped.max).toBeGreaterThan(0);
  });

  it('⛔ c= שאיננו מכירים → לא קוראים, ולא מנחשים', () => {
    const sig = `v=1; d=tranzila.com; s=default; c=relaxed/mystery; h=Received:From:To:Subject; l=${relaxedLen}; bh=x; b=y`;
    const result = runOrderPipeline([msg(sig)]);
    const d = result.stats.diagnostics;

    expect(d.bodyCanon.other).toBe(1);
    // ★★ לא נקרא חלק, ולא נמדד מבנה — כי לא הגענו לשלב המבנה.
    expect(d.partsSelected.none).toBe(1);
    expect(d.structuresMeasured).toBe(0);

    expect(result.needsAttention).toHaveLength(1);
    expect(result.needsAttention[0].issues.map((i) => i.code)).toContain(
      'signatureScopeUnreadable',
    );
    expect(result.needsAttention[0].recipient.city).toBeNull();
  });

  it('★★ וההגנה לא נחלשה: זנב שהודבק אחרי הגבול המקונן אינו מגיע לכרטיס', () => {
    const attacked =
      spacedBody() +
      ['שם לקוח:  דן התוקף', 'כתובת:  רחוב התוקף 9', 'עיר:  קריית הזיוף', ''].join('\r\n');

    const sig = `v=1; d=tranzila.com; s=default; c=relaxed/relaxed; h=Received:From:To:Subject; l=${relaxedLen}; bh=x; b=y`;
    const result = runOrderPipeline([
      { ...msg(sig), bodyRaw: attacked } as OrderSourceCandidate,
    ]);

    // ★ ההזמנה האמיתית נקראה — הכתובת היא של הלקוחה.
    expect(result.toShip).toHaveLength(1);
    expect(result.toShip[0].recipient.city).toBe('חיפה');

    // ★★ ושום פרט של התוקף אינו קיים בשום מקום בתוצאה.
    const blob = JSON.stringify(result);
    for (const leaked of ['דן התוקף', 'רחוב התוקף 9', 'קריית הזיוף']) {
      expect(blob).not.toContain(leaked);
    }

    // ★ והחיתוך אכן קרה — הזנב ירד, ונספר.
    expect(result.stats.diagnostics.bytesDropped.min).toBeGreaterThan(0);
  });
});

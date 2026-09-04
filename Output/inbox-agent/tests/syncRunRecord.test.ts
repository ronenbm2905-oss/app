// ============================================================================
// syncRunRecord.test.ts — ★★ "ריצה שלא מדווחת נראית כמו ריצה שלא קרתה."
//
// ---------------------------------------------------------------------------
// מה נתפס כאן, ולמה זה לא היה נתפס קודם
// ---------------------------------------------------------------------------
// המשפט הזה נכתב על `purgeOrders` והוא נכון גם עליו — אבל הוא **לא יושם על
// השליפה**, ודווקא היא זו שרצה כל בוקר ושדורית מסתמכת עליה. הרצנו את
// `syncOrders` ידנית על תיבה אמיתית, והיא רצה בלי שאפשר היה לדעת מה קרה.
//
// שתי טענות נבדקות כאן:
//
//  1. **כל ריצה נרשמת, גם כשלא נמצא כלום.** אפס תוצאות אינו אפס רשומות.
//  2. ★★ **הרשומה אומרת מי הריץ** (`trigger`). בלעדיו רשומה שנוצרה מלחיצה
//     של דורית ורשומה שנוצרה מהמתזמן של 06:30 נראות זהות — ולכן "יש
//     רשומות ב-`syncRuns`" לא היה מוכיח שהמתזמן בכלל עובד. זו בדיוק השאלה
//     שלא היה אפשר לענות עליה.
//
// ★ הבדיקה רצה מול Firestore מזויף (אובייקט קטן בקובץ הזה) ולא מול אמולטור:
// מה שנבדק הוא **מה נכתב**, ולא ש-Firestore יודע לקבל כתיבה.
// ============================================================================

import { describe, expect, it } from 'vitest';
import { syncOrdersForUser, writeFailedRun } from '../functions/src/lib/orderSync';

interface Written {
  path: string;
  data: Record<string, unknown>;
}

/** Firestore מזויף — רק מה ש-`orderSync` באמת נוגע בו. */
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

const runsOf = (added: Written[]) => added.filter((w) => w.path.endsWith('/syncRuns'));

describe('★★ כל ריצת סנכרון מדווחת', () => {
  it('ריצה שנכשלה בחיבור נרשמת — ומסומנת כריצה של המתזמן', async () => {
    const { db, added } = fakeDb();

    await syncOrdersForUser('u-dorit', {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      db: db as any,
      tokens: {
        getAccessToken: async () => {
          throw new Error('no tokens');
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      makeClient: () => {
        throw new Error('לא אמור להגיע לכאן');
      },
      trigger: 'schedule',
      now: () => new Date('2026-08-30T03:30:00.000Z'),
    });

    const runs = runsOf(added);
    expect(runs).toHaveLength(1);
    expect(runs[0].data.kind).toBe('sync');
    // ★★ השדה שבלעדיו אי אפשר לדעת אם הבוקר רץ.
    expect(runs[0].data.trigger).toBe('schedule');
    expect(runs[0].data.errorHe).toBeTypeOf('string');
  });

  it('ריצה ריקה שהצליחה נרשמת גם היא — אפס תוצאות אינו אפס רשומות', async () => {
    const { db, added } = fakeDb();

    await syncOrdersForUser('u-dorit', {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      db: db as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tokens: { getAccessToken: async () => 'tok' } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeClient: () => ({ listOrderMessageIds: async () => [] }) as any,
      trigger: 'schedule',
      now: () => new Date('2026-08-30T03:30:00.000Z'),
    });

    const runs = runsOf(added);
    expect(runs).toHaveLength(1);
    expect(runs[0].data.written).toBe(0);
    expect(runs[0].data.messagesRead).toBe(0);
    expect(runs[0].data.errorHe).toBeNull();
    expect(runs[0].data.trigger).toBe('schedule');
  });

  it('ברירת המחדל היא `manual` — ריצה שלא הצהירה אינה נזקפת למתזמן', async () => {
    const { db, added } = fakeDb();

    await syncOrdersForUser('u-dorit', {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      db: db as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tokens: { getAccessToken: async () => 'tok' } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeClient: () => ({ listOrderMessageIds: async () => [] }) as any,
      now: () => new Date('2026-08-30T03:30:00.000Z'),
    });

    expect(runsOf(added)[0].data.trigger).toBe('manual');
  });

  it('★ זריקה באמצע הלולאה מקבלת רשומה משלה, בלי פרטים מההודעה', async () => {
    const { db, added } = fakeDb();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await writeFailedRun(db as any, 'u-dorit', 'schedule', new Date('2026-08-30T03:30:00.000Z'));

    const runs = runsOf(added);
    expect(runs).toHaveLength(1);
    expect(runs[0].data.trigger).toBe('schedule');
    expect(runs[0].data.errorHe).toContain('נפלה באמצע');
    // ★ ספירות וקודים בלבד: אין נושא, אין שם, אין כתובת.
    for (const banned of ['subject', 'fromAddress', 'recipient', 'bodyRaw', 'stack']) {
      expect(Object.keys(runs[0].data)).not.toContain(banned);
    }
  });
});

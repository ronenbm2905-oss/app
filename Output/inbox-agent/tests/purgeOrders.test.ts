// ============================================================================
// purgeOrders.test.ts — ★★ A7 / B9. **המחיקה באמת רצה, ובאמת מוחקת.**
//
// ---------------------------------------------------------------------------
// למה המבחן הזה קיים, ולמה הוא לא "מבחן על הפונקציה"
// ---------------------------------------------------------------------------
// הכשל שהוא נועד למנוע כבר קרה, בפרויקט אחר, ונתפס בשער המשפטי ולא בקוד:
// `purgeAfter` נכתב על כל רשומה, ואיש לא קרא אותו. המדיניות הצהירה על מחיקה
// שלא קרתה מעולם — בלי תסמין, בלי שגיאה, ובלי מי שיתלונן.
//
// ולכן המבחן לא שואל "האם `runPurge` מחזירה את הערך הנכון". הוא בונה מסד
// בזיכרון, כותב לתוכו כתובת מגורים בכל מקום שהיא יכולה להגיע אליו, מריץ את
// המחיקה, ואז **סורק את כל מה שנשאר** ומחפש את המחרוזת. אותה תבנית כמו
// מבחן הדליפה ב-`orderPipeline.test.tsx`.
//
// ---------------------------------------------------------------------------
// ★★ ומלכודת העותק השני — 8א.2(ב)
// ---------------------------------------------------------------------------
// > *"מחיקת שדות במסמך ההזמנה אינה מספיקה אם קיים מסמך 'ההזמנות של היום'
// > שמרנדר את הרשימה — **הוא מחזיק את אותן כתובות והוא לא ב-`orders/`,
// > ולכן `purgeExpired` לא יעבור עליו.**"*
//
// המבנה שלנו מונע את זה מלכתחילה (`dailyLists` מחזיק מזהים בלבד), אבל
// **מבנה נכון אינו מנגנון**: מספיק שמישהו "רק יוסיף שדה כדי שהמסך ייטען
// מהר". לכן המבחן כותב בכוונה כתובת לתוך מסמך הרשימה היומית — כלומר מדמה
// בדיוק את הבאג העתידי — ודורש שהמחיקה תתפוס אותה **ותדווח עליה כממצא**.
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  runPurge,
  purgeSummaryHe,
  type PurgeStore,
  type StoredDoc,
} from '../shared/lib/purgePolicy';
import { COLLECTIONS, type CollectionName } from '../shared/lib/firestorePaths';
import { MAX_RETENTION_DAYS, POST_SHIPMENT_DAYS } from '../shared/lib/orderRetention';

const UID = 'user-1';
const NOW = new Date('2026-09-01T03:15:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY).toISOString();
const daysAhead = (n: number) => new Date(NOW.getTime() + n * DAY).toISOString();

const STREET = 'רחוב הדוגמה 14, דירה 3';
const CUSTOMER = 'רונית שדה';

/**
 * ★ מסד בזיכרון שמממש את `PurgeStore` במלואו.
 *
 * לא מוק: הוא באמת מוחק שדות, באמת מוחק מסמכים, ואפשר לסרוק אותו אחרי
 * הריצה. מוק שרק סופר קריאות היה מוכיח שהקוד קרא לפונקציות הנכונות —
 * ולא שמשהו נמחק.
 */
class MemoryStore implements PurgeStore {
  readonly data = new Map<string, Map<string, Record<string, unknown>>>();

  put(uid: string, collection: CollectionName, id: string, doc: Record<string, unknown>): void {
    const key = `${uid}/${collection}`;
    if (!this.data.has(key)) this.data.set(key, new Map());
    this.data.get(key)!.set(id, doc);
  }

  async listUsers(): Promise<string[]> {
    return Array.from(new Set(Array.from(this.data.keys()).map((k) => k.split('/')[0])));
  }

  async listAll(uid: string, collection: CollectionName): Promise<StoredDoc[]> {
    const m = this.data.get(`${uid}/${collection}`);
    return m ? Array.from(m.entries()).map(([id, data]) => ({ id, data })) : [];
  }

  async purgeRecipient(uid: string, orderId: string, at: string): Promise<void> {
    const doc = this.data.get(`${uid}/${COLLECTIONS.orders}`)?.get(orderId);
    if (!doc) return;
    // ★ מחיקת שדה אמיתית — `delete`, לא `= null` ולא `deleted: true`.
    delete doc.recipient;
    doc.recipientPurged = true;
    doc.updatedAt = at;
  }

  async deleteDoc(uid: string, collection: CollectionName, id: string): Promise<void> {
    this.data.get(`${uid}/${collection}`)?.delete(id);
  }

  async stripFields(
    uid: string,
    collection: CollectionName,
    id: string,
    fields: readonly string[],
  ): Promise<void> {
    const doc = this.data.get(`${uid}/${collection}`)?.get(id);
    if (!doc) return;
    for (const f of fields) delete doc[f];
  }

  /** ★ כל מה שנשאר במסד, כמחרוזת אחת. זה מה שהמבחן סורק. */
  dump(): string {
    const out: Record<string, unknown> = {};
    for (const [key, docs] of this.data) out[key] = Object.fromEntries(docs);
    return JSON.stringify(out);
  }
}

function orderDoc(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    userId: UID,
    kind: 'order',
    receivedAt: daysAgo(10),
    status: 'new',
    shippedAt: null,
    recipientPurged: false,
    recipient: {
      name: CUSTOMER,
      phone: '050-555-0101',
      email: 'ronit.s@lakoach.example',
      street: STREET,
      city: 'תל דוגמה',
      postalCode: '6100200',
      countryCode: 'IL',
    },
    items: [{ productName: 'מדבקות', quantity: 1, unitPrice: 42, isPackable: true, lineTotal: 42 }],
    paidTotal: 42,
    purgeAfter: daysAhead(170),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------

describe('★★ המחיקה רצה ומוחקת', () => {
  it('הזמנה שהגיע מועדה — פרטי הנמענת נמחקים, והרשומה המצומצמת שורדת', async () => {
    const store = new MemoryStore();
    store.put(UID, COLLECTIONS.orders, 'ord-1', orderDoc({ purgeAfter: daysAgo(1) }));

    const summary = await runPurge(store, NOW);

    expect(summary.ordersPurged).toBe(1);
    const doc = (await store.listAll(UID, COLLECTIONS.orders))[0].data;

    // ★★ מחיקה, לא הסתרה.
    expect(doc.recipient).toBeUndefined();
    expect(doc.recipientPurged).toBe(true);

    // ★ ומה ששורד: תאריך · מוצר · כמות · סכום.
    expect(doc.receivedAt).toBeTruthy();
    expect(doc.paidTotal).toBe(42);
    expect(doc.items).toBeTruthy();
  });

  it('הזמנה שעוד לא הגיע מועדה — לא נגעו בה', async () => {
    const store = new MemoryStore();
    store.put(UID, COLLECTIONS.orders, 'ord-1', orderDoc({ purgeAfter: daysAhead(30) }));

    const summary = await runPurge(store, NOW);

    expect(summary.ordersPurged).toBe(0);
    expect(store.dump()).toContain(STREET);
  });

  it('★★ הרצפה: הזמנה שאיש לא סימן, אחרי 180 יום — נמחקת בכל זאת', async () => {
    const store = new MemoryStore();
    const received = daysAgo(MAX_RETENTION_DAYS + 5);
    store.put(
      UID,
      COLLECTIONS.orders,
      'ord-forgotten',
      orderDoc({
        status: 'new',
        shippedAt: null,
        receivedAt: received,
        purgeAfter: new Date(new Date(received).getTime() + MAX_RETENTION_DAYS * DAY).toISOString(),
      }),
    );

    await runPurge(store, NOW);

    // ★★ זה הסעיף שסקירת עדי הפילה בשורה אחת: "כל עוד לא נשלח — הכול נשמר"
    // פירושו כתובת מגורים לנצח, כי מישהו שכח ללחוץ.
    expect(store.dump()).not.toContain(STREET);
    expect(store.dump()).not.toContain(CUSTOMER);
  });

  it('60 יום אחרי משלוח — נמחקת', async () => {
    const store = new MemoryStore();
    const shipped = daysAgo(POST_SHIPMENT_DAYS + 1);
    store.put(
      UID,
      COLLECTIONS.orders,
      'ord-shipped',
      orderDoc({
        status: 'shipped',
        shippedAt: shipped,
        purgeAfter: new Date(new Date(shipped).getTime() + POST_SHIPMENT_DAYS * DAY).toISOString(),
      }),
    );

    await runPurge(store, NOW);
    expect(store.dump()).not.toContain(STREET);
  });
});

describe('★★ מלכודת העותק השני — מסמך "ההזמנות של היום"', () => {
  it('רשימה יומית שעבר מועדה נמחקת כולה', async () => {
    const store = new MemoryStore();
    store.put(UID, COLLECTIONS.dailyLists, '2026-02-01', {
      orderIds: ['ord-1'],
      builtAt: daysAgo(200),
      purgeAfter: daysAgo(20),
    });

    const summary = await runPurge(store, NOW);
    expect(summary.dailyListsDeleted).toBe(1);
    expect(await store.listAll(UID, COLLECTIONS.dailyLists)).toHaveLength(0);
  });

  it('★★★ רשימה יומית שמישהו הוסיף לה כתובת — הכתובת נמחקת, וזה מדווח כממצא', async () => {
    const store = new MemoryStore();

    // ★ מדמה בדיוק את הבאג העתידי: "רק נוסיף את הכתובת כדי שהמסך ייטען מהר".
    store.put(UID, COLLECTIONS.dailyLists, '2026-08-30', {
      orderIds: ['ord-1'],
      builtAt: daysAgo(2),
      purgeAfter: daysAhead(100),
      // ⛔ השדה שלא אמור להיות כאן.
      recipient: { name: CUSTOMER, street: STREET },
    });

    const summary = await runPurge(store, NOW);

    // ★★ נמחק — למרות שמועד המחיקה של המסמך עוד לא הגיע. שדה נמען במקום
    // שאין לו סכימה עבורו אינו "עוד לא הגיע זמנו", הוא באג.
    expect(store.dump()).not.toContain(STREET);

    // ★★★ **ומדווח.** ניקוי שקט היה מסתיר את הבאג שגרם לו.
    expect(summary.residue).toHaveLength(1);
    expect(summary.residue[0].collection).toBe(COLLECTIONS.dailyLists);
    expect(summary.residue[0].fields).toContain('recipient');
    expect(purgeSummaryHe(summary)).toContain('רונן צריך להסתכל');
  });

  it('★★ מבחן דליפה מקצה לקצה: כתובת בכל אוסף, מחיקה, וסריקה של הכול', async () => {
    const store = new MemoryStore();

    store.put(UID, COLLECTIONS.orders, 'ord-1', orderDoc({ purgeAfter: daysAgo(1) }));
    store.put(UID, COLLECTIONS.dailyLists, '2026-08-30', {
      orderIds: ['ord-1'],
      purgeAfter: daysAhead(50),
      address: STREET, // שם שדה אחר, אותו מידע
    });
    store.put(UID, COLLECTIONS.accessLog, 'log-1', {
      at: daysAgo(500),
      action: 'orderContentOpened',
      purgeAfter: daysAgo(100),
    });
    store.put(UID, COLLECTIONS.syncRuns, 'run-1', {
      at: daysAgo(200),
      scanned: 3,
      purgeAfter: daysAgo(110),
    });

    await runPurge(store, NOW);

    const dump = store.dump();
    // ★★ שלוש המחרוזות שאסור שיישרדו, בשום אוסף.
    expect(dump).not.toContain(STREET);
    expect(dump).not.toContain(CUSTOMER);
    expect(dump).not.toContain('ronit.s@lakoach.example');
  });

  it('הרצה שנייה על מסד נקי לא מדווחת ממצאים חדשים', async () => {
    const store = new MemoryStore();
    store.put(UID, COLLECTIONS.orders, 'ord-1', orderDoc({ purgeAfter: daysAgo(1) }));

    await runPurge(store, NOW);
    const second = await runPurge(store, NOW);

    // ★ רשומה שכבר נמחקה אינה "מסמך שמחזיק שדה" — אחרת כל ריצה שנייה
    // הייתה מדווחת ממצא, ואיש לא היה מסתכל על הדוח בפעם השלישית.
    expect(second.ordersPurged).toBe(0);
    expect(second.residue).toHaveLength(0);
    expect(second.missed).toBe(0);
  });
});

describe('הדיווח', () => {
  it('"לא היה מה למחוק" נאמר במפורש — ריצה שלא מדווחת נראית כמו ריצה שלא קרתה', async () => {
    const store = new MemoryStore();
    store.put(UID, COLLECTIONS.orders, 'ord-1', orderDoc());
    const summary = await runPurge(store, NOW);
    expect(purgeSummaryHe(summary)).toContain('לא היה מה למחוק היום');
  });

  it('מסמך בלי purgeAfter כלל נסרק ולא מדולג', async () => {
    const store = new MemoryStore();
    // ★ מסמך פגום — בדיוק מה ששאילתת `where('purgeAfter','<=',now)` הייתה
    // מדלגת עליו בשקט. הסריקה המלאה תופסת אותו.
    store.put(UID, COLLECTIONS.dailyLists, 'broken', {
      orderIds: ['x'],
      recipient: { street: STREET },
    });

    const summary = await runPurge(store, NOW);
    expect(summary.residue).toHaveLength(1);
    expect(store.dump()).not.toContain(STREET);
  });
});

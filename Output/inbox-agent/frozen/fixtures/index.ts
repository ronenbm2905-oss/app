// ============================================================================
// frozen/fixtures/index.ts — נתוני הדוגמה של המסכים שהוקפאו.
//
// שני קבצים ולא אחד, בכוונה: `inbox.sample.json` הוא התיבה של פרוסה 0
// ו-`invoices.sample.json` נוסף בפרוסה 0.5. מיזוג בקוד במקום קובץ אחד ענק
// שומר על שני דברים — אפשר לקרוא כל קובץ בישיבה אחת, והמבחנים של פרוסה 0
// ממשיכים לרוץ על **בדיוק** אותו קלט שהם נכתבו עליו.
//
// זה לא פדנטיות: מבחן שהקלט שלו השתנה מתחתיו הוא מבחן שאיבד את המשמעות שלו
// בלי שאף אחד הבחין.
//
// ---------------------------------------------------------------------------
// ★ למה ההזמנות נשארו ב-`src/fixtures/`
// ---------------------------------------------------------------------------
// `orders.sample.json` הוא הקלט של המוצר עצמו, ולכן הוא בבנייה. הקובץ הזה
// **מייבא אותו** כדי שהתיבה הממוזגת תמשיך להכיל את הודעות ההזמנה — וזו לא
// נוחות אלא תנאי למבחן `orderRoute.test.ts`: אם ההזמנות היו רצות רק בצינור
// שלהן, הטענה "הזמנה לא מגיעה למודל" הייתה נשענת על תרשים ולא על קוד.
//
// הכיוון חד-סטרי: **מוקפא מייבא מהבנייה, ולא ההפך.**
// ============================================================================

import inboxJson from './inbox.sample.json';
import invoicesJson from './invoices.sample.json';
import briefHistoryJson from './briefHistory.sample.json';
import type { InboxFixture } from '../utils/inboxFixture';
import type { InvoiceSourceMessage } from '../utils/invoicePipeline';
import type { SenderLedgerEntry } from '../types';
import { orderMessages } from '../../src/fixtures';

// ההזמנות מיוצאות מחדש כדי שמבחנים קיימים שמייבאים הכול ממקום אחד ימשיכו
// לעבוד. המקור נשאר `src/fixtures`.
export { orderMessages, ordersFixture, SEEDED_SHIPMENTS } from '../../src/fixtures';
export type { OrdersFixture } from '../../src/fixtures';

export const baseInbox = inboxJson as unknown as InboxFixture;

/** מבנה קובץ החשבוניות. `attachments` קיים ב-fixture בלבד. */
export interface InvoiceFixture {
  meta?: Record<string, string | number>;
  sentAddresses?: string[];
  senders?: Record<string, Partial<SenderLedgerEntry>>;
  messages: InvoiceSourceMessage[];
}

export const invoiceFixture = invoicesJson as unknown as InvoiceFixture;

/** הופעות קודמות בדוח בוקר — הקלט של חלון ההשהיה. */
export interface BriefHistoryEntry {
  firstSeenInBriefAt: string;
  briefAppearances: number;
}

export const SEEDED_BRIEF_HISTORY: Record<string, BriefHistoryEntry> = (
  briefHistoryJson as { entries: Record<string, BriefHistoryEntry> }
).entries;

/**
 * התיבה המלאה: 42 ההודעות של פרוסה 0 + 15 ההודעות של מודול החשבוניות.
 *
 * ה-`senders` ממוזגים כי הפנקס הוא אחד — וזה מה שמאפשר לחשבונית מ-
 * `anan-shrutim.example` להיות גם `defaultVerdict: 'noise'` (הכותרות אומרות
 * דיוור) וגם `invoiceSource: true` (משם מגיעות חשבוניות). הצירוף הזה הוא
 * המצב הרגיל, והוא בדיוק מה שמפעיל את הקידום בשלב 7.5 של המסנן.
 */
export function mergedInbox(): InboxFixture & { messages: InvoiceSourceMessage[] } {
  return {
    ...baseInbox,
    sentAddresses: [...(baseInbox.sentAddresses ?? []), ...(invoiceFixture.sentAddresses ?? [])],
    senders: { ...(baseInbox.senders ?? {}), ...(invoiceFixture.senders ?? {}) },
    messages: [
      ...(baseInbox.messages as unknown as InvoiceSourceMessage[]),
      ...invoiceFixture.messages,
      // ★ הודעות ההזמנה נכנסות **לאותה תיבה** ולא לצינור נפרד. ראה ההערה
      // בראש הקובץ — זו הנקודה שסקירת עדי דרשה שתהיה ניתנת לבדיקה.
      ...(orderMessages as unknown as InvoiceSourceMessage[]),
    ],
  } as InboxFixture & { messages: InvoiceSourceMessage[] };
}

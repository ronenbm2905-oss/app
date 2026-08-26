// ============================================================================
// fixtures/index.ts — מיזוג נתוני הדוגמה לתיבה אחת.
//
// שני קבצים ולא אחד, בכוונה: `inbox.sample.json` הוא התיבה של פרוסה 0
// ו-`invoices.sample.json` נוסף בפרוסה 0.5. מיזוג בקוד במקום קובץ אחד ענק
// שומר על שני דברים — אפשר לקרוא כל קובץ בישיבה אחת, והמבחנים של פרוסה 0
// ממשיכים לרוץ על **בדיוק** אותו קלט שהם נכתבו עליו.
//
// זה לא פדנטיות: מבחן שהקלט שלו השתנה מתחתיו הוא מבחן שאיבד את המשמעות
// שלו בלי שאף אחד הבחין.
// ============================================================================

import inboxJson from './inbox.sample.json';
import invoicesJson from './invoices.sample.json';
import briefHistoryJson from './briefHistory.sample.json';
import type { InboxFixture } from '../utils/pipeline';
import type { InvoiceSourceMessage } from '../utils/invoicePipeline';
import type { SenderLedgerEntry } from '../../shared/types';

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
    ],
  } as InboxFixture & { messages: InvoiceSourceMessage[] };
}

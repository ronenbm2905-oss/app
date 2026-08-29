// ============================================================================
// fixtures/index.ts — נתוני הדוגמה של המוצר: **הזמנות בלבד**.
//
// ---------------------------------------------------------------------------
// ★ מה ירד מכאן
// ---------------------------------------------------------------------------
// הקובץ הזה החזיק גם את התיבה של פרוסה 0 (`inbox.sample.json`), את קובץ
// החשבוניות ואת היסטוריית דוח הבוקר. שלושתם עברו ל-`frozen/fixtures/` יחד
// עם המסכים שקוראים אותם.
//
// הסיבה אינה סדר: `mergedInbox()` ייבא את `InboxFixture` מ-`pipeline.ts`,
// כלומר מהמודול שקורא למודל. כל קובץ בבנייה שהיה מייבא מכאן ולו שורה אחת
// היה גורר את הצינור ההוא איתו לחבילה.
// ============================================================================

import ordersJson from './orders.sample.json';
import type { OrderFixtureMessage } from '../utils/orderPipeline';

export interface OrdersFixture {
  meta?: Record<string, string | number>;
  /** הזמנות שכבר סומנו כנשלחו, לפי `messageId`. */
  seededShipments?: Record<string, { shippedAt: string }>;
  messages: OrderFixtureMessage[];
}

export const ordersFixture = ordersJson as unknown as OrdersFixture;

export const orderMessages: OrderFixtureMessage[] = ordersFixture.messages;

/**
 * שתי הזמנות שכבר יצאו: אחת מלפני 70 יום (עברה את מועד המחיקה) ואחת מלפני
 * חמישה ימים. הן מוזרעות כדי שמסלול המחיקה יהיה **גלוי על המסך** ולא רק
 * ירוק במבחן — בקרה שאי אפשר לראות היא בקרה שאף אחד לא מאמין לה.
 */
export const SEEDED_SHIPMENTS: Record<string, { shippedAt: string }> =
  ordersFixture.seededShipments ?? {};

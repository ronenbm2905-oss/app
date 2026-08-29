// ============================================================================
// inboxFixture.ts — צורת קובץ התיבה לדוגמה, והשלמת פנקס השולחים.
//
// ---------------------------------------------------------------------------
// ★ למה הקובץ הזה נולד — והמחיקה שהוא שריד שלה
// ---------------------------------------------------------------------------
// שלושת הדברים כאן ישבו ב-`pipeline.ts`, ו-`pipeline.ts` **נמחק**. הוא היה
// מסלול הכתיבה לאוסף `items`: הוא בנה `TriageItem` שנשא `subject` גולמי לצד
// כתובת השולח, החזיק את גוף המייל בזיכרון, וקרא ל"מודל".
//
// הדרישה בסקירה (B13, וממנה נופל גם B1) הייתה מפורשת: **אוסף `items` ומסלול
// הכתיבה אליו נמחקים — לא נשארים ללא שימוש.** הטענה "לא שומרים כותרות מייל"
// נכונה רק אם אין קוד שיודע לכתוב אותן; אוסף ששורד "רק בשביל הקשר" מחזיר את
// הממצא שלם.
//
// מה שנשאר כאן הוא מה ש**אינו** נוגע ב-`items`: צורת ה-fixture, ו-
// `hydrateLedger` שממלא רשומת פנקס שולחים. שניהם משרתים את המודולים
// שהוקפאו (חשבוניות, תוכנית הארכוב) ואין בהם לא כותרת שנשמרת ולא גוף.
// ============================================================================

import type { MessageMeta, SenderLedgerEntry, UserSenderRule, Verdict } from '../types';
import { LOCAL_USER_ID } from '../constants';

export interface FixtureMessage extends MessageMeta {
  /** כותרת האימות, ל-fixtures של הזמנות. ראה orderParse. */
  authenticationResults?: string | null;

  /**
   * גוף המייל. **קיים ב-fixture בלבד** — אין יותר שום מבנה נשמר שיש בו מקום
   * לגוף. זהו העיקרון "מצביעים ונגזרות, לא תוכן", שהיה מיושם כאן כבר בפרוסה
   * המקומית, ועכשיו הוא פשוט המצב.
   */
  bodyHtml: string;
}

export interface InboxFixture {
  meta?: Record<string, string | number>;
  owner?: { address: string; displayName: string };
  sentAddresses?: string[];
  signalThreadIds?: string[];
  userRules?: UserSenderRule[];
  senders?: Record<string, Partial<SenderLedgerEntry>>;
  messages: FixtureMessage[];
}

/** משלים רשומת פנקס חלקית מה-fixture לרשומה מלאה ומטופסת. */
export function hydrateLedger(
  raw: Record<string, Partial<SenderLedgerEntry>> | undefined,
): Record<string, SenderLedgerEntry> {
  const out: Record<string, SenderLedgerEntry> = {};
  const ts = new Date().toISOString();
  for (const [domainKey, v] of Object.entries(raw ?? {})) {
    out[domainKey] = {
      userId: LOCAL_USER_ID,
      domainKey,
      defaultVerdict: (v.defaultVerdict ?? 'unknown') as Verdict,
      // ברירת המחדל היא `header` ולא `user`: רשומה שנטענה מ-fixture מייצגת
      // מה שנלמד מהכותרות, לא הכרעה מפורשת של המשתמשת. ההבדל משנה — פסק
      // של המשתמשת לא נדרס בלמידה אוטומטית.
      verdictSource: v.verdictSource ?? 'header',
      neverAutoNoise: v.neverAutoNoise ?? false,
      invoiceSource: v.invoiceSource ?? false,
      messageCount: v.messageCount ?? 0,
      repliedCount: v.repliedCount ?? 0,
      lastSeenAt: v.lastSeenAt ?? ts,
      createdAt: ts,
      updatedAt: ts,
    };
  }
  return out;
}

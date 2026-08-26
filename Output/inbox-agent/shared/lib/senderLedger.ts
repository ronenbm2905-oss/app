// ============================================================================
// senderLedger.ts — ★ **מודול הכתיבה היחיד לפנקס השולחים.**
//
// ---------------------------------------------------------------------------
// למה זה קובץ, ולמה הוא היחיד
// ---------------------------------------------------------------------------
// כלל 1 של הארכוב אומר "רק המסנן הדטרמיניסטי מארכב, פסיקת מודל לעולם לא".
// הכלל נשמע הרמטי, ויש בו חור שסקירת עדי מצאה: **המסנן קורא את הפנקס.**
//
// כלומר אם קוד כלשהו במורד הזרם יכול לכתוב `defaultVerdict: 'noise'` לפנקס
// על סמך משהו שהמודל אמר, אז בריצה הבאה **המסנן** יקבע `noise`, כלל 1 יתקיים
// באופן פורמלי — והמייל יארכב בגלל פסיקת מודל. הדליפה עוברת דרך הזמן ודרך
// מסד הנתונים, ולכן אף מבחן על `triageFilter` לא רואה אותה.
//
// התיקון היחיד שעובד הוא **צוואר בקבוק אחד**: פונקציה אחת שכותבת לפנקס,
// שמקבלת `source` מטיפוס שיש בו שני ערכים בלבד, ושאין דרך לקרוא לה עם
// "המודל אמר".
//
// ---------------------------------------------------------------------------
// בדיקת CI שצריכה להתלוות לזה
// ---------------------------------------------------------------------------
// `tests/senderLedger.test.ts` מוודא שאין ערך שלישי ב-`SenderVerdictSource`
// ושכל רשומה שנוצרת נושאת מקור. בפרוסה 1 מצטרפת בדיקת `grep` על
// `functions/src/` שמפילה את ה-build אם מישהו כותב ל-`senders/` מחוץ לקובץ
// הזה — אותה תבנית בדיוק שסעיף 9 בתוכנית מגדיר ל-`messages.send`.
// ============================================================================

import type { MessageMeta } from '../types/triage';
import type { SenderLedgerEntry, SenderVerdictSource } from '../types/sender';
import type { Verdict } from '../types/triage';
import { domainOf } from './triageFilter';

/**
 * ★ ראיה קבילה לעדכון פנקס.
 *
 * שים לב מה **אין** בטיפוס הזה: אין שדה שמייצג פלט מודל. לא `category`, לא
 * `urgency`, לא `summaryHe`. אי אפשר להעביר לפונקציה הזאת את מה שהמודל אמר,
 * גם לא בטעות, כי אין לזה פרמטר.
 */
export type LedgerEvidence =
  | {
      source: 'header';
      /** הכותרות של ההודעה. הראיה היחידה שהמסנן רשאי ללמוד ממנה. */
      message: MessageMeta;
    }
  | {
      source: 'user';
      /** בעלת העסק הכריעה במפורש. */
      verdict: Verdict;
      domainKey: string;
      neverAutoNoise?: boolean;
      invoiceSource?: boolean;
    };

export interface LedgerUpdate {
  entry: SenderLedgerEntry;
  /** מה השתנה, בעברית. לתצוגה במסך "מה עומד לקרות". */
  changeHe: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * האם הכותרות מצהירות על דיוור המוני. **שכפול מכוון** של הבדיקה ב-
 * `triageFilter`, כי כאן היא משמשת לשאלה אחרת: לא "מה לעשות עם ההודעה הזאת"
 * אלא "האם מותר ללמוד מהדומיין הזה". שיתוף הפונקציה היה מפתה לחבר את שתי
 * ההחלטות, וזה בדיוק מה שגרם לדליפה מלכתחילה.
 */
function headersDeclareBulk(msg: MessageMeta): boolean {
  if (msg.listUnsubscribe && String(msg.listUnsubscribe).trim()) return true;
  const prec = String(msg.precedence ?? '').trim().toLowerCase();
  if (prec === 'bulk' || prec === 'list' || prec === 'junk') return true;
  const auto = String(msg.autoSubmitted ?? '').trim().toLowerCase();
  return Boolean(auto) && auto !== 'no';
}

function blankEntry(userId: string, domainKey: string, source: SenderVerdictSource): SenderLedgerEntry {
  const ts = nowIso();
  return {
    userId,
    domainKey,
    defaultVerdict: 'unknown',
    verdictSource: source,
    neverAutoNoise: false,
    invoiceSource: false,
    messageCount: 0,
    repliedCount: 0,
    lastSeenAt: ts,
    createdAt: ts,
    updatedAt: ts,
  };
}

/**
 * ★ הפונקציה **היחידה** שמייצרת או מעדכנת רשומת פנקס.
 *
 * מחזירה רשומה חדשה; לא משנה את הקיימת. מי שקורא לה אחראי לשמור — וזה בסדר,
 * כי הנקודה כאן היא לא מי כותב לדיסק אלא **מי רשאי להחליט מה נכתב**.
 */
export function applyLedgerEvidence(
  existing: SenderLedgerEntry | undefined,
  evidence: LedgerEvidence,
  userId: string,
): LedgerUpdate {
  // --- ראיה מהמשתמשת. גוברת על הכול, כולל על מה שנלמד מכותרות. ------------
  if (evidence.source === 'user') {
    const base = existing ?? blankEntry(userId, evidence.domainKey, 'user');
    return {
      entry: {
        ...base,
        defaultVerdict: evidence.verdict,
        verdictSource: 'user',
        neverAutoNoise: evidence.neverAutoNoise ?? base.neverAutoNoise,
        invoiceSource: evidence.invoiceSource ?? base.invoiceSource,
        updatedAt: nowIso(),
      },
      changeHe: `שמרתי את ההחלטה שלך לגבי ${evidence.domainKey}`,
    };
  }

  // --- ראיה מכותרות. הדבר היחיד שהמערכת רשאית ללמוד לבד. -------------------
  const domainKey = domainOf(evidence.message.fromAddress);
  const base = existing ?? blankEntry(userId, domainKey, 'header');

  // ★ פסק דין שמקורו במשתמשת **לא נדרס** בידי למידה אוטומטית. אחרת כל
  // החלטה מפורשת שלה נשחקת תוך שבוע והיא מפסיקה לסמוך על הכלי.
  const canOverrideVerdict = base.verdictSource !== 'user';

  const bulk = headersDeclareBulk(evidence.message);
  const nextVerdict: Verdict =
    canOverrideVerdict && bulk ? 'noise' : base.defaultVerdict;

  return {
    entry: {
      ...base,
      defaultVerdict: nextVerdict,
      verdictSource: canOverrideVerdict && bulk ? 'header' : base.verdictSource,
      messageCount: base.messageCount + 1,
      lastSeenAt: evidence.message.receivedAt || nowIso(),
      updatedAt: nowIso(),
    },
    changeHe: bulk
      ? `${domainKey} שולח דיוור המוני — כך כתוב בכותרות של המייל עצמו`
      : `ראיתי עוד מייל מ-${domainKey}`,
  };
}

/**
 * ★ שער בטיחות שאפשר לקרוא לו מכל מקום: האם מותר לפסק הדין הזה להוביל
 * לארכוב.
 *
 * `true` רק כשהפסק נלמד מכותרות או נקבע בידי המשתמשת. הפונקציה קיימת כדי
 * ש-`archivePolicy` לא יצטרך לדעת איך הפנקס בנוי — הוא רק שואל.
 */
export function ledgerVerdictMayArchive(entry: SenderLedgerEntry | undefined): boolean {
  if (!entry) return true; // אין רשומה = הפסק לא הגיע מהפנקס בכלל
  return entry.verdictSource === 'header' || entry.verdictSource === 'user';
}

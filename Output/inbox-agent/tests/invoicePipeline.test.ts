// ============================================================================
// invoicePipeline.test.ts — הצינור מקצה לקצה, על ה-fixture שהאפליקציה טוענת.
//
// המבחנים ב-`invoiceLogic.test.ts` בודקים כל מודול בבידוד. כאן נבדקת הטענה
// שהמסך עצמו מציג: שהחיבור ביניהם בסדר הנכון מייצר את הטבלה הנכונה, ושכל
// אחד מה-fixtures שנכתבו כדי להדגים כשל **באמת נכשל** — ונכשל בצורה הנכונה.
//
// מבחן כזה תופס בדיוק את מה שבדיקת יחידה מפספסת: שני מודולים נכונים
// שחוברו בסדר הלא נכון.
// ============================================================================

import { describe, expect, it } from 'vitest';
import { runInvoicePipeline } from '../frozen/utils/invoicePipeline';
import { buildAccountantCsv, csvCell, accountantFileName } from '../frozen/utils/accountantExport';
import { buildPlan } from '../frozen/utils/plannedActions';
import { mergedInbox, invoiceFixture, SEEDED_BRIEF_HISTORY } from '../frozen/fixtures';
import { prepareContext, triageFilter } from '../frozen/lib/triageFilter';
import { hydrateLedger } from '../frozen/utils/inboxFixture';
import type { SenderLedgerEntry } from '../frozen/types';

const NOW = '2026-08-26T09:00:00+03:00';

/** משלים את הפנקס מה-fixture, כמו שהאפליקציה עושה. */
function hydrate(): Record<string, SenderLedgerEntry> {
  const merged = mergedInbox();
  const out: Record<string, SenderLedgerEntry> = {};
  const ts = '2026-08-01T00:00:00Z';
  for (const [domainKey, v] of Object.entries(merged.senders ?? {})) {
    out[domainKey] = {
      userId: 'local-single-user',
      domainKey,
      defaultVerdict: v.defaultVerdict ?? 'unknown',
      verdictSource: v.verdictSource ?? 'header',
      neverAutoNoise: v.neverAutoNoise ?? false,
      invoiceSource: v.invoiceSource ?? false,
      messageCount: v.messageCount ?? 0,
      repliedCount: v.repliedCount ?? 0,
      lastSeenAt: ts,
      createdAt: ts,
      updatedAt: ts,
    };
  }
  return out;
}

const senders = hydrate();
const merged = mergedInbox();

const result = runInvoicePipeline(merged.messages, {
  triage: {
    senders,
    sentAddresses: merged.sentAddresses ?? [],
    signalThreadIds: merged.signalThreadIds ?? [],
    userRules: merged.userRules ?? [],
  },
  senders,
  now: NOW,
});

const byId = (id: string) => result.invoices.find((i) => i.sourceItemId === id);

// ---------------------------------------------------------------------------

describe('ה-fixture עצמו', () => {
  it('כל הכתובות הן .example — הריפו ציבורי', () => {
    for (const m of invoiceFixture.messages) {
      expect(m.fromAddress).toMatch(/\.example$/);
    }
  });

  it('אין בקובץ מספר עוסק שיכול להיות אמיתי', () => {
    // כל המספרים בטווח 9xxxxxxxx, שאינו בשימוש כמספר עוסק ישראלי.
    const raw = JSON.stringify(invoiceFixture);
    for (const m of raw.matchAll(/\b\d{9}\b/g)) {
      expect(Number(m[0])).toBeGreaterThanOrEqual(900_000_000);
    }
  });

  it('הצינור לא נשבר על אף הודעה', () => {
    expect(result.stats.scanned).toBe(merged.messages.length);
    expect(result.invoices.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------

describe('★ הקידום שמונע מחשבוניות להיקבר', () => {
  // ★ שני המבחנים האלה רצו דרך `runPipeline`, שנמחק יחד עם אוסף `items`
  // (סקירת עדי, B13). הטענה שהם בודקים לא השתנתה — היא מעולם לא הייתה על
  // הצינור אלא על **המסנן** — ולכן הם קוראים לו עכשיו ישירות. זה גם מבחן
  // צר יותר: אין דרך שהוא יעבור בזכות שלב אחר בצינור.
  const ctx = prepareContext({
    senders: hydrateLedger(merged.senders),
    sentAddresses: merged.sentAddresses,
    signalThreadIds: merged.signalThreadIds,
  });
  const invoiceMsg = merged.messages.find((m) => m.messageId === 'inv-001')!;

  it('חשבונית מספק מוכר עם כותרות דיוור — לא נחשבת רעש', () => {
    // `billing@anan-shrutim.example` שולח עם `List-Unsubscribe` ו-
    // `Precedence: bulk`, כלומר שלב 5 של המסנן קבע עליה רעש **בצדק**.
    // בלי הקידום בשלב 7.5, דווקא המיילים שנוגעים בכסף היו נקברים.
    const d = triageFilter(invoiceMsg, ctx);
    expect(d.verdict).not.toBe('noise');
    expect(d.reason).toBe('invoiceEvidence');
  });

  it('הקידום מגיע רק עד "שווה מבט", לעולם לא ל"דורש טיפול"', () => {
    expect(triageFilter(invoiceMsg, ctx).verdict).toBe('unknown');
  });
});

// ---------------------------------------------------------------------------

describe('חשבוניות תקינות', () => {
  it('שתי החשבוניות של הספק החוזר נקראו במלואן', () => {
    for (const id of ['inv-001', 'inv-002']) {
      const inv = byId(id);
      expect(inv?.needsHumanReview).toBe(false);
      expect(inv?.fields.total).toBe(354);
      expect(inv?.fields.currency).toBe('ILS');
      expect(inv?.fields.supplierName).toBe('ענן שירותים בע״מ');
    }
  });

  it('שלושה מטבעות שונים, וכל אחד נשאר בשלו', () => {
    expect(byId('inv-006')?.fields.currency).toBe('USD');
    expect(byId('inv-007')?.fields.currency).toBe('EUR');
    expect(byId('inv-001')?.fields.currency).toBe('ILS');
  });

  it('★ הסכום החודשי מחושב לכל מטבע בנפרד', () => {
    // חיבור שקלים לדולרים בעמודה אחת נראה נכון על המסך ומתגלה אצל הרו״ח.
    const august = result.months.find((m) => m.monthKey === '2026-08');
    const currencies = august?.totals.map((t) => t.currency) ?? [];
    expect(new Set(currencies).size).toBe(currencies.length);
    expect(currencies.length).toBeGreaterThan(1);
  });

  it('קיבוץ לפי חודש לפי תאריך החשבונית, ולא לפי מתי המייל הגיע', () => {
    // inv-001 הגיע ב-2 ביולי ותאריך החשבונית 1 ביולי — שניהם יולי, אבל
    // המקור מסומן במפורש כדי שניחוש לא ייראה כמו עובדה.
    expect(byId('inv-001')?.monthKey).toBe('2026-07');
    expect(byId('inv-001')?.monthKeySource).toBe('issueDate');
  });
});

// ---------------------------------------------------------------------------

describe('★★ מה שדורש בדיקה — הלב של המודול', () => {
  it('★ סכום שלא נקרא: שדה ריק + הסבר, לא מספר', () => {
    const inv = byId('inv-008');
    // הקובץ הוא JPG, ולכן שער הקליטה חוסם אותו עוד לפני החילוץ — וזו
    // התוצאה הנכונה: עדיף לא לקרוא מאשר לקרוא חלקית.
    expect(inv).toBeUndefined();
    const q = result.openQuestions.find((x) => x.messageId === 'inv-008');
    expect(q?.reasonHe).toContain('PDF');
  });

  it('★ חישוב שלא מסתדר → דורש בדיקה, ולא נכנס לסכום', () => {
    const inv = byId('inv-009');
    expect(inv?.needsHumanReview).toBe(true);
    expect(inv?.issues.some((i) => i.code === 'vatMismatch')).toBe(true);

    const august = result.months.find((m) => m.monthKey === '2026-08');
    const ils = august?.totals.find((t) => t.currency === 'ILS');
    // 1,950.20 לא נכלל בסכום — הבדיקה היא שהוא פשוט לא שם.
    expect(ils?.total).not.toBe(1950.2);
    expect((august?.needsReviewCount ?? 0)).toBeGreaterThan(0);
  });

  it('★ תאריך דו-משמעי לא מתפרש, והחודש מסומן כניחוש', () => {
    const inv = byId('inv-010');
    expect(inv?.fields.issueDate).toBeNull();
    expect(inv?.monthKeySource).toBe('receivedAt');
    expect(inv?.needsHumanReview).toBe(true);
  });

  it('מטבע לא מוכר נדחה ולא מומר', () => {
    const inv = byId('inv-011');
    expect(inv?.fields.currency).toBeNull();
    expect(inv?.needsHumanReview).toBe(true);
  });

  it('★ כל שורה שדורשת בדיקה נושאת קישור למקור', () => {
    // "שדה ריק עם הסבר" שווה משהו רק אם אפשר להגיע מהמסמך למקור.
    for (const inv of result.invoices.filter((i) => i.needsHumanReview)) {
      expect(inv.sourceItemId).toBeTruthy();
      expect(inv.filePath).toContain('לבדיקה');
      expect(inv.issues.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------

describe('★★ שלוש החשבוניות העוינות', () => {
  it('★ הוראה מוסתרת בתוך טקסט המסמך — נתפסת, ולא מייצרת שום נתון', () => {
    const inv = byId('inv-012');
    expect(inv?.needsHumanReview).toBe(true);
    expect(inv?.issues.some((i) => i.code === 'injectionAttempt')).toBe(true);
    // ה-9,440 שכתוב במסמך לא נכנס לשום סכום.
    const august = result.months.find((m) => m.monthKey === '2026-08');
    const ils = august?.totals.find((t) => t.currency === 'ILS');
    expect(ils?.total ?? 0).toBeLessThan(9440);
  });

  it('★ מתחזה לספק מוכר עם פרטי בנק תחובים — שם הספק מתאפס', () => {
    const inv = byId('inv-014');
    expect(inv?.fields.supplierName).toBeNull();
    expect(inv?.issues.some((i) => i.code === 'paymentDetails')).toBe(true);
    expect(inv?.needsHumanReview).toBe(true);
  });

  it('★ מתחזה מדומיין דומה מסומן גם כספק חדש', () => {
    // `anan-shrutim-billing.example` אינו `anan-shrutim.example`. ההבדל
    // נראה זניח לעין ומוחלט לקוד — וזה בדיוק היתרון של השוואת דומיין.
    const inv = byId('inv-014');
    expect(inv?.fromDomain).toBe('anan-shrutim-billing.example');
    expect(inv?.issues.some((i) => i.code === 'newSupplier')).toBe(true);
  });

  it('★ פרטי בנק לא מגיעים לשום שדה, בשום חשבונית', () => {
    for (const inv of result.invoices) {
      const text = JSON.stringify(inv.fields);
      expect(text).not.toMatch(/IBAN|IL\d{2}\d{10,}/i);
    }
  });

  it('★ `List-Unsubscribe` מזויף לא קונה ארכוב', () => {
    const plan = buildPlan(
      {
        messages: merged.messages,
        senders,
        sentAddresses: merged.sentAddresses,
        signalThreadIds: merged.signalThreadIds,
        briefHistory: SEEDED_BRIEF_HISTORY,
      },
      { now: NOW },
    );
    const a = plan.actions.find((x) => x.itemId === 'inv-015');
    expect(a?.decision.action).toBe('keep');
  });
});

// ---------------------------------------------------------------------------

describe('דיוור שמתחזה לחשבונית', () => {
  it('★ "החשבונית שלך מוכנה — לחצי כאן" לא הופך לשורה בטבלה', () => {
    expect(byId('inv-013')).toBeUndefined();
  });

  it('...אבל גם לא נעלם בשקט — הוא מוצג כשאלה', () => {
    // פער בין "נראה כמו חשבונית" ל"לא בטבלה", בלי הסבר, הוא בדיוק מה
    // שגורם לחוסר אמון בכלי.
    const q = result.openQuestions.find((x) => x.messageId === 'inv-013');
    expect(q).toBeDefined();
    expect(q?.reasonHe.length).toBeGreaterThan(10);
  });
});

// ---------------------------------------------------------------------------

describe('★ הקובץ לרו״ח', () => {
  const csv = buildAccountantCsv(result.invoices);

  it('נפתח נכון באקסל: BOM, CRLF, כותרות בעברית', () => {
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('\r\n');
    expect(csv).toContain('ספק');
    expect(csv).toContain('סה״כ');
  });

  it('★ שורה שדורשת בדיקה יוצאת עם עמודות סכום ריקות', () => {
    const lines = csv.split('\r\n');
    const suspect = lines.find((l) => l.includes('צריך בדיקה שלך'));
    expect(suspect).toBeDefined();
    // הסכום שכן ראינו יושב בעמודה נפרדת ששמה אומר בדיוק מה היא.
    expect(csv).toContain('סכום שקראתי ולא הצלחתי לוודא');
  });

  it('★★ הזרקת נוסחה מנוטרלת — הקובץ נפתח במחשב של הרו״ח', () => {
    expect(csvCell('=HYPERLINK("http://evil.example")')).toBe(
      '"\'=HYPERLINK(""http://evil.example"")"',
    );
    expect(csvCell('+1+1')).toContain("'+1+1");
    expect(csvCell('@SUM(A1)')).toContain("'@SUM(A1)");
  });

  it('מרכאות ושורות חדשות לא שוברות את המבנה', () => {
    expect(csvCell('ספק "בע״מ"')).toBe('"ספק ""בע״מ"""');
    expect(csvCell('שורה\nשנייה')).toBe('"שורה שנייה"');
  });

  it('שם הקובץ בעברית וכולל את החודש', () => {
    const name = accountantFileName(result.months);
    expect(name).toMatch(/^חשבוניות /);
    expect(name).toMatch(/\.csv$/);
    expect(name).toMatch(/20\d\d/);
  });

  it('★ מספר השורות שווה למספר החשבוניות — אף אחת לא נשמטה', () => {
    const lines = csv.trim().split('\r\n');
    expect(lines.length - 1).toBe(result.invoices.length);
  });
});

// ---------------------------------------------------------------------------

describe('★ מה עומד לקרות — התוכנית על התיבה המלאה', () => {
  const plan = buildPlan(
    {
      messages: merged.messages,
      senders,
      sentAddresses: merged.sentAddresses,
      signalThreadIds: merged.signalThreadIds,
      briefHistory: SEEDED_BRIEF_HISTORY,
    },
    { now: NOW },
  );

  it('מפסק הזרם לא יורה על תיבה רגילה', () => {
    // תקרה שלא יורה אף פעם היא תקרה שלא קיימת; תקרה שיורה ביום רגיל היא
    // תקרה שיכבו אותה. שתי הבדיקות האלה יחד הן מה שמכייל אותה.
    expect(plan.run.tripped).toBe(false);
    expect(plan.willArchive.length).toBeGreaterThan(0);
  });

  it('★ שום חשבונית לא מאורכבת', () => {
    const invoiceIds = new Set(result.invoices.map((i) => i.sourceItemId));
    for (const a of plan.willArchive) {
      expect(invoiceIds.has(a.itemId)).toBe(false);
    }
  });

  it('★ שום מייל עם קובץ מצורף לא מאורכב', () => {
    const withAttachment = new Set(
      merged.messages
        .filter((m) => ((m as { attachments?: unknown[] }).attachments?.length ?? 0) > 0)
        .map((m) => m.messageId),
    );
    for (const a of plan.willArchive) {
      expect(withAttachment.has(a.itemId)).toBe(false);
    }
  });

  it('★ פריט שהגיע היום ולא הופיע בדוח בוקר — נשאר', () => {
    // m-036 ולא m-042: m-042 מגיע מדומיין שהתכתבנו איתו, ולכן הוא נחסם
    // כבר בכלל 7 ולא מגיע בכלל לחלון ההשהיה.
    const fresh = plan.actions.find((a) => a.itemId === 'm-036');
    expect(fresh?.decision.action).toBe('keep');
    expect(fresh?.decision.rule).toBe('deferralWindow');
  });

  it('★ פריט שמאורכב לא נושא כותרת בכלל — היא לא נשמרה מלכתחילה', () => {
    for (const a of plan.willArchive) {
      expect(a.subject).toBeNull();
    }
  });

  it('★ כל החלטה מגיעה עם משפט בעברית שאפשר להראות כמו שהוא', () => {
    for (const a of plan.actions) {
      expect(a.decision.reasonHe.length).toBeGreaterThan(10);
      // בלי מונחים פנימיים על המסך.
      expect(a.decision.reasonHe).not.toMatch(/noise|signal|verdict|unknown|proposal/i);
    }
  });

  it('★ החזרה בלחיצה: נעיצה של פריט מוציאה אותו מרשימת הארכוב', () => {
    const target = plan.willArchive[0].itemId;
    const after = buildPlan(
      {
        messages: merged.messages,
        senders,
        sentAddresses: merged.sentAddresses,
        signalThreadIds: merged.signalThreadIds,
        briefHistory: SEEDED_BRIEF_HISTORY,
        pinnedIds: new Set([target]),
      },
      { now: NOW },
    );
    expect(after.willArchive.some((a) => a.itemId === target)).toBe(false);
    expect(after.actions.find((a) => a.itemId === target)?.decision.rule).toBe('userPinned');
  });
});

// ============================================================================
// plannedActions.ts — ★ "מה עומד לקרות". בונה את התוכנית, לא מבצע אותה.
//
// ---------------------------------------------------------------------------
// למה המסך הזה קיים לפני שיש הרשאת כתיבה
// ---------------------------------------------------------------------------
// זה המקום שבו בעלת העסק בונה אמון **לפני** שהסוכן נוגע בתיבה שלה. היא רואה
// בדיוק מה הוא היה עושה, ולמה, ומה היא יכולה להחזיר — בזמן שהתשובה לשאלה
// "ומה אם הוא טועה?" היא "אז לא קרה כלום, כי הוא עוד לא עושה כלום".
//
// זה גם ה-QA שלנו: תוכנית שאפשר לקרוא היא הדרך היחידה לתפוס כלל שיורה על
// הפריטים הלא נכונים, לפני שהוא יורה על תיבה אמיתית.
//
// ---------------------------------------------------------------------------
// ★ הקובץ הזה **בונה מועמדים**, ולא מכריע
// ---------------------------------------------------------------------------
// כל ההכרעות יושבות ב-`frozen/lib/archivePolicy.ts`, שהוא טהור ונבדק. כאן
// רק מתרגמים את מה שיש באפליקציה לשדות של `ArchiveCandidate`. ההפרדה הזאת
// היא מה שמאפשר למבחני הבטיחות להיות מבחנים על **הכללים** ולא על המסך.
// ============================================================================

import {
  archiveDecision,
  isInstitutionalDomain,
  labelsFor,
  planArchiveRun,
  type AgentLabel,
  type ArchiveCandidate,
  type ArchiveDecision,
  type RunPlan,
  type RunPlanOptions,
} from '../lib/archivePolicy';
import { invoiceDetect, looksLikeInvoice } from '../lib/invoiceDetect';
import { domainOf, normalizeAddress, prepareContext, triageFilter } from '../lib/triageFilter';
import { ledgerVerdictMayArchive } from '../lib/senderLedger';
import { isOrderMessage } from '../../shared/lib/orderParse';
import type { InvoiceSourceMessage } from './invoicePipeline';
import { supplierDomainsFrom } from './invoicePipeline';
import type { SenderLedgerEntry, TriageDecision } from '../types';
import type { BriefHistoryEntry } from '../fixtures';

export interface PlannedAction {
  itemId: string;
  fromDomain: string;
  receivedAt: string;
  /**
   * ★ מוצג **רק** כשהפריט אינו רעש.
   * פריט רעש לא נושא כותרת בשום מקום במערכת, וגם המסך הזה לא ממציא לו אחת.
   */
  subject: string | null;
  triage: TriageDecision;
  decision: ArchiveDecision;
  labels: AgentLabel[];
  looksLikeInvoice: boolean;
}

export interface PlanResult {
  actions: PlannedAction[];
  run: RunPlan;
  /** מה שיארכב. */
  willArchive: PlannedAction[];
  /** מה שיישאר — עם הסיבה. */
  willStay: PlannedAction[];
  /** תוויות בלבד, בלי ארכוב. */
  willLabelOnly: PlannedAction[];
}

export interface BuildPlanInput {
  messages: readonly InvoiceSourceMessage[];
  senders?: Readonly<Record<string, SenderLedgerEntry>>;
  sentAddresses?: readonly string[];
  signalThreadIds?: readonly string[];
  /** הופעות קודמות בדוח בוקר, לפי מזהה. */
  briefHistory?: Record<string, BriefHistoryEntry>;
  /** מה שבעלת העסק ביקשה להשאיר. */
  pinnedIds?: ReadonlySet<string>;
}

/**
 * ★ בונה את התוכנית המלאה.
 *
 * שים לב לסדר: קודם מחשבים פסק מסנן לכל ההודעות, **ואז** נגזרות ברמת
 * השרשור. חסינות השרשור (כלל 8) לא ניתנת לחישוב מהודעה בודדת — צריך לראות
 * את כל השרשור כדי לדעת אם יש בו משהו חי, וזו בדיוק הסיבה שהיא נשברה
 * בניסוח המקורי של הכללים.
 */
export function buildPlan(
  input: BuildPlanInput,
  opts: RunPlanOptions = {},
): PlanResult {
  const senders = input.senders ?? {};
  const ctx = prepareContext({
    senders,
    sentAddresses: input.sentAddresses ?? [],
    signalThreadIds: input.signalThreadIds ?? [],
  });
  const supplierDomains = supplierDomainsFrom(senders);

  // --- מעבר ראשון: פסק מסנן לכל הודעה. ---
  const triaged = input.messages.map((msg) => ({
    msg,
    triage: triageFilter(msg, ctx),
    detection: invoiceDetect(msg, msg.attachments, { supplierDomains }),
  }));

  // --- ★ מעבר שני: חסינות ברמת השרשור. ---
  // שרשור שיש בו ולו הודעה אחת שאינה רעש, או שיש בו קובץ מצורף, מחסן את כל
  // ההודעות שבו. הצורך התגלה בניסוח של עדי: תשובה אוטומטית בתוך שיחה פתוחה
  // ("קיבלנו את פנייתך") נושאת `Auto-Submitted`, נופלת לרעש בצדק — ואם היא
  // מאורכבת, השרשור נעלם מהעין באמצע שיחה חיה.
  const activeThreads = new Set<string>();
  for (const { msg, triage, detection } of triaged) {
    if (triage.verdict !== 'noise' || looksLikeInvoice(detection)) {
      if (msg.threadId) activeThreads.add(msg.threadId);
    }
  }

  // --- דומיינים שהתכתבנו איתם. וטו ברמת הדומיין, לא הכתובת. ---
  const correspondentDomains = new Set(
    (input.sentAddresses ?? []).map((a) => domainOf(normalizeAddress(a))).filter(Boolean),
  );

  const candidates: ArchiveCandidate[] = triaged.map(({ msg, triage, detection }) => {
    const fromDomain = domainOf(msg.fromAddress);
    const history = input.briefHistory?.[msg.messageId];
    const ledgerEntry = senders[triage.matchedDomainKey ?? fromDomain];

    return {
      itemId: msg.messageId,
      fromDomain,
      filterVerdict: triage.verdict,
      filterReason: triage.reason,
      looksLikeInvoice: looksLikeInvoice(detection),
      hasAttachment: (msg.attachments?.length ?? 0) > 0,
      isCorrespondentDomain: correspondentDomains.has(fromDomain),
      threadActive: Boolean(msg.threadId && activeThreads.has(msg.threadId)),
      isInstitutional: isInstitutionalDomain(fromDomain) || Boolean(ledgerEntry?.neverAutoNoise),
      // ★★ כלל 11. נגזר משולח ונושא בלבד, ולא מפענוח מוצלח — הזמנה שלא
      // הצלחתי לקרוא היא בדיוק זו שהכי חשוב שתישאר מול העיניים.
      isOrderMessage: isOrderMessage(msg),
      ledgerVerdictTrusted:
        triage.reason === 'senderLedger' ? ledgerVerdictMayArchive(ledgerEntry) : true,
      userPinned: input.pinnedIds?.has(msg.messageId) ?? false,
      firstSeenInBriefAt: history?.firstSeenInBriefAt ?? null,
      briefAppearances: history?.briefAppearances ?? 0,
    };
  });

  const run = planArchiveRun(candidates, opts);

  const actions: PlannedAction[] = triaged.map(({ msg, triage }, i) => {
    const c = candidates[i];
    const decision = run.decisions.get(msg.messageId) ?? archiveDecision(c, opts);
    return {
      itemId: msg.messageId,
      fromDomain: c.fromDomain,
      receivedAt: msg.receivedAt,
      subject: triage.verdict === 'noise' ? null : String(msg.subject ?? ''),
      triage,
      decision,
      labels: labelsFor({
        filterVerdict: triage.verdict,
        isOrderMessage: c.isOrderMessage === true,
        looksLikeInvoice: c.looksLikeInvoice === true,
        actionRequired: triage.verdict === 'signal',
        needsHumanReview: false,
      }),
      looksLikeInvoice: c.looksLikeInvoice === true,
    };
  });

  const willArchive = actions.filter((a) => a.decision.action === 'archive');
  const willStay = actions.filter((a) => a.decision.action === 'keep');
  const willLabelOnly = willStay.filter((a) => a.labels.length > 0);

  return { actions, run, willArchive, willStay, willLabelOnly };
}

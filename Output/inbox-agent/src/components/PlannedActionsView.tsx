// ============================================================================
// PlannedActionsView.tsx — ★ "מה עומד לקרות".
//
// ---------------------------------------------------------------------------
// המסך שבו נבנה האמון, ולכן הוא כתוב אחרת מכל השאר
// ---------------------------------------------------------------------------
// הוא מנוסח כ**הבטחה בגוף ראשון**: "אארכב 30 מיילים פרסומיים — כל אחד מהם
// חוזר בלחיצה". לא "30 פריטים סווגו כרעש", ולא טבלה של דגלים.
//
// הסיבה: בשלב הזה הסוכן עוד לא נגע בתיבה, והשאלה היחידה שמעניינת את בעלת
// העסק היא "ומה אם הוא טועה?". התשובה חייבת להיות על המסך, לא בתיעוד, ולא
// אחרי לחיצה על "עוד".
//
// ---------------------------------------------------------------------------
// ★ "ניתן להחזרה בלחיצה" — כתוב, ונכון
// ---------------------------------------------------------------------------
// כפתור "להשאיר בתיבה" יושב על **כל** שורה ברשימת הארכוב, לא מוסתר בתפריט,
// ולא דורש אישור. והוא לא רק מסיר מהרשימה הנוכחית — הוא נועץ את הפריט
// לתמיד (`archivePolicy.restoreArchived`), כך ש"החזרתי ומחר זה ירד שוב" לא
// יכול לקרות. יש על זה מבחן, כי הבטחה על מסך בלי מבחן היא הבטחה.
// ============================================================================

import { useState } from 'react';
import type { PlannedAction, PlanResult } from '../utils/plannedActions';
import { Badge, Banner } from './ui/Badge';
import { t } from '../i18n';

const whenFmt = new Intl.DateTimeFormat('he-IL', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : whenFmt.format(d);
}

export interface PlannedActionsViewProps {
  plan: PlanResult;
  pinned: ReadonlySet<string>;
  canEdit: boolean;
  onKeep: (itemId: string) => void;
  onRelease: (itemId: string) => void;
}

export function PlannedActionsView({
  plan,
  pinned,
  canEdit,
  onKeep,
  onRelease,
}: PlannedActionsViewProps) {
  const { willArchive, willLabelOnly, run } = plan;
  const kept = plan.actions.filter((a) => pinned.has(a.itemId));

  return (
    <div className="space-y-5">
      {/* ★ ההבטחה. ראשונה על המסך, בגוף ראשון. */}
      <section className="rounded-xl border border-slate-300 bg-white p-4">
        <h2 className="text-base font-bold text-slate-900">{t('plannedTitle')}</h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-700">{t('plannedNothingYet')}</p>

        <p className="mt-3 text-lg font-semibold leading-relaxed text-slate-900">
          {run.tripped
            ? run.summaryHe.replace(/\*\*/g, '')
            : willArchive.length === 0
              ? t('plannedNoArchive')
              : `אארכב ${willArchive.length} מיילים פרסומיים — כל אחד מהם חוזר בלחיצה אחת.`}
        </p>

        {willLabelOnly.length > 0 ? (
          <p className="mt-2 text-sm text-slate-700">
            {`ועוד ${willLabelOnly.length} מיילים רק אסמן בתווית, בלי לגעת בהם.`}
          </p>
        ) : null}
      </section>

      {run.tripped ? (
        <Banner tone="danger" title={t('breakerTitle')}>
          {t('breakerBody')}
        </Banner>
      ) : null}

      {/* ★ מה שהוחזר — למעלה, כדי שהיא תראה שהלחיצה עבדה. */}
      {kept.length > 0 ? (
        <ActionGroup
          title={t('plannedKeptTitle')}
          subtitle={t('plannedKeptBody')}
          tone="quiet"
          actions={kept}
          canEdit={canEdit}
          buttonLabel={t('plannedRelease')}
          onAct={onRelease}
        />
      ) : null}

      <ActionGroup
        title={t('plannedArchiveTitle')}
        subtitle={t('plannedArchiveBody')}
        tone="archive"
        actions={willArchive}
        canEdit={canEdit}
        buttonLabel={t('plannedKeep')}
        onAct={onKeep}
        emptyText={t('plannedArchiveEmpty')}
      />

      <StayGroup actions={plan.willStay.filter((a) => !pinned.has(a.itemId))} />
    </div>
  );
}

// ---------------------------------------------------------------------------

function ActionGroup({
  title,
  subtitle,
  tone,
  actions,
  canEdit,
  buttonLabel,
  onAct,
  emptyText,
}: {
  title: string;
  subtitle: string;
  tone: 'archive' | 'quiet';
  actions: PlannedAction[];
  canEdit: boolean;
  buttonLabel: string;
  onAct: (itemId: string) => void;
  emptyText?: string;
}) {
  return (
    <section
      className={`rounded-xl border p-3 sm:p-4 ${
        tone === 'archive' ? 'border-slate-300 bg-white' : 'border-emerald-300 bg-emerald-50'
      }`}
    >
      <h3 className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-900">
        {title}
        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-300">
          {actions.length}
        </span>
      </h3>
      <p className="mt-1 text-xs leading-relaxed text-slate-600">{subtitle}</p>

      {actions.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">{emptyText ?? t('plannedNone')}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {actions.map((a) => (
            <li
              key={a.itemId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
            >
              <div className="min-w-0">
                {/* פריט שיאורכב אינו נושא כותרת — היא לא נשמרה מלכתחילה. */}
                <div className="text-sm font-medium text-slate-900">{a.subject ?? a.fromDomain}</div>
                <div className="mt-0.5 text-xs text-slate-600">
                  {a.subject ? `${a.fromDomain} · ` : ''}
                  {formatWhen(a.receivedAt)}
                </div>
                <div className="mt-1 text-xs leading-relaxed text-slate-700">
                  {a.decision.reasonHe}
                </div>
              </div>

              {canEdit ? (
                <button
                  type="button"
                  onClick={() => onAct(a.itemId)}
                  className="min-h-[44px] shrink-0 rounded-lg border border-slate-400 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                >
                  {buttonLabel}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------

/**
 * מה שנשאר, ולמה. מקופל כברירת מחדל: זו הרשימה הארוכה, ומי שפותח אותה
 * עושה זאת כדי לבדוק טענה ספציפית ("למה החשבונית הזאת נשארה?"). המספר
 * גלוי תמיד — הוא מה שמאפשר לוודא שכלום לא נעלם.
 */
function StayGroup({ actions }: { actions: PlannedAction[] }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
          {t('plannedStayTitle')}
          <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-300">
            {actions.length}
          </span>
        </h3>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="min-h-[44px] rounded-lg border border-slate-400 bg-white px-4 py-2 text-sm text-slate-800 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          {open ? t('plannedStayHide') : t('plannedStayShow')}
        </button>
      </div>

      {open ? (
        <ul className="mt-3 space-y-2">
          {actions.map((a) => (
            <li key={a.itemId} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-slate-900">
                  {a.subject ?? a.fromDomain}
                </span>
                {a.looksLikeInvoice ? <Badge tone="info">{t('badgeInvoice')}</Badge> : null}
              </div>
              <div className="mt-1 text-xs leading-relaxed text-slate-700">{a.decision.reasonHe}</div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
